/**
 * Neues Preismodell (28.10.): derselbe Hinweis unter jeder Frage im
 * Fragebogen. Wortlaut Growth landing-v3.md Abschnitt 4 (1:1). Nur sichtbar
 * mit PRICING_MODEL=v2 (Build-Zeit, next.config `env`); Legacy unverändert.
 */
export const INTAKE_QUESTION_HINT =
  "Wissen Sie das nicht genau? Kein Problem. Füllen Sie aus, was Sie wissen, und laden Sie später eine Person ein, die den Rest ergänzt.";
export const INTAKE_QUESTION_HINT_LINK = "Person einladen";
export const INTAKE_QUESTION_HINT_HREF = "/account";

export function intakeQuestionHintEnabled(): boolean {
  return process.env.GOBD_PRICING_NEW_MODEL === "1";
}

export function IntakeQuestionHint() {
  if (!intakeQuestionHintEnabled()) return null;
  return (
    <p className="hint intake-question-hint">
      {INTAKE_QUESTION_HINT}{" "}
      <a href={INTAKE_QUESTION_HINT_HREF}>{INTAKE_QUESTION_HINT_LINK}</a>
    </p>
  );
}
