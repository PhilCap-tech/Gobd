import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";
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

export function createAmpelDoiToken(
  input: {
    email: string;
    answers: string;
    ref: string;
    consentAt: string;
    consentTextVersion?: string;
    check?: "kassen-check";
  },
  now = Date.now(),
): string | null {
  const questions = questionsForCheck(input.check);
  const email = normalizeAmpelEmail(input.email);
  const answers = decodeAmpelAnswers(input.answers, questions);
  if (!email || !answers) return null;
  const code = encodeAmpelAnswers(answers, questions);
  if (!code || !scoreAmpel(answers, questions)) return null;
  const consentAt = input.consentAt.trim();
  if (!Number.isFinite(Date.parse(consentAt))) return null;
  const payload: AmpelDoiPayload = {
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
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signAmpelBody(body)}`;
}

export function verifyAmpelDoiToken(
  token: string | undefined | null,
  now = Date.now(),
): AmpelDoiPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || token.split(".").length !== 2) return null;
  const expected = signAmpelBody(body);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<AmpelDoiPayload>;
    if (parsed.purpose !== "ampel-doi") return null;
    if (parsed.check !== undefined && parsed.check !== "kassen-check") return null;
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp < now) {
      return null;
    }
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
  } catch {
    return null;
  }
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

export function createAmpelUnsubscribeToken(email: string, consentAt: string): string | null {
  const normalized = normalizeAmpelEmail(email);
  if (!normalized || !Number.isFinite(Date.parse(consentAt))) return null;
  const payload: AmpelUnsubscribePayload = {
    purpose: "ampel-unsubscribe",
    email: normalized,
    consentAt: consentAt.trim(),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signAmpelBody(body)}`;
}

export function verifyAmpelUnsubscribeToken(token: string): AmpelUnsubscribePayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = signAmpelBody(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<AmpelUnsubscribePayload>;
    if (parsed.purpose !== "ampel-unsubscribe") return null;
    const email = normalizeAmpelEmail(parsed.email);
    const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
    if (!email || !Number.isFinite(Date.parse(consentAt))) return null;
    return { purpose: "ampel-unsubscribe", email, consentAt };
  } catch {
    return null;
  }
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
