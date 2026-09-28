import { toVersionPdfMeta } from "@/lib/versioning";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

/**
 * Fictional Beispiel GmbH for /steuerberater/muster.
 *
 * Präsens in the PDF may only repeat these fixed questionnaire answers:
 * - GmbH, Dienstleistung, Größenordnung „2–5“ (no separate headcount field)
 * - FiBu: DATEV
 * - Eingang: „E-Mail / PDF“ only — paper chapter is omitted
 * - Ausgang: „aus Buchhaltungssoftware“
 * - Archiv: DATEV Unternehmen online
 * - Hosting: Cloud (Anbieter DE/EU)
 * - Sicherung: Automatisch (Anbieter) — not a restore test
 * - Zugriff: Geschäftsführung und Buchhaltung — not a permission list
 * - GF Anna Beispiel, Buchhaltung Ben Muster, Steuerberatung Kanzlei Beispiel
 * - gültig ab 01.10.2026, Änderung „Erste fiktive Musterfassung“
 *
 * Left empty on purpose: weitereSysteme, it.
 * Not collected, so always open points (not Präsens): structured e-invoice
 * XML vs PDF view, restore test, control routine, permission list / mandate.
 * No mailbox, no product name beyond the chosen option, no DATEV Rechnungswesen
 * at the Kanzlei, no monthly sample — the questionnaire has no such fields.
 *
 * Stripe session/customer stay empty. They are not open-point rules and are
 * not printed on the customer PDF. stub stays true internally and is not printed.
 *
 * PDF is not a static file. GET /steuerberater/muster/pdf calls generatePdf
 * with this fixture. To regenerate locally:
 *   npx tsx scripts/render-partner-muster-pdf.ts
 */

export const PARTNER_MUSTER_PATH = "/steuerberater/muster";
export const PARTNER_MUSTER_PDF_PATH = "/steuerberater/muster/pdf";
export const PARTNER_DEMO_PATH = "/steuerberater/demo";
export const PARTNER_MUSTER_DOCUMENT_ID = "partner-muster-gmbh";
export const PARTNER_MUSTER_FILENAME =
  "Muster-Verfahrensdokumentation-Beispiel-GmbH.pdf";

export const PARTNER_MUSTER_IDENTITY: CheckoutIdentity = {
  email: "muster@example.invalid",
  company: "Beispiel GmbH",
  stripeSessionId: "",
  stripeCustomerId: "",
  stub: true,
};

export const PARTNER_MUSTER_ANSWERS: IntakeAnswers = {
  branchen: ["Dienstleistung"],
  rechtsform: "GmbH",
  mitarbeitende: "2–5",
  fibu: ["DATEV"],
  weitereSysteme: "",
  eingangsbelege: ["E-Mail / PDF"],
  ausgangsrechnungen: ["aus Buchhaltungssoftware"],
  archiv: "DATEV Unternehmen online",
  hosting: "Cloud (Anbieter DE/EU)",
  backup: ["Automatisch (Anbieter)"],
  zugriff: "Geschäftsführung und Buchhaltung",
  gf: "Anna Beispiel",
  buchhaltung: "Ben Muster",
  it: "",
  steuerberater: "Kanzlei Beispiel",
};

export const PARTNER_MUSTER_VERSION_META = toVersionPdfMeta({
  validFrom: "2026-10-01",
  validTo: "",
  changeSummary: "Erste fiktive Musterfassung",
  changedBy: "Beispielannahmen, keine Freigabe",
});
