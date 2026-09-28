import { toVersionPdfMeta } from "@/lib/versioning";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

/**
 * Partner-Trust fixture (`content/delivery-templates/sample-intake-partner-trust.json`).
 *
 * Digital only: E-Mail and PDF, no paper path. Stripe ids are present on the
 * identity so a render can prove they stay out of the customer PDF.
 * `it` is the empty label „nicht angegeben“ and becomes an open point.
 *
 * PDF is not a static file. GET /steuerberater/muster/pdf calls generatePdf
 * with this fixture. To regenerate locally:
 *   npx tsx scripts/render-partner-muster-pdf.ts
 *
 * Zielbild is philip-muster-v2-detailliert-2026-09-28. Chapter markdown is the
 * Delivery v4 pack, wired as an interim adapter until schema and bundle
 * 4.0.0 land. Präsens only where this intake confirms the fact. Generation
 * is not a GF Freigabevermerk and is not a final quality sign-off.
 */

export const PARTNER_MUSTER_PATH = "/steuerberater/muster";
export const PARTNER_MUSTER_PDF_PATH = "/steuerberater/muster/pdf";
export const PARTNER_DEMO_PATH = "/steuerberater/demo";
export const PARTNER_MUSTER_DOCUMENT_ID = "partner-muster-gmbh";
export const PARTNER_MUSTER_FILENAME =
  "Muster-Verfahrensdokumentation-Beispiel-GmbH.pdf";

export const PARTNER_MUSTER_IDENTITY: CheckoutIdentity = {
  email: "demo@beispiel.invalid",
  company: "Beispiel GmbH",
  stripeSessionId: "cs_test_DO_NOT_PUT_IN_PDF",
  stripeCustomerId: "cus_DO_NOT_PUT_IN_PDF",
  stub: false,
};

export const PARTNER_MUSTER_ANSWERS: IntakeAnswers = {
  branchen: ["B2B-Dienstleistungen"],
  rechtsform: "GmbH",
  mitarbeitende: "1-5",
  fibu: ["DATEV"],
  weitereSysteme:
    "Funktionspostfach für Eingangsrechnungen; Rechnungssoftware für Ausgang",
  eingangsbelege: ["E-Mail", "PDF"],
  ausgangsrechnungen: ["Rechnungssoftware"],
  archiv: "DATEV Unternehmen online",
  hosting: "SaaS / Anbieter-Cloud",
  backup: ["Anbieter-Backup"],
  zugriff: "Geschäftsführung und Buchhaltung; Kanzlei im Mandatsumfang",
  gf: "Anna Beispiel",
  buchhaltung: "Ben Muster",
  it: "nicht angegeben",
  steuerberater: "externe Kanzlei (Leistungsumfang zu bestätigen)",
};

export const PARTNER_MUSTER_VERSION_META = toVersionPdfMeta({
  validFrom: "",
  validTo: "",
  changeSummary: "Arbeitsfassung entlang der Gliederung Muster v2",
  changedBy: "",
});
