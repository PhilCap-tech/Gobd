import { scoreAmpel, type AmpelAnswerMap, type AmpelScore } from "@/lib/ampel-score";
import { AMPEL_NEIN_CAPS_AT_GELB, AMPEL_NEIN_FORCES_ROT } from "@/lib/ampel-questions";

/**
 * Weighted score from the shared formula, then the Ampel rules:
 * a Nein on a core question is always Rot, any other Nein is at most Gelb.
 * „Trifft nicht zu“ is not a Nein. The Kassen check does not use this function.
 */
export function scoreAmpelCheck(answers: AmpelAnswerMap): AmpelScore | null {
  const scored = scoreAmpel(answers);
  if (!scored) return null;
  let light = scored.light;
  if (light === "gruen" && AMPEL_NEIN_CAPS_AT_GELB.some((id) => answers[id] === "nein")) {
    light = "gelb";
  }
  if (AMPEL_NEIN_FORCES_ROT.some((id) => answers[id] === "nein")) {
    light = "rot";
  }
  const capped = light === "rot" ? false : scored.capped;
  if (light === scored.light && capped === scored.capped) return scored;
  return { ...scored, light, capped };
}
