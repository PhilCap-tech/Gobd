import type { MailResult } from "@/lib/mail";
import type { ReadinessLead } from "@/lib/readiness";
import { sendAmpelResultMail } from "@/lib/ampel-mail";
import {
  ampelLeadId,
  decodeAmpelAnswers,
  scoreAmpel,
  toAmpelReadinessLead,
  verifyAmpelDoiToken,
  type AmpelDoiPayload,
  type AmpelLight,
} from "@/lib/ampel";

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
