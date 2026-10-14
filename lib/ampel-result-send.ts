import { createHash } from "node:crypto";
import { sanitizeAmpelRef, toAmpelReadinessLead } from "@/lib/ampel";
import { requestAmpelConfirmation, type AmpelConfirmationResult } from "@/lib/ampel-confirm";
import { sendAmpelConfirmationMail } from "@/lib/ampel-mail";
import { buildAmpelPdfMail, buildAmpelResultPdf } from "@/lib/ampel-pdf";
import { AMPEL_CONSENT_TEXT_VERSION, AMPEL_RESULT_MAIL } from "@/lib/ampel-questions";
import { ampelRateIpKey, ampelRateStore, type AmpelRateStore } from "@/lib/ampel-rate-limit";
import { decodeAmpelAnswers, encodeAmpelAnswers, normalizeAmpelEmail, scoreAmpel, type AmpelAnswerMap } from "@/lib/ampel-score";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { findLatestAmpelReadinessLead, purgeExpiredAmpelLeads, upsertReadinessLead } from "@/lib/store";
import type { ReadinessLead } from "@/lib/readiness";

export const AMPEL_PDF_FROM = "GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>";
export const AMPEL_PDF_FILENAME = "Betriebspruefungs-Ampel.pdf";
export const AMPEL_SEND_TIMEOUT_MS = 8_000;

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
  confirm?: (input: {
    email: string;
    answers: string;
    ref: string;
    consentIp?: string;
    consentTextVersion?: string;
  }) => Promise<AmpelConfirmationResult>;
  saveLead?: (lead: ReadinessLead) => Promise<void>;
  purge?: () => Promise<void>;
  mail?: (input: { email: string; answers: AmpelAnswerMap; code: string }) => Promise<MailResult>;
  sendTimeoutMs?: number;
};

export type SubmitAmpelOutcome =
  | { ok: true; honeypot: true }
  | {
      ok: true;
      duplicate: boolean;
      marketing: "started" | "failed" | "skipped";
      mailed: boolean;
      notice?: string;
    }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 429; error: string; scope: "ip" | "email" };

export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ampel-timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function withheld(notice: string): SubmitAmpelOutcome {
  return { ok: true, duplicate: false, marketing: "skipped", mailed: false, notice };
}

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
  consentIp?: string;
  consentTextVersion?: string;
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

export async function sendAmpelPdfMail(
  input: {
    email: string;
    answers: AmpelAnswerMap;
    code: string;
  },
  timeoutMs = AMPEL_SEND_TIMEOUT_MS,
): Promise<MailResult> {
  const mail = buildAmpelPdfMail(input.answers);
  if (!mail) return { stub: false, sent: false };
  const pdf = await withDeadline(buildAmpelResultPdf(input.answers), timeoutMs);
  return withDeadline(
    sendDedupedEmail({
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
    }),
    timeoutMs,
  );
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
    return withheld(AMPEL_RESULT_MAIL.shownWithoutMail);
  }
  if (decision !== "ok") {
    return { ok: false, status: 429, error: AMPEL_RESULT_MAIL.rateLimited, scope: decision };
  }

  const timeoutMs = deps.sendTimeoutMs ?? AMPEL_SEND_TIMEOUT_MS;
  let mail: MailResult;
  try {
    const send = deps.mail ?? ((payload) => sendAmpelPdfMail(payload, timeoutMs));
    mail = await withDeadline(send({ email, answers, code }), timeoutMs);
  } catch (error) {
    console.error("[ampel] Ergebnis-PDF fehlgeschlagen", error instanceof Error ? error.name : "error");
    return withheld(AMPEL_RESULT_MAIL.shownWithoutMail);
  }
  if (mail.inflight || !delivered(mail)) {
    return withheld(AMPEL_RESULT_MAIL.shownWithoutMail);
  }

  const purge = deps.purge ?? (async () => {
    await purgeExpiredAmpelLeads(now);
  });
  try {
    await withDeadline(purge(), timeoutMs);
  } catch (error) {
    console.error("[ampel] Ergebnis speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
  }
  try {
    const scored = scoreAmpel(answers);
    if (scored) {
      const consentAt = new Date(now).toISOString();
      const lead = toAmpelReadinessLead({
        email,
        answers: code,
        ref: sanitizeAmpelRef(input.ref),
        consentAt,
        doiConfirmedAt: "",
        score: scored.score,
        light: scored.light,
        mailStatus: "pdf_sent",
      });
      lead.status = "ampel_pdf";
      lead.timestamp = consentAt;
      const save = deps.saveLead ?? (async (row: ReadinessLead) => {
        await upsertReadinessLead(row);
      });
      await withDeadline(save(lead), timeoutMs);
    }
  } catch (error) {
    console.error("[ampel] Ergebnis speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
  }

  let marketing: "started" | "failed" | "skipped" = "skipped";
  if (input.marketing === true) {
    try {
      const confirm = deps.confirm ?? confirmMarketing;
      const confirmed = await withDeadline(
        confirm({
          email,
          answers: code,
          ref: sanitizeAmpelRef(input.ref),
          consentIp: input.ip,
          consentTextVersion: AMPEL_CONSENT_TEXT_VERSION,
        }),
        timeoutMs,
      );
      marketing = confirmed.ok ? "started" : "failed";
    } catch (error) {
      console.error("[ampel] Einwilligung fehlgeschlagen", error instanceof Error ? error.name : "error");
      marketing = "failed";
    }
  }
  return { ok: true, duplicate: mail.duplicate === true, marketing, mailed: true };
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
