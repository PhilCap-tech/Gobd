import { toVersionPdfMeta } from "@/lib/versioning";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

/**
 * Anonymized small-GmbH fixture for /steuerberater/muster.
 *
 * Scenario the intake can actually express:
 * - GmbH, Dienstleistung, 2–5 Mitarbeitende
 * - FiBu: DATEV
 * - digitaler Belegeingang: Option „E-Mail / PDF“
 * - Ausgangsrechnungen: Option „aus Buchhaltungssoftware“
 * - Archiv freitext: DATEV Unternehmen online
 *
 * Left empty on purpose so the open-points rules fire:
 * - weitereSysteme, it
 *
 * Stripe session/customer stay empty here. They are not open-point rules
 * and are not printed on the customer PDF.
 *
 * PDF is not a static file. GET /steuerberater/muster/pdf calls generatePdf
 * with this fixture — the delivery pipeline. To regenerate locally:
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
  gf: "A. Beispiel",
  buchhaltung: "B. Beispiel",
  it: "",
  steuerberater: "Kanzlei Beispiel",
};

export const PARTNER_MUSTER_VERSION_META = toVersionPdfMeta({
  validFrom: "2026-03-01",
  validTo: "",
  changeSummary: "Musterfassung, anonymisiert",
  changedBy: "Muster",
});
