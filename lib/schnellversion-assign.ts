/**
 * Zuteilung 50/50 für den 4-Wochen-Test.
 *
 * Ohne Marketing-Einwilligung gibt es keinen Arm und kein Cookie: die
 * bestehende Consent-Logik speichert Analyse-Daten erst nach Einwilligung
 * (`hasMarketingConsent` in lib/tracking.ts). Die Startseite bleibt dann
 * die Kontrolle, Direktaufrufe der Schnellversion gehen auf die Startseite.
 *
 * Mit Einwilligung wird einmalig `control` oder `test` gewählt und im
 * Cookie `sv49_arm` gehalten (28 Tage, SameSite=Lax, kein gclid, keine
 * Personendaten). Widerruf löscht das Cookie wieder.
 *
 * Variante ist fest B (Button „Direkt kaufen“). Die Kontrolle sieht den
 * Button nicht.
 */

export const SV_ARM_COOKIE = "sv49_arm";
export const SV_ARM_MAX_AGE_SEC = 60 * 60 * 24 * 28;

export type SvArm = "control" | "test";

export function parseSvArm(value: string | undefined | null): SvArm | null {
  return value === "control" || value === "test" ? value : null;
}

/**
 * `null`, solange keine Marketing-Einwilligung vorliegt.
 * Ein schon gesetzter Arm bleibt. Sonst entscheidet `roll` in [0, 1): unter 0,5 Kontrolle.
 */
export function decideSvArm(input: {
  marketing: boolean;
  existing: SvArm | null;
  roll: number;
}): SvArm | null {
  if (!input.marketing) return null;
  if (input.existing) return input.existing;
  if (!Number.isFinite(input.roll)) return "control";
  return input.roll < 0.5 ? "control" : "test";
}
