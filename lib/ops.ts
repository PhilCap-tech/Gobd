/**
 * Transactional mail.
 *
 * Onboarding, Delivery, Readiness, Magic-Link, Failed Payment und Failed Job
 * gehen über Resend, wenn Mail-Env gesetzt ist.
 * HTML läuft durch wrapTransactionalHtml. Ohne Env: bisheriger Log-Stub, kein Versand.
 * Die Weitergabe steht in der Liefermail. Es gibt keine zweite Mail dazu.
 */

import { createHash } from "node:crypto";
import { CUSTOMER_ONBOARDING_NEXT_PATH, magicLinkUrl } from "@/lib/auth";
import { isMailConfigured } from "@/lib/env";
import type { MailResult } from "@/lib/mail";
import {
  MAGIC_LINK_WINDOW_MS,
  deliveryMailKey,
  failedJobMailKey,
  failedPaymentMailKey,
  magicLinkMailKey,
  onboardingMailKey,
  partnerInquiryMailKey,
  sendDedupedEmail,
} from "@/lib/mail-dedupe";
import { isCompAccessEmail } from "@/lib/comp-access";
import { isTestEntity } from "@/lib/test-entities";
import { ACCOUNT_PAID_CTA_LABEL } from "@/lib/offer-copy";
import { isPilotPaymentFailedExempt } from "@/lib/pilot-exemptions";
import {
  escapeAttr,
  escapeHtml,
  MAIL_ACCOUNT_URL,
  MAIL_CHECKOUT_URL,
  MAIL_FAQ_URL,
  MAIL_LOGIN_URL,
  MAIL_SUPPORT_EMAIL,
  transactionalPrimaryButton,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";
import {
  getAccountProfile,
  listDocumentsByEmail,
  listEntitiesByEmail,
} from "@/lib/store";
import {
  KANZLEI_PILOT_MONTHLY_EUR,
  KANZLEI_PILOT_MONTHLY_GROSS_LABEL,
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  SETUP_GROSS_LABEL,
  V2_ENTRY_CENTS,
  V2_MEMBER_YEAR_CENTS,
  netWithGrossCents,
} from "@/lib/pricing";
import { isPricingV2 } from "@/lib/pricing-model";
import { PARTNER_PROBE_MAIL_INTRO_V2, PARTNER_PROBE_MAIL_OFFER_V2 } from "@/lib/plan-copy";
import { answersFromSheetRow } from "@/lib/types";

export type OpsResult = {
  stub: boolean;
  sent: boolean;
  /** Kein Versand: keine Adresse oder Pilot-Exemption. */
  skipped?: boolean;
  action:
    | "onboarding"
    | "failed_payment"
    | "failed_job"
    | "delivery"
    | "readiness"
    | "partner_inquiry";
};

export type TransactionalMailContent = {
  subject: string;
  text: string;
  html: string;
};

/** A settled claim already delivered this mail. Callers treat that as success. */
function claimedMail(
  result: MailResult,
  action: OpsResult["action"],
  inflightAsSent = false,
): OpsResult & MailResult {
  if (result.duplicate && (!result.inflight || inflightAsSent)) {
    return { ...result, sent: true, action };
  }
  return { ...result, action };
}

const CHECKOUT_CTA = ACCOUNT_PAID_CTA_LABEL;
const READINESS_MICRO =
  "14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde · Keine Steuerberatung · Entwurf für Ihren Steuerberater";

/** Exact product URL for the short share section in the delivery mail. */
export const REFERRAL_AFTER_DELIVERY_URL =
  "https://www.gobd-doku-erstellen.de/?utm_source=referral&utm_medium=email&utm_campaign=post_delivery";
/** One price line. The delivery mail includes this at most once. */
export const REFERRAL_MICRO = isPricingV2()
  ? `${netWithGrossCents(V2_ENTRY_CENTS)} einmalig, optional Jahresmitgliedschaft ${netWithGrossCents(V2_MEMBER_YEAR_CENTS)} pro Jahr, zzgl. 19 % USt · 14 Tage Geld zurück, solange noch kein PDF erzeugt wurde · Keine Steuerberatung`
  : `${SETUP_EUR} € netto (${SETUP_GROSS_LABEL} € brutto) + ${MONTHLY_EUR} €/Monat netto (${MONTHLY_GROSS_LABEL} € brutto), inkl. 19 % USt · 14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde · Keine Steuerberatung`;

/** Closes every customer mail, including the partner pilot. */
export const CUSTOMER_MAIL_SIGNATURE = "Ihr Team von GoBD Verfahrensdoku";

export function buildMagicLinkMail(input: {
  magicLinkUrl: string;
}): TransactionalMailContent {
  const text = wrapTransactionalText(
    [
      "Guten Tag,",
      "",
      "hier ist Ihr Anmeldelink für GoBD Verfahrensdoku (20 Minuten gültig):",
      input.magicLinkUrl,
      "",
      "Wenn Sie das nicht angefordert haben, können Sie diese Mail ignorieren.",
      "",
      CUSTOMER_MAIL_SIGNATURE,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>hier ist Ihr Anmeldelink für GoBD Verfahrensdoku (20 Minuten gültig):</p>
    <p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden</a></p>
    <p>Wenn Sie das nicht angefordert haben, können Sie diese Mail ignorieren.</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return {
    subject: "Ihr Anmeldelink — GoBD Verfahrensdoku",
    text,
    html,
  };
}

export function buildReadinessMail(input: {
  name?: string;
  /** Firm names that must not be used as the greeting. */
  company?: string;
  brancheLabel: string;
  downloadUrl: string;
  magicLinkUrl?: string;
}): TransactionalMailContent {
  const greeting = customerOnboardingGreeting(input.name, [input.company]);
  const lines = [
    greeting,
    "",
    `Ihr Readiness-Ergebnis für ${input.brancheLabel} ist da — der Leitfaden zeigt Lücken. Die volle Verfahrensdokumentation fehlt noch.`,
    "",
    `Download (Arbeitshilfe, keine Verfahrensdokumentation): ${input.downloadUrl}`,
  ];
  if (input.magicLinkUrl) {
    lines.push(
      `Späterer Zugang (Magic Link, 20 Minuten gültig): ${input.magicLinkUrl}`,
    );
  }
  lines.push(
    "",
    CHECKOUT_CTA,
    MAIL_CHECKOUT_URL,
    "",
    READINESS_MICRO,
    "",
    CUSTOMER_MAIL_SIGNATURE,
  );
  const html = wrapTransactionalHtml(`
    <p>${escapeHtml(greeting)}</p>
    <p>Ihr Readiness-Ergebnis für ${escapeHtml(input.brancheLabel)} ist da — der Leitfaden zeigt Lücken. Die volle Verfahrensdokumentation fehlt noch.</p>
    <p><a href="${escapeAttr(input.downloadUrl)}">PDF herunterladen</a> (Arbeitshilfe, keine Verfahrensdokumentation)</p>
    ${input.magicLinkUrl ? `<p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden (Magic Link, 20 Minuten gültig)</a></p>` : ""}
    <p><a href="${escapeAttr(MAIL_CHECKOUT_URL)}">${escapeHtml(CHECKOUT_CTA)}</a></p>
    <p>${escapeHtml(READINESS_MICRO)}</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return {
    subject: "Ihr Readiness-Ergebnis — nächster Schritt zur Verfahrensdokumentation",
    text: wrapTransactionalText(lines.join("\n")),
    html,
  };
}

export type OnboardingAudience = "kunde" | "steuerberater";

export const CUSTOMER_ONBOARDING_SIGNATURE = CUSTOMER_MAIL_SIGNATURE;
export const PARTNER_ONBOARDING_SIGNATURE = CUSTOMER_MAIL_SIGNATURE;

const CUSTOMER_ONBOARDING_SUBJECT =
  "Willkommen — nächste Schritte zu Ihrer Verfahrensdokumentation";
const CUSTOMER_ONBOARDING_DISCLAIMER =
  "Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus Ihren Angaben.";
const CUSTOMER_ONBOARDING_CTA = "Jetzt starten: Betriebs-Check";
export const CUSTOMER_ONBOARDING_CONTINUE_CTA = "Verfahrensdokumentation weiter ausfüllen";

/**
 * Intake des Kaufs. Die Session ist der Schlüssel des Server-Entwurfs
 * (`session:<id>:gesamt`). Ohne gültige Session bleibt `/intake`; die Seite
 * hängt dann die letzte bezahlte Session der angemeldeten Adresse an.
 */
export function customerOnboardingDraftPath(sessionId?: string | null): string {
  const id = sessionId?.trim() ?? "";
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return CUSTOMER_ONBOARDING_NEXT_PATH;
  return `${CUSTOMER_ONBOARDING_NEXT_PATH}?session_id=${id}`;
}

/** Trim, drop control chars, collapse whitespace. Empty stays empty. */
export function normalizeOnboardingName(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function foldOnboardingName(value: string): string {
  return normalizeOnboardingName(value).toLocaleLowerCase("de-DE");
}

export function onboardingNamesEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = foldOnboardingName(left ?? "");
  const b = foldOnboardingName(right ?? "");
  return Boolean(a) && a === b;
}

function matchesKnownCompany(
  name: string,
  companyNames: Array<string | null | undefined> | undefined,
): boolean {
  return (companyNames ?? []).some((company) => onboardingNamesEqual(name, company));
}

/**
 * Person to greet. First non-empty candidate that is not a known company name.
 * Priority: account-hub profile, then Stripe checkout name (individual name
 * before customer_details.name), then Geschäftsführung / Bestätigung from
 * existing intake rows for this e-mail. Entity rows have no person field —
 * their names only extend the company blocklist.
 */
export function pickOnboardingContactName(input: {
  profileName?: string | null;
  checkoutNames?: Array<string | null | undefined>;
  intakeContactNames?: Array<string | null | undefined>;
  companyNames?: Array<string | null | undefined>;
}): string {
  const candidates = [
    input.profileName,
    ...(input.checkoutNames ?? []),
    ...(input.intakeContactNames ?? []),
  ];
  for (const candidate of candidates) {
    const name = normalizeOnboardingName(candidate);
    if (!name || matchesKnownCompany(name, input.companyNames)) continue;
    return name;
  }
  return "";
}

/** „Guten Tag {Name},“ or exactly „Guten Tag,“ when no person name is usable. */
export function customerOnboardingGreeting(
  contactName?: string | null,
  companyNames?: Array<string | null | undefined>,
): string {
  const name = pickOnboardingContactName({
    profileName: contactName,
    companyNames,
  });
  return name ? `Guten Tag ${name},` : "Guten Tag,";
}

type IntakeContactSource = {
  gf?: string;
  bestaetigungName?: string;
  katalog?: Record<string, { values?: Record<string, unknown> } | undefined>;
};

/** Geschäftsführung, sonst Bestätigungsname, sonst Katalog A01. */
export function intakeContactNameFromAnswers(answers: IntakeContactSource): string {
  const direct = normalizeOnboardingName(answers.gf);
  if (direct) return direct;
  const confirmed = normalizeOnboardingName(answers.bestaetigungName);
  if (confirmed) return confirmed;
  const catalogGf = answers.katalog?.A01?.values?.gf;
  return typeof catalogGf === "string" ? normalizeOnboardingName(catalogGf) : "";
}

export function checkoutContactFromCustomerDetails(
  details:
    | {
        name?: string | null;
        business_name?: string | null;
        individual_name?: string | null;
      }
    | null
    | undefined,
): { checkoutNames: string[]; extraCompanyNames: string[] } {
  if (!details) return { checkoutNames: [], extraCompanyNames: [] };
  return {
    checkoutNames: [details.individual_name ?? "", details.name ?? ""],
    extraCompanyNames: [details.business_name ?? ""],
  };
}

function customerOnboardingStartUrl(magicLinkUrlValue?: string): string {
  const direct = magicLinkUrlValue?.trim() ?? "";
  if (direct) return direct;
  return `${MAIL_LOGIN_URL}?next=${encodeURIComponent(CUSTOMER_ONBOARDING_NEXT_PATH)}`;
}

function buildCustomerOnboardingMail(input: {
  company?: string;
  contactName?: string;
  magicLinkUrl?: string;
  /** Magic-Link in den Server-Entwurf. Fehlt er, gilt derselbe Startlink. */
  continueUrl?: string;
}): TransactionalMailContent {
  const greeting = customerOnboardingGreeting(input.contactName, [input.company]);
  const startUrl = customerOnboardingStartUrl(input.magicLinkUrl);
  const continueUrl = input.continueUrl?.trim() || startUrl;
  const text = wrapTransactionalText(
    [
      greeting,
      "",
      "vielen Dank für Ihre Bestellung bei gobd-doku-erstellen.de. So geht es weiter:",
      "",
      "1. Betriebs-Check: ein paar Fragen zu Ihrem Betrieb. Daraus ergibt sich, welche der 24 Module für Sie gelten. Antworten, die Sie jetzt nicht zur Hand haben, füllen Sie später aus.",
      "2. Module ausfüllen – oder „Später ausfüllen“ wählen. Der Entwurf wird gespeichert. Offene Module erscheinen als To-dos in Ihrem Konto, dort können Sie jederzeit weiterarbeiten.",
      "3. Gesamt-PDF erstellen – mit Vollständigkeitsübersicht, welche Module beschrieben, anderweitig dokumentiert oder noch offen sind.",
      "",
      CUSTOMER_ONBOARDING_CTA,
      startUrl,
      "",
      "Der Button meldet Sie direkt an (Link 20 Minuten gültig). Ist er abgelaufen, senden Sie sich auf der nächsten Seite einen neuen Link – Sie landen danach wieder bei Ihrem Entwurf.",
      "",
      CUSTOMER_ONBOARDING_CONTINUE_CTA,
      continueUrl,
      "",
      "Der Link meldet Sie an und öffnet Ihren gespeicherten Entwurf im Fragebogen.",
      "",
      `Ihr Konto: ${MAIL_ACCOUNT_URL}`,
      "",
      "Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:",
      MAIL_FAQ_URL,
      "",
      `Ihr Ansprechpartner: ${MAIL_SUPPORT_EMAIL}. Antworten auf diese E-Mail erreichen uns unter dieser Adresse.`,
      "",
      CUSTOMER_ONBOARDING_DISCLAIMER,
      "",
      CUSTOMER_ONBOARDING_SIGNATURE,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>${escapeHtml(greeting)}</p>
    <p>vielen Dank für Ihre Bestellung bei gobd-doku-erstellen.de. So geht es weiter:</p>
    <ol>
      <li><strong>Betriebs-Check:</strong> ein paar Fragen zu Ihrem Betrieb. Daraus ergibt sich, welche der 24 Module für Sie gelten. Antworten, die Sie jetzt nicht zur Hand haben, füllen Sie später aus.</li>
      <li><strong>Module ausfüllen</strong> – oder „Später ausfüllen“ wählen. Der Entwurf wird gespeichert. Offene Module erscheinen als To-dos in Ihrem Konto, dort können Sie jederzeit weiterarbeiten.</li>
      <li><strong>Gesamt-PDF erstellen</strong> – mit Vollständigkeitsübersicht, welche Module beschrieben, anderweitig dokumentiert oder noch offen sind.</li>
    </ol>
    <p>${transactionalPrimaryButton(startUrl, CUSTOMER_ONBOARDING_CTA)}</p>
    <p>Der Button meldet Sie direkt an (Link 20 Minuten gültig). Ist er abgelaufen, senden Sie sich auf der nächsten Seite einen neuen Link – Sie landen danach wieder bei Ihrem Entwurf.</p>
    <p>${transactionalPrimaryButton(continueUrl, CUSTOMER_ONBOARDING_CONTINUE_CTA)}</p>
    <p>Der Link meldet Sie an und öffnet Ihren gespeicherten Entwurf im Fragebogen.</p>
    <p>Ihr Konto: <a href="${escapeAttr(MAIL_ACCOUNT_URL)}">${escapeHtml(MAIL_ACCOUNT_URL)}</a></p>
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Ihr Ansprechpartner: <a href="${escapeAttr(`mailto:${MAIL_SUPPORT_EMAIL}`)}">${escapeHtml(MAIL_SUPPORT_EMAIL)}</a>. Antworten auf diese E-Mail erreichen uns unter dieser Adresse.</p>
    <p>${escapeHtml(CUSTOMER_ONBOARDING_DISCLAIMER)}</p>
    <p>${escapeHtml(CUSTOMER_ONBOARDING_SIGNATURE)}</p>
  `);
  return {
    subject: CUSTOMER_ONBOARDING_SUBJECT,
    text,
    html,
  };
}

export function buildOnboardingMail(input: {
  company?: string;
  audience?: OnboardingAudience;
  contactName?: string;
  magicLinkUrl?: string;
  continueUrl?: string;
}): TransactionalMailContent {
  if (input.audience === "steuerberater") return buildSteuerberaterOnboardingMail(input);
  return buildCustomerOnboardingMail(input);
}

/** Partner-Pilot. Sie-Form. Kein Soft-Invite an weitere Kanzleien. */
function buildSteuerberaterOnboardingMail(input: {
  company?: string;
}): TransactionalMailContent {
  const company = input.company?.trim();
  const greeting = company ? `Guten Tag ${company},` : "Guten Tag,";
  // v2: Umstellung auf Kanzlei-Probedurchlauf, Texte Legal Do 29.10. (TODO-LEGAL).
  const v2 = isPricingV2();
  const intro = v2 ? PARTNER_PROBE_MAIL_INTRO_V2 : "vielen Dank für Ihre Bestellung im Partner-Pilot.";
  const offer = v2
    ? PARTNER_PROBE_MAIL_OFFER_V2
    : `Mit dem Code KANZLEI-PILOT sind Setup und die ersten zwei Monatsbeiträge 0 €. Danach ${KANZLEI_PILOT_MONTHLY_EUR} €/Monat netto (${KANZLEI_PILOT_MONTHLY_GROSS_LABEL} € brutto), inkl. 19 % USt, wenn Sie nicht kündigen.`;
  const text = wrapTransactionalText(
    [
      greeting,
      "",
      intro,
      "",
      "Nächste Schritte:",
      "1. Den Fragenkatalog im Intake ausfüllen (falls noch offen). Der Zwischenstand wird gespeichert; offene Module erscheinen als To-dos im Konto, „Später ausfüllen“ ist möglich.",
      "2. Das PDF herunterladen, sobald die Generierung fertig ist",
      `3. Konto: Anmeldung unter ${MAIL_LOGIN_URL}`,
      "",
      offer,
      "",
      "Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:",
      MAIL_FAQ_URL,
      "",
      `Support: ${MAIL_SUPPORT_EMAIL}`,
      "",
      "Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus den Angaben. Sie füllen sie nicht für einen Mandanten aus.",
      "",
      PARTNER_ONBOARDING_SIGNATURE,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(intro)}</p>
    <p>Nächste Schritte:</p>
    <ol>
      <li>Den Fragenkatalog im Intake ausfüllen (falls noch offen). Der Zwischenstand wird gespeichert; offene Module erscheinen als To-dos im Konto, „Später ausfüllen“ ist möglich.</li>
      <li>Das PDF herunterladen, sobald die Generierung fertig ist</li>
      <li>Konto: Anmeldung unter <a href="${escapeAttr(MAIL_LOGIN_URL)}">${escapeHtml(MAIL_LOGIN_URL)}</a></li>
    </ol>
    <p>${escapeHtml(offer)}</p>
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(MAIL_SUPPORT_EMAIL)}</p>
    <p>Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus den Angaben. Sie füllen sie nicht für einen Mandanten aus.</p>
    <p>${escapeHtml(PARTNER_ONBOARDING_SIGNATURE)}</p>
  `);
  return {
    subject: "Willkommen — nächste Schritte zu Ihrer Verfahrensdokumentation",
    text,
    html,
  };
}

export function buildFailedPaymentMail(): TransactionalMailContent {
  const text = wrapTransactionalText(
    [
      "Guten Tag,",
      "",
      "eine Zahlung für Ihr GoBD-Abo ist fehlgeschlagen. Bitte aktualisieren Sie das Zahlungsmittel im Kundenportal:",
      MAIL_ACCOUNT_URL,
      "",
      `Fragen: ${MAIL_FAQ_URL}`,
      `Support: ${MAIL_SUPPORT_EMAIL}`,
      "",
      CUSTOMER_MAIL_SIGNATURE,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>eine Zahlung für Ihr GoBD-Abo ist fehlgeschlagen. Bitte aktualisieren Sie das Zahlungsmittel im Kundenportal:</p>
    <p><a href="${escapeAttr(MAIL_ACCOUNT_URL)}">${escapeHtml(MAIL_ACCOUNT_URL)}</a></p>
    <p>Fragen: <a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(MAIL_SUPPORT_EMAIL)}</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return {
    subject: "Zahlung fehlgeschlagen — bitte prüfen",
    text,
    html,
  };
}

export function buildFailedJobMail(): TransactionalMailContent {
  const text = wrapTransactionalText(
    [
      "Guten Tag,",
      "",
      "bei der Erstellung Ihrer Verfahrensdokumentation ist ein technischer Fehler aufgetreten. Wir prüfen das und melden uns.",
      "",
      `Zwischenzeitlich: ${MAIL_FAQ_URL}`,
      `Support: ${MAIL_SUPPORT_EMAIL}`,
      "",
      CUSTOMER_MAIL_SIGNATURE,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>bei der Erstellung Ihrer Verfahrensdokumentation ist ein technischer Fehler aufgetreten. Wir prüfen das und melden uns.</p>
    <p>Zwischenzeitlich: <a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(MAIL_SUPPORT_EMAIL)}</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return {
    subject: "Technisches Problem bei der Erstellung — wir kümmern uns",
    text,
    html,
  };
}

const DELIVERY_SHARE_INTRO =
  "Wenn Ihr Steuerberater oder ein Kollege ebenfalls eine prüfbare Verfahrensdokumentation braucht, können Sie diesen Link weitergeben:";

export function buildDeliveryMail(input: {
  company?: string;
  /** Person. A company name is ignored; the greeting then stays „Guten Tag,“. */
  contactName?: string;
  downloadUrl: string;
  magicLinkUrl?: string;
  successUrl?: string;
  version?: number;
}): TransactionalMailContent {
  const version = input.version && input.version > 0 ? input.version : 1;
  const greeting = customerOnboardingGreeting(input.contactName, [input.company]);
  const lines = [
    greeting,
    "",
    `Ihr Entwurf der Verfahrensdokumentation (Version ${version}) ist fertig.`,
    "",
    `Download: ${input.downloadUrl}`,
  ];
  if (input.successUrl) {
    lines.push(`Übersicht: ${input.successUrl}`);
  }
  if (input.magicLinkUrl) {
    lines.push(`Konto (Magic Link, 20 Minuten gültig): ${input.magicLinkUrl}`);
  }
  lines.push(
    "",
    "Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:",
    MAIL_FAQ_URL,
    "",
    "Keine Steuerberatung. Das PDF ist ein Entwurf zur Abstimmung mit Ihrem Steuerberater.",
    "",
    "Gern weitergeben",
    "",
    DELIVERY_SHARE_INTRO,
    REFERRAL_AFTER_DELIVERY_URL,
    "",
    REFERRAL_MICRO,
    "",
    CUSTOMER_MAIL_SIGNATURE,
  );
  const html = wrapTransactionalHtml(`
    <p>${escapeHtml(greeting)}</p>
    <p>Ihr Entwurf der Verfahrensdokumentation (Version ${version}) ist fertig.</p>
    <p><a href="${escapeAttr(input.downloadUrl)}">PDF herunterladen</a></p>
    ${input.successUrl ? `<p><a href="${escapeAttr(input.successUrl)}">Zur Übersicht</a></p>` : ""}
    ${input.magicLinkUrl ? `<p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden (Magic Link, 20 Minuten gültig)</a></p>` : ""}
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Keine Steuerberatung. Das PDF ist ein Entwurf zur Abstimmung mit Ihrem Steuerberater.</p>
    <p><strong>Gern weitergeben</strong></p>
    <p>${escapeHtml(DELIVERY_SHARE_INTRO)}</p>
    <p><a href="${escapeAttr(REFERRAL_AFTER_DELIVERY_URL)}">${escapeHtml(REFERRAL_AFTER_DELIVERY_URL)}</a></p>
    <p>${escapeHtml(REFERRAL_MICRO)}</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return {
    subject: "Ihr Entwurf der Verfahrensdokumentation",
    text: wrapTransactionalText(lines.join("\n")),
    html,
  };
}

async function lookupOnboardingContactSources(email: string): Promise<{
  profileName: string;
  intakeContactNames: string[];
  companyNames: string[];
}> {
  const [profile, entities, documents] = await Promise.all([
    getAccountProfile(email),
    listEntitiesByEmail(email),
    listDocumentsByEmail(email),
  ]);
  return {
    profileName: profile?.name ?? "",
    intakeContactNames: documents.map((doc) =>
      intakeContactNameFromAnswers(answersFromSheetRow(doc)),
    ),
    companyNames: [
      ...entities.map((entity) => entity.name),
      ...documents.map((doc) => doc.company),
    ],
  };
}

export async function triggerOnboardingMail(input: {
  email: string;
  company?: string;
  sessionId?: string;
  audience?: OnboardingAudience;
  /** Stripe `customer_details.individual_name`, then `customer_details.name`. */
  checkoutNames?: string[];
  /** Firm names that must not be used as a greeting (metadata, business_name). */
  extraCompanyNames?: string[];
  /** Resend key. Same checkout session must not send a second order mail. */
  idempotencyKey?: string;
  /** Firm id. A listed test firm does not receive the order mail. */
  entityId?: string | null;
}): Promise<OpsResult & MailResult> {
  if (isTestEntity(input.entityId)) {
    console.info("[ops] onboarding mail übersprungen — Testfirma", {
      sessionId: input.sessionId,
    });
    return { stub: false, sent: false, skipped: true, action: "onboarding" };
  }
  if (isCompAccessEmail(input.email)) {
    console.info("[ops] onboarding mail übersprungen — kostenfreier Zugang", {
      sessionId: input.sessionId,
    });
    return { stub: false, sent: false, skipped: true, action: "onboarding" };
  }

  const audience = input.audience === "steuerberater" ? "steuerberater" : "kunde";
  if (!isMailConfigured()) {
    console.info("[ops] onboarding mail stub", {
      email: input.email,
      company: input.company,
      sessionId: input.sessionId,
      audience,
    });
    return { stub: true, sent: false, action: "onboarding" };
  }

  if (!input.email.trim()) {
    console.info("[ops] onboarding mail übersprungen — keine E-Mail", {
      sessionId: input.sessionId,
    });
    return { stub: true, sent: false, action: "onboarding" };
  }

  let contactName = "";
  let startUrl: string | undefined;
  let continueUrl: string | undefined;
  if (audience === "kunde") {
    const companyNames = [input.company ?? "", ...(input.extraCompanyNames ?? [])];
    let profileName = "";
    let intakeContactNames: string[] = [];
    try {
      const found = await lookupOnboardingContactSources(input.email);
      profileName = found.profileName;
      intakeContactNames = found.intakeContactNames;
      companyNames.push(...found.companyNames);
    } catch (error) {
      console.warn("[ops] Ansprechperson nicht geladen — Fallback auf Checkout-Name", error);
    }
    contactName = pickOnboardingContactName({
      profileName,
      checkoutNames: input.checkoutNames,
      intakeContactNames,
      companyNames,
    });
    const start = await magicLinkUrl(input.email, CUSTOMER_ONBOARDING_NEXT_PATH);
    const draft = await magicLinkUrl(input.email, customerOnboardingDraftPath(input.sessionId));
    if (!start || !draft) {
      console.error("[ops] Anmeldelink nicht gespeichert", { sessionId: input.sessionId });
      return { stub: false, sent: false, action: "onboarding" };
    }
    startUrl = start;
    continueUrl = draft;
  }

  const mail = buildOnboardingMail({
    company: input.company,
    audience,
    contactName,
    magicLinkUrl: startUrl,
    continueUrl,
  });
  const sessionId = input.sessionId?.trim() ?? "";
  const result = await sendDedupedEmail({
    dedupeKey: sessionId
      ? onboardingMailKey(sessionId)
      : input.idempotencyKey?.trim() || onboardingMailKey(input.email.trim().toLowerCase()),
    to: input.email,
    replyTo: MAIL_SUPPORT_EMAIL,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  console.info("[ops] onboarding mail", {
    email: input.email,
    sessionId: input.sessionId,
    audience,
    sent: result.sent,
    stub: result.stub,
  });
  return claimedMail(result, "onboarding");
}

export async function handleFailedPayment(input: {
  email?: string;
  sessionId?: string;
  invoiceId?: string;
  /** Stripe `event.id`, used when the invoice has no id. */
  eventId?: string;
  customerId?: string;
  reason?: string;
  /** Firm id from the invoice or subscription metadata. */
  entityId?: string | null;
}): Promise<OpsResult & MailResult> {
  if (isTestEntity(input.entityId)) {
    console.info("[ops] payment-failed übersprungen — Testfirma");
    return { stub: false, sent: false, skipped: true, action: "failed_payment" };
  }
  const email = input.email?.trim() ?? "";
  if (isPilotPaymentFailedExempt(email)) {
    console.info(`[ops] payment-failed skipped: pilot exemption ${email}`);
    return {
      stub: false,
      sent: false,
      skipped: true,
      action: "failed_payment",
    };
  }

  if (!isMailConfigured()) {
    console.warn("[ops] failed payment stub", input);
    return { stub: true, sent: false, action: "failed_payment" };
  }

  if (!email) {
    console.warn("[ops] failed payment übersprungen — keine E-Mail", input);
    return { stub: true, sent: false, action: "failed_payment" };
  }

  const mail = buildFailedPaymentMail();
  const anchor =
    input.invoiceId?.trim() ||
    input.eventId?.trim() ||
    input.sessionId?.trim() ||
    email.toLowerCase();
  const result = await sendDedupedEmail({
    dedupeKey: failedPaymentMailKey(anchor),
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  console.warn("[ops] failed payment mail", {
    email,
    sessionId: input.sessionId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    reason: input.reason,
    sent: result.sent,
    stub: result.stub,
  });
  return claimedMail(result, "failed_payment");
}

export async function handleFailedJob(input: {
  email?: string;
  sessionId?: string;
  job?: string;
  reason?: string;
  /** Firm id, when the failed job belongs to a checkout. */
  entityId?: string | null;
}): Promise<OpsResult & MailResult> {
  if (isTestEntity(input.entityId)) {
    console.info("[ops] failed job übersprungen — Testfirma");
    return { stub: false, sent: false, skipped: true, action: "failed_job" };
  }
  const email = input.email?.trim() ?? "";
  if (!isMailConfigured()) {
    console.warn("[ops] failed job stub", input);
    return { stub: true, sent: false, action: "failed_job" };
  }

  if (!email) {
    console.warn("[ops] failed job übersprungen — keine E-Mail", input);
    return { stub: true, sent: false, action: "failed_job" };
  }

  const mail = buildFailedJobMail();
  const result = await sendDedupedEmail({
    dedupeKey: failedJobMailKey(
      input.sessionId?.trim() || email.toLowerCase(),
      input.job?.trim() || input.reason?.trim() || "job",
    ),
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  console.warn("[ops] failed job mail", {
    email,
    sessionId: input.sessionId,
    job: input.job,
    reason: input.reason,
    sent: result.sent,
    stub: result.stub,
  });
  return claimedMail(result, "failed_job");
}

export async function sendDeliveryMail(input: {
  email: string;
  company?: string;
  downloadUrl: string;
  magicLinkUrl?: string;
  successUrl?: string;
  documentId?: string;
  version?: number;
  /** Firm the document belongs to. A listed test firm gets no delivery mail. */
  entityId?: string | null;
}): Promise<OpsResult & MailResult> {
  if (isTestEntity(input.entityId)) {
    console.info("[ops] delivery mail übersprungen — Testfirma");
    return { stub: false, sent: false, skipped: true, action: "delivery" };
  }
  if (isCompAccessEmail(input.email)) {
    console.info("[ops] delivery mail übersprungen — kostenfreier Zugang");
    return { stub: false, sent: false, skipped: true, action: "delivery" };
  }

  if (!input.email.trim()) {
    console.info("[ops] delivery mail übersprungen — keine E-Mail");
    return { stub: true, sent: false, action: "delivery" };
  }

  let contactName = "";
  try {
    const found = await lookupOnboardingContactSources(input.email);
    contactName = pickOnboardingContactName({
      profileName: found.profileName,
      intakeContactNames: found.intakeContactNames,
      companyNames: [input.company ?? "", ...found.companyNames],
    });
  } catch (error) {
    console.warn("[ops] Ansprechperson für die Liefermail nicht geladen", error);
  }

  const mail = buildDeliveryMail({ ...input, contactName });
  const documentId = input.documentId?.trim() ?? "";
  const dedupeKey =
    documentId && input.version != null
      ? deliveryMailKey(documentId, input.version)
      : documentId
        ? `delivery:${documentId}`
        : `delivery:${input.email.trim().toLowerCase()}:${input.downloadUrl}`;
  const result = await sendDedupedEmail({
    dedupeKey,
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return claimedMail(result, "delivery");
}

export type PartnerInquiryMailInput = {
  name: string;
  kanzlei: string;
  email: string;
  mandantenZahl: string;
  message: string;
};

/** Inbound from /steuerberater. Sie-Form in the mail body is not required: this goes to Ops. No Soft-Invite. */
export function buildPartnerInquiryMail(
  input: PartnerInquiryMailInput,
): TransactionalMailContent {
  const kanzlei = input.kanzlei.replace(/[\r\n]+/g, " ").trim();
  const lines = [
    "Neue Anfrage von der Partnerseite /steuerberater (VD für mehrere Mandanten).",
    "",
    `Name: ${input.name}`,
    `Kanzlei: ${input.kanzlei}`,
    `E-Mail: ${input.email}`,
    `Grobe Mandanten-Zahl: ${input.mandantenZahl}`,
    "",
    "Nachricht:",
    input.message,
  ];
  const html = wrapTransactionalHtml(`
    <p>Neue Anfrage von der Partnerseite /steuerberater (VD für mehrere Mandanten).</p>
    <p>
      <strong>Name:</strong> ${escapeHtml(input.name)}<br />
      <strong>Kanzlei:</strong> ${escapeHtml(input.kanzlei)}<br />
      <strong>E-Mail:</strong> <a href="mailto:${escapeAttr(input.email)}">${escapeHtml(input.email)}</a><br />
      <strong>Grobe Mandanten-Zahl:</strong> ${escapeHtml(input.mandantenZahl)}
    </p>
    <p><strong>Nachricht:</strong><br />${escapeHtml(input.message).replaceAll("\n", "<br />")}</p>
  `);
  return {
    subject: `Anfrage: VD für mehrere Mandanten — ${kanzlei}`,
    text: wrapTransactionalText(lines.join("\n")),
    html,
  };
}

export async function sendPartnerInquiryMail(
  input: PartnerInquiryMailInput,
): Promise<OpsResult & MailResult> {
  const mail = buildPartnerInquiryMail(input);
  const canonical = [input.email, input.name, input.kanzlei, input.mandantenZahl, input.message]
    .map((part) => part.replace(/\s+/g, " ").trim().toLowerCase())
    .join("\n");
  const result = await sendDedupedEmail({
    dedupeKey: partnerInquiryMailKey(
      createHash("sha256").update(canonical).digest("hex").slice(0, 40),
    ),
    to: MAIL_SUPPORT_EMAIL,
    replyTo: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  // Keine personenbezogenen Daten im Log (Empfänger, Absender, Kanzlei).
  console.info("[ops] partner inquiry mail", {
    sent: result.sent,
    stub: result.stub,
  });
  return claimedMail(result, "partner_inquiry");
}

export async function sendReadinessMail(input: {
  email: string;
  name?: string;
  company?: string;
  brancheLabel: string;
  downloadUrl: string;
  successUrl?: string;
  magicLinkUrl?: string;
  /** Stable submission key. A new lead id must not bypass it. */
  dedupeKey?: string;
}): Promise<OpsResult & MailResult> {
  if (!input.email.trim()) {
    console.info("[ops] readiness mail übersprungen — keine E-Mail");
    return { stub: true, sent: false, action: "readiness" };
  }

  const mail = buildReadinessMail(input);
  const result = await sendDedupedEmail({
    dedupeKey:
      input.dedupeKey?.trim() ||
      `readiness:${input.email.trim().toLowerCase()}:${input.downloadUrl}`,
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return claimedMail(result, "readiness");
}

export async function sendMagicLinkMail(input: {
  email: string;
  magicLinkUrl: string;
}): Promise<OpsResult & MailResult> {
  const mail = buildMagicLinkMail(input);
  const result = await sendDedupedEmail({
    dedupeKey: magicLinkMailKey(input.email),
    windowMs: MAGIC_LINK_WINDOW_MS,
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return claimedMail(result, "onboarding", true);
}
