/**
 * GoBD Ops.
 *
 * Onboarding und Delivery gehen über Resend, wenn Mail-Env gesetzt ist.
 * Ohne Env: bisheriger Log-Stub, kein Versand.
 * Failed Payment / Failed Job bleiben Stubs (Logs).
 */

import { CANONICAL_PRODUCTION_APP_URL, isMailConfigured } from "@/lib/env";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { sendEmail, type MailResult } from "@/lib/mail";

/** Canonical customer FAQ — always the www URL, never a markdown file. */
const OPS_FAQ_URL = `${CANONICAL_PRODUCTION_APP_URL}/faq`;
const OPS_LOGIN_URL = `${CANONICAL_PRODUCTION_APP_URL}/login`;

export type OpsResult = {
  stub: boolean;
  sent: boolean;
  action: "onboarding" | "failed_payment" | "failed_job" | "delivery" | "readiness";
};

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

  const company = input.company?.trim();
  const greeting = company ? `Hallo ${company},` : "Hallo,";
  const text = [
    greeting,
    "",
    "danke für deine Bestellung bei gobd-doku-erstellen.de.",
    "",
    "Nächste Schritte:",
    "1. Intake ausfüllen (falls noch offen)",
    "2. PDF herunterladen, sobald die Generierung fertig ist",
    `3. Konto: Magic-Link / Anmeldung unter ${OPS_LOGIN_URL}`,
    "",
    "Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:",
    OPS_FAQ_URL,
    "",
    `Support: ${LEGAL_OPERATOR.email}`,
    "",
    "Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus deinen Angaben.",
    "",
    `GoBD Ops · ${LEGAL_OPERATOR.name}`,
  ].join("\n");
  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>danke für deine Bestellung bei gobd-doku-erstellen.de.</p>
    <p>Nächste Schritte:</p>
    <ol>
      <li>Intake ausfüllen (falls noch offen)</li>
      <li>PDF herunterladen, sobald die Generierung fertig ist</li>
      <li>Konto: Magic-Link / Anmeldung unter <a href="${escapeAttr(OPS_LOGIN_URL)}">${escapeHtml(OPS_LOGIN_URL)}</a></li>
    </ol>
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="${escapeAttr(OPS_FAQ_URL)}">${escapeHtml(OPS_FAQ_URL)}</a></p>
    <p>Support: ${escapeHtml(LEGAL_OPERATOR.email)}</p>
    <p>Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus deinen Angaben.</p>
    <p>GoBD Ops · ${escapeHtml(LEGAL_OPERATOR.name)}</p>
  `;

  const result = await sendEmail({
    to: input.email,
    subject: "Willkommen — nächste Schritte zu deiner Verfahrensdokumentation",
    text,
    html,
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
}): Promise<OpsResult> {
  console.warn("[ops] failed payment stub", input);
  return { stub: true, sent: false, action: "failed_payment" };
}

export async function handleFailedJob(input: {
  sessionId?: string;
  job?: string;
  reason?: string;
}): Promise<OpsResult> {
  console.warn("[ops] failed job stub", input);
  return { stub: true, sent: false, action: "failed_job" };
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
    OPS_FAQ_URL,
    "",
    "Keine Steuerberatung. Das PDF ist ein Entwurf zur Abstimmung mit deinem Steuerberater.",
    "",
    "GoBD Verfahrensdoku",
  );
  const text = lines.join("\n");
  const html = `
    <p>Hallo${input.company ? ` ${escapeHtml(input.company)}` : ""},</p>
    <p>dein Entwurf der Verfahrensdokumentation (Version ${version}) ist fertig.</p>
    <p><a href="${escapeAttr(input.downloadUrl)}">PDF herunterladen</a></p>
    ${input.successUrl ? `<p><a href="${escapeAttr(input.successUrl)}">Zur Übersicht</a></p>` : ""}
    ${input.magicLinkUrl ? `<p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden (Magic Link, 20 Minuten gültig)</a></p>` : ""}
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="${escapeAttr(OPS_FAQ_URL)}">${escapeHtml(OPS_FAQ_URL)}</a></p>
    <p>Keine Steuerberatung. Das PDF ist ein Entwurf zur Abstimmung mit deinem Steuerberater.</p>
    <p>GoBD Verfahrensdoku</p>
  `;

  const result = await sendEmail({
    to: input.email,
    subject: "Dein Entwurf der Verfahrensdokumentation",
    text,
    html,
  });
  return { ...result, action: "delivery" };
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

  const greeting = input.name?.trim() ? `Hallo ${input.name.trim()},` : "Hallo,";
  const lines = [
    greeting,
    "",
    `hier sind deine GoBD-Grundlagen für ${input.brancheLabel} (Readiness-Arbeitshilfe, keine Verfahrensdokumentation).`,
    "",
    `Download: ${input.downloadUrl}`,
  ];
  if (input.successUrl) {
    lines.push(`Übersicht: ${input.successUrl}`);
  }
  if (input.magicLinkUrl) {
    lines.push(
      `Späterer Zugang (Magic Link, 20 Minuten gültig): ${input.magicLinkUrl}`,
    );
  }
  lines.push(
    "",
    "Kein Steuerberatungsersatz. Keine Zusicherung von GoBD-Konformität.",
    "",
    "GoBD Verfahrensdoku",
  );
  const text = lines.join("\n");
  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>hier sind deine GoBD-Grundlagen für ${escapeHtml(input.brancheLabel)} (Readiness-Arbeitshilfe, keine Verfahrensdokumentation).</p>
    <p><a href="${escapeAttr(input.downloadUrl)}">PDF herunterladen</a></p>
    ${input.successUrl ? `<p><a href="${escapeAttr(input.successUrl)}">Zur Übersicht</a></p>` : ""}
    ${input.magicLinkUrl ? `<p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden (Magic Link, 20 Minuten gültig)</a></p>` : ""}
    <p>Kein Steuerberatungsersatz. Keine Zusicherung von GoBD-Konformität.</p>
    <p>GoBD Verfahrensdoku</p>
  `;

  const result = await sendEmail({
    to: input.email,
    subject: `Deine GoBD-Grundlagen für ${input.brancheLabel}`,
    text,
    html,
  });
  return { ...result, action: "readiness" };
}

export async function sendMagicLinkMail(input: {
  email: string;
  magicLinkUrl: string;
}): Promise<OpsResult & MailResult> {
  const text = [
    "Hallo,",
    "",
    "hier ist dein Anmeldelink für GoBD Verfahrensdoku (20 Minuten gültig):",
    input.magicLinkUrl,
    "",
    "Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.",
  ].join("\n");
  const html = `
    <p>Hallo,</p>
    <p>hier ist dein Anmeldelink für GoBD Verfahrensdoku (20 Minuten gültig):</p>
    <p><a href="${escapeAttr(input.magicLinkUrl)}">Anmelden</a></p>
    <p>Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.</p>
  `;
  const result = await sendEmail({
    to: input.email,
    subject: "Dein Anmeldelink — GoBD Verfahrensdoku",
    text,
    html,
  });
  return { ...result, action: "onboarding" };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
