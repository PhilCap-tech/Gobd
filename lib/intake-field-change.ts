import { KEINE_REGELMAESSIGE_KONTROLLE, normalizeExclusiveSelection } from "@/lib/keine-angaben";
import {
  applyDerivedStatus,
  prefillKnownFacts,
  setCatalogValue,
  type FirmFacts,
} from "@/lib/intake-catalog";
import type { IntakeAnswers } from "@/lib/types";

/**
 * One field change in the intake questionnaire, including the A01 keystroke
 * prefill. The component calls this 1:1 from commitValue.
 */
export function applyAnswerFieldChange(
  answers: IntakeAnswers,
  questionId: string,
  key: string,
  value: unknown,
  firm?: FirmFacts,
): IntakeAnswers {
  let stored: unknown = value;
  if (key === "kontrollen" && Array.isArray(value) && value.every((item) => typeof item === "string")) {
    stored = normalizeExclusiveSelection(
      value.map((item) => String(item)),
      KEINE_REGELMAESSIGE_KONTROLLE,
    );
  }
  let next = setCatalogValue(answers, questionId, key, stored);
  if (
    key === "kontrollen" &&
    Array.isArray(stored) &&
    stored.length === 1 &&
    stored[0] === KEINE_REGELMAESSIGE_KONTROLLE
  ) {
    next = setCatalogValue(next, questionId, "details", "");
  }
  if (questionId === "A03") next = applyDerivedStatus(next, questionId);
  if (questionId === "A01") {
    next = prefillKnownFacts(next, firm, { protect: [[questionId, key]], previous: answers });
  }
  return next;
}
