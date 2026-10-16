import { createHash } from "node:crypto";
import {
  AMPEL_CONFIRM_WINDOW_MS,
  AMPEL_DOI_TTL_MS,
  type AmpelDoiPayload,
  verifyAmpelDoiToken,
} from "@/lib/ampel";
import { ampelConsentBlocked } from "@/lib/ampel-marketing-guard";
import { ampelListUnsubscribeHeaders } from "@/lib/ampel-mail";
import { publicAmpelSource, type AmpelAnswerMap } from "@/lib/ampel-score";
import { getAppUrl, isMailConfigured, magicLinkDevFallbackAllowed } from "@/lib/env";
import { CUSTOMER_MAIL_SIGNATURE } from "@/lib/ops";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import {
  escapeAttr,
  escapeHtml,
  transactionalPrimaryButton,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";
import { scoreKassen } from "@/lib/kassen-check-score";
import {
  KASSEN_CHECK_PATH,
  KASSEN_DISCLAIMER,
  KASSEN_QUESTIONS,
  KASSEN_RESULTS,
} from "@/lib/kassen-check-questions";

const DOI_HOURS = Math.round(AMPEL_DOI_TTL_MS / (60 * 60 * 1000));

export function kassenResultDedupeKey(email: string, answers: string): string {
  const hash = createHash("sha256").update(answers).digest("hex").slice(0, 32);
  return `kassen-result:${email}:${hash}`;
}

export function kassenConfirmUrl(token: string): string {
  return `${getAppUrl()}${KASSEN_CHECK_PATH}/bestaetigen?token=${encodeURIComponent(token)}`;
}

function kassenConfirmDedupeKey(email: string, consentAt: string): string {
  return `kassen-confirm:${email.trim().toLowerCase()}:${consentAt}`;
}

function kassenAckDedupeKey(payload: AmpelDoiPayload): string {
  return `kassen-doi-ack:${payload.email}:${payload.answers}:${payload.consentAt}`;
}

export function buildKassenResultMail(answers: AmpelAnswerMap): {
  subject: string;
  text: string;
  html: string;
} | null {
  const scored = scoreKassen(answers);
  if (!scored) return null;
  const band = KASSEN_RESULTS[scored.light];
  const subject = `Ihr Kassen- und TSE-Meldecheck: ${band.headline}`;
  const lines = ["Guten Tag,", "", band.headline, "", band.text, ""];
  for (const question of KASSEN_QUESTIONS) {
    lines.push(question.question, question.explanation, `Quelle: ${publicAmpelSource(question.source)}`, "");
  }
  lines.push(KASSEN_DISCLAIMER, "", CUSTOMER_MAIL_SIGNATURE);
  const questionsHtml = KASSEN_QUESTIONS.map(
    (question) =>
      `<li><strong>${escapeHtml(question.question)}</strong><br />${escapeHtml(question.explanation)}<br />Quelle: ${escapeHtml(publicAmpelSource(question.source))}</li>`,
  ).join("");
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p><strong>${escapeHtml(band.headline)}</strong></p>
    <p>${escapeHtml(band.text)}</p>
    <ul>${questionsHtml}</ul>
    <p>${escapeHtml(KASSEN_DISCLAIMER)}</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

export async function sendKassenResultMail(input: {
  email: string;
  answers: AmpelAnswerMap;
  code: string;
}): Promise<MailResult> {
  const mail = buildKassenResultMail(input.answers);
  if (!mail) return { stub: false, sent: false };
  if (!isMailConfigured()) {
    if (!magicLinkDevFallbackAllowed()) {
      console.error("[kassen] Ergebnismail nicht konfiguriert");
      return { stub: false, sent: false };
    }
    console.info("[kassen] dev fallback Ergebnismail — nur Server-Log, nicht in der Response");
    return { stub: true, sent: false };
  }
  return sendDedupedEmail({
    dedupeKey: kassenResultDedupeKey(input.email, input.code),
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

export function buildKassenConfirmationMail(input: { confirmUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Bitte bestätigen Sie Ihre E-Mail — Kassen- und TSE-Meldecheck";
  const lines = [
    "Guten Tag,",
    "",
    "Sie haben zugestimmt, per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) zu erhalten. Bitte bestätigen Sie das über den folgenden Link.",
    `Der Link ist ${DOI_HOURS} Stunden gültig.`,
    "Ohne diese Bestätigung senden wir keine weiteren E-Mails. Das angeforderte Ergebnis erhalten Sie unabhängig davon.",
    "",
    input.confirmUrl,
    "",
    "Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren.",
    "Die Einwilligung können Sie jederzeit widerrufen.",
    "",
    CUSTOMER_MAIL_SIGNATURE,
  ];
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>Sie haben zugestimmt, per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) zu erhalten. Bitte bestätigen Sie das über den folgenden Link. Ohne diese Bestätigung senden wir keine weiteren E-Mails. Das angeforderte Ergebnis erhalten Sie unabhängig davon.</p>
    <p>${transactionalPrimaryButton(input.confirmUrl, "E-Mail-Adresse bestätigen")}</p>
    <p>Der Link ist ${DOI_HOURS} Stunden gültig. Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren. Die Einwilligung können Sie jederzeit widerrufen.</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

export async function sendKassenConfirmationMail(input: {
  email: string;
  token: string;
}): Promise<MailResult> {
  const confirmed = verifyAmpelDoiToken(input.token);
  const consentAt = confirmed?.consentAt ?? "";
  if (await ampelConsentBlocked(input.email, consentAt)) {
    console.info("[kassen] Bestätigungsmail blockiert");
    return { stub: false, sent: false, blocked: "suppressed" };
  }
  const confirmUrl = kassenConfirmUrl(input.token);
  if (!isMailConfigured()) {
    if (!magicLinkDevFallbackAllowed()) {
      console.error("[kassen] Bestätigungsmail nicht konfiguriert");
      return { stub: false, sent: false };
    }
    console.info("[kassen] dev fallback Bestätigungslink — nur Server-Log, nicht in der Response");
    console.info(confirmUrl);
    return { stub: true, sent: false };
  }
  const mail = buildKassenConfirmationMail({ confirmUrl });
  const headers = confirmed ? ampelListUnsubscribeHeaders(confirmed.email, confirmed.consentAt) : undefined;
  return sendDedupedEmail({
    dedupeKey: kassenConfirmDedupeKey(confirmed?.email || input.email, consentAt),
    windowMs: AMPEL_CONFIRM_WINDOW_MS,
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(headers ? { headers } : {}),
  });
}

export function buildKassenDoiAckMail(): { subject: string; text: string; html: string } {
  const subject = "Ihre Einwilligung ist bestätigt — Kassen- und TSE-Meldecheck";
  const lines = [
    "Guten Tag,",
    "",
    "Sie haben bestätigt, dass wir Ihnen Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) senden dürfen. Die Einwilligung können Sie jederzeit widerrufen.",
    "",
    CUSTOMER_MAIL_SIGNATURE,
  ];
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>Sie haben bestätigt, dass wir Ihnen Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) senden dürfen. Die Einwilligung können Sie jederzeit widerrufen.</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

/** After the checkbox link is confirmed. The result mail has already gone out. */
export async function sendKassenDoiAckMail(payload: AmpelDoiPayload): Promise<MailResult> {
  if (payload.check !== "kassen-check") return { stub: false, sent: false };
  if (await ampelConsentBlocked(payload.email, payload.consentAt)) {
    console.info("[kassen] Einwilligung blockiert");
    return { stub: false, sent: false, blocked: "suppressed" };
  }
  const mail = buildKassenDoiAckMail();
  if (!isMailConfigured()) {
    if (!magicLinkDevFallbackAllowed()) {
      console.error("[kassen] Einwilligungsmail nicht konfiguriert");
      return { stub: false, sent: false };
    }
    console.info("[kassen] dev fallback Einwilligungsmail — nur Server-Log, nicht in der Response");
    return { stub: true, sent: false };
  }
  const headers = ampelListUnsubscribeHeaders(payload.email, payload.consentAt);
  return sendDedupedEmail({
    dedupeKey: kassenAckDedupeKey(payload),
    to: payload.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(headers ? { headers } : {}),
  });
}
