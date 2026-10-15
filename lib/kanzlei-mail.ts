import { AMPEL_CONFIRM_WINDOW_MS } from "@/lib/ampel";
import { getAppUrl, isMailConfigured, magicLinkDevFallbackAllowed } from "@/lib/env";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import {
  escapeAttr,
  escapeHtml,
  MAIL_IMPRESSUM_URL,
  MAIL_SITE_URL,
  transactionalPrimaryButton,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";
import { CUSTOMER_MAIL_SIGNATURE } from "@/lib/ops";
import {
  KANZLEI_DOI_BUTTON,
  KANZLEI_DOI_PREHEADER,
  KANZLEI_DOI_SUBJECT,
  KANZLEI_MAIL_FOOTER,
  KANZLEI_OPT_IN_SCOPE,
  KANZLEI_UNSUBSCRIBE_LABEL,
} from "@/lib/kanzlei-copy";
import { KANZLEI_DOI_TTL_MS, createKanzleiUnsubscribeToken } from "@/lib/kanzlei-token";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { normalizeAmpelEmail } from "@/lib/ampel-score";
import type { ReadinessLead } from "@/lib/readiness";
import { listKanzleiReadinessLeadsByEmail } from "@/lib/store";

const DOI_HOURS = Math.round(KANZLEI_DOI_TTL_MS / (60 * 60 * 1000));

export const KANZLEI_MAIL_FROM = "GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>";

export function kanzleiConfirmUrl(token: string): string {
  return `${getAppUrl()}/steuerberater/merkblatt/bestaetigen?token=${encodeURIComponent(token)}`;
}

export function kanzleiPrivacyUrl(): string {
  return `${MAIL_SITE_URL}/datenschutz#kanzlei-merkblatt`;
}

/** Link for a later marketing mail. The DOI mail does not include it. */
export function kanzleiUnsubscribeUrl(email: string, consentAt: string): string {
  const token = createKanzleiUnsubscribeToken(email, consentAt);
  if (!token) return "";
  return `${getAppUrl()}/steuerberater/merkblatt/abmelden?token=${encodeURIComponent(token)}`;
}

export function kanzleiUnsubscribeFooterLine(url: string): string {
  return `Abmelden: ${KANZLEI_UNSUBSCRIBE_LABEL} ${url}`.trim();
}

/** One-click and mailto headers for a Kanzlei marketing mail. The DOI mail does not use them. */
export function kanzleiListUnsubscribeHeaders(
  email: string,
  consentAt: string,
): Record<string, string> | undefined {
  const token = createKanzleiUnsubscribeToken(email, consentAt);
  if (!token) return undefined;
  const oneClickUrl = `${getAppUrl()}/api/kanzlei-merkblatt/abmelden?token=${encodeURIComponent(token)}`;
  const mailto = `mailto:${LEGAL_OPERATOR.email}?subject=Abmelden`;
  return {
    "List-Unsubscribe": `<${oneClickUrl}>, <${mailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function consentCovered(leads: ReadinessLead[], consentAt: string): boolean {
  const consentMs = Date.parse(consentAt);
  if (!Number.isFinite(consentMs)) return true;
  return leads.some((lead) => {
    if (lead.marketingOptIn !== "withdrawn" || !lead.withdrawnAt) return false;
    const withdrawnMs = Date.parse(lead.withdrawnAt);
    return Number.isFinite(withdrawnMs) && consentMs <= withdrawnMs;
  });
}

/**
 * Marketing mail only. A confirmed DOI for this exact consent is required.
 * A withdrawal that already covers that consent blocks the send.
 */
export async function sendKanzleiMarketingMail(
  input: { email: string; consentAt: string; subject: string; text: string; html: string },
  deps: { listLeads?: (email: string) => Promise<ReadinessLead[]> } = {},
): Promise<MailResult> {
  const email = normalizeAmpelEmail(input.email);
  const consentAt = input.consentAt.trim();
  if (!email || !Number.isFinite(Date.parse(consentAt))) {
    return { stub: false, sent: false, blocked: "no-confirmed-doi" };
  }
  const list = deps.listLeads ?? ((address: string) => listKanzleiReadinessLeadsByEmail(address, { fresh: true }));
  let leads: ReadinessLead[];
  try {
    leads = await list(email);
  } catch (error) {
    console.error("[kanzlei] Einwilligung lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { stub: false, sent: false, blocked: "no-confirmed-doi" };
  }
  if (consentCovered(leads, consentAt)) return { stub: false, sent: false, blocked: "suppressed" };
  const confirmed = leads.some(
    (lead) => lead.marketingOptIn === "confirmed" && Boolean(lead.doiConfirmedAt) && lead.consentAt === consentAt,
  );
  if (!confirmed) return { stub: false, sent: false, blocked: "no-confirmed-doi" };
  const headers = kanzleiListUnsubscribeHeaders(email, consentAt);
  if (!headers) return { stub: false, sent: false, blocked: "no-confirmed-doi" };
  return sendDedupedEmail({
    dedupeKey: `kanzlei-marketing:${email}:${consentAt}`,
    to: email,
    from: KANZLEI_MAIL_FROM,
    subject: input.subject,
    text: input.text,
    html: input.html,
    headers,
  });
}

export function buildKanzleiDoiMail(input: { confirmUrl: string }): {
  subject: string;
  text: string;
  html: string;
  preheader: string;
} {
  const privacyUrl = kanzleiPrivacyUrl();
  const lines = [
    KANZLEI_DOI_PREHEADER,
    "",
    "Guten Tag,",
    "",
    `Sie haben auf gobd-doku-erstellen.de angegeben, dass Sie per E-Mail ${KANZLEI_OPT_IN_SCOPE} erhalten möchten. Bitte bestätigen Sie das über den folgenden Link:`,
    "",
    `${KANZLEI_DOI_BUTTON}: ${input.confirmUrl}`,
    "",
    `Der Link ist ${DOI_HOURS} Stunden gültig. Ohne Ihre Bestätigung senden wir Ihnen keine solchen E-Mails. Das Merkblatt haben Sie unabhängig davon bereits direkt auf der Seite heruntergeladen.`,
    "",
    "Wenn Sie sich nicht angemeldet haben, ignorieren Sie diese E-Mail bitte. Wir verwenden Ihre Adresse dann nicht für diesen Zweck.",
    "",
    "Ihre Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen, über den Abmeldelink in jeder E-Mail oder per Nachricht an info@gobd-doku-erstellen.de.",
    "",
    "Wir schreiben Ihnen höchstens zweimal im Monat.",
    "",
    CUSTOMER_MAIL_SIGNATURE,
    "",
    KANZLEI_MAIL_FOOTER,
    `Impressum: ${MAIL_IMPRESSUM_URL}`,
    `Datenschutz: ${privacyUrl}`,
  ];
  const html = wrapTransactionalHtml(`
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(KANZLEI_DOI_PREHEADER)}</div>
    <p>Guten Tag,</p>
    <p>Sie haben auf gobd-doku-erstellen.de angegeben, dass Sie per E-Mail ${escapeHtml(KANZLEI_OPT_IN_SCOPE)} erhalten möchten. Bitte bestätigen Sie das über den folgenden Link:</p>
    <p>${transactionalPrimaryButton(input.confirmUrl, KANZLEI_DOI_BUTTON)}</p>
    <p>Der Link ist ${DOI_HOURS} Stunden gültig. Ohne Ihre Bestätigung senden wir Ihnen keine solchen E-Mails. Das Merkblatt haben Sie unabhängig davon bereits direkt auf der Seite heruntergeladen.</p>
    <p>Wenn Sie sich nicht angemeldet haben, ignorieren Sie diese E-Mail bitte. Wir verwenden Ihre Adresse dann nicht für diesen Zweck.</p>
    <p>Ihre Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen, über den Abmeldelink in jeder E-Mail oder per Nachricht an info@gobd-doku-erstellen.de.</p>
    <p>Wir schreiben Ihnen höchstens zweimal im Monat.</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
    <p>${escapeHtml(KANZLEI_MAIL_FOOTER)}</p>
    <p><a href="${escapeAttr(MAIL_IMPRESSUM_URL)}">Impressum</a> · <a href="${escapeAttr(privacyUrl)}">Datenschutz</a></p>
  `);
  return {
    subject: KANZLEI_DOI_SUBJECT,
    preheader: KANZLEI_DOI_PREHEADER,
    text: wrapTransactionalText(lines.join("\n")),
    html,
  };
}

function doiDedupeKey(email: string): string {
  return `kanzlei-doi:${email.trim().toLowerCase()}`;
}

export async function sendKanzleiDoiMail(input: { email: string; token: string }): Promise<MailResult> {
  const confirmUrl = kanzleiConfirmUrl(input.token);
  if (!isMailConfigured()) {
    if (!magicLinkDevFallbackAllowed()) {
      console.error("[kanzlei] Bestätigungsmail nicht konfiguriert");
      return { stub: false, sent: false };
    }
    console.info("[kanzlei] Bestätigungsmail im Dev-Fallback, ohne Adresse im Log");
    return { stub: true, sent: false };
  }
  const mail = buildKanzleiDoiMail({ confirmUrl });
  return sendDedupedEmail({
    dedupeKey: doiDedupeKey(input.email),
    windowMs: AMPEL_CONFIRM_WINDOW_MS,
    to: input.email,
    from: KANZLEI_MAIL_FROM,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}
