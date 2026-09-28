import { intakeFrageStepError } from "@/lib/frage-intake";
import { CATALOG_STEPS, catalogStepError, hasCatalogAnswers } from "@/lib/intake-catalog";
import type { IntakeAnswers } from "@/lib/types";

/**
 * Production intake copy and options.
 * The partner demo renders the same steps. Paper, scan and E-Rechnung
 * questions appear only when the earlier answer opens that branch.
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
  "E-Mail",
  "PDF",
  "E-Rechnung",
  "Portal Lieferant",
  "Schnittstelle",
  "Scan / App",
  "Papierordner",
] as const;

export const INTAKE_FORMATE = [
  "PDF",
  "XRechnung",
  "ZUGFeRD",
  "Papier",
  "EDI",
  "E-Rechnung",
] as const;

export const INTAKE_VORSYSTEME = [
  "Keine weiteren",
  "Kasse",
  "Shop",
  "Lager",
  "Lohn",
  "Plattform",
] as const;

export const INTAKE_SCAN_ZWECK = [
  "nein, kein Scan",
  "Bearbeitungskopie",
  "ersetzendes Scannen",
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

export const INTAKE_STEPS = CATALOG_STEPS.map((step, index, all) => ({
  stepLabel: `Schritt ${index + 1} von ${all.length}`,
  title: step.title,
}));

/** Landing preview: the real step questions, not a second questionnaire. */
export const INTAKE_PREVIEW_ROWS = [
  {
    question: "Branche (mehrere möglich), Rechtsform, Mitarbeitende (ca.)",
    why: "Rahmen für Betrieb und Größe",
  },
  {
    question:
      "Buchhaltung / FiBu; weitere Systeme (ERP, Kassensystem, Zeiterfassung …)",
    why: "Welche Systeme in der Beschreibung stehen",
  },
  {
    question:
      "Wie kommen Eingangsbelege rein? Ausgangsrechnungen? Wo werden Belege archiviert?",
    why: "Herkunft und Ablage der Belege",
  },
  {
    question:
      "Wo liegen die Daten? Backup? Wer hat Zugriff auf Buchhaltungsdaten?",
    why: "Ort, Sicherung, Zugriff",
  },
  {
    question:
      "Geschäftsführung / Inhaber, Buchhaltung / Belegverantwortung, IT / Systeme, Steuerberater (Kanzlei)",
    why: "Wer im Fragebogen benannt wird",
  },
] as const;

export const INTAKE_REVIEW = {
  stepLabel: "Prüfen & absenden",
  title: "Stimmt das so?",
} as const;

/** Same gates as the paid intake. Step 0 firm-select stays in the account form. */
export function intakeStepError(step: number, answers: IntakeAnswers): string {
  if (hasCatalogAnswers(answers) || Object.keys(answers.katalog ?? {}).length > 0) {
    return catalogStepError(step, answers);
  }
  return intakeFrageStepError(step, answers);
}
