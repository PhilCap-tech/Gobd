import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { isKanzleiId } from "@/lib/kanzlei-toolbox";
import {
  escapeAttr,
  escapeHtml,
  transactionalPrimaryButton,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { getAppUrl } from "@/lib/env";
import {
  KANZLEI_TOOLBOX_NEWSLETTER_NOTE,
  kanzleiHinweisText,
  kanzleiNewsletterLong,
  kanzleiNewsletterShort,
} from "@/lib/kanzlei-toolbox-copy";
import { createKanzleiReportToken, createKanzleiRevokeToken } from "@/lib/kanzlei-toolbox-token";

export const KANZLEI_MAIL_SINK = "delivered@resend.dev";
export const KANZLEI_MAIL_BLOCKED = "philip.cappelletti@sdc-ventures.com";
export const KANZLEI_TOOLBOX_MAIL_FROM = "GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>";

/** One DOI mail per application. The id is opaque and carries no name, ref or campaign value. */
export function kanzleiToolboxDoiKey(kanzleiId: string): string {
  return `kanzlei-toolbox-doi:${kanzleiId}`;
}

/** One toolbox mail per confirmed application. */
export function kanzleiToolboxKitKey(kanzleiId: string): string {
  return `kanzlei-toolbox-kit:${kanzleiId}`;
}

function acceptedDedupeKey(value: string): string {
  const key = value.trim();
  const id = key.slice(key.lastIndexOf(":") + 1);
  if ((key.startsWith("kanzlei-toolbox-doi:") || key.startsWith("kanzlei-toolbox-kit:")) && isKanzleiId(id)) return key;
  return "";
}

/** Preview, checks and any non-production host may mail only the Resend sink. */
export function kanzleiMailAllowed(to: string): boolean {
  const email = to.trim().toLowerCase();
  if (!email || email === KANZLEI_MAIL_BLOCKED) return false;
  if (automatedRunForbidsLiveWrites()) return false;
  if (process.env.VERCEL_ENV !== "production" && email !== KANZLEI_MAIL_SINK) return false;
  return true;
}

export async function sendKanzleiToolboxMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  dedupeKey: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}): Promise<MailResult> {
  const dedupeKey = acceptedDedupeKey(input.dedupeKey);
  if (!dedupeKey || !kanzleiMailAllowed(input.to)) return { stub: true, sent: false };
  return sendDedupedEmail({
    dedupeKey,
    to: input.to,
    from: KANZLEI_TOOLBOX_MAIL_FROM,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
}

export function buildKanzleiDoiMail(confirmUrl: string): { subject: string; text: string; html: string } {
  const subject = "Bitte bestätigen Sie Ihre E-Mail — Kanzlei-Toolbox";
  const text = wrapTransactionalText(
    [
      "Guten Tag,",
      "",
      "Sie haben die Kanzlei-Toolbox auf gobd-doku-erstellen.de angefordert. Bitte bestätigen Sie Ihre E-Mail-Adresse über diesen Link:",
      confirmUrl,
      "",
      "Der Link ist 48 Stunden gültig. Ohne Bestätigung bleibt die Anmeldung inaktiv, und wir zeigen den Kanzleinamen nicht an.",
      "Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.",
      "",
      `${LEGAL_OPERATOR.name}, ${LEGAL_OPERATOR.street}, ${LEGAL_OPERATOR.zipCity}`,
    ].join("\n"),
  );
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>Sie haben die Kanzlei-Toolbox auf gobd-doku-erstellen.de angefordert. Bitte bestätigen Sie Ihre E-Mail-Adresse. Ohne Bestätigung bleibt die Anmeldung inaktiv, und wir zeigen den Kanzleinamen nicht an.</p>
    <p>${transactionalPrimaryButton(confirmUrl, "E-Mail-Adresse bestätigen")}</p>
    <p>Der Link ist 48 Stunden gültig. Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.</p>
    <p>${escapeHtml(LEGAL_OPERATOR.name)}, ${escapeHtml(LEGAL_OPERATOR.street)}, ${escapeHtml(LEGAL_OPERATOR.zipCity)}</p>
  `);
  return { subject, text, html };
}

export function buildKanzleiToolboxMail(input: {
  displayName: string;
  slug: string;
  kanzleiId: string;
  verified: boolean;
  reportOptIn: boolean;
}): { subject: string; text: string; html: string } | null {
  const revoke = createKanzleiRevokeToken(input.kanzleiId);
  if (!revoke) return null;
  const origin = getAppUrl();
  const link = `${origin}/k/${input.slug}`;
  const removeUrl = `${origin}/steuerberater/toolbox/entfernen?token=${encodeURIComponent(revoke)}`;
  const reportToken = input.reportOptIn ? createKanzleiReportToken(input.kanzleiId) : null;
  const reportUrl = reportToken ? `${origin}/steuerberater/toolbox/bericht?token=${encodeURIComponent(reportToken)}` : "";
  const status = input.verified
    ? `Auf dem Ampel-Check steht die Zeile „${kanzleiHinweisText(input.displayName).title}“. ${input.displayName} hat den Check nicht erstellt und nicht geprüft.`
    : "Der Kanzleiname wird noch nicht angezeigt. Wir gleichen die Angaben mit dem Impressum und danach einzeln mit dem amtlichen Steuerberaterverzeichnis ab. Bis dahin führt Ihr Link auf den Ampel-Check ohne Namen, ohne Zählung und ohne Zuordnung.";
  const lines = [
    "Guten Tag,",
    "",
    "Ihre E-Mail-Adresse ist bestätigt. Hier ist Ihre Kanzlei-Toolbox.",
    "",
    status,
    "",
    `Ihr Link: ${link}`,
    "Den QR-Code und das Mandanten-Merkblatt finden Sie im Anhang.",
    "",
    "Newsletter-Baustein, kurz:",
    kanzleiNewsletterShort(input.slug),
    "",
    "Newsletter-Baustein, lang:",
    kanzleiNewsletterLong(input.slug),
    "",
    KANZLEI_TOOLBOX_NEWSLETTER_NOTE,
    "",
    reportUrl ? `Bericht mit Zahlen: ${reportUrl}` : "",
    `Eintrag entfernen: ${removeUrl}`,
    "Der Widerruf ist kostenfrei und entfernt den Namen sofort.",
    "",
    "Die Toolbox ist kostenlos. Sie erhalten keine Provision, keine Vergütung und keine sonstige Gegenleistung.",
    `${LEGAL_OPERATOR.name}, ${LEGAL_OPERATOR.street}, ${LEGAL_OPERATOR.zipCity}`,
  ].filter((line) => line !== "");
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>Ihre E-Mail-Adresse ist bestätigt. Hier ist Ihre Kanzlei-Toolbox.</p>
    <p>${escapeHtml(status)}</p>
    <p>Ihr Link: <a href="${escapeAttr(link)}">${escapeHtml(link)}</a></p>
    <p>Den QR-Code und das Mandanten-Merkblatt finden Sie im Anhang.</p>
    <p><strong>Newsletter-Baustein, kurz</strong></p>
    <pre>${escapeHtml(kanzleiNewsletterShort(input.slug))}</pre>
    <p><strong>Newsletter-Baustein, lang</strong></p>
    <pre>${escapeHtml(kanzleiNewsletterLong(input.slug))}</pre>
    <p>${escapeHtml(KANZLEI_TOOLBOX_NEWSLETTER_NOTE)}</p>
    ${reportUrl ? `<p><a href="${escapeAttr(reportUrl)}">Bericht mit Zahlen</a></p>` : ""}
    <p><a href="${escapeAttr(removeUrl)}">Eintrag entfernen</a>. Der Widerruf ist kostenfrei und entfernt den Namen sofort.</p>
    <p>Die Toolbox ist kostenlos. Sie erhalten keine Provision, keine Vergütung und keine sonstige Gegenleistung.</p>
    <p>${escapeHtml(LEGAL_OPERATOR.name)}, ${escapeHtml(LEGAL_OPERATOR.street)}, ${escapeHtml(LEGAL_OPERATOR.zipCity)}</p>
  `);
  return { subject: "Ihre Kanzlei-Toolbox", text: wrapTransactionalText(lines.join("\n")), html };
}
