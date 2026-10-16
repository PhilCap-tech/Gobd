import { createHash } from "node:crypto";
import { sanitizeAmpelRef, toAmpelReadinessLead } from "@/lib/ampel";
import { requestAmpelConfirmation, type AmpelConfirmationInput, type AmpelConfirmationResult } from "@/lib/ampel-confirm";
import { sendAmpelConfirmationMail } from "@/lib/ampel-mail";
import { ampelConsentBlocked } from "@/lib/ampel-marketing-guard";
import { buildAmpelPdfMail, buildAmpelResultPdf } from "@/lib/ampel-pdf";
import {
  ampelMailStatusId,
  ampelMailStatusStore,
  type AmpelMailStatusStore,
} from "@/lib/ampel-mail-status";
import { AMPEL_CONSENT_TEXT_VERSION, AMPEL_RESULT_MAIL } from "@/lib/ampel-questions";
import {
  AMPEL_IP_WINDOW_MS,
  ampelRateIpKey,
  ampelRateLogLine,
  ampelRateStore,
  ampelRateWindowId,
  logAmpelRateFailure,
  withAmpelRateIdentity,
  type AmpelRateHold,
  type AmpelRateStore,
  type AmpelRateTrace,
} from "@/lib/ampel-rate-limit";
import {
  ampelSendTokenPresent,
  consumeAmpelSendToken,
  issueAmpelSendToken,
  ampelSendTokenStore,
  type AmpelSendTokenStore,
} from "@/lib/ampel-send-token";
import { decodeAmpelAnswers, encodeAmpelAnswers, normalizeAmpelEmail, scoreAmpel, type AmpelAnswerMap } from "@/lib/ampel-score";
import type { MailResult } from "@/lib/mail";
import { lookupMailDedupe, sendDedupedEmail } from "@/lib/mail-dedupe";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { findLatestAmpelReadinessLead, upsertReadinessLead } from "@/lib/store";
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
  /** Which request header supplied `ip`. Empty when the address is missing. */
  ipSource?: string;
  /** One-time token from the handoff response. Required to send the mail. */
  sendToken?: unknown;
};

export type SubmitAmpelDeps = {
  now?: () => number;
  store?: AmpelRateStore;
  confirm?: (input: AmpelConfirmationInput) => Promise<AmpelConfirmationResult>;
  saveLead?: (lead: ReadinessLead) => Promise<void>;
  mail?: (input: { email: string; answers: AmpelAnswerMap; code: string }) => Promise<MailResult>;
  sendTimeoutMs?: number;
  /** Return after the limit check and let a second request send the mail. */
  handoff?: boolean;
  status?: AmpelMailStatusStore;
  tokens?: AmpelSendTokenStore;
};

export type SubmitAmpelOutcome =
  | { ok: true; honeypot: true; trace?: AmpelRateTrace }
  | {
      ok: true;
      duplicate: boolean;
      marketing: "started" | "failed" | "skipped";
      mailed: boolean;
      notice?: string;
      pending?: boolean;
      token?: string;
      limited?: "ip" | "email";
      trace?: AmpelRateTrace;
    }
  | { ok: false; status: 400 | 403; error: string; trace?: AmpelRateTrace };

function gridFields(hold: { rows?: number; match?: number }): { rows?: number; match?: number } {
  return {
    ...(typeof hold.rows === "number" ? { rows: hold.rows } : {}),
    ...(typeof hold.match === "number" ? { match: hold.match } : {}),
  };
}

function stamp(
  outcome: SubmitAmpelOutcome,
  trace: AmpelRateTrace,
  input: { ip: string; ipSource?: string },
): SubmitAmpelOutcome {
  return { ...outcome, trace: withAmpelRateIdentity(trace, input.ip, input.ipSource ?? "") };
}

function failOpenCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "ampel-rate-range") return "range";
  if (message === "ampel-rate-position") return "position";
  if (message === "ampel-rate-unshared") return "unshared";
  return "store";
}

function allowTrace(store: AmpelRateStore, hold: AmpelRateHold, now: number): AmpelRateTrace {
  if ((store.origin ?? "memory") === "sheets") {
    return {
      kind: "sheets",
      pos: hold.ipSlot,
      win: ampelRateWindowId(now, AMPEL_IP_WINDOW_MS),
      ...gridFields(hold),
    };
  }
  return { kind: "skip", reason: store.origin ?? "memory" };
}

function limitTrace(decision: "ip" | "email", hold: AmpelRateHold): AmpelRateTrace {
  return { kind: "limit", pos: decision === "email" ? hold.emailSlot : hold.ipSlot, ...gridFields(hold) };
}

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

function alreadySent(): SubmitAmpelOutcome {
  return {
    ok: true,
    duplicate: true,
    marketing: "skipped",
    mailed: false,
    notice: AMPEL_RESULT_MAIL.alreadySent,
  };
}

function limited(scope: "ip" | "email"): SubmitAmpelOutcome {
  return {
    ok: true,
    duplicate: false,
    marketing: "skipped",
    mailed: false,
    limited: scope,
    notice: scope === "ip" ? AMPEL_RESULT_MAIL.rateLimitedIp : AMPEL_RESULT_MAIL.rateLimitedEmail,
  };
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

async function confirmMarketing(input: AmpelConfirmationInput): Promise<AmpelConfirmationResult> {
  return requestAmpelConfirmation(input, {
    findLead: (leadEmail, leadAnswers) =>
      findLatestAmpelReadinessLead(leadEmail, leadAnswers, { fresh: true }),
    saveLead: async (lead) => {
      if (automatedRunForbidsLiveWrites()) return;
      await upsertReadinessLead(lead);
    },
    sendConfirmation: sendAmpelConfirmationMail,
  });
}

/** Transactional result PDF for every requested check. No DOI and no suppression check. */
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
  const source = input.ipSource ?? "";
  const prior = await lookupMailDedupe(ampelPdfDedupeKey(email, code));
  if (prior === "sent" || prior === "inflight") return stamp(alreadySent(), { kind: "skip", reason: "duplicate" }, input);
  const clientIp = input.ip.trim();
  if (!clientIp || clientIp.toLowerCase() === "unknown") {
    console.info(ampelRateLogLine(source, 0, ""));
    return stamp(withheld(AMPEL_RESULT_MAIL.shownWithoutMail), { kind: "skip", reason: "noip" }, input);
  }
  const store = deps.store ?? ampelRateStore();
  const hold: AmpelRateHold = { ipSlot: 0, emailSlot: 0 };
  let decision: "ok" | "ip" | "email" = "ok";
  let trace: AmpelRateTrace | null = null;
  try {
    decision = await store.take({
      ipKey: ampelRateIpKey(clientIp),
      emailKey: `em:${email}`,
      now,
      hold,
    });
  } catch (error) {
    // Fail open. A store error is not proof that slots 1..N are full.
    // Log it without the address and send the mail anyway.
    logAmpelRateFailure("store", error);
    decision = "ok";
    trace = { kind: "failopen", err: failOpenCode(error), ...gridFields(hold) };
  }
  if (!trace) trace = decision === "ok" ? allowTrace(store, hold, now) : limitTrace(decision, hold);
  console.info(ampelRateLogLine(source, decision === "ok" ? hold.ipSlot : 0, clientIp));
  if (decision !== "ok") return stamp(limited(decision), trace, input);

  if (deps.handoff && hold.ipSlot >= 1 && hold.emailSlot >= 1) {
    let token: string | null = null;
    try {
      token = await issueAmpelSendToken(
        {
          email,
          code,
          now,
          ipSlot: hold.ipSlot,
          emailSlot: hold.emailSlot,
          rows: hold.rows,
          match: hold.match,
        },
        deps.tokens ?? ampelSendTokenStore(),
      );
    } catch (error) {
      console.error("[ampel] Versandtoken fehlgeschlagen", error instanceof Error ? error.name : "error");
      return stamp(withheld(AMPEL_RESULT_MAIL.shownWithoutMail), trace, input);
    }
    if (!token) return stamp(withheld(AMPEL_RESULT_MAIL.shownWithoutMail), trace, input);
    try {
      const status = deps.status ?? ampelMailStatusStore();
      await status.write(ampelMailStatusId(email, code), {
        state: "sending",
        notice: AMPEL_RESULT_MAIL.sending,
      });
    } catch (error) {
      console.error("[ampel] Versandstatus fehlgeschlagen", error instanceof Error ? error.name : "error");
      return stamp(withheld(AMPEL_RESULT_MAIL.shownWithoutMail), trace, input);
    }
    return stamp(
      {
        ok: true,
        duplicate: false,
        marketing: "skipped",
        mailed: false,
        pending: true,
        token,
        notice: AMPEL_RESULT_MAIL.sending,
      },
      trace,
      input,
    );
  }

  return stamp(await deliverAmpelResult(email, answers, code, input, deps, now), trace, input);
}

export async function deliverAmpelResult(
  email: string,
  answers: AmpelAnswerMap,
  code: string,
  input: SubmitAmpelInput,
  deps: SubmitAmpelDeps,
  now = deps.now?.() ?? Date.now(),
): Promise<SubmitAmpelOutcome> {
  const timeoutMs = deps.sendTimeoutMs ?? AMPEL_SEND_TIMEOUT_MS;
  let mail: MailResult;
  try {
    const send = deps.mail ?? ((payload) => sendAmpelPdfMail(payload, timeoutMs));
    mail = await withDeadline(send({ email, answers, code }), timeoutMs);
  } catch (error) {
    console.error("[ampel] Ergebnis-PDF fehlgeschlagen", error instanceof Error ? error.name : "error");
    return withheld(AMPEL_RESULT_MAIL.shownWithoutMail);
  }
  if (mail.duplicate) return alreadySent();
  if (mail.inflight || !delivered(mail)) {
    return withheld(AMPEL_RESULT_MAIL.shownWithoutMail);
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
        marketingOptIn: input.marketing === true ? "pending" : "",
        mailed: "ja",
      });
      lead.status = "ampel_pdf";
      lead.timestamp = consentAt;
      const save = deps.saveLead ?? (async (row: ReadinessLead) => {
        if (automatedRunForbidsLiveWrites()) return;
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
      const blocked = await ampelConsentBlocked(email, new Date(now).toISOString());
      if (!blocked) {
        const confirm = deps.confirm ?? confirmMarketing;
        const confirmed = await withDeadline(
          confirm({
            email,
            answers: code,
            ref: sanitizeAmpelRef(input.ref),
            consentIp: input.ip,
            consentTextVersion: AMPEL_CONSENT_TEXT_VERSION,
            mailed: "ja",
          }),
          timeoutMs,
        );
        if (!confirmed.ok) marketing = "failed";
        else if (confirmed.blocked === "suppressed") marketing = "skipped";
        else marketing = "started";
      }
    } catch (error) {
      console.error("[ampel] Einwilligung fehlgeschlagen", error instanceof Error ? error.name : "error");
      marketing = "failed";
    }
  }
  const notice =
    marketing === "started"
      ? `${AMPEL_RESULT_MAIL.sent} ${AMPEL_RESULT_MAIL.doiSuccess}`
      : AMPEL_RESULT_MAIL.sent;
  return { ok: true, duplicate: false, marketing, mailed: true, notice };
}

export async function completeAmpelResult(
  input: SubmitAmpelInput,
  deps: SubmitAmpelDeps = {},
): Promise<SubmitAmpelOutcome> {
  const source = input.ipSource ?? "";
  const started = deps.now?.() ?? Date.now();
  if (!ampelSendTokenPresent(input.sendToken)) {
    return stamp({ ok: false, status: 403, error: AMPEL_RESULT_MAIL.sendUnauthorized }, { kind: "skip", reason: "token" }, input);
  }
  if (honeypotTripped(input.honeypot)) return stamp({ ok: true, honeypot: true }, { kind: "skip", reason: "honeypot" }, input);
  const email = normalizeAmpelEmail(input.email);
  if (!email) return stamp({ ok: false, status: 400, error: AMPEL_RESULT_MAIL.invalidEmail }, { kind: "skip", reason: "email" }, input);
  const raw = typeof input.answers === "string" ? input.answers : "";
  const answers = decodeAmpelAnswers(raw);
  const code = answers ? encodeAmpelAnswers(answers) : null;
  if (!answers || !code || !scoreAmpel(answers)) {
    return stamp({ ok: false, status: 400, error: "Bitte beantworten Sie alle Fragen." }, { kind: "skip", reason: "answers" }, input);
  }
  const now = started;
  let consumed: Awaited<ReturnType<typeof consumeAmpelSendToken>> = { verdict: "invalid", ipSlot: 0, emailSlot: 0 };
  try {
    consumed = await consumeAmpelSendToken(
      { token: input.sendToken, email, code, now },
      deps.tokens ?? ampelSendTokenStore(),
    );
  } catch (error) {
    console.error("[ampel] Versandtoken fehlgeschlagen", error instanceof Error ? error.name : "error");
    return stamp({ ok: false, status: 403, error: AMPEL_RESULT_MAIL.sendUnauthorized }, { kind: "skip", reason: "token" }, input);
  }
  if (consumed.verdict !== "ok") {
    return stamp({ ok: false, status: 403, error: AMPEL_RESULT_MAIL.sendUnauthorized }, { kind: "skip", reason: "token" }, input);
  }
  const store = deps.store ?? ampelRateStore();
  let trace: AmpelRateTrace = { kind: "skip", reason: "noip", ...gridFields(consumed) };
  const clientIp = input.ip.trim();
  if (!clientIp || clientIp.toLowerCase() === "unknown") {
    console.info(ampelRateLogLine(source, consumed.ipSlot, ""));
  } else {
    try {
      const confirmed = await store.confirm({
        ipKey: ampelRateIpKey(clientIp),
        emailKey: `em:${email}`,
        now,
        ipSlot: consumed.ipSlot,
        emailSlot: consumed.emailSlot,
      });
      console.info(ampelRateLogLine(source, consumed.ipSlot, clientIp));
      if (confirmed === "ip" || confirmed === "email") {
        return stamp(
          limited(confirmed),
          {
            kind: "limit",
            pos: confirmed === "email" ? consumed.emailSlot : consumed.ipSlot,
            ...gridFields(consumed),
          },
          input,
        );
      }
      trace =
        (store.origin ?? "memory") === "sheets"
          ? {
              kind: "sheets",
              pos: consumed.ipSlot,
              win: ampelRateWindowId(now, AMPEL_IP_WINDOW_MS),
              ...gridFields(consumed),
            }
          : { kind: "skip", reason: store.origin ?? "memory" };
    } catch (error) {
      logAmpelRateFailure("confirm", error);
      trace = { kind: "failopen", err: "confirm", ...gridFields(consumed) };
    }
  }
  const prior = await lookupMailDedupe(ampelPdfDedupeKey(email, code));
  if (prior === "sent" || prior === "inflight") return stamp(alreadySent(), trace, input);
  const status = deps.status ?? ampelMailStatusStore();
  let row: { state: string; notice: string } | null = null;
  try {
    row = await status.read(ampelMailStatusId(email, code));
  } catch (error) {
    console.error("[ampel] Versandstatus fehlgeschlagen", error instanceof Error ? error.name : "error");
    return stamp(withheld(AMPEL_RESULT_MAIL.shownWithoutMail), trace, input);
  }
  if (!row || row.state !== "sending") {
    if (row?.state === "sent") return stamp(alreadySent(), trace, input);
    return stamp(withheld(row?.notice || AMPEL_RESULT_MAIL.shownWithoutMail), trace, input);
  }
  const outcome = await deliverAmpelResult(email, answers, code, input, deps);
  if (outcome.ok && !("honeypot" in outcome)) {
    try {
      await status.write(ampelMailStatusId(email, code), {
        state: outcome.mailed || outcome.duplicate ? "sent" : "failed",
        notice: outcome.notice || AMPEL_RESULT_MAIL.shownWithoutMail,
      });
    } catch (error) {
      console.error("[ampel] Versandstatus fehlgeschlagen", error instanceof Error ? error.name : "error");
    }
  }
  return stamp(outcome, trace, input);
}

export function submitAmpelResult(
  input: SubmitAmpelInput,
  deps: SubmitAmpelDeps = {},
): Promise<SubmitAmpelOutcome> {
  if (honeypotTripped(input.honeypot)) {
    return Promise.resolve(stamp({ ok: true, honeypot: true }, { kind: "skip", reason: "honeypot" }, input));
  }
  const email = normalizeAmpelEmail(input.email);
  if (!email) {
    return Promise.resolve(stamp({ ok: false, status: 400, error: AMPEL_RESULT_MAIL.invalidEmail }, { kind: "skip", reason: "email" }, input));
  }
  const raw = typeof input.answers === "string" ? input.answers : "";
  const answers = decodeAmpelAnswers(raw);
  const code = answers ? encodeAmpelAnswers(answers) : null;
  if (!answers || !code || !scoreAmpel(answers)) {
    return Promise.resolve(stamp({ ok: false, status: 400, error: "Bitte beantworten Sie alle Fragen." }, { kind: "skip", reason: "answers" }, input));
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
