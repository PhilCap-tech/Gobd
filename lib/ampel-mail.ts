import { getAppUrl, isMailConfigured, magicLinkDevFallbackAllowed } from "@/lib/env";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
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
  AMPEL_RESULTS,
} from "@/lib/ampel-questions";
import {
  AMPEL_CONFIRM_WINDOW_MS,
  AMPEL_DOI_TTL_MS,
  ampelNeinQuestions,
  ampelResultPath,
  decodeAmpelAnswers,
  publicAmpelSource,
  scoreAmpel,
  type AmpelDoiPayload,
} from "@/lib/ampel";

const DOI_HOURS = Math.round(AMPEL_DOI_TTL_MS / (60 * 60 * 1000));

export function ampelConfirmUrl(token: string): string {
  return `${getAppUrl()}/ampel-check/bestaetigen?token=${encodeURIComponent(token)}`;
}

export function buildAmpelConfirmationMail(input: { confirmUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Bitte bestätigen Sie Ihre E-Mail — Betriebsprüfungs-Ampel";
  const lines = [
    "Guten Tag,",
    "",
    "Sie haben das Ergebnis der Betriebsprüfungs-Ampel angefordert.",
    `Bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link (${DOI_HOURS} Stunden gültig).`,
    "Ihr Ergebnis senden wir Ihnen erst nach dieser Bestätigung.",
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
    <p>Sie haben das Ergebnis der Betriebsprüfungs-Ampel angefordert. Bitte bestätigen Sie Ihre E-Mail-Adresse. Ihr Ergebnis senden wir Ihnen erst nach dieser Bestätigung.</p>
    <p>${transactionalPrimaryButton(input.confirmUrl, "E-Mail-Adresse bestätigen")}</p>
    <p>Der Link ist ${DOI_HOURS} Stunden gültig. Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren. Die Einwilligung können Sie jederzeit widerrufen.</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

export function buildAmpelResultMail(payload: AmpelDoiPayload): {
  subject: string;
  text: string;
  html: string;
} | null {
  const answers = decodeAmpelAnswers(payload.answers);
  if (!answers) return null;
  const scored = scoreAmpel(answers);
  if (!scored) return null;
  const band = AMPEL_RESULTS[scored.light];
  const nein = ampelNeinQuestions(answers);
  const resultUrl = `${getAppUrl()}${ampelResultPath(payload.answers, payload.ref)}`;
  const subject = `Ihr Ampel-Ergebnis: ${band.label} — Betriebsprüfungs-Ampel`;
  const lines = [
    "Guten Tag,",
    "",
    `Ihr Ergebnis: ${band.label}, ${scored.score} von 100.`,
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
    <p>Ihr Ergebnis: <strong>${escapeHtml(band.label)}</strong>, ${scored.score} von 100.</p>
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
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return { subject, text: wrapTransactionalText(lines.join("\n")), html };
}

function ampelConfirmDedupeKey(email: string): string {
  return `ampel-confirm:${email.trim().toLowerCase()}`;
}

function ampelResultDedupeKey(payload: AmpelDoiPayload): string {
  return `ampel-result:${payload.email}:${payload.answers}:${payload.consentAt}`;
}

export async function sendAmpelConfirmationMail(input: {
  email: string;
  token: string;
}): Promise<MailResult> {
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
  return sendDedupedEmail({
    dedupeKey: ampelConfirmDedupeKey(input.email),
    windowMs: AMPEL_CONFIRM_WINDOW_MS,
    to: input.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

export async function sendAmpelResultMail(payload: AmpelDoiPayload): Promise<MailResult> {
  const mail = buildAmpelResultMail(payload);
  if (!mail) return { stub: false, sent: false };
  if (!isMailConfigured()) {
    if (!magicLinkDevFallbackAllowed()) {
      console.error("[ampel] Ergebnismail nicht konfiguriert");
      return { stub: false, sent: false };
    }
    console.info("[ampel] dev fallback Ergebnismail — nur Server-Log, nicht in der Response");
    console.info(mail.text);
    return { stub: true, sent: false };
  }
  return sendDedupedEmail({
    dedupeKey: ampelResultDedupeKey(payload),
    to: payload.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}
