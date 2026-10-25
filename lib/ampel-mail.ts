import { getAppUrl, isMailConfigured, magicLinkDevFallbackAllowed } from "@/lib/env";
import { LEGAL_OPERATOR } from "@/lib/legal";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { ampelConsentBlocked, mayMarket } from "@/lib/ampel-marketing-guard";
import {
  escapeAttr,
  escapeHtml,
  MAIL_CHECKOUT_URL,
  transactionalPrimaryButton,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";
import { CUSTOMER_MAIL_SIGNATURE } from "@/lib/ops";
import {
  AMPEL_CAP_NOTE,
  AMPEL_CTA,
  AMPEL_DISCLAIMER,
  AMPEL_RESULT_REGISTER_LINE,
  AMPEL_RESULTS,
} from "@/lib/ampel-questions";
import {
  AMPEL_CONFIRM_WINDOW_MS,
  AMPEL_DOI_TTL_MS,
  ampelNeinQuestions,
  ampelResultPath,
  createAmpelUnsubscribeToken,
  decodeAmpelAnswers,
  verifyAmpelDoiToken,
  publicAmpelSource,
  type AmpelDoiPayload,
} from "@/lib/ampel";
import { scoreAmpelCheck } from "@/lib/ampel-check-score";

const DOI_HOURS = Math.round(AMPEL_DOI_TTL_MS / (60 * 60 * 1000));

export function ampelConfirmUrl(token: string): string {
  return `${getAppUrl()}/ampel-check/bestaetigen?token=${encodeURIComponent(token)}`;
}

export function buildAmpelConfirmationMail(input: { confirmUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Bitte bestätigen Sie Ihre E-Mail — GoBD-Ampel";
  const lines = [
    "Guten Tag,",
    "",
    "Sie haben zugestimmt, per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) zu erhalten. Bitte bestätigen Sie das über den folgenden Link.",
    `Der Link ist ${DOI_HOURS} Stunden gültig.`,
    "Ohne diese Bestätigung senden wir keine weiteren E-Mails. Das angeforderte Ergebnis-PDF erhalten Sie unabhängig davon.",
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
    <p>Sie haben zugestimmt, per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) zu erhalten. Bitte bestätigen Sie das über den folgenden Link. Ohne diese Bestätigung senden wir keine weiteren E-Mails. Das angeforderte Ergebnis-PDF erhalten Sie unabhängig davon.</p>
    <p>${transactionalPrimaryButton(input.confirmUrl, "E-Mail-Adresse bestätigen")}</p>
    <p>Der Link ist ${DOI_HOURS} Stunden gültig. Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren. Die Einwilligung können Sie jederzeit widerrufen.</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

export async function buildAmpelResultMail(payload: AmpelDoiPayload): Promise<{
  subject: string;
  text: string;
  html: string;
} | null> {
  const answers = decodeAmpelAnswers(payload.answers);
  if (!answers) return null;
  const scored = scoreAmpelCheck(answers);
  if (!scored) return null;
  const band = AMPEL_RESULTS[scored.light];
  const nein = ampelNeinQuestions(answers);
  const resultUrl = `${getAppUrl()}${ampelResultPath(payload.answers, payload.ref)}`;
  const subject = `Ihr Ampel-Ergebnis: ${band.label} — GoBD-Ampel`;
  const lines = [
    "Guten Tag,",
    "",
    `Ihr Ergebnis: ${band.label}.`,
    band.headline,
    "",
    band.text,
  ];
  if (scored.capped) {
    lines.push("", AMPEL_CAP_NOTE);
  }
  if (nein.length > 0) {
    lines.push("", "Mit Nein beantwortet:");
    for (const question of nein) {
      lines.push(`- ${question.question}`, `  ${question.explanation}`, `  Quelle: ${publicAmpelSource(question.source)}`);
    }
  }
  lines.push("", "Hinweise:");
  for (const hint of band.hints) lines.push(`- ${hint}`);
  const unsubscribeUrl = await ampelUnsubscribeUrl(payload);
  lines.push(
    "",
    AMPEL_CTA.headline,
    AMPEL_CTA.text,
    AMPEL_CTA.price,
    `${AMPEL_CTA.button}: ${MAIL_CHECKOUT_URL}`,
    "",
    `Ergebnis erneut öffnen: ${resultUrl}`,
    "",
    AMPEL_DISCLAIMER,
    "",
    unsubscribeUrl ? `Wenn Sie keine weiteren Informationen wünschen, melden Sie sich hier ab: ${unsubscribeUrl}` : "",
    "",
    AMPEL_RESULT_REGISTER_LINE,
    "",
    CUSTOMER_MAIL_SIGNATURE,
  );
  const neinHtml = nein
    .map(
      (question) =>
        `<li><strong>${escapeHtml(question.question)}</strong><br />${escapeHtml(question.explanation)}<br />Quelle: ${escapeHtml(publicAmpelSource(question.source))}</li>`,
    )
    .join("");
  const hintsHtml = band.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("");
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>Ihr Ergebnis: <strong>${escapeHtml(band.label)}</strong>.</p>
    <p><strong>${escapeHtml(band.headline)}</strong></p>
    <p>${escapeHtml(band.text)}</p>
    ${scored.capped ? `<p>${escapeHtml(AMPEL_CAP_NOTE)}</p>` : ""}
    ${neinHtml ? `<p>Mit Nein beantwortet:</p><ul>${neinHtml}</ul>` : ""}
    <p>Hinweise:</p>
    <ul>${hintsHtml}</ul>
    <p><strong>${escapeHtml(AMPEL_CTA.headline)}</strong></p>
    <p>${escapeHtml(AMPEL_CTA.text)}</p>
    <p>${escapeHtml(AMPEL_CTA.price)}</p>
    <p>${transactionalPrimaryButton(MAIL_CHECKOUT_URL, AMPEL_CTA.button)}</p>
    <p><a href="${escapeAttr(resultUrl)}">Ergebnis erneut öffnen</a></p>
    <p>${escapeHtml(AMPEL_DISCLAIMER)}</p>
    ${
      unsubscribeUrl
        ? `<p>Wenn Sie keine weiteren Informationen wünschen, <a href="${escapeAttr(unsubscribeUrl)}">melden Sie sich hier ab</a>.</p>`
        : ""
    }
    <p>${escapeHtml(AMPEL_RESULT_REGISTER_LINE)}</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

async function ampelUnsubscribeUrl(payload: AmpelDoiPayload): Promise<string> {
  const token = await createAmpelUnsubscribeToken(payload.email, payload.consentAt);
  if (!token) return "";
  return `${getAppUrl()}/ampel-check/abmelden?token=${encodeURIComponent(token)}`;
}

function ampelConfirmDedupeKey(email: string, consentAt: string): string {
  return `ampel-confirm:${email.trim().toLowerCase()}:${consentAt}`;
}

/** One-click and mailto unsubscribe headers. The visible link stays on the confirm page. */
export async function ampelListUnsubscribeHeaders(
  email: string,
  consentAt: string,
): Promise<Record<string, string> | undefined> {
  const token = await createAmpelUnsubscribeToken(email, consentAt);
  if (!token) return undefined;
  const oneClickUrl = `${getAppUrl()}/api/ampel/abmelden?token=${encodeURIComponent(token)}`;
  const mailto = `mailto:${LEGAL_OPERATOR.email}?subject=Abmelden`;
  return {
    "List-Unsubscribe": `<${oneClickUrl}>, <${mailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function ampelResultDedupeKey(payload: AmpelDoiPayload): string {
  return `ampel-result:${payload.email}:${payload.answers}:${payload.consentAt}`;
}

export async function sendAmpelConfirmationMail(input: {
  email: string;
  token: string;
}): Promise<MailResult> {
  const confirmed = await verifyAmpelDoiToken(input.token);
  const consentAt = confirmed?.consentAt ?? "";
  if (await ampelConsentBlocked(input.email, consentAt)) {
    console.info("[ampel] Bestätigungsmail blockiert");
    return { stub: false, sent: false, blocked: "suppressed" };
  }
  const confirmUrl = ampelConfirmUrl(input.token);
  if (!isMailConfigured()) {
    if (!magicLinkDevFallbackAllowed()) {
      console.error("[ampel] Bestätigungsmail nicht konfiguriert");
      return { stub: false, sent: false };
    }
    console.info("[ampel] dev fallback Bestätigungslink — nur Server-Log, nicht in der Response");
    console.info(confirmUrl);
    return { stub: true, sent: false };
  }
  const mail = buildAmpelConfirmationMail({ confirmUrl });
  const headers = confirmed ? await ampelListUnsubscribeHeaders(confirmed.email, confirmed.consentAt) : undefined;
  if (confirmed && !headers) return { stub: false, sent: false };
  return sendDedupedEmail({
    dedupeKey: ampelConfirmDedupeKey(confirmed?.email || input.email, consentAt),
    windowMs: AMPEL_CONFIRM_WINDOW_MS,
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(headers ? { headers } : {}),
  });
}

export async function sendAmpelResultMail(payload: AmpelDoiPayload): Promise<MailResult> {
  const mail = await buildAmpelResultMail(payload);
  if (!mail) return { stub: false, sent: false };
  if (!(await mayMarket(payload.email, { consentAt: payload.consentAt, answers: payload.answers }))) {
    console.info("[ampel] Ergebnismail blockiert");
    return { stub: false, sent: false, blocked: "no-confirmed-doi" };
  }
  if (!isMailConfigured()) {
    if (!magicLinkDevFallbackAllowed()) {
      console.error("[ampel] Ergebnismail nicht konfiguriert");
      return { stub: false, sent: false };
    }
    console.info("[ampel] dev fallback Ergebnismail — nur Server-Log, nicht in der Response");
    console.info(mail.text);
    return { stub: true, sent: false };
  }
  const headers = await ampelListUnsubscribeHeaders(payload.email, payload.consentAt);
  if (!headers) return { stub: false, sent: false };
  return sendDedupedEmail({
    dedupeKey: ampelResultDedupeKey(payload),
    to: payload.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(headers ? { headers } : {}),
  });
}
