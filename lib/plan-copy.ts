/**
 * Texte Preismodell v2. Beträge sind entschieden (Philip 26.10., netto).
 * Werbliche Formulierungen liefert Growth, Rechtstexte Legal: bis dahin
 * stehen hier sachliche Platzhalter mit [TODO-GROWTH] bzw. [TODO-LEGAL].
 * Intern heißt das Paket „Jahresplan“ (annual plan), weil „Mitgliedschaft“
 * im Code schon die Mitwirkenden meint; die Oberfläche darf Mitgliedschaft sagen.
 */
import {
  V2_CHANGE_GROSS_LABEL,
  V2_CHANGE_LABEL,
  V2_ENTRY_GROSS_LABEL,
  V2_ENTRY_LABEL,
  V2_MEMBER_YEAR_GROSS_LABEL,
  V2_MEMBER_YEAR_LABEL,
  V2_ENTRY_WITH_MEMBER_CENTS,
  centsLabel,
  grossFromNetCents,
  V3_ENTRY_GROSS_LABEL,
  V3_ENTRY_LABEL,
  V3_ENTRY_WITH_YEAR_GROSS_LABEL,
  V3_ENTRY_WITH_YEAR_LABEL,
  V3_YEAR_GROSS_LABEL,
  V3_YEAR_LABEL,
} from "@/lib/pricing";

export const TODO_GROWTH = "[TODO-GROWTH]";
export const TODO_LEGAL = "[TODO-LEGAL]";

/**
 * Merge-Sperre: solange `true`, meldet check-forbidden-words die Marker
 * [TODO-GROWTH] / [TODO-LEGAL] nur als Warnung (Draft-PR, Test-Preview).
 * Vor dem Merge auf `false` setzen; dann bricht der Build bei jedem Marker ab.
 */
export const PLAN_COPY_DRAFT = true;

export type PlanPackage = "einstieg" | "mitglied";

/* Neues Modell (Philip 28.10.), Wortlaut Growth landing-v3.md (28.10.), 1:1. */
export const PLAN_PACKAGE_ENTRY_TITLE = "30 Tage";
export const PLAN_PACKAGE_MEMBER_TITLE = "Dauerhaft";
/** Kennzeichnung Option 2 (Philip 28.10.; Growth MARKER 2 offen). */
export const PLAN_BESTSELLER_LABEL = "Bestseller";

export const PLAN_ENTRY_PRICE_LINE = `${V3_ENTRY_LABEL} € netto (${V3_ENTRY_GROSS_LABEL} € brutto) einmalig`;
export const PLAN_MEMBER_PRICE_LINE = `${V3_YEAR_LABEL} € netto (${V3_YEAR_GROSS_LABEL} € brutto) pro Jahr`;
export const PLAN_ENTRY_WITH_MEMBER_TOTAL = `${V3_ENTRY_WITH_YEAR_LABEL} € netto (${V3_ENTRY_WITH_YEAR_GROSS_LABEL} € brutto)`;
/** v2 vom 26.10. (abgeschaltet): nur noch für Altbestand/Checks. */
export const PLAN_V2_MEMBER_PRICE_LINE = `${V2_MEMBER_YEAR_LABEL} € netto (${V2_MEMBER_YEAR_GROSS_LABEL} € brutto) pro Jahr`;
export const PLAN_CHANGE_PRICE_LINE = `${V2_CHANGE_LABEL} € netto (${V2_CHANGE_GROSS_LABEL} € brutto) je Änderung`;
export const PLAN_V2_ENTRY_WITH_MEMBER_TOTAL = `${centsLabel(V2_ENTRY_WITH_MEMBER_CENTS)} € netto (${centsLabel(grossFromNetCents(V2_ENTRY_WITH_MEMBER_CENTS), { forceDecimals: true })} € brutto)`;
void V2_ENTRY_LABEL;
void V2_ENTRY_GROSS_LABEL;

/** Jahrespaket nachbuchen (Option 1, innerhalb der 30 Tage). Growth Abschnitt 2/6. */
export const PLAN_ADDON_TITLE = "Jahrespaket zubuchen";
export const PLAN_ADDON_TEXT =
  "Kann ich später auf „Dauerhaft“ wechseln? Ja, für 49 €/Jahr zzgl. USt, solange Ihr 30-Tage-Zugang läuft. Das Jahr zählt ab Ihrem ersten Kauf.";
/** Growth Abschnitt 5 „Konto deaktiviert“. Button-Wortlaut: Philip 28.10. (PLAN_REACTIVATE_LABEL). */
export const PLAN_REACTIVATE_TITLE = "Ihr Konto ist deaktiviert.";
export function planReactivateText(input: { company: string; date: string }): string {
  return `Ihr 30-Tage-Zugang für ${input.company || "Ihre Firma"} ist am ${input.date} abgelaufen. Dashboard und PDF-Download sind deshalb gesperrt. Ihre Angaben sind noch gespeichert.`;
}
export const PLAN_REACTIVATE_TEXT_2 =
  "Mit dem Paket „Dauerhaft“ öffnen Sie Ihr Konto wieder, mit allem, was Sie bereits eingegeben haben.";
export const PLAN_REACTIVATE_PRICE_LINE = "99 € + 49 €/Jahr zzgl. USt";
export const PLAN_REACTIVATE_SMALL = "Zahlung über Stripe. Keine Steuer- oder Rechtsberatung.";
/** Faktenzeile statt 14-Tage-Garantie (Growth MARKER 1, bis Philip entscheidet). */
export const PLAN_FACT_LINE = "Kostenloser Fragebogen · Zahlung erst vor der Erstellung · ab 99 € je Firma zzgl. USt";
/** Widerspruchshinweis § 7 Abs. 3 UWG im Checkout, vor dem Fragebogen und in der 7-Tage-Mail. Wortlaut Legal v3 (AGB § 12a Abs. 2), 1:1. */
export const PLAN_OFFER_OBJECTION_NOTICE =
  "Der Verwendung Ihrer E-Mail-Adresse für Angebote eigener ähnlicher Leistungen (z. B. das Jahrespaket) können Sie jederzeit widersprechen, z. B. per E-Mail an info@gobd-doku-erstellen.de, ohne dass hierfür andere als die Übermittlungskosten nach den Basistarifen entstehen.";
/** Hinweis bei Auswahl Option 1 (Growth Abschnitt 3, inline). */
export const PLAN_ENTRY_SELECTED_HINT =
  "Gut zu wissen: Nach 30 Tagen haben Sie keinen Zugriff mehr auf Dashboard und PDFs. Speichern Sie Ihre PDFs rechtzeitig. Ein Wechsel auf „Dauerhaft“ ist während der 30 Tage für 49 €/Jahr möglich.";
/** Zeile unter beiden Paketen (Growth Abschnitt 2). */
export const PLAN_PACKAGES_FOOTER =
  "Jede Firma wird einzeln gebucht. Alle Preise netto zzgl. USt. Keine Steuer- oder Rechtsberatung.";

/** Growth Abschnitt 2, Paket-Texte (Stichpunkte als Satzfolge). */
const PLAN_V3_ENTRY_TEXT =
  "99 € einmalig je Firma, zzgl. USt. Verfahrensdokumentation als PDF · 30 Tage Zugang zum Dashboard · Angaben anpassen und PDF neu erstellen, solange der Zugang läuft · Personen einladen, die beim Ausfüllen helfen · Danach wird das Konto deaktiviert, auch der PDF-Download. Bitte speichern Sie Ihre PDFs innerhalb der 30 Tage.";
const PLAN_V3_MEMBER_TEXT =
  "99 € einmalig + 49 €/Jahr je Firma, zzgl. USt (im ersten Jahr 148 € zzgl. USt). Alles aus „30 Tage“ · Dauerhafter Zugang zum Dashboard und zu Ihren PDFs · Änderungen jederzeit: Angaben anpassen und neue Version erstellen, wenn sich in Ihrem Betrieb etwas ändert · Personen jederzeit einladen · Verlängert sich jährlich, kündbar laut AGB";

/**
 * Text je Paket, Wortlaut Legal (BUILDER-UEBERGABE 26.10., Abschnitt 4
 * „Checkout und Preisseite – Text je Paket“), vollständig. Löschsätze stehen
 * immer da (Legal, Builder-Hinweis 5 neu: Ops löscht bis zum Lösch-Lauf manuell).
 */
const PLAN_MEMBER_TEXT_BEFORE =
  "beim Kauf 198,90 € netto (236,69 € brutto) = 99 € Einstieg + 99,90 € erstes Mitgliedschaftsjahr, danach 99,90 € netto (118,88 € brutto) pro Jahr. Laufzeit 12 Monate ab Kauftag, verlängert sich automatisch um 12 Monate, wenn Sie nicht spätestens 3 Monate vor Ablauf kündigen. Alle Änderungen inklusive.";
const PLAN_MEMBER_TEXT_DELETE =
  "Nach einer Kündigung löschen wir Ihre Dokumentation mit Ablauf der Mitgliedschaft, nach Vorab-Hinweis 30 und 7 Tage vorher.";
/** Fassung 14:24 (freigegeben). */
const PLAN_MEMBER_TEXT_AFTER =
  "Gilt für 1 Firma; 2. Firma ohne Aufpreis, ab der 3. je 49 € netto (58,31 € brutto) pro Jahr, ohne anteilige Berechnung.";
/** Fassung 15:00 (Abrechnung nach aktiven Firmen, § 12c neu): wartet auf Philips Freigabe, nur mit PRICING_EXTRA_FIRMS_ENABLED. */
const PLAN_MEMBER_TEXT_AFTER_ACTIVE_FIRMS =
  "Gilt für 1 Firma; eine weitere Firma ohne Aufpreis, jede darüber hinaus 49 € netto (58,31 € brutto) pro Jahr, abgerechnet bei jeder Verlängerung nach der Zahl der aktiven Firmen, ohne anteilige Berechnung.";
const PLAN_ENTRY_TEXT_BEFORE =
  "99 € netto (117,81 € brutto) einmalig. Ihre Dokumentation wird 12 Monate ab Kauftag vorgehalten; Änderungen in dieser Zeit je 49 € netto (58,31 € brutto), jede bezahlte Änderung verlängert die Vorhaltung auf 12 Monate ab Zahlung.";
const PLAN_ENTRY_TEXT_DELETE = "Danach löschen wir sie nach Vorab-Hinweis (30 und 7 Tage vorher).";
const PLAN_ENTRY_TEXT_AFTER =
  "Ihr PDF behalten Sie. Gilt für 1 Firma; jede weitere Firma 99 € netto (117,81 € brutto) mit eigener 12-Monatsfrist ab Zahlung.";

export type PlanPackageTexts = { entry: string; member: string };

/** Neues Modell (28.10.). */
export function planPackageTextsV3(): PlanPackageTexts {
  return { entry: PLAN_V3_ENTRY_TEXT, member: PLAN_V3_MEMBER_TEXT };
}

export function planPackageTexts(activeFirmsBilling = false): PlanPackageTexts {
  const firms = activeFirmsBilling ? PLAN_MEMBER_TEXT_AFTER_ACTIVE_FIRMS : PLAN_MEMBER_TEXT_AFTER;
  return {
    member: `${PLAN_MEMBER_TEXT_BEFORE} ${PLAN_MEMBER_TEXT_DELETE} ${firms}`,
    entry: `${PLAN_ENTRY_TEXT_BEFORE} ${PLAN_ENTRY_TEXT_DELETE} ${PLAN_ENTRY_TEXT_AFTER}`,
  };
}

/** Growth-Wortlaut 26.10. (exakt): Preisseite und Paketwahl. */
export const PLAN_B2B_NOTICE = "Nur für Unternehmen · alle Preise zzgl. 19 % USt";
export const PLAN_PACKAGE_INTRO = `Wählen Sie Ihr Paket. ${TODO_GROWTH}`;
/** Wortlaut Legal (legal/checkout-konto-saetze.md, 26.10. 15:20), Pflicht-Checkbox, nicht vorangekreuzt. */
export const PLAN_TERMS_LABEL_BEFORE = "Ich akzeptiere die ";
export const PLAN_TERMS_LINK = "Allgemeinen Geschäftsbedingungen";
export const PLAN_TERMS_LABEL_AFTER = " der IKAT GmbH.";
export const PLAN_TERMS_HREF = "/agb";
/** Darunter, ohne Checkbox (nur Link, keine Einwilligung). */
export const PLAN_PRIVACY_BEFORE = "Informationen zur Verarbeitung Ihrer Daten finden Sie in der ";
export const PLAN_PRIVACY_LINK = "Datenschutzerklärung";
export const PLAN_PRIVACY_AFTER = ".";
export const PLAN_PRIVACY_HREF = "/datenschutz";

/** Konto, Karte „Jahresmitgliedschaft“ (Wortlaut Legal 15:20). */
export const PLAN_CANCEL_EMAIL_NOTE =
  "Sie können die Mitgliedschaft auch per E-Mail an info@gobd-doku-erstellen.de kündigen (bis 3 Monate vor Ablauf) und eine Kündigung bis zum Ablauf ebenso per E-Mail zurücknehmen.";

/**
 * Kanzlei-Probedurchlauf (Philip 15:06/15:15): Legal-Texte kommen Do 29.10.
 * Nur unter v2 sichtbar; Legacy behält Partner-Pilot/KANZLEI-PILOT-Wortlaut.
 */
export const PARTNER_PROBE_MAIL_INTRO_V2 = `${TODO_LEGAL} Einleitung Partner-Mail zum Kanzlei-Probedurchlauf (Text folgt).`;
export const PARTNER_PROBE_MAIL_OFFER_V2 = `${TODO_LEGAL} Satz zum Kanzlei-Probedurchlauf statt KANZLEI-PILOT-Konditionen (Text folgt).`;
export const PARTNER_PROBE_CHECKOUT_NOTE_V2 = `${TODO_LEGAL} Hinweis zum Kanzlei-Probedurchlauf statt Pilot-Satz (Text folgt).`;
