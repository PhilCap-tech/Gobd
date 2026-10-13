import {
  AMPEL_QUESTIONS,
  AMPEL_RESULTS,
  type AmpelAnswer,
  type AmpelQuestion,
} from "@/lib/ampel-questions";

export const AMPEL_PATH = "/ampel-check";

export type AmpelLight = keyof typeof AMPEL_RESULTS;

export type AmpelAnswerMap = Record<string, AmpelAnswer>;

export type AmpelScore = {
  yesWeight: number;
  applicableWeight: number;
  maxWeight: number;
  /** Rounded percentage of applicable weight. */
  score: number;
  light: AmpelLight;
  /** A weight-3 „Nein“ lowered an otherwise green result to yellow. */
  capped: boolean;
};

const ANSWER_CODE: Record<AmpelAnswer, string> = {
  ja: "J",
  nein: "N",
  nicht_zutreffend: "X",
};

const CODE_ANSWER: Record<string, AmpelAnswer> = {
  J: "ja",
  N: "nein",
  X: "nicht_zutreffend",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bracket notes such as „[prüfen]“ stay in the config and never reach the page. */
const REVIEW_MARKER = /\s*\[[^\]]*\bprüfen\b[^\]]*\]/gi;

export function publicAmpelSource(source: string): string {
  return source.replace(REVIEW_MARKER, "").replace(/[ \t]{2,}/g, " ").trim();
}

export function ampelMaxWeight(
  questions: readonly AmpelQuestion[] = AMPEL_QUESTIONS,
): number {
  return questions.reduce((sum, question) => sum + question.weight, 0);
}

export function ampelLightForScore(score: number): AmpelLight {
  if (score >= AMPEL_RESULTS.gruen.range[0] && score <= AMPEL_RESULTS.gruen.range[1]) {
    return "gruen";
  }
  if (score >= AMPEL_RESULTS.gelb.range[0] && score <= AMPEL_RESULTS.gelb.range[1]) {
    return "gelb";
  }
  return "rot";
}

export function sanitizeAmpelRef(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/[^\p{L}\p{N} ._'-]/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
}

export function normalizeAmpelEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) return null;
  return email;
}

export function encodeAmpelAnswers(
  answers: AmpelAnswerMap,
  questions: readonly AmpelQuestion[] = AMPEL_QUESTIONS,
): string | null {
  let code = "";
  for (const question of questions) {
    const answer = answers[question.id];
    if (answer !== "ja" && answer !== "nein" && answer !== "nicht_zutreffend") {
      return null;
    }
    if (answer === "nicht_zutreffend" && question.applicable !== "optional") {
      return null;
    }
    code += ANSWER_CODE[answer];
  }
  return code;
}

export function decodeAmpelAnswers(
  code: string,
  questions: readonly AmpelQuestion[] = AMPEL_QUESTIONS,
): AmpelAnswerMap | null {
  const compact = code.trim().toUpperCase();
  if (compact.length !== questions.length) return null;
  const answers: AmpelAnswerMap = {};
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const answer = CODE_ANSWER[compact[index] ?? ""];
    if (!question || !answer) return null;
    if (answer === "nicht_zutreffend" && question.applicable !== "optional") {
      return null;
    }
    answers[question.id] = answer;
  }
  return answers;
}

/**
 * Score = round(100 × yes-weight / applicable-weight).
 * „Trifft nicht zu“ drops that question from both sides.
 * A „Nein“ on weight 3 cannot stay green.
 */
export function scoreAmpel(
  answers: AmpelAnswerMap,
  questions: readonly AmpelQuestion[] = AMPEL_QUESTIONS,
): AmpelScore | null {
  let yesWeight = 0;
  let applicableWeight = 0;
  let weight3No = false;
  for (const question of questions) {
    const answer = answers[question.id];
    if (answer !== "ja" && answer !== "nein" && answer !== "nicht_zutreffend") {
      return null;
    }
    if (answer === "nicht_zutreffend") {
      if (question.applicable !== "optional") return null;
      continue;
    }
    applicableWeight += question.weight;
    if (answer === "ja") yesWeight += question.weight;
    if (answer === "nein" && question.weight === 3) weight3No = true;
  }
  if (applicableWeight <= 0) return null;
  const score = Math.round((100 * yesWeight) / applicableWeight);
  const uncapped = ampelLightForScore(score);
  const capped = weight3No && uncapped === "gruen";
  return {
    yesWeight,
    applicableWeight,
    maxWeight: ampelMaxWeight(questions),
    score,
    light: capped ? "gelb" : uncapped,
    capped,
  };
}

export function ampelNeinQuestions(
  answers: AmpelAnswerMap,
  questions: readonly AmpelQuestion[] = AMPEL_QUESTIONS,
): AmpelQuestion[] {
  return questions.filter((question) => answers[question.id] === "nein");
}

export function ampelSharePath(ref = ""): string {
  const safe = sanitizeAmpelRef(ref);
  if (!safe) return AMPEL_PATH;
  return `${AMPEL_PATH}?ref=${encodeURIComponent(safe)}`;
}

export function ampelResultPath(code: string, ref = ""): string {
  const params = new URLSearchParams();
  params.set("a", code.trim().toUpperCase());
  const safe = sanitizeAmpelRef(ref);
  if (safe) params.set("ref", safe);
  return `${AMPEL_PATH}?${params.toString()}`;
}
