/**
 * GoBD Ops.
 *
 * Onboarding, Delivery, Referral nach Delivery, Readiness, Magic-Link,
 * Failed Payment und Failed Job gehen über Resend, wenn Mail-Env gesetzt ist.
 * HTML läuft durch wrapTransactionalHtml. Ohne Env: bisheriger Log-Stub, kein Versand.
 * Referral hängt nur am Delivery-Erfolg (eigene Funktion), nicht an Onboarding,
 * Failed Job, Failed Payment oder Magic-Link.
 */

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
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";

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
    | "referral_after_delivery";
};

export type TransactionalMailContent = {
  subject: string;
  text: string;
  html: string;
};

const CHECKOUT_CTA = "Jetzt Verfahrensdokumentation erstellen — 149 € + 49 €/Mo";
const READINESS_MICRO =
  "14 Tage Geld-zurück · Keine Steuerberatung · Entwurf für deinen Steuerberater";

/** Exact product URL from the Post-Delivery Referral spec (Track C). */
export const REFERRAL_AFTER_DELIVERY_URL =
  "https://www.gobd-doku-erstellen.de/?utm_source=referral&utm_medium=email&utm_campaign=post_delivery";
export const REFERRAL_AFTER_DELIVERY_SUBJECT =
  "Dein Entwurf ist fertig — gern an Steuerberater oder Kollegen weitergeben";
export const REFERRAL_MICRO =
  "149 € + 49 €/Mo · 14 Tage Geld-zurück · Keine Steuerberatung";

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

export function buildOnboardingMail(input: {
  company?: string;
}): TransactionalMailContent {
  const company = input.company?.trim();
  const greeting = company ? `Hallo ${company},` : "Hallo,";
  const text = wrapTransactionalText(
    [
      greeting,
      "",
      "danke für deine Bestellung bei gobd-doku-erstellen.de.",
      "",
      "Nächste Schritte:",
      "1. Intake ausfüllen (falls noch offen)",
      "2. PDF herunterladen, sobald die Generierung fertig ist",
      `3. Konto: Magic-Link / Anmeldung unter ${MAIL_LOGIN_URL}`,
      "",
      "Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:",
      MAIL_FAQ_URL,
      "",
      `Support: ${MAIL_SUPPORT_EMAIL}`,
      "",
      "Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus deinen Angaben.",
      "",
      "GoBD Ops · IKAT GmbH",
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>${escapeHtml(greeting)}</p>
    <p>danke für deine Bestellung bei gobd-doku-erstellen.de.</p>
    <p>Nächste Schritte:</p>
    <ol>
      <li>Intake ausfüllen (falls noch offen)</li>
      <li>PDF herunterladen, sobald die Generierung fertig ist</li>
      <li>Konto: Magic-Link / Anmeldung unter <a href="${escapeAttr(MAIL_LOGIN_URL)}">${escapeHtml(MAIL_LOGIN_URL)}</a></li>
    </ol>
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="${escapeAttr(MAIL_FAQ_URL)}">${escapeHtml(MAIL_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(MAIL_SUPPORT_EMAIL)}</p>
    <p>Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus deinen Angaben.</p>
    <p>GoBD Ops · IKAT GmbH</p>
  `);
  return {
    subject: "Willkommen — nächste Schritte zu deiner Verfahrensdokumentation",
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
      "Kurz: Online-Intake → Entwurf als PDF. Setup 149 €, danach 49 €/Monat. 14 Tage Geld-zurück. Keine Steuer- oder Rechtsberatung — Arbeitshilfe aus den Angaben.",
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
    <p>Kurz: Online-Intake → Entwurf als PDF. Setup 149 €, danach 49 €/Monat. 14 Tage Geld-zurück. Keine Steuer- oder Rechtsberatung — Arbeitshilfe aus den Angaben.</p>
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

export async function triggerOnboardingMail(input: {
  email: string;
  company?: string;
  sessionId?: string;
}): Promise<OpsResult & MailResult> {
  if (!isMailConfigured()) {
    console.info("[ops] onboarding mail stub", {
      email: input.email,
      company: input.company,
      sessionId: input.sessionId,
    });
    return { stub: true, sent: false, action: "onboarding" };
  }

  if (!input.email.trim()) {
    console.info("[ops] onboarding mail übersprungen — keine E-Mail", {
      sessionId: input.sessionId,
    });
    return { stub: true, sent: false, action: "onboarding" };
  }

  const mail = buildOnboardingMail({ company: input.company });
  const result = await sendEmail({
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  console.info("[ops] onboarding mail", {
    email: input.email,
    sessionId: input.sessionId,
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
