/**
 * Ablauf für Einträge im Browser-Speicher (Datenschutz-Fix, beide Modi).
 *
 * - `gobd-intake-draft:<Kennung>` (localStorage/sessionStorage): 30 Tage nach
 *   dem letzten Speichern (`savedAt`), außerdem beim Abmelden entfernt.
 * - `gobd_ads_purchase:<Checkout-Session>` (localStorage/sessionStorage):
 *   90 Tage nach der Meldung.
 *
 * Einträge ohne Zeitstempel (Altbestand) gelten als frisch und bekommen beim
 * Lesen einen Zeitstempel; es wird nichts massenhaft gelöscht.
 * Nur Browser-Speicher: Server-Entwürfe (Blob), Sheet-Zeilen und der
 * Mail-Dedupe-Ledger bleiben unberührt (Fristen entscheidet Philip).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const INTAKE_DRAFT_STORAGE_PREFIX = "gobd-intake-draft:";
export const INTAKE_DRAFT_MAX_AGE_MS = 30 * DAY_MS;
export const ADS_PURCHASE_MAX_AGE_MS = 90 * DAY_MS;

/** Minimal-Ausschnitt von `Storage`, damit die Prüfung ohne Browser läuft. */
export type StorageLike = {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function timestampMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Älter als `maxAgeMs`? Zeitstempel in der Zukunft (Uhrabweichung) gelten als frisch. */
export function storageEntryExpired(atMs: number, maxAgeMs: number, now: number): boolean {
  return now - atMs > maxAgeMs;
}

export type StorageExpiryAction =
  | { action: "keep" }
  | { action: "remove" }
  | { action: "stamp"; value: string };

/**
 * Entscheidung für einen gespeicherten Fragebogen-Entwurf (JSON-Snapshot).
 * Bezug ist `savedAt`; fehlt es, `stampedAt` (vom ersten Lesen nach diesem
 * Stand). Ohne beides: frisch, Zeitstempel `stampedAt` ergänzen (`savedAt`
 * bleibt unverändert, damit der Vergleich mit dem Server-Entwurf gleich bleibt).
 * Unlesbares JSON wird nicht angefasst.
 */
export function intakeDraftExpiry(raw: string, now: number): StorageExpiryAction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { action: "keep" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { action: "keep" };
  const record = parsed as { savedAt?: unknown; stampedAt?: unknown };
  const at = timestampMs(record.savedAt) ?? timestampMs(record.stampedAt);
  if (at === null) {
    return {
      action: "stamp",
      value: JSON.stringify({ ...record, stampedAt: new Date(now).toISOString() }),
    };
  }
  return storageEntryExpired(at, INTAKE_DRAFT_MAX_AGE_MS, now) ? { action: "remove" } : { action: "keep" };
}

/** Wert für einen gemeldeten Kauf: Zeitpunkt der Meldung. */
export function adsPurchaseStorageValue(now: number): string {
  return JSON.stringify({ at: new Date(now).toISOString() });
}

/**
 * Entscheidung für den Kauf-Vermerk. Altbestand `"1"` (ohne Zeitpunkt): frisch,
 * Zeitpunkt ergänzen. Unbekannte Werte gelten wie bisher als „nicht gemeldet“.
 */
export function adsPurchaseExpiry(raw: string, now: number): StorageExpiryAction & { sent: boolean } {
  if (raw === "1") return { action: "stamp", value: adsPurchaseStorageValue(now), sent: true };
  let at: number | null = null;
  try {
    at = timestampMs((JSON.parse(raw) as { at?: unknown } | null)?.at);
  } catch {
    at = null;
  }
  if (at === null) return { action: "keep", sent: false };
  if (storageEntryExpired(at, ADS_PURCHASE_MAX_AGE_MS, now)) return { action: "remove", sent: false };
  return { action: "keep", sent: true };
}

function apply(storage: StorageLike, key: string, decision: StorageExpiryAction): void {
  try {
    if (decision.action === "remove") storage.removeItem(key);
    if (decision.action === "stamp") storage.setItem(key, decision.value);
  } catch {
    /* Speicher gesperrt oder voll */
  }
}

/** Liest einen Entwurf; abgelaufen: entfernt und `null`. */
export function readIntakeDraftEntry(storage: StorageLike, key: string, now: number): string | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const decision = intakeDraftExpiry(raw, now);
  apply(storage, key, decision);
  if (decision.action === "remove") return null;
  return decision.action === "stamp" ? decision.value : raw;
}

function keysWithPrefix(storage: StorageLike, prefix: string): string[] {
  const keys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
  } catch {
    /* Speicher gesperrt */
  }
  return keys;
}

/** Entfernt abgelaufene Entwürfe (alle Kennungen), stempelt Altbestand. */
export function sweepIntakeDrafts(storage: StorageLike, now: number): void {
  for (const key of keysWithPrefix(storage, INTAKE_DRAFT_STORAGE_PREFIX)) {
    readIntakeDraftEntry(storage, key, now);
  }
}

/** Abmelden: alle Fragebogen-Entwürfe aus diesem Browser-Speicher entfernen. */
export function clearIntakeDrafts(storage: StorageLike): number {
  const keys = keysWithPrefix(storage, INTAKE_DRAFT_STORAGE_PREFIX);
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignorieren */
    }
  }
  return keys.length;
}

/** Kauf-Vermerk lesen; abgelaufen: entfernt und `false`. */
export function readAdsPurchaseFlag(storage: StorageLike, key: string, now: number): boolean {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return false;
  }
  if (raw === null) return false;
  const decision = adsPurchaseExpiry(raw, now);
  apply(storage, key, decision);
  return decision.sent;
}

export function writeAdsPurchaseFlag(storage: StorageLike, key: string, now: number): void {
  try {
    storage.setItem(key, adsPurchaseStorageValue(now));
  } catch {
    /* private mode */
  }
}

/** Alle Kauf-Vermerke mit diesem Präfix prüfen (abgelaufene entfernen, Altbestand stempeln). */
export function sweepAdsPurchaseFlags(storage: StorageLike, prefix: string, now: number): void {
  for (const key of keysWithPrefix(storage, prefix)) readAdsPurchaseFlag(storage, key, now);
}
