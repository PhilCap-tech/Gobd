/**
 * GoBD Ops.
 *
 * Onboarding, Delivery, Referral nach Delivery, Readiness, Magic-Link,
 * Failed Payment und Failed Job gehen über Resend, wenn Mail-Env gesetzt ist.
 * HTML läuft durch wrapTransactionalHtml. Ohne Env: bisheriger Log-Stub, kein Versand.
 * Referral hängt nur am Delivery-Erfolg (eigene Funktion), nicht an Onboarding,
 * Failed Job, Failed Payment oder Magic-Link.
 */

import { CUSTOMER_ONBOARDING_NEXT_PATH, magicLinkUrl } from "@/lib/auth";
import { isMailConfigured } from "@/lib/env";
import { sendEmail, type MailResult } from "@/lib/mail";
import { isPilotPaymentFailedExempt } from "@/lib/pilot-exemptions";
import {
  cancelReferralDelivery,
  completeReferralDelivery,
  referralDeliveryKey,
  referralIdempotencyKey,
  reserveReferralDelivery,
} from "@/lib/referral-sent";
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
import { answersFromSheetRow } from "@/lib/types";

export type OpsResult = {
  stub: boolean;
  sent: boolean;
  /** Kein Versand: keine Adresse, keine Delivery-Id, Referral schon gesendet, oder Pilot-Exemption. */
  skipped?: boolean;
  action:
    | "onboarding"
    | "failed_payment"
    | "failed_job"
    | "delivery"
    | "readiness"
    | "referral_after_delivery"
    | "partner_inquiry";
};

export type TransactionalMailContent = {
  subject: string;
  text: string;
  html: string;
};

const CHECKOUT_CTA = "Jetzt Verfahrensdokumentation erstellen — 149 € + 49 €/Mo";
const READINESS_MICRO =
  "14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde · Keine Steuerberatung · Entwurf für deinen Steuerberater";

/** Exact product URL from the Post-Delivery Referral spec (Track C). */
export const REFERRAL_AFTER_DELIVERY_URL =
  "https://www.gobd-doku-erstellen.de/?utm_source=referral&utm_medium=email&utm_campaign=post_delivery";
export const REFERRAL_AFTER_DELIVERY_SUBJECT =
  "Dein Entwurf ist fertig — gern an Steuerberater oder Kollegen weitergeben";
export const REFERRAL_MICRO =
  "149 € + 49 €/Monat, jeweils zzgl. USt · 14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde · Keine Steuerberatung";

export function buildMagicLinkMail(input: {
  magicLinkUrl: string;
}): TransactionalMailContent {
  const text = wrapTransactionalText(
    [
      "Hallo,",
      "",
      "hier ist dein Anmeldelink für GoBD Verfahrensdoku (20 Minuten gültig):",
      input.magicLinkUrl,
      "",
      "Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.",
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>Hallo,</p>
    <p>hier ist dein Anmeldelink für GoBD Verfahrensdoku (20 Minuten gültig):</p>
    <p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden</a></p>
    <p>Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.</p>
  `);
  return {
    subject: "Dein Anmeldelink — GoBD Verfahrensdoku",
    text,
    html,
  };
}

export function buildReadinessMail(input: {
  name?: string;
  brancheLabel: string;
  downloadUrl: string;
  magicLinkUrl?: string;
}): TransactionalMailContent {
  const greeting = input.name?.trim() ? `Hallo ${input.name.trim()},` : "Hallo,";
  const lines = [
    greeting,
    "",
    `dein Readiness-Ergebnis für ${input.brancheLabel} ist da — der Leitfaden zeigt Lücken. Die volle Verfahrensdokumentation fehlt noch.`,
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
  );
  const html = wrapTransactionalHtml(`
    <p>${escapeHtml(greeting)}</p>
    <p>dein Readiness-Ergebnis für ${escapeHtml(input.brancheLabel)} ist da — der Leitfaden zeigt Lücken. Die volle Verfahrensdokumentation fehlt noch.</p>
    <p><a href="${escapeAttr(input.downloadUrl)}">PDF herunterladen</a> (Arbeitshilfe, keine Verfahrensdokumentation)</p>
    ${input.magicLinkUrl ? `<p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden (Magic Link, 20 Minuten gültig)</a></p>` : ""}
    <p><a href="${escapeAttr(MAIL_CHECKOUT_URL)}">${escapeHtml(CHECKOUT_CTA)}</a></p>
    <p>${escapeHtml(READINESS_MICRO)}</p>
  `);
  return {
    subject: "Dein Readiness-Ergebnis — nächster Schritt zur Verfahrensdokumentation",
    text: wrapTransactionalText(lines.join("\n")),
    html,
  };
}

export type OnboardingAudience = "kunde" | "steuerberater";

export const CUSTOMER_ONBOARDING_SIGNATURE = "Dein Team von GoBD Verfahrensdoku";
/** Sie-Form der Kundensignatur. Partner-Mail bleibt sonst unverändert. */
export const PARTNER_ONBOARDING_SIGNATURE = "Ihr Team von GoBD Verfahrensdoku";

const CUSTOMER_ONBOARDING_SUBJECT =
  "Willkommen — nächste Schritte zu deiner Verfahrensdokumentation";
const CUSTOMER_ONBOARDING_DISCLAIMER =
  "Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus deinen Angaben.";
const CUSTOMER_ONBOARDING_CTA = "Jetzt starten: Betriebs-Check";

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

/** „Hallo {Name},“ or exactly „Hallo,“ when no person name is usable. */
export function customerOnboardingGreeting(
  contactName?: string | null,
  companyNames?: Array<string | null | undefined>,
): string {
  const name = pickOnboardingContactName({
    profileName: contactName,
    companyNames,
  });
  return name ? `Hallo ${name},` : "Hallo,";
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
}): TransactionalMailContent {
  const greeting = customerOnboardingGreeting(input.contactName, [input.company]);
  const startUrl = customerOnboardingStartUrl(input.magicLinkUrl);
  const text = wrapTransactionalText(
    [
      greeting,
      "",
      "danke für deine Bestellung bei gobd-doku-erstellen.de. So geht es weiter:",
      "",
      "1. Betriebs-Check: ein paar Fragen zu deinem Betrieb. Daraus ergibt sich, welche der 24 Module für dich gelten.",
      "2. Module ausfüllen – oder „Später ausfüllen“ wählen. Offene Module erscheinen als To-dos in deinem Konto, dort machst du jederzeit weiter.",
      "3. Gesamt-PDF erstellen – mit Vollständigkeitsübersicht, welche Module beschrieben, anderweitig dokumentiert oder noch offen sind.",
      "",
      CUSTOMER_ONBOARDING_CTA,
      startUrl,
      "",
      "Der Button meldet dich direkt an (Link 20 Minuten gültig). Ist er abgelaufen, fordere auf der Anmeldeseite einen neuen Link an – du landest danach wieder im Fragebogen.",
      "",
      "Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:",
      MAIL_FAQ_URL,
      "",
      `Support: ${MAIL_SUPPORT_EMAIL}`,
      "",
      CUSTOMER_ONBOARDING_DISCLAIMER,
      "",
      CUSTOMER_ONBOARDING_SIGNATURE,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>${escapeHtml(greeting)}</p>
    <p>danke für deine Bestellung bei gobd-doku-erstellen.de. So geht es weiter:</p>
    <ol>
      <li><strong>Betriebs-Check:</strong> ein paar Fragen zu deinem Betrieb. Daraus ergibt sich, welche der 24 Module für dich gelten.</li>
      <li><strong>Module ausfüllen</strong> – oder „Später ausfüllen“ wählen. Offene Module erscheinen als To-dos in deinem Konto, dort machst du jederzeit weiter.</li>
      <li><strong>Gesamt-PDF erstellen</strong> – mit Vollständigkeitsübersicht, welche Module beschrieben, anderweitig dokumentiert oder noch offen sind.</li>
    </ol>
    <p>${transactionalPrimaryButton(startUrl, CUSTOMER_ONBOARDING_CTA)}</p>
    <p>Der Button meldet dich direkt an (Link 20 Minuten gültig). Ist er abgelaufen, fordere auf der Anmeldeseite einen neuen Link an – du landest danach wieder im Fragebogen.</p>
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(MAIL_SUPPORT_EMAIL)}</p>
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
  const text = wrapTransactionalText(
    [
      greeting,
      "",
      "vielen Dank für Ihre Bestellung im Partner-Pilot.",
      "",
      "Nächste Schritte:",
      "1. Den Fragenkatalog im Intake ausfüllen (falls noch offen)",
      "2. Das PDF herunterladen, sobald die Generierung fertig ist",
      `3. Konto: Anmeldung unter ${MAIL_LOGIN_URL}`,
      "",
      "Mit dem Code KANZLEI-PILOT sind Setup und die ersten zwei Monatsbeiträge 0 €. Danach 49 €/Monat, wenn Sie nicht kündigen.",
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
    <p>vielen Dank für Ihre Bestellung im Partner-Pilot.</p>
    <p>Nächste Schritte:</p>
    <ol>
      <li>Den Fragenkatalog im Intake ausfüllen (falls noch offen)</li>
      <li>Das PDF herunterladen, sobald die Generierung fertig ist</li>
      <li>Konto: Anmeldung unter <a href="${escapeAttr(MAIL_LOGIN_URL)}">${escapeHtml(MAIL_LOGIN_URL)}</a></li>
    </ol>
    <p>Mit dem Code KANZLEI-PILOT sind Setup und die ersten zwei Monatsbeiträge 0 €. Danach 49 €/Monat, wenn Sie nicht kündigen.</p>
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
      "Hallo,",
      "",
      "eine Zahlung für dein GoBD-Abo ist fehlgeschlagen. Bitte Zahlungsmittel im Kundenportal aktualisieren:",
      MAIL_ACCOUNT_URL,
      "",
      `Fragen: ${MAIL_FAQ_URL}`,
      `Support: ${MAIL_SUPPORT_EMAIL}`,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>Hallo,</p>
    <p>eine Zahlung für dein GoBD-Abo ist fehlgeschlagen. Bitte Zahlungsmittel im Kundenportal aktualisieren:</p>
    <p><a href="${escapeAttr(MAIL_ACCOUNT_URL)}">${escapeHtml(MAIL_ACCOUNT_URL)}</a></p>
    <p>Fragen: <a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(MAIL_SUPPORT_EMAIL)}</p>
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
      "Hallo,",
      "",
      "bei der Erstellung deiner Verfahrensdokumentation ist ein technischer Fehler aufgetreten. Wir prüfen das und melden uns.",
      "",
      `Zwischenzeitlich: ${MAIL_FAQ_URL}`,
      `Support: ${MAIL_SUPPORT_EMAIL}`,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>Hallo,</p>
    <p>bei der Erstellung deiner Verfahrensdokumentation ist ein technischer Fehler aufgetreten. Wir prüfen das und melden uns.</p>
    <p>Zwischenzeitlich: <a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(MAIL_SUPPORT_EMAIL)}</p>
  `);
  return {
    subject: "Technisches Problem bei der Erstellung — wir kümmern uns",
    text,
    html,
  };
}

export function buildDeliveryMail(input: {
  company?: string;
  downloadUrl: string;
  magicLinkUrl?: string;
  successUrl?: string;
  version?: number;
}): TransactionalMailContent {
  const version = input.version && input.version > 0 ? input.version : 1;
  const lines = [
    `Hallo${input.company ? ` ${input.company}` : ""},`,
    "",
    `dein Entwurf der Verfahrensdokumentation (Version ${version}) ist fertig.`,
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
    "Keine Steuerberatung. Das PDF ist ein Entwurf zur Abstimmung mit deinem Steuerberater.",
    "",
    "GoBD Verfahrensdoku",
  );
  const html = wrapTransactionalHtml(`
    <p>Hallo${input.company ? ` ${escapeHtml(input.company)}` : ""},</p>
    <p>dein Entwurf der Verfahrensdokumentation (Version ${version}) ist fertig.</p>
    <p><a href="${escapeAttr(input.downloadUrl)}">PDF herunterladen</a></p>
    ${input.successUrl ? `<p><a href="${escapeAttr(input.successUrl)}">Zur Übersicht</a></p>` : ""}
    ${input.magicLinkUrl ? `<p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden (Magic Link, 20 Minuten gültig)</a></p>` : ""}
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Keine Steuerberatung. Das PDF ist ein Entwurf zur Abstimmung mit deinem Steuerberater.</p>
    <p>GoBD Verfahrensdoku</p>
  `);
  return {
    subject: "Dein Entwurf der Verfahrensdokumentation",
    text: wrapTransactionalText(lines.join("\n")),
    html,
  };
}

export function buildReferralAfterDeliveryMail(input: {
  company?: string;
}): TransactionalMailContent {
  const company = input.company?.trim() ?? "";
  const greeting = company ? `Hallo ${company},` : "Hallo,";
  const text = wrapTransactionalText(
    [
      greeting,
      "",
      "dein Entwurf der Verfahrensdokumentation ist bereit.",
      "",
      "Wenn dein Steuerberater oder ein Kollege ebenfalls eine prüfbare Verfahrensdokumentation braucht, kannst du diesen Link weitergeben:",
      "",
      REFERRAL_AFTER_DELIVERY_URL,
      "",
      "Kurz: Online-Intake → Entwurf als PDF. Einrichtung 149 € zzgl. USt, danach 49 € zzgl. USt pro Monat. 14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde. Keine Steuer- oder Rechtsberatung — Arbeitshilfe aus den Angaben.",
      "",
      `Dein Konto: ${MAIL_LOGIN_URL}`,
      `Fragen: ${MAIL_FAQ_URL}`,
      `Support: ${MAIL_SUPPORT_EMAIL}`,
      "",
      "GoBD Ops · IKAT GmbH",
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>${escapeHtml(greeting)}</p>
    <p>dein Entwurf der Verfahrensdokumentation ist bereit.</p>
    <p>Wenn dein Steuerberater oder ein Kollege ebenfalls eine prüfbare Verfahrensdokumentation braucht, kannst du diesen Link weitergeben:</p>
    <p><a href="${escapeAttr(REFERRAL_AFTER_DELIVERY_URL)}">Link weitergeben</a></p>
    <p>Kurz: Online-Intake → Entwurf als PDF. Einrichtung 149 € zzgl. USt, danach 49 € zzgl. USt pro Monat. 14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde. Keine Steuer- oder Rechtsberatung — Arbeitshilfe aus den Angaben.</p>
    <p>${escapeHtml(REFERRAL_MICRO)}</p>
    <p>Dein Konto: <a href="${escapeAttr(MAIL_LOGIN_URL)}">${escapeHtml(MAIL_LOGIN_URL)}</a></p>
    <p>Fragen: <a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(MAIL_SUPPORT_EMAIL)}</p>
    <p>GoBD Ops · IKAT GmbH</p>
  `);
  return {
    subject: REFERRAL_AFTER_DELIVERY_SUBJECT,
    text,
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
}): Promise<OpsResult & MailResult> {
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
    startUrl = magicLinkUrl(input.email, CUSTOMER_ONBOARDING_NEXT_PATH);
  }

  const mail = buildOnboardingMail({
    company: input.company,
    audience,
    contactName,
    magicLinkUrl: startUrl,
  });
  const result = await sendEmail({
    to: input.email,
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
  return { ...result, action: "onboarding" };
}

export async function handleFailedPayment(input: {
  email?: string;
  sessionId?: string;
  invoiceId?: string;
  customerId?: string;
  reason?: string;
}): Promise<OpsResult & MailResult> {
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
  const result = await sendEmail({
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
  return { ...result, action: "failed_payment" };
}

export async function handleFailedJob(input: {
  email?: string;
  sessionId?: string;
  job?: string;
  reason?: string;
}): Promise<OpsResult & MailResult> {
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
  const result = await sendEmail({
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
  return { ...result, action: "failed_job" };
}

export async function sendDeliveryMail(input: {
  email: string;
  company?: string;
  downloadUrl: string;
  magicLinkUrl?: string;
  successUrl?: string;
  version?: number;
}): Promise<OpsResult & MailResult> {
  if (!input.email.trim()) {
    console.info("[ops] delivery mail übersprungen — keine E-Mail");
    return { stub: true, sent: false, action: "delivery" };
  }

  const mail = buildDeliveryMail(input);
  const result = await sendEmail({
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return { ...result, action: "delivery" };
}

/**
 * Post-Delivery Referral. Eigene Funktion, nicht Teil von sendDeliveryMail.
 * Nur aufrufen, nachdem eine Delivery wirklich erfolgreich war (PDF liegt).
 * Höchstens einmal pro documentId (sonst pro sessionId).
 */
export async function sendReferralAfterDeliveryMail(input: {
  email: string;
  company?: string;
  documentId?: string;
  sessionId?: string;
}): Promise<OpsResult & MailResult> {
  const email = input.email.trim();
  const documentId = input.documentId?.trim() ?? "";
  const sessionId = input.sessionId?.trim() ?? "";

  if (!email) {
    console.info("[ops] referral mail übersprungen — keine E-Mail", {
      documentId,
      sessionId,
    });
    return {
      stub: true,
      sent: false,
      skipped: true,
      action: "referral_after_delivery",
    };
  }

  const eventKey = referralDeliveryKey({ documentId, sessionId });
  if (!eventKey) {
    console.info("[ops] referral mail übersprungen — keine Delivery-Id", {
      email,
    });
    return {
      stub: true,
      sent: false,
      skipped: true,
      action: "referral_after_delivery",
    };
  }

  const reservation = await reserveReferralDelivery(eventKey);
  if (reservation === "duplicate") {
    console.info("[ops] referral mail bereits gesendet", {
      email,
      documentId,
      sessionId,
    });
    return {
      stub: false,
      sent: false,
      skipped: true,
      action: "referral_after_delivery",
    };
  }

  try {
    const mail = buildReferralAfterDeliveryMail({ company: input.company });
    const result = await sendEmail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      idempotencyKey: referralIdempotencyKey(eventKey),
    });
    if (result.sent || result.stub) {
      await completeReferralDelivery(eventKey);
    } else {
      cancelReferralDelivery(eventKey);
    }
    console.info("[ops] referral mail", {
      email,
      documentId,
      sessionId,
      sent: result.sent,
      stub: result.stub,
    });
    return { ...result, skipped: false, action: "referral_after_delivery" };
  } catch (error) {
    cancelReferralDelivery(eventKey);
    throw error;
  }
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
  const result = await sendEmail({
    to: MAIL_SUPPORT_EMAIL,
    replyTo: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  console.info("[ops] partner inquiry mail", {
    to: MAIL_SUPPORT_EMAIL,
    replyTo: input.email,
    kanzlei: input.kanzlei,
    sent: result.sent,
    stub: result.stub,
  });
  return { ...result, action: "partner_inquiry" };
}

export async function sendReadinessMail(input: {
  email: string;
  name?: string;
  brancheLabel: string;
  downloadUrl: string;
  successUrl?: string;
  magicLinkUrl?: string;
}): Promise<OpsResult & MailResult> {
  if (!input.email.trim()) {
    console.info("[ops] readiness mail übersprungen — keine E-Mail");
    return { stub: true, sent: false, action: "readiness" };
  }

  const mail = buildReadinessMail(input);
  const result = await sendEmail({
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return { ...result, action: "readiness" };
}

export async function sendMagicLinkMail(input: {
  email: string;
  magicLinkUrl: string;
}): Promise<OpsResult & MailResult> {
  const mail = buildMagicLinkMail(input);
  const result = await sendEmail({
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return { ...result, action: "onboarding" };
}
