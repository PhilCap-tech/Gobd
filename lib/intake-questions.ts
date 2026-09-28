import type { IntakeAnswers } from "@/lib/types";

/**
 * Production intake copy and options (app/intake/intake-form.tsx).
 * The partner demo must render these strings — not a second questionnaire.
 * There is no branch: later steps do not change when an earlier answer changes.
 */

export const INTAKE_BRANCHEN = [
  "Handwerk",
  "Handel",
  "Dienstleistung",
  "Freiberufler",
  "Gastronomie",
  "Sonstiges",
] as const;

export const INTAKE_RECHTSFORMEN = [
  "Einzelunternehmen",
  "GbR",
  "UG",
  "GmbH",
  "AG",
  "Sonstiges",
] as const;

export const INTAKE_MITARBEITENDE = [
  "1 (nur ich)",
  "2–5",
  "6–10",
  "11–20",
  "über 20",
] as const;

export const INTAKE_FIBU = [
  "DATEV",
  "sevdesk",
  "lexoffice",
  "Excel / manuell",
  "Sonstiges",
] as const;

export const INTAKE_EINGANG = [
  "E-Mail / PDF",
  "Scan / App",
  "Papierordner",
  "Portal Lieferant",
] as const;

export const INTAKE_AUSGANG = [
  "aus Buchhaltungssoftware",
  "Word / Excel",
  "Shop / Kassensystem",
  "gemischt",
] as const;

export const INTAKE_HOSTING = [
  "Cloud (Anbieter DE/EU)",
  "Cloud (Anbieter außerhalb EU)",
  "Eigener Server / NAS",
  "Nur lokal auf PCs",
  "Gemischt / unklar",
] as const;

export const INTAKE_BACKUP = [
  "Automatisch (Anbieter)",
  "Manuell / unregelmäßig",
  "Kein bekanntes Backup",
  "Unklar",
] as const;

export const INTAKE_ERRORS = {
  step0: "Branche, Rechtsform und Mitarbeitende auswählen.",
  step1: "Mindestens eine FiBu-Option wählen.",
  step2: "Eingangs- und Ausgangswege wählen.",
  step3: "Hosting-Angabe fehlt.",
  step4: "GF und Buchhaltungsverantwortung ausfüllen.",
} as const;

export const INTAKE_STEPS = [
  {
    stepLabel: "Schritt 1 von 5",
    title: "Branche & Unternehmensform",
  },
  {
    stepLabel: "Schritt 2 von 5",
    title: "Buchhaltungs- & Branchensoftware",
  },
  {
    stepLabel: "Schritt 3 von 5",
    title: "Belegwege",
  },
  {
    stepLabel: "Schritt 4 von 5",
    title: "IT & Zugriff",
  },
  {
    stepLabel: "Schritt 5 von 5",
    title: "Verantwortliche",
  },
] as const;

export const INTAKE_REVIEW = {
  stepLabel: "Prüfen & absenden",
  title: "Stimmt das so?",
} as const;

/** Same gates as the paid intake. Step 0 firm-select stays in the account form. */
export function intakeStepError(step: number, answers: IntakeAnswers): string {
  if (
    step === 0 &&
    (!answers.branchen.length || !answers.rechtsform || !answers.mitarbeitende)
  ) {
    return INTAKE_ERRORS.step0;
  }
  if (step === 1 && !answers.fibu.length) return INTAKE_ERRORS.step1;
  if (
    step === 2 &&
    (!answers.eingangsbelege.length || !answers.ausgangsrechnungen.length)
  ) {
    return INTAKE_ERRORS.step2;
  }
  if (step === 3 && !answers.hosting) return INTAKE_ERRORS.step3;
  if (step === 4 && (!answers.gf || !answers.buchhaltung)) return INTAKE_ERRORS.step4;
  return "";
}
