/**
 * GoBD Ops.
 *
 * Onboarding / Failed Payment / Failed Job bleiben Stubs (Logs).
 * Delivery-Mail geht über Resend, wenn env gesetzt ist — sonst Stub-Log.
 */

import { sendEmail, type MailResult } from "@/lib/mail";

export type OpsResult = {
  stub: boolean;
  sent: boolean;
  action: "onboarding" | "failed_payment" | "failed_job" | "delivery";
};

export async function triggerOnboardingMail(input: {
  email: string;
  company?: string;
  sessionId?: string;
}): Promise<OpsResult> {
  console.info("[ops] onboarding mail stub", {
    email: input.email,
    company: input.company,
    sessionId: input.sessionId,
  });
  return { stub: true, sent: false, action: "onboarding" };
}

export async function handleFailedPayment(input: {
  email?: string;
  sessionId?: string;
  invoiceId?: string;
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
