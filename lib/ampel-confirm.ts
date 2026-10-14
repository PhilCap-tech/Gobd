import type { MailResult } from "@/lib/mail";
import type { ReadinessLead } from "@/lib/readiness";
import { sendAmpelConfirmationMail, sendAmpelResultMail } from "@/lib/ampel-mail";
import {
  AMPEL_CONFIRM_WINDOW_MS,
  ampelLeadId,
  createAmpelDoiToken,
  decodeAmpelAnswers,
  encodeAmpelAnswers,
  normalizeAmpelEmail,
  sanitizeAmpelRef,
  scoreAmpel,
  toAmpelReadinessLead,
  verifyAmpelDoiToken,
  type AmpelDoiPayload,
  type AmpelLight,
} from "@/lib/ampel";
import { AMPEL_CONSENT_TEXT_VERSION } from "@/lib/ampel-questions";

/** Pauses between result-mail attempts. The first attempt does not wait. */
export const AMPEL_RESULT_RETRY_DELAYS_MS = [0, 400, 1200] as const;

const RECORDED_MAIL = new Set(["sent", "duplicate", "stub"]);
const runs = new Map<string, Promise<AmpelConfirmResult>>();

export function ampelResultMailRecorded(status: string | undefined): boolean {
  return RECORDED_MAIL.has((status ?? "").trim());
}

export type AmpelConfirmDeps = {
  findLead: (leadId: string) => Promise<ReadinessLead | null>;
  saveLead: (lead: ReadinessLead) => Promise<void>;
  sendResult?: (payload: AmpelDoiPayload) => Promise<MailResult>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type AmpelConfirmResult =
  | { ok: true; score: number; light: AmpelLight; alreadySent: boolean }
  | { ok: false; status: 400 | 503; reason: "invalid" | "mail" };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mailLabel(mail: MailResult): string {
  if (mail.sent) return "sent";
  if (mail.duplicate) return "duplicate";
  if (mail.stub) return "stub";
  return "failed";
}

function delivered(mail: MailResult): boolean {
  return mail.sent || mail.stub || (mail.duplicate === true && mail.inflight !== true);
}

async function readLead(deps: AmpelConfirmDeps, leadId: string): Promise<ReadinessLead | null> {
  try {
    return await deps.findLead(leadId);
  } catch (error) {
    console.error("[ampel] Lead lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return null;
  }
}

async function writeLead(deps: AmpelConfirmDeps, lead: ReadinessLead): Promise<void> {
  try {
    await deps.saveLead(lead);
  } catch (error) {
    console.error("[ampel] Lead speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
  }
}

async function runConfirm(token: string, deps: AmpelConfirmDeps): Promise<AmpelConfirmResult> {
  const now = deps.now?.() ?? Date.now();
  const payload = verifyAmpelDoiToken(token, now);
  if (!payload) return { ok: false, status: 400, reason: "invalid" };
  const answers = decodeAmpelAnswers(payload.answers);
  const scored = answers ? scoreAmpel(answers) : null;
  if (!scored) return { ok: false, status: 400, reason: "invalid" };

  const confirmedAt = new Date(now).toISOString();
  const leadId = ampelLeadId(payload.email, payload.answers, payload.consentAt);
  const draft = toAmpelReadinessLead({
    email: payload.email,
    answers: payload.answers,
    ref: payload.ref,
    consentAt: payload.consentAt,
    doiConfirmedAt: confirmedAt,
    score: scored.score,
    light: scored.light,
    mailStatus: "pending",
  });

  const existing = await readLead(deps, leadId);
  if (existing?.marketingOptIn === "withdrawn") {
    return { ok: true, score: scored.score, light: scored.light, alreadySent: true };
  }
  if (existing && existing.doiConfirmedAt && ampelResultMailRecorded(existing.mailStatus)) {
    return { ok: true, score: scored.score, light: scored.light, alreadySent: true };
  }

  const pending: ReadinessLead = {
    ...draft,
    ...(existing ?? {}),
    leadId,
    email: draft.email,
    status: "ampel_doi_confirmed",
    consentAt: draft.consentAt,
    doiConfirmedAt: existing?.doiConfirmedAt || confirmedAt,
    marketingOptIn: "confirmed",
    consentIp: existing?.consentIp || "",
    consentTextVersion: existing?.consentTextVersion || payload.consentTextVersion || "",
    advisorRef: draft.advisorRef,
    ampelAnswers: draft.ampelAnswers,
    ampelScore: draft.ampelScore,
    ampelLight: draft.ampelLight,
    mailStatus: existing?.mailStatus || "pending",
  };
  await writeLead(deps, pending);

  const send = deps.sendResult ?? sendAmpelResultMail;
  const pause = deps.sleep ?? wait;
  for (let attempt = 0; attempt < AMPEL_RESULT_RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = AMPEL_RESULT_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) await pause(delay);
    const current = await readLead(deps, leadId);
    if (current?.doiConfirmedAt && ampelResultMailRecorded(current.mailStatus)) {
      return { ok: true, score: scored.score, light: scored.light, alreadySent: true };
    }
    const mail = await send(payload);
    if (!delivered(mail)) continue;
    await writeLead(deps, {
      ...(current ?? pending),
      leadId,
      status: "ampel_doi_confirmed",
      doiConfirmedAt: current?.doiConfirmedAt || pending.doiConfirmedAt,
      marketingOptIn: "confirmed",
      consentIp: current?.consentIp || pending.consentIp,
      consentTextVersion: current?.consentTextVersion || pending.consentTextVersion || payload.consentTextVersion || "",
      mailStatus: mailLabel(mail),
    });
    return {
      ok: true,
      score: scored.score,
      light: scored.light,
      alreadySent: mail.duplicate === true,
    };
  }

  const after = await readLead(deps, leadId);
  if (after?.doiConfirmedAt && ampelResultMailRecorded(after.mailStatus)) {
    return { ok: true, score: scored.score, light: scored.light, alreadySent: true };
  }
  return { ok: false, status: 503, reason: "mail" };
}

/** One in-flight confirmation per lead. A joined click waits for that attempt. */
export function confirmAmpelDoi(token: string, deps: AmpelConfirmDeps): Promise<AmpelConfirmResult> {
  const now = deps.now?.() ?? Date.now();
  const payload = verifyAmpelDoiToken(token, now);
  if (!payload) return Promise.resolve({ ok: false, status: 400, reason: "invalid" });
  const leadId = ampelLeadId(payload.email, payload.answers, payload.consentAt);
  const current = runs.get(leadId);
  if (current) return current;
  const run = runConfirm(token, deps).finally(() => {
    if (runs.get(leadId) === run) runs.delete(leadId);
  });
  runs.set(leadId, run);
  return run;
}

const CONFIRM_RECORDED = new Set(["confirm_sent", "confirm_duplicate", "confirm_stub"]);
const confirmRuns = new Map<string, Promise<AmpelConfirmationResult>>();

export function ampelConfirmMailRecorded(status: string | undefined): boolean {
  return CONFIRM_RECORDED.has((status ?? "").trim());
}

export type AmpelConfirmationInput = {
  email: string;
  answers: string;
  ref: string;
  consentIp?: string;
  consentTextVersion?: string;
};

export type AmpelConfirmationDeps = {
  findLead: (email: string, answers: string) => Promise<ReadinessLead | null>;
  saveLead: (lead: ReadinessLead) => Promise<void>;
  sendConfirmation?: (input: { email: string; token: string }) => Promise<MailResult>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type AmpelConfirmationResult =
  | { ok: true; throttled: boolean }
  | { ok: false; status: 400 | 503; reason: "invalid" | "mail" };

function confirmMailLabel(mail: MailResult): string {
  if (mail.sent) return "confirm_sent";
  if (mail.duplicate) return "confirm_duplicate";
  if (mail.stub) return "confirm_stub";
  return "confirm_pending";
}

function withinConfirmWindow(consentAt: string, now: number): boolean {
  const at = Date.parse(consentAt);
  if (!Number.isFinite(at)) return false;
  return now - at < AMPEL_CONFIRM_WINDOW_MS;
}

function resultAlreadyRecorded(lead: ReadinessLead): boolean {
  return Boolean(lead.doiConfirmedAt) && ampelResultMailRecorded(lead.mailStatus);
}

async function readConfirmLead(
  deps: AmpelConfirmationDeps,
  email: string,
  answers: string,
): Promise<ReadinessLead | null> {
  try {
    return await deps.findLead(email, answers);
  } catch (error) {
    console.error("[ampel] Lead lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return null;
  }
}

async function writeConfirmLead(deps: AmpelConfirmationDeps, lead: ReadinessLead): Promise<void> {
  try {
    await deps.saveLead(lead);
  } catch (error) {
    console.error("[ampel] Lead speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
  }
}

async function runConfirmation(
  input: AmpelConfirmationInput,
  deps: AmpelConfirmationDeps,
): Promise<AmpelConfirmationResult> {
  const nowMs = deps.now?.() ?? Date.now();
  const email = normalizeAmpelEmail(input.email);
  const decoded = decodeAmpelAnswers(input.answers);
  const scored = decoded ? scoreAmpel(decoded) : null;
  const code = decoded ? encodeAmpelAnswers(decoded) : null;
  if (!email || !decoded || !code || !scored) {
    return { ok: false, status: 400, reason: "invalid" };
  }
  const ref = sanitizeAmpelRef(input.ref);
  const existing = await readConfirmLead(deps, email, code);
  if (
    existing &&
    ampelConfirmMailRecorded(existing.mailStatus) &&
    withinConfirmWindow(existing.consentAt, nowMs)
  ) {
    return { ok: true, throttled: true };
  }
  if (existing && resultAlreadyRecorded(existing) && withinConfirmWindow(existing.consentAt, nowMs)) {
    return { ok: true, throttled: true };
  }

  const reuse =
    existing &&
    !existing.doiConfirmedAt &&
    !ampelConfirmMailRecorded(existing.mailStatus) &&
    withinConfirmWindow(existing.consentAt, nowMs)
      ? existing
      : null;
  const consentAt = reuse?.consentAt || new Date(nowMs).toISOString();
  const consentTextVersion = input.consentTextVersion?.trim() || AMPEL_CONSENT_TEXT_VERSION;
  const consentIp = input.consentIp?.trim() || reuse?.consentIp || "";
  const token = createAmpelDoiToken(
    { email, answers: code, ref, consentAt, consentTextVersion },
    nowMs,
  );
  if (!token) return { ok: false, status: 400, reason: "invalid" };

  const pending: ReadinessLead = {
    ...toAmpelReadinessLead({
      email,
      answers: code,
      ref,
      consentAt,
      doiConfirmedAt: "",
      score: scored.score,
      light: scored.light,
      mailStatus: "confirm_pending",
      marketingOptIn: "pending",
      consentIp,
      consentTextVersion,
    }),
    timestamp: consentAt,
    status: "ampel_doi_pending",
    doiConfirmedAt: "",
    marketingOptIn: "pending",
    consentIp,
    consentTextVersion,
  };
  await writeConfirmLead(deps, pending);

  const send = deps.sendConfirmation ?? sendAmpelConfirmationMail;
  const pause = deps.sleep ?? wait;
  for (let attempt = 0; attempt < AMPEL_RESULT_RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = AMPEL_RESULT_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) await pause(delay);
    const current = await readConfirmLead(deps, email, code);
    if (current && ampelConfirmMailRecorded(current.mailStatus)) {
      return { ok: true, throttled: true };
    }
    if (current && resultAlreadyRecorded(current) && withinConfirmWindow(current.consentAt, nowMs)) {
      return { ok: true, throttled: true };
    }
    const mail = await send({ email, token });
    if (!delivered(mail)) continue;
    const base = current && current.leadId === pending.leadId ? current : pending;
    await writeConfirmLead(deps, {
      ...base,
      leadId: pending.leadId,
      email: pending.email,
      timestamp: base.timestamp || pending.timestamp,
      status: "ampel_doi_pending",
      consentAt: pending.consentAt,
      doiConfirmedAt: "",
      marketingOptIn: "pending",
      consentIp: pending.consentIp,
      consentTextVersion: pending.consentTextVersion,
      advisorRef: pending.advisorRef,
      ampelAnswers: pending.ampelAnswers,
      ampelScore: pending.ampelScore,
      ampelLight: pending.ampelLight,
      mailStatus: confirmMailLabel(mail),
    });
    return { ok: true, throttled: mail.duplicate === true };
  }

  const after = await readConfirmLead(deps, email, code);
  if (after && ampelConfirmMailRecorded(after.mailStatus)) {
    return { ok: true, throttled: true };
  }
  return { ok: false, status: 503, reason: "mail" };
}

/** One in-flight confirmation mail per address and answers. A joined click waits for that attempt. */
export function requestAmpelConfirmation(
  input: AmpelConfirmationInput,
  deps: AmpelConfirmationDeps,
): Promise<AmpelConfirmationResult> {
  const email = normalizeAmpelEmail(input.email);
  const decoded = decodeAmpelAnswers(input.answers);
  const code = decoded ? encodeAmpelAnswers(decoded) : null;
  if (!email || !decoded || !code || !scoreAmpel(decoded)) {
    return Promise.resolve({ ok: false, status: 400, reason: "invalid" });
  }
  const key = `${email}\n${code}`;
  const current = confirmRuns.get(key);
  if (current) return current;
  const run = runConfirmation(input, deps).finally(() => {
    if (confirmRuns.get(key) === run) confirmRuns.delete(key);
  });
  confirmRuns.set(key, run);
  return run;
}
