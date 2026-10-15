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
  KANZLEI_UNSUBSCRIBE_LABEL,
} from "@/lib/kanzlei-copy";
import { KANZLEI_DOI_TTL_MS, createKanzleiUnsubscribeToken } from "@/lib/kanzlei-token";

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
    "Sie haben auf gobd-doku-erstellen.de angegeben, dass Sie per E-Mail Informationen zu GoBD-Themen und zu Angeboten von gobd-doku-erstellen.de (IKAT GmbH) für Kanzleien sowie Einladungen zu Veranstaltungen erhalten möchten. Bitte bestätigen Sie das über den folgenden Link:",
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
    <p>Sie haben auf gobd-doku-erstellen.de angegeben, dass Sie per E-Mail Informationen zu GoBD-Themen und zu Angeboten von gobd-doku-erstellen.de (IKAT GmbH) für Kanzleien sowie Einladungen zu Veranstaltungen erhalten möchten. Bitte bestätigen Sie das über den folgenden Link:</p>
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
