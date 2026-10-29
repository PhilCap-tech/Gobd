"use client";

/**
 * Neues Preismodell (28.10.): derselbe Hinweis unter jeder Frage im
 * Fragebogen. Wortlaut Growth landing-v3.md Abschnitt 4 (1:1). Nur sichtbar
 * mit PRICING_MODEL=v2 (Build-Zeit, next.config `env`); Legacy unverändert.
 */
import { createContext, useContext } from "react";
import { V3_INVITE_PREPAY_MESSAGE } from "@/lib/invite-copy";

export const INTAKE_QUESTION_HINT =
  "Wissen Sie das nicht genau? Kein Problem. Füllen Sie aus, was Sie wissen, und laden Sie später eine Person ein, die den Rest ergänzt.";
export const INTAKE_QUESTION_HINT_LINK = "Person einladen";

/**
 * Vor der Zahlung kann niemand eingeladen werden: kein Link, nur der
 * freigegebene Satz. Nach der Zahlung: Link auf „Mitwirkende“ der Firma.
 * Default (kein Provider) = vor der Zahlung.
 */
export type IntakeHintState = { paid: boolean; inviteHref: string };
const IntakeHintContext = createContext<IntakeHintState>({ paid: false, inviteHref: "" });
export const IntakeHintProvider = IntakeHintContext.Provider;

/** Einladen geschieht im Konto unter Firma → Mitwirkende. */
export function intakeInviteHref(entityId: string): string {
  const id = entityId.trim();
  return id ? `/account/firma/${encodeURIComponent(id)}#mitwirkende-heading` : "";
}

export function intakeQuestionHintEnabled(): boolean {
  return process.env.GOBD_PRICING_NEW_MODEL === "1";
}

export function IntakeQuestionHint() {
  const state = useContext(IntakeHintContext);
  if (!intakeQuestionHintEnabled()) return null;
  if (!state.paid) {
    return (
      <p className="hint intake-question-hint">
        {INTAKE_QUESTION_HINT} {V3_INVITE_PREPAY_MESSAGE}
      </p>
    );
  }
  return (
    <p className="hint intake-question-hint">
      {INTAKE_QUESTION_HINT}
      {state.inviteHref ? (
        <>
          {" "}
          <a href={state.inviteHref}>{INTAKE_QUESTION_HINT_LINK}</a>
        </>
      ) : null}
    </p>
  );
}
