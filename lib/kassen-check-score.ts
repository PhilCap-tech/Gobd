import { scoreAmpel, type AmpelAnswerMap, type AmpelScore } from "@/lib/ampel-score";
import {
  KASSEN_NEIN_CAPS_AT_GELB,
  KASSEN_NEIN_FORCES_ROT,
  KASSEN_QUESTIONS,
} from "@/lib/kassen-check-questions";

/**
 * Weighted score from the shared Ampel formula, then the Kassen rules:
 * a Nein on TSE is always Rot, a Nein on current filing data is at most Gelb.
 */
export function scoreKassen(answers: AmpelAnswerMap): AmpelScore | null {
  const scored = scoreAmpel(answers, KASSEN_QUESTIONS);
  if (!scored) return null;
  let light = scored.light;
  let capped = scored.capped;
  if (light === "gruen" && KASSEN_NEIN_CAPS_AT_GELB.some((id) => answers[id] === "nein")) {
    light = "gelb";
    capped = true;
  }
  if (KASSEN_NEIN_FORCES_ROT.some((id) => answers[id] === "nein")) {
    light = "rot";
  }
  if (light === scored.light && capped === scored.capped) return scored;
  return { ...scored, light, capped };
}
