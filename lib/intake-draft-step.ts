/**
 * Entwürfe von vor der Aufteilung von Modul 1 speichern nur eine Schrittnummer.
 * Die Nummernfolge unten ist die Katalogreihenfolge vor den fünf Modul-1-Seiten.
 * Neue Entwürfe speichern zusätzlich die Schritt-Id und landen genau dort.
 */
import {
  CATALOG_STEPS,
  MODUL_UEBERSICHT_STEP_ID,
  catalogStepApplies,
  nextApplicableStep,
} from "@/lib/intake-catalog";
import { M01_PAGE_IDS } from "@/lib/intake-m01";
import type { IntakeAnswers } from "@/lib/types";

export const LEGACY_INTAKE_STEP_IDS = [
  "step-BC",
  "step-MO",
  "step-A",
  "step-B",
  "step-BR",
  "step-BR2",
  "step-M01",
  "step-M02",
  "step-M03",
  "step-M04",
  "step-M05",
  "step-M06",
  "step-M07",
  "step-M08",
  "step-M09",
  "step-M10",
  "step-M11",
  "step-M12",
  "step-M13",
  "step-M14",
  "step-M15",
  "step-M16",
  "step-M17",
  "step-M18",
  "step-M19",
  "step-M20",
  "step-M21",
  "step-M22",
  "step-M23",
  "step-M24",
  "step-C",
  "step-D",
  "step-E",
  "step-F",
  "step-G",
  "step-H",
  "step-I",
] as const;

function indexOfStep(id: string): number {
  return CATALOG_STEPS.findIndex((step) => step.id === id);
}

function pageAnswered(stepId: string, answers: IntakeAnswers): boolean {
  const step = CATALOG_STEPS.find((item) => item.id === stepId);
  const questions = step?.questions ?? [];
  if (!questions.length) return false;
  return questions.every((question) => Boolean(answers.katalog?.[question.id]?.status));
}

/** Erste Modul-1-Seite ohne Stand. Sind alle beantwortet, die letzte Seite. */
export function m01ResumeStepId(answers: IntakeAnswers): string {
  for (const id of M01_PAGE_IDS) {
    if (!pageAnswered(id, answers)) return id;
  }
  return M01_PAGE_IDS[M01_PAGE_IDS.length - 1];
}

function clampApplicable(index: number, answers: IntakeAnswers): number {
  if (index < 0) return nextApplicableStep(-1, answers);
  const step = CATALOG_STEPS[index];
  if (!step) return Math.min(Math.max(index, 0), CATALOG_STEPS.length);
  if (step.id === MODUL_UEBERSICHT_STEP_ID) return index;
  if (catalogStepApplies(step, answers)) return index;
  return nextApplicableStep(index, answers);
}

/**
 * Schritt nach dem Laden. Mit Schritt-Id gilt diese. Ohne Id gilt die alte
 * Nummernfolge. Ein alter Modul-1-Entwurf (eine Seite) setzt auf der ersten
 * Seite ohne Stand fort.
 */
export function resumeIntakeStep(input: { step: number; stepId?: string; answers: IntakeAnswers }): number {
  const explicit = input.stepId && indexOfStep(input.stepId) >= 0 ? input.stepId : "";
  if (explicit) return clampApplicable(indexOfStep(explicit), input.answers);
  if (!Number.isFinite(input.step) || input.step >= LEGACY_INTAKE_STEP_IDS.length) {
    return CATALOG_STEPS.length;
  }
  const legacyId = LEGACY_INTAKE_STEP_IDS[input.step] ?? "";
  if (!legacyId) return nextApplicableStep(-1, input.answers);
  if (legacyId === "step-M01") return clampApplicable(indexOfStep(m01ResumeStepId(input.answers)), input.answers);
  return clampApplicable(indexOfStep(legacyId), input.answers);
}
