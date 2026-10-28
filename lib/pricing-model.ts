/**
 * Schalter für das Preismodell v2 (Draft, Preismodell 2026-11).
 * Ohne gesetzte Variablen bleibt alles wie bisher: PRICING_MODEL=legacy.
 * Reine Lesefunktionen, keine Seiteneffekte, keine Secrets.
 */

export type PricingModel = "legacy" | "v2";

/** `v2` nur bei genau diesem Wert. Alles andere ist das bisherige Modell. */
export function pricingModel(): PricingModel {
  // Neues Modell (Philip 28.10.) ersetzt v2 vom 26.10. unter demselben Wert; `v3` ist ein Alias.
  const raw = process.env.PRICING_MODEL?.trim().toLowerCase();
  return raw === "v2" || raw === "v3" ? "v2" : "legacy";
}

export function isPricingV2(): boolean {
  return pricingModel() === "v2";
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true" || raw === "1" || raw === "ja" || raw === "on") return true;
  if (raw === "false" || raw === "0" || raw === "nein" || raw === "off") return false;
  return fallback;
}

/**
 * Zugangslogik aus dem Tab `plans`. Default: an, wenn v2 verkauft wird.
 * Für einen Rollback auf legacy bleibt sie mit PLAN_ACCESS_ENABLED=true an,
 * damit Käufe aus der v2-Zeit weiter richtig behandelt werden.
 */
export function planAccessEnabled(): boolean {
  return boolEnv("PLAN_ACCESS_ENABLED", isPricingV2());
}

/**
 * Zurückgestellte Plan-Logik (CoS 27.10., v2-Kern): Fristen-/Löschzugang
 * (T5/T6), Änderung bzw. Mitgliedschaft im Konto kaufen (T4), eigener
 * Kündigungsstichtag im Konto (T8) und Status-Anzeigen (T10). Default AUS.
 * Aus: Käufe werden im Webhook weiter in `plans` verbucht, der Zugang hängt
 * aber nicht davon ab (alle v2-Kunden voll offen), Kündigen läuft über das
 * Stripe-Kundenportal. Der Code bleibt, er wird nur nicht ausgewertet.
 */
export function planLifecycleEnabled(): boolean {
  return planAccessEnabled() && boolEnv("PLAN_LIFECYCLE_ENABLED", false);
}

/** Paket mit Jahresmitgliedschaft vorausgewählt (Philip 26.10.; Legal prüft). Default: ja. */
export function memberPreselected(): boolean {
  return boolEnv("PRICING_MEMBER_PRESELECTED", true);
}

/** Lösch-Lauf darf löschen. Default AUS. Auch bei an löscht dieser Stand nichts (nur Trockenlauf). */
export function retentionDeleteEnabled(): boolean {
  return boolEnv("RETENTION_DELETE_ENABLED", false);
}

/** Erinnerungsmails 30 und 7 Tage vor der Löschung. Default AUS. */
export function retentionNoticeEnabled(): boolean {
  return boolEnv("RETENTION_NOTICE_ENABLED", false);
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

/** Vorhaltefrist ohne Mitgliedschaft: ab Kauftag bzw. ab Zahlung einer Änderung. Fest 12. */
export const PLAN_WINDOW_MONTHS = 12;

/**
 * R3 (Philip 26.10. 13:57): Nach Kündigung der Mitgliedschaft wird die
 * Dokumentation zum Ablauf der Mitgliedschaft gelöscht, ohne neue Frist.
 * Default 0 Monate. Ein anderer Wert (1–36) gibt eine Frist ab dem Ende.
 */
export function windowAfterMemberMonths(): number {
  return intEnv("PLAN_WINDOW_AFTER_MEMBER_MONTHS", 0, 0, 36);
}

/** Kündigung der Mitgliedschaft bis so viele Monate vor Ablauf (Philip 26.10.: 3). */
export function memberCancelNoticeMonths(): number {
  return intEnv("MEMBER_CANCEL_NOTICE_MONTHS", 3, 0, 11);
}

/**
 * R4 (Legal prüft): Wirkung einer Kündigung nach dem Stichtag.
 * `following_term` (Default, CoS 26.10.): zum Ende der übernächsten Laufzeit,
 * also eine Verlängerung läuft noch. `current_term`: trotzdem zum laufenden Ende.
 */
export type LateCancelEffect = "following_term" | "current_term";

export function memberLateCancelEffect(): LateCancelEffect {
  return process.env.MEMBER_LATE_CANCEL_EFFECT?.trim() === "current_term"
    ? "current_term"
    : "following_term";
}

/** Stripe-Preis-IDs v2 aus der Umgebung. Keine IDs im Code. */
export function v2PriceIds(): { entry: string; memberYear: string; change: string } {
  return {
    entry: process.env.STRIPE_PRICE_ENTRY_ID?.trim() ?? "",
    memberYear: process.env.STRIPE_PRICE_MEMBER_YEAR_ID?.trim() ?? "",
    change: process.env.STRIPE_PRICE_CHANGE_ID?.trim() ?? "",
  };
}

export function isStripeV2Configured(): boolean {
  const ids = v2PriceIds();
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && ids.entry && ids.memberYear && ids.change);
}

/* ---------- Weitere Firmen (R1 neu, Philip 26.10. 14:04) ---------- */

/**
 * Eigener Schalter, Default AUS (CoS 26.10. 14:15): Firmen-Plätze, weitere
 * Firma buchen, Fristen je Firma. Aus: v2 deckt Firmen auf Konto-Ebene wie
 * bisher, weitere Firmen werden vorerst manuell berechnet.
 */
export function extraFirmsEnabled(): boolean {
  // Neues Modell (28.10.): jede weitere Firma ist ein eigener voller Kauf; der Firmen-Pfad bleibt aus.
  if (isPricingV2()) return false;
  return planAccessEnabled() && process.env.PRICING_EXTRA_FIRMS_ENABLED?.trim().toLowerCase() === "true";
}

/** Mitglieder: Firmen ohne Aufpreis (1. + 2. Firma). MEMBER_INCLUDED_FIRMS, Default 2. */
export function memberIncludedFirms(): number {
  const raw = Number(process.env.MEMBER_INCLUDED_FIRMS?.trim() || "2");
  return Number.isInteger(raw) && raw >= 1 && raw <= 20 ? raw : 2;
}

/**
 * Preis-IDs für weitere Firmen. STRIPE_PRICE_FIRM_ID: 99 € einmalig ohne
 * Mitgliedschaft (leer: STRIPE_PRICE_ENTRY_ID). STRIPE_PRICE_MEMBER_FIRM_YEAR_ID:
 * 49 €/Jahr als zusätzlicher Posten (Menge) am Mitgliedschafts-Abo.
 */
export function v2FirmPriceIds(): { firm: string; memberFirmYear: string } {
  return {
    firm: process.env.STRIPE_PRICE_FIRM_ID?.trim() || process.env.STRIPE_PRICE_ENTRY_ID?.trim() || "",
    memberFirmYear: process.env.STRIPE_PRICE_MEMBER_FIRM_YEAR_ID?.trim() ?? "",
  };
}

/* ---------- Erinnerung vor jeder Verlängerung (CoS 26.10. 14:25) ---------- */

/** Schalter für die Verlängerungs-Erinnerung. Default AUS; versendet wird in diesem Stand nie. */
export function renewalNoticeEnabled(): boolean {
  return boolEnv("RENEWAL_NOTICE_ENABLED", false);
}

/**
 * Tage VOR dem Kündigungsstichtag (Ablauf − 3 Monate). AGB-Entwurf § 12
 * Abs. 2: „rechtzeitig vor Beginn der Kündigungsfrist“. Default 30 Tage,
 * also rund 4 Monate vor der Verlängerung. RENEWAL_NOTICE_DAYS_BEFORE_CUTOFF, 7–120.
 */
export function renewalNoticeDaysBeforeCutoff(): number {
  const raw = Number(process.env.RENEWAL_NOTICE_DAYS_BEFORE_CUTOFF?.trim() || "30");
  return Number.isInteger(raw) && raw >= 7 && raw <= 120 ? raw : 30;
}

/* ---------- Neues Preismodell (Philip 28.10.), ersetzt v2 vom 26.10. ---------- */

/** Option 1: Zugang ab Kauf in Tagen. Ab Kauf + 30 Tage (genau) ist alles gesperrt, auch der Download. */
export const PLAN_ACCESS_DAYS = 30;
/** Hinweis-Mail mit Angebot Jahrespaket: so viele Tage vor dem Zugangsende. */
export const PLAN_ADDON_NOTICE_DAYS_BEFORE = 7;

/** Stripe Lookup Keys (Platzhalter, es gibt noch keine Stripe-Objekte). */
export const PLAN_LOOKUP_KEY_ENTRY = "entry_v3";
export const PLAN_LOOKUP_KEY_YEAR = "year_v3";
/** Einmalposten 49 € fürs erste Jahr beim nachgebuchten Jahrespaket (Jahr ab Erstkauf). */
export const PLAN_LOOKUP_KEY_ADDON_YEAR = "addon_year_v3";

/**
 * Preis-IDs neues Modell aus der Umgebung. Einstieg 99 € einmalig:
 * STRIPE_PRICE_ENTRY_ID. Jahrespaket 49 €/Jahr: STRIPE_PRICE_YEAR_ID (bewusst
 * nicht STRIPE_PRICE_MEMBER_YEAR_ID, damit kein alter 99,90-€-Preis greift).
 */
export function v3PriceIds(): { entry: string; year: string } {
  return {
    entry: process.env.STRIPE_PRICE_ENTRY_ID?.trim() ?? "",
    year: process.env.STRIPE_PRICE_YEAR_ID?.trim() ?? "",
  };
}

/** 7-Tage-Hinweis-Mail (Cron) wirklich versenden. Default AUS: der Lauf wählt nur aus. */
export function addonNoticeEnabled(): boolean {
  return boolEnv("PLAN_ADDON_NOTICE_ENABLED", false);
}

/** Phase 2: Login vor dem Fragebogen, Paketwahl und Zahlung danach. Default AUS. */
export function intakeLoginFirstEnabled(): boolean {
  // Default AN im neuen Modell (Go-live), Legacy immer aus.
  return isPricingV2() && boolEnv("INTAKE_LOGIN_FIRST_ENABLED", true);
}
