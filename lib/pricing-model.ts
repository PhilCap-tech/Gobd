/**
 * Schalter für das Preismodell v2 (Draft, Preismodell 2026-11).
 * Ohne gesetzte Variablen bleibt alles wie bisher: PRICING_MODEL=legacy.
 * Reine Lesefunktionen, keine Seiteneffekte, keine Secrets.
 */

export type PricingModel = "legacy" | "v2";

/** `v2` nur bei genau diesem Wert. Alles andere ist das bisherige Modell. */
export function pricingModel(): PricingModel {
  return process.env.PRICING_MODEL?.trim().toLowerCase() === "v2" ? "v2" : "legacy";
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
