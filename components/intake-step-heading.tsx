"use client";

import { useEffect, type ReactNode } from "react";
import { INTAKE_STEP_HEADING_ID, scrollIntakeStepIntoView } from "@/lib/intake-step-focus";

export function IntakeStepHeading({ children }: { children: ReactNode }) {
  return (
    <h1 id={INTAKE_STEP_HEADING_ID} tabIndex={-1}>
      {children}
    </h1>
  );
}

/** After Weiter, Zurück, or a module jump: show the bar and the step heading. */
export function useIntakeStepFocus(step: number) {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const heading = document.getElementById(INTAKE_STEP_HEADING_ID);
    scrollIntakeStepIntoView({
      reducedMotion,
      heading: heading instanceof HTMLElement ? heading : null,
    });
  }, [step]);
}
