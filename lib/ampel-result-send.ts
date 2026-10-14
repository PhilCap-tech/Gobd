import { createHash } from "node:crypto";
import { sanitizeAmpelRef } from "@/lib/ampel";
import { requestAmpelConfirmation, type AmpelConfirmationResult } from "@/lib/ampel-confirm";
import { sendAmpelConfirmationMail } from "@/lib/ampel-mail";
import { buildAmpelPdfMail, buildAmpelResultPdf } from "@/lib/ampel-pdf";
import { AMPEL_RESULT_MAIL } from "@/lib/ampel-questions";
import { ampelRateIpKey, ampelRateStore, type AmpelRateStore } from "@/lib/ampel-rate-limit";
import { decodeAmpelAnswers, encodeAmpelAnswers, normalizeAmpelEmail, scoreAmpel, type AmpelAnswerMap } from "@/lib/ampel-score";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { findLatestAmpelReadinessLead, upsertReadinessLead } from "@/lib/store";

export const AMPEL_PDF_FROM = "GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>";
export const AMPEL_PDF_FILENAME = "Betriebspruefungs-Ampel.pdf";

export type SubmitAmpelInput = {
  email: unknown;
  answers: unknown;
  ref: unknown;
  marketing: unknown;
  honeypot: unknown;
  ip: string;
};

export type SubmitAmpelDeps = {
  now?: () => number;
  store?: AmpelRateStore;
  confirm?: (input: { email: string; answers: string; ref: string }) => Promise<AmpelConfirmationResult>;
};

export type SubmitAmpelOutcome =
  | { ok: true; honeypot: true }
  | { ok: true; duplicate: boolean; marketing: "started" | "failed" | "skipped" }
  | { ok: false; status: 400 | 503; error: string }
  | { ok: false; status: 429; error: string; scope: "ip" | "email" };

const runs = new Map<string, Promise<SubmitAmpelOutcome>>();

export function ampelPdfDedupeKey(email: string, answers: string): string {
  const hash = createHash("sha256").update(answers).digest("hex").slice(0, 32);
  return `ampel-pdf:${email}:${hash}`;
}

function honeypotTripped(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return value != null && value !== false;
}

function delivered(mail: MailResult): boolean {
  return mail.sent || mail.stub || (mail.duplicate === true && mail.inflight !== true);
}

async function confirmMarketing(input: {
  email: string;
  answers: string;
  ref: string;
}): Promise<AmpelConfirmationResult> {
  return requestAmpelConfirmation(input, {
    findLead: (leadEmail, leadAnswers) =>
      findLatestAmpelReadinessLead(leadEmail, leadAnswers, { fresh: true }),
    saveLead: async (lead) => {
      await upsertReadinessLead(lead);
    },
    sendConfirmation: sendAmpelConfirmationMail,
  });
}

export async function sendAmpelPdfMail(input: {
  email: string;
  answers: AmpelAnswerMap;
  code: string;
}): Promise<MailResult> {
  const mail = buildAmpelPdfMail(input.answers);
  if (!mail) return { stub: false, sent: false };
  const pdf = await buildAmpelResultPdf(input.answers);
  return sendDedupedEmail({
    dedupeKey: ampelPdfDedupeKey(input.email, input.code),
    to: input.email,
    from: AMPEL_PDF_FROM,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: [
      {
        filename: AMPEL_PDF_FILENAME,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
}

async function runSubmit(
  email: string,
  answers: AmpelAnswerMap,
  code: string,
  input: SubmitAmpelInput,
  deps: SubmitAmpelDeps,
): Promise<SubmitAmpelOutcome> {
  const now = deps.now?.() ?? Date.now();
  const store = deps.store ?? ampelRateStore();
  let decision: "ok" | "ip" | "email";
  try {
    decision = await store.take({
      ipKey: ampelRateIpKey(input.ip || "unknown"),
      emailKey: `em:${email}`,
      now,
    });
  } catch (error) {
    console.error("[ampel] Rate-Limit fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: false, status: 503, error: AMPEL_RESULT_MAIL.sendFailed };
  }
  if (decision !== "ok") {
    return { ok: false, status: 429, error: AMPEL_RESULT_MAIL.rateLimited, scope: decision };
  }

  let mail: MailResult;
  try {
    mail = await sendAmpelPdfMail({ email, answers, code });
  } catch (error) {
    console.error("[ampel] Ergebnis-PDF fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: false, status: 503, error: AMPEL_RESULT_MAIL.sendFailed };
  }
  if (mail.inflight || !delivered(mail)) {
    return { ok: false, status: 503, error: AMPEL_RESULT_MAIL.sendFailed };
  }

  let marketing: "started" | "failed" | "skipped" = "skipped";
  if (input.marketing === true) {
    try {
      const confirm = deps.confirm ?? confirmMarketing;
      const confirmed = await confirm({
        email,
        answers: code,
        ref: sanitizeAmpelRef(input.ref),
      });
      marketing = confirmed.ok ? "started" : "failed";
    } catch (error) {
      console.error("[ampel] Einwilligung fehlgeschlagen", error instanceof Error ? error.name : "error");
      marketing = "failed";
    }
  }
  return { ok: true, duplicate: mail.duplicate === true, marketing };
}

export function submitAmpelResult(
  input: SubmitAmpelInput,
  deps: SubmitAmpelDeps = {},
): Promise<SubmitAmpelOutcome> {
  if (honeypotTripped(input.honeypot)) {
    return Promise.resolve({ ok: true, honeypot: true });
  }
  const email = normalizeAmpelEmail(input.email);
  if (!email) {
    return Promise.resolve({ ok: false, status: 400, error: AMPEL_RESULT_MAIL.invalidEmail });
  }
  const raw = typeof input.answers === "string" ? input.answers : "";
  const answers = decodeAmpelAnswers(raw);
  const code = answers ? encodeAmpelAnswers(answers) : null;
  if (!answers || !code || !scoreAmpel(answers)) {
    return Promise.resolve({ ok: false, status: 400, error: "Bitte beantworten Sie alle Fragen." });
  }
  const key = `${email}\n${code}`;
  const current = runs.get(key);
  if (current) return current;
  const run = runSubmit(email, answers, code, input, deps).finally(() => {
    if (runs.get(key) === run) runs.delete(key);
  });
  runs.set(key, run);
  return run;
}
