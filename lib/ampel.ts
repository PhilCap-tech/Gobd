import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";
import {
  loadMailLinkToken,
  newOpaqueMailLinkToken,
  saveMailLinkToken,
} from "@/lib/mail-link-token-store";
import { KASSEN_QUESTIONS } from "@/lib/kassen-check-questions";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import {
  decodeAmpelAnswers,
  encodeAmpelAnswers,
  normalizeAmpelEmail,
  sanitizeAmpelRef,
  scoreAmpel,
  type AmpelLight,
} from "@/lib/ampel-score";
import type { AmpelQuestion } from "@/lib/ampel-questions";

export {
  AMPEL_PATH,
  ampelLightForScore,
  ampelMaxWeight,
  ampelNeinQuestions,
  ampelResultPath,
  ampelSharePath,
  decodeAmpelAnswers,
  encodeAmpelAnswers,
  normalizeAmpelEmail,
  publicAmpelSource,
  sanitizeAmpelRef,
  scoreAmpel,
} from "@/lib/ampel-score";
export type { AmpelAnswerMap, AmpelLight, AmpelScore } from "@/lib/ampel-score";

/** One confirmation mail per address inside this window. */
export const AMPEL_CONFIRM_WINDOW_MS = 15 * 60 * 1000;

/** Signed double-opt-in link lifetime. */
export const AMPEL_DOI_TTL_MS = 48 * 60 * 60 * 1000;

export type AmpelDoiPayload = {
  purpose: "ampel-doi";
  email: string;
  answers: string;
  ref: string;
  consentAt: string;
  exp: number;
  consentTextVersion?: string;
  /** Absent on Ampel tokens. Selects the question list when the code is not an Ampel code. */
  check?: "kassen-check";
};

export type AmpelUnsubscribePayload = {
  purpose: "ampel-unsubscribe";
  email: string;
  consentAt: string;
};

function signAmpelBody(body: string): string {
  return createHmac("sha256", getMagicLinkSecret()).update(body).digest("base64url");
}

type AmpelDoiInput = {
  email: string;
  answers: string;
  ref: string;
  consentAt: string;
  consentTextVersion?: string;
  check?: "kassen-check";
};

function ampelDoiPayload(input: AmpelDoiInput, now: number): AmpelDoiPayload | null {
  const questions = questionsForCheck(input.check);
  const email = normalizeAmpelEmail(input.email);
  const answers = decodeAmpelAnswers(input.answers, questions);
  if (!email || !answers) return null;
  const code = encodeAmpelAnswers(answers, questions);
  if (!code || !scoreAmpel(answers, questions)) return null;
  const consentAt = input.consentAt.trim();
  if (!Number.isFinite(Date.parse(consentAt))) return null;
  return {
    purpose: "ampel-doi",
    email,
    answers: code,
    ref: sanitizeAmpelRef(input.ref),
    consentAt,
    exp: now + AMPEL_DOI_TTL_MS,
    ...(input.consentTextVersion?.trim()
      ? { consentTextVersion: input.consentTextVersion.trim() }
      : {}),
    ...(input.check === "kassen-check" ? { check: "kassen-check" as const } : {}),
  };
}

function ampelDoiFromParsed(parsed: Partial<AmpelDoiPayload>, now: number): AmpelDoiPayload | null {
  if (parsed.purpose !== "ampel-doi") return null;
  if (parsed.check !== undefined && parsed.check !== "kassen-check") return null;
  if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp < now) return null;
  const check = parsed.check === "kassen-check" ? ("kassen-check" as const) : undefined;
  const questions = questionsForCheck(check);
  const email = normalizeAmpelEmail(parsed.email);
  const decoded = typeof parsed.answers === "string" ? decodeAmpelAnswers(parsed.answers, questions) : null;
  const code = decoded ? encodeAmpelAnswers(decoded, questions) : null;
  if (!email || !decoded || !code || !scoreAmpel(decoded, questions)) return null;
  const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
  if (!Number.isFinite(Date.parse(consentAt))) return null;
  const consentTextVersion =
    typeof parsed.consentTextVersion === "string" ? parsed.consentTextVersion.trim() : "";
  return {
    purpose: "ampel-doi",
    email,
    answers: code,
    ref: sanitizeAmpelRef(parsed.ref),
    consentAt,
    exp: parsed.exp,
    ...(consentTextVersion ? { consentTextVersion } : {}),
    ...(check ? { check } : {}),
  };
}

function legacySigned(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signAmpelBody(body)}`;
}

function legacyParts(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!body || !signature) return null;
  const expected = signAmpelBody(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return body;
}

/**
 * Signed DOI link already sent. New mail uses `createAmpelDoiToken`.
 * The body still carries the address; only verification of those links remains.
 */
export function legacyAmpelDoiToken(input: AmpelDoiInput, now = Date.now()): string | null {
  const payload = ampelDoiPayload(input, now);
  if (!payload) return null;
  return legacySigned(payload);
}

/** Opaque id. The address, answers, and ref stay in the private store, not the link. */
export async function createAmpelDoiToken(input: AmpelDoiInput, now = Date.now()): Promise<string | null> {
  const payload = ampelDoiPayload(input, now);
  if (!payload) return null;
  const token = newOpaqueMailLinkToken();
  const saved = await saveMailLinkToken(token, payload);
  return saved ? token : null;
}

function verifyLegacyAmpelDoiToken(token: string, now: number): AmpelDoiPayload | null {
  const body = legacyParts(token);
  if (!body) return null;
  try {
    return ampelDoiFromParsed(JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<AmpelDoiPayload>, now);
  } catch {
    return null;
  }
}

export async function verifyAmpelDoiToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<AmpelDoiPayload | null> {
  if (!token) return null;
  if (token.includes(".")) return verifyLegacyAmpelDoiToken(token, now);
  const record = await loadMailLinkToken(token);
  if (!record || record.purpose !== "ampel-doi") return null;
  return ampelDoiFromParsed(record as Partial<AmpelDoiPayload>, now);
}

export function ampelLeadId(
  email: string,
  answers: string,
  consentAt: string,
  prefix = "ampel",
): string {
  const safe = prefix === "kassen" ? "kassen" : "ampel";
  const hash = createHash("sha256")
    .update(`${email}\n${answers}\n${consentAt}`)
    .digest("hex")
    .slice(0, 32);
  return `${safe}-${hash}`;
}

function questionsForCheck(check: "kassen-check" | undefined): readonly AmpelQuestion[] | undefined {
  return check === "kassen-check" ? KASSEN_QUESTIONS : undefined;
}

function ampelUnsubscribePayload(email: string, consentAt: string): AmpelUnsubscribePayload | null {
  const normalized = normalizeAmpelEmail(email);
  const at = consentAt.trim();
  if (!normalized || !Number.isFinite(Date.parse(at))) return null;
  return { purpose: "ampel-unsubscribe", email: normalized, consentAt: at };
}

function ampelUnsubscribeFromParsed(parsed: Partial<AmpelUnsubscribePayload>): AmpelUnsubscribePayload | null {
  if (parsed.purpose !== "ampel-unsubscribe") return null;
  const email = normalizeAmpelEmail(parsed.email);
  const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
  if (!email || !Number.isFinite(Date.parse(consentAt))) return null;
  return { purpose: "ampel-unsubscribe", email, consentAt };
}

/**
 * Signed unsubscribe link already sent. It has no expiry.
 * New mail uses `createAmpelUnsubscribeToken`.
 */
export function legacyAmpelUnsubscribeToken(email: string, consentAt: string): string | null {
  const payload = ampelUnsubscribePayload(email, consentAt);
  if (!payload) return null;
  return legacySigned(payload);
}

/** Opaque id stored with the address and consent time, and no expiry. */
export async function createAmpelUnsubscribeToken(email: string, consentAt: string): Promise<string | null> {
  const payload = ampelUnsubscribePayload(email, consentAt);
  if (!payload) return null;
  const token = newOpaqueMailLinkToken();
  const saved = await saveMailLinkToken(token, payload);
  return saved ? token : null;
}

export async function verifyAmpelUnsubscribeToken(token: string): Promise<AmpelUnsubscribePayload | null> {
  if (!token) return null;
  if (token.includes(".")) {
    const body = legacyParts(token);
    if (!body) return null;
    try {
      return ampelUnsubscribeFromParsed(
        JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<AmpelUnsubscribePayload>,
      );
    } catch {
      return null;
    }
  }
  const record = await loadMailLinkToken(token);
  if (!record) return null;
  return ampelUnsubscribeFromParsed(record as Partial<AmpelUnsubscribePayload>);
}

/** `ja` stays once a result mail was sent. Empty means the column was not written yet. */
export function keepAmpelMailed(incoming: string | undefined, existing: string | undefined): string {
  if (incoming === "ja" || existing === "ja") return "ja";
  if (incoming === "nein" || existing === "nein") return "nein";
  return "";
}

export function toAmpelReadinessLead(input: {
  email: string;
  answers: string;
  ref: string;
  consentAt: string;
  doiConfirmedAt: string;
  score: number;
  light: AmpelLight;
  mailStatus: string;
  marketingOptIn?: string;
  consentIp?: string;
  consentTextVersion?: string;
  mailed?: string;
  leadPrefix?: string;
}): ReadinessLead {
  const email = input.email.trim().toLowerCase();
  return {
    ...emptyReadinessLead(),
    timestamp: input.doiConfirmedAt,
    leadId: ampelLeadId(email, input.answers, input.consentAt, input.leadPrefix),
    email,
    status: "ampel_doi_confirmed",
    mailStatus: input.mailStatus,
    consentAt: input.consentAt,
    doiConfirmedAt: input.doiConfirmedAt,
    advisorRef: sanitizeAmpelRef(input.ref),
    ampelAnswers: input.answers,
    ampelScore: String(input.score),
    ampelLight: input.light,
    marketingOptIn: input.marketingOptIn ?? "",
    consentIp: input.consentIp?.trim() ?? "",
    consentTextVersion: input.consentTextVersion?.trim() ?? "",
    withdrawnAt: "",
    mailed: input.mailed === "ja" || input.mailed === "nein" ? input.mailed : "",
  };
}
