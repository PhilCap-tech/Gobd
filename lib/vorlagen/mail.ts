import { getAppUrl } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { LEGAL_OPERATOR } from "@/lib/legal";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail, type DedupedMailInput } from "@/lib/mail-dedupe";
import {
  escapeHtml,
  transactionalPrimaryButton,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";
import { CUSTOMER_MAIL_SIGNATURE } from "@/lib/ops";
import { MAGNET_MAIL_DEDUPE_MS, MAGNET_TITLES, type MagnetId } from "@/lib/vorlagen/ids";
import {
  createMagnetDownloadToken,
  createMagnetMarketingToken,
  createMagnetUnsubscribeToken,
} from "@/lib/vorlagen/token";
import type { CalcSnapshot } from "@/lib/vorlagen/calc";

export const MAGNET_MAIL_FROM = "GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>";

const DOI_HOURS = 48;
const DOWNLOAD_DAYS = 30;

export function magnetConfirmUrl(token: string): string {
  return `${getAppUrl()}/vorlagen/bestaetigen?token=${encodeURIComponent(token)}`;
}

export function magnetDownloadUrl(token: string): string {
  return `${getAppUrl()}/api/magnet/datei?token=${encodeURIComponent(token)}`;
}

export function magnetMarketingConfirmUrl(token: string): string {
  return `${getAppUrl()}/vorlagen/werbung/bestaetigen?token=${encodeURIComponent(token)}`;
}

export function magnetUnsubscribePageUrl(token: string): string {
  return `${getAppUrl()}/vorlagen/werbung/abmelden?token=${encodeURIComponent(token)}`;
}

export function buildMagnetDoiMail(input: { title: string; confirmUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Bitte bestätigen Sie Ihre Anforderung";
  const lines = [
    "Guten Tag,",
    "",
    `Sie haben eine Vorlage angefordert: ${input.title}.`,
    "Bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link. Erst danach erhalten Sie den Download.",
    `Der Link ist ${DOI_HOURS} Stunden gültig.`,
    "",
    input.confirmUrl,
    "",
    "Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren.",
    "",
    CUSTOMER_MAIL_SIGNATURE,
  ];
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>Sie haben eine Vorlage angefordert: ${escapeHtml(input.title)}. Bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link. Erst danach erhalten Sie den Download.</p>
    <p>${transactionalPrimaryButton(input.confirmUrl, "E-Mail-Adresse bestätigen")}</p>
    <p>Der Link ist ${DOI_HOURS} Stunden gültig. Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

export function buildMagnetFileMail(input: { title: string; downloadUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Ihre Vorlage";
  const lines = [
    "Guten Tag,",
    "",
    `vielen Dank für die Bestätigung. Hier ist Ihre Vorlage „${input.title}“.`,
    `Der Link ist ${DOWNLOAD_DAYS} Tage gültig und kann mehrfach verwendet werden.`,
    "",
    input.downloadUrl,
    "",
    CUSTOMER_MAIL_SIGNATURE,
  ];
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>vielen Dank für die Bestätigung. Hier ist Ihre Vorlage „${escapeHtml(input.title)}“. Der Link ist ${DOWNLOAD_DAYS} Tage gültig und kann mehrfach verwendet werden.</p>
    <p>${transactionalPrimaryButton(input.downloadUrl, "Vorlage herunterladen")}</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

export function buildMagnetMarketingMail(input: { confirmUrl: string; unsubscribeUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Bitte bestätigen Sie Ihre E-Mail";
  const lines = [
    "Guten Tag,",
    "",
    "Sie haben zugestimmt, per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) zu erhalten. Bitte bestätigen Sie das über den folgenden Link.",
    `Der Link ist ${DOI_HOURS} Stunden gültig.`,
    "Ohne diese Bestätigung senden wir keine solchen Informationen. Die angeforderte Vorlage erhalten Sie unabhängig davon, sobald Sie die Vorlage selbst bestätigt haben.",
    "",
    input.confirmUrl,
    "",
    "Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren.",
    "Die Einwilligung können Sie jederzeit widerrufen.",
    input.unsubscribeUrl ? `Abmelden: ${input.unsubscribeUrl}` : "",
    "",
    CUSTOMER_MAIL_SIGNATURE,
  ];
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>Sie haben zugestimmt, per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) zu erhalten. Bitte bestätigen Sie das über den folgenden Link. Ohne diese Bestätigung senden wir keine solchen Informationen. Die angeforderte Vorlage erhalten Sie unabhängig davon, sobald Sie die Vorlage selbst bestätigt haben.</p>
    <p>${transactionalPrimaryButton(input.confirmUrl, "E-Mail-Adresse bestätigen")}</p>
    <p>Der Link ist ${DOI_HOURS} Stunden gültig. Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren. Die Einwilligung können Sie jederzeit widerrufen.</p>
    ${input.unsubscribeUrl ? `<p><a href="${escapeHtml(input.unsubscribeUrl)}">E-Mail-Informationen abbestellen</a></p>` : ""}
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.filter((line) => line !== undefined).join("\n")), html };
}

export function magnetFileLink(input: {
  leadId: string;
  email: string;
  magnet: MagnetId;
  exp: number;
  calc: CalcSnapshot | null;
}): string | null {
  const token = createMagnetDownloadToken(input);
  return token ? magnetDownloadUrl(token) : null;
}

export function magnetMarketingLinks(input: {
  leadId: string;
  email: string;
  magnet: MagnetId;
  consentAt: string;
  consentTextVersion: string;
}): { confirmUrl: string; unsubscribeUrl: string; token: string } | null {
  const token = createMagnetMarketingToken(input);
  const unsubscribe = createMagnetUnsubscribeToken(input);
  if (!token || !unsubscribe) return null;
  return {
    token,
    confirmUrl: magnetMarketingConfirmUrl(token),
    unsubscribeUrl: magnetUnsubscribePageUrl(unsubscribe),
  };
}

export function magnetListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  const oneClick = unsubscribeUrl.replace("/vorlagen/werbung/abmelden", "/api/magnet/werbung/abmelden");
  const mailto = `mailto:${LEGAL_OPERATOR.email}?subject=Abmelden`;
  return {
    "List-Unsubscribe": `<${oneClick}>, <${mailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function deliverMagnetMail(input: DedupedMailInput): Promise<MailResult> {
  if (automatedRunForbidsLiveWrites()) return { stub: true, sent: false };
  return sendDedupedEmail({
    ...input,
    from: MAGNET_MAIL_FROM,
    windowMs: input.windowMs ?? MAGNET_MAIL_DEDUPE_MS,
  });
}

export function magnetTitle(magnet: MagnetId): string {
  return MAGNET_TITLES[magnet];
}
