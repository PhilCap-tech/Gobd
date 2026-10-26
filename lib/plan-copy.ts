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

export const PLAN_PACKAGE_ENTRY_TITLE = "Einstieg";
export const PLAN_PACKAGE_MEMBER_TITLE = "Einstieg mit Mitgliedschaft";

export const PLAN_ENTRY_PRICE_LINE = `${V2_ENTRY_LABEL} € netto (${V2_ENTRY_GROSS_LABEL} € brutto) einmalig`;
export const PLAN_MEMBER_PRICE_LINE = `${V2_MEMBER_YEAR_LABEL} € netto (${V2_MEMBER_YEAR_GROSS_LABEL} € brutto) pro Jahr`;
export const PLAN_CHANGE_PRICE_LINE = `${V2_CHANGE_LABEL} € netto (${V2_CHANGE_GROSS_LABEL} € brutto) je Änderung`;
export const PLAN_ENTRY_WITH_MEMBER_TOTAL = `${centsLabel(V2_ENTRY_WITH_MEMBER_CENTS)} € netto (${centsLabel(grossFromNetCents(V2_ENTRY_WITH_MEMBER_CENTS), { forceDecimals: true })} € brutto)`;

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
