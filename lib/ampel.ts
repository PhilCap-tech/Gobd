import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import {
  decodeAmpelAnswers,
  encodeAmpelAnswers,
  normalizeAmpelEmail,
  sanitizeAmpelRef,
  scoreAmpel,
  type AmpelLight,
} from "@/lib/ampel-score";

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
  },
  now = Date.now(),
): string | null {
  const email = normalizeAmpelEmail(input.email);
  const answers = decodeAmpelAnswers(input.answers);
  if (!email || !answers) return null;
  const code = encodeAmpelAnswers(answers);
  if (!code || !scoreAmpel(answers)) return null;
  const consentAt = input.consentAt.trim();
  if (!Number.isFinite(Date.parse(consentAt))) return null;
  const payload: AmpelDoiPayload = {
    purpose: "ampel-doi",
    email,
    answers: code,
    ref: sanitizeAmpelRef(input.ref),
    consentAt,
    exp: now + AMPEL_DOI_TTL_MS,
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
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp < now) {
      return null;
    }
    const email = normalizeAmpelEmail(parsed.email);
    const decoded = typeof parsed.answers === "string" ? decodeAmpelAnswers(parsed.answers) : null;
    const code = decoded ? encodeAmpelAnswers(decoded) : null;
    if (!email || !decoded || !code || !scoreAmpel(decoded)) return null;
    const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
    if (!Number.isFinite(Date.parse(consentAt))) return null;
    return {
      purpose: "ampel-doi",
      email,
      answers: code,
      ref: sanitizeAmpelRef(parsed.ref),
      consentAt,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function ampelLeadId(email: string, answers: string, consentAt: string): string {
  const hash = createHash("sha256")
    .update(`${email}\n${answers}\n${consentAt}`)
    .digest("hex")
    .slice(0, 32);
  return `ampel-${hash}`;
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
}): ReadinessLead {
  const email = input.email.trim().toLowerCase();
  return {
    ...emptyReadinessLead(),
    timestamp: input.doiConfirmedAt,
    leadId: ampelLeadId(email, input.answers, input.consentAt),
    email,
    status: "ampel_doi_confirmed",
    mailStatus: input.mailStatus,
    consentAt: input.consentAt,
    doiConfirmedAt: input.doiConfirmedAt,
    advisorRef: sanitizeAmpelRef(input.ref),
    ampelAnswers: input.answers,
    ampelScore: String(input.score),
    ampelLight: input.light,
  };
}
