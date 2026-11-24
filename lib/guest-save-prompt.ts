import { CATALOG_STEPS, nextApplicableStep } from "@/lib/intake-catalog";
import { M01_PAGE_IDS } from "@/lib/intake-m01";
import type { IntakeAnswers } from "@/lib/types";

/** Sichtbar auf dem ersten Schritt nach der letzten Seite von Modul 1. */
export function guestSavePromptVisible(stepIndex: number, answers: IntakeAnswers): boolean {
  const lastId = M01_PAGE_IDS[M01_PAGE_IDS.length - 1];
  const last = CATALOG_STEPS.findIndex((step) => step.id === lastId);
  if (last < 0) return false;
  const next = nextApplicableStep(last, answers);
  return next < CATALOG_STEPS.length && stepIndex === next;
}
