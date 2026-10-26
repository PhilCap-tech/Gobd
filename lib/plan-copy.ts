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

export type PlanPackage = "einstieg" | "mitglied";

export const PLAN_PACKAGE_ENTRY_TITLE = "Einstieg";
export const PLAN_PACKAGE_MEMBER_TITLE = "Einstieg + Jahresmitgliedschaft";

export const PLAN_ENTRY_PRICE_LINE = `${V2_ENTRY_LABEL} € netto (${V2_ENTRY_GROSS_LABEL} € brutto) einmalig`;
export const PLAN_MEMBER_PRICE_LINE = `${V2_MEMBER_YEAR_LABEL} € netto (${V2_MEMBER_YEAR_GROSS_LABEL} € brutto) pro Jahr`;
export const PLAN_CHANGE_PRICE_LINE = `${V2_CHANGE_LABEL} € netto (${V2_CHANGE_GROSS_LABEL} € brutto) je Änderung`;
export const PLAN_ENTRY_WITH_MEMBER_TOTAL = `${centsLabel(V2_ENTRY_WITH_MEMBER_CENTS)} € netto (${centsLabel(grossFromNetCents(V2_ENTRY_WITH_MEMBER_CENTS), { forceDecimals: true })} € brutto)`;

/** Unterschiede je Paket, sachlich (entschieden). Werbetext folgt. */
export const PLAN_ENTRY_POINTS = [
  "Verfahrensdokumentation als PDF, bis zu 5 Firmen, alle 24 Module",
  "Dokumentation 12 Monate ab Kauf bei uns gespeichert",
  `Änderung in dieser Frist: ${V2_CHANGE_LABEL} € netto, verlängert die Frist um 12 Monate ab Zahlung`,
  "Danach Löschung bei uns; Ihr PDF behalten Sie",
] as const;

export const PLAN_MEMBER_POINTS = [
  "Verfahrensdokumentation als PDF, bis zu 5 Firmen, alle 24 Module",
  "Dokumentation wird bei uns geführt und versioniert",
  "Alle Änderungen inklusive",
  "Verlängert sich jährlich; Kündigung bis 3 Monate vor Ablauf im Konto oder schriftlich",
] as const;

export const PLAN_B2B_NOTICE = `Angebot nur für Unternehmen. ${TODO_GROWTH}`;
export const PLAN_PACKAGE_INTRO = `Wählen Sie Ihr Paket. ${TODO_GROWTH}`;
export const PLAN_TERMS_LABEL_BEFORE = "Ich habe die ";
export const PLAN_TERMS_LINK = "AGB";
export const PLAN_TERMS_LABEL_AFTER = ` gelesen und akzeptiere sie. ${TODO_LEGAL}`;
export const PLAN_TERMS_HREF = "/agb";
