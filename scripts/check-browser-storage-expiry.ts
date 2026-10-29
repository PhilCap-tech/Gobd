/**
 * Browser-Speicher-Ablauf (Datenschutz-Fix, beide Modi): Fragebogen-Entwurf
 * 30 Tage + Löschen beim Abmelden, Kauf-Vermerk 90 Tage. Altbestand ohne
 * Zeitstempel bleibt (wird gestempelt). Reine Funktionen, kein Browser.
 * Nur Browser: kein Ablauf für Blob-Entwürfe, Sheets oder Mail-Dedupe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ADS_PURCHASE_MAX_AGE_MS,
  INTAKE_DRAFT_MAX_AGE_MS,
  INTAKE_DRAFT_STORAGE_PREFIX,
  adsPurchaseExpiry,
  clearIntakeDrafts,
  intakeDraftExpiry,
  readAdsPurchaseFlag,
  readIntakeDraftEntry,
  storageEntryExpired,
  sweepIntakeDrafts,
  writeAdsPurchaseFlag,
  type StorageLike,
} from "@/lib/browser-storage-expiry";
import { PURCHASE_CONVERSION_STORAGE_PREFIX } from "@/lib/tracking";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-26T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  writes = 0;
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.writes += 1;
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

let passed = 0;
function check(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`ok: ${name}`);
}

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

check("Fristen 30 und 90 Tage", () => {
  assert.equal(INTAKE_DRAFT_MAX_AGE_MS, 30 * DAY);
  assert.equal(ADS_PURCHASE_MAX_AGE_MS, 90 * DAY);
  assert.equal(INTAKE_DRAFT_STORAGE_PREFIX, "gobd-intake-draft:");
  assert.equal(PURCHASE_CONVERSION_STORAGE_PREFIX, "gobd_ads_purchase:");
  assert.equal(storageEntryExpired(NOW - 30 * DAY, 30 * DAY, NOW), false, "genau 30 Tage: noch da");
  assert.equal(storageEntryExpired(NOW - 30 * DAY - 1, 30 * DAY, NOW), true);
  assert.equal(storageEntryExpired(NOW + DAY, 30 * DAY, NOW), false, "Zukunft gilt als frisch");
});

check("Entwurf: frisch bleibt, alt wird entfernt, ohne Zeitstempel gestempelt", () => {
  const fresh = JSON.stringify({ answers: {}, step: 1, savedAt: iso(NOW - 29 * DAY) });
  assert.deepEqual(intakeDraftExpiry(fresh, NOW), { action: "keep" });
  const old = JSON.stringify({ answers: {}, step: 1, savedAt: iso(NOW - 31 * DAY) });
  assert.deepEqual(intakeDraftExpiry(old, NOW), { action: "remove" });
  const legacy = JSON.stringify({ answers: { a: 1 }, step: 2, savedAt: "" });
  const stamped = intakeDraftExpiry(legacy, NOW);
  assert.equal(stamped.action, "stamp");
  const value = JSON.parse((stamped as { value: string }).value) as Record<string, unknown>;
  assert.equal(value.stampedAt, iso(NOW));
  assert.equal(value.savedAt, "", "savedAt bleibt unverändert (Vergleich mit Server-Entwurf)");
  assert.deepEqual(value.answers, { a: 1 });
  const stampedOld = JSON.stringify({ answers: {}, stampedAt: iso(NOW - 31 * DAY) });
  assert.deepEqual(intakeDraftExpiry(stampedOld, NOW), { action: "remove" }, "Stempel zählt ab dem ersten Lesen");
  assert.deepEqual(intakeDraftExpiry("{kaputt", NOW), { action: "keep" }, "unlesbar: nicht anfassen");
});

check("Entwurf: Lesen und Sweep im Speicher, kein Massenlöschen von Altbestand", () => {
  const storage = new MemoryStorage();
  storage.setItem("gobd-intake-draft:alt", JSON.stringify({ answers: {}, savedAt: iso(NOW - 40 * DAY) }));
  storage.setItem("gobd-intake-draft:neu", JSON.stringify({ answers: {}, savedAt: iso(NOW - DAY) }));
  storage.setItem("gobd-intake-draft:ohne", JSON.stringify({ answers: {} }));
  storage.setItem("gobd_consent", "x");
  assert.equal(readIntakeDraftEntry(storage, "gobd-intake-draft:alt", NOW), null);
  assert.equal(storage.getItem("gobd-intake-draft:alt"), null, "abgelaufen: entfernt");
  storage.setItem("gobd-intake-draft:alt2", JSON.stringify({ answers: {}, savedAt: iso(NOW - 40 * DAY) }));
  sweepIntakeDrafts(storage, NOW);
  assert.equal(storage.getItem("gobd-intake-draft:alt2"), null);
  assert.ok(storage.getItem("gobd-intake-draft:neu"));
  const ohne = JSON.parse(storage.getItem("gobd-intake-draft:ohne") ?? "{}") as { stampedAt?: string };
  assert.equal(ohne.stampedAt, iso(NOW), "Altbestand gestempelt, nicht gelöscht");
  assert.equal(storage.getItem("gobd_consent"), "x", "andere Keys unberührt");
  sweepIntakeDrafts(storage, NOW + 29 * DAY);
  assert.ok(storage.getItem("gobd-intake-draft:ohne"), "29 Tage nach Stempel noch da");
  sweepIntakeDrafts(storage, NOW + 31 * DAY);
  assert.equal(storage.getItem("gobd-intake-draft:ohne"), null, "31 Tage nach Stempel entfernt");
});

check("Abmelden entfernt alle Entwürfe, sonst nichts", () => {
  const storage = new MemoryStorage();
  storage.setItem("gobd-intake-draft:a", "{}");
  storage.setItem("gobd-intake-draft:b", "{}");
  storage.setItem("gobd_ads_purchase:cs_1", "1");
  storage.setItem("gobd_consent", "x");
  assert.equal(clearIntakeDrafts(storage), 2);
  assert.equal(storage.length, 2);
  assert.ok(storage.getItem("gobd_consent") && storage.getItem("gobd_ads_purchase:cs_1"));
  const logout = read("components/logout-button.tsx");
  assert.ok(logout.includes("clearIntakeDrafts(storage)"), "Logout-Button räumt Entwürfe");
  assert.ok(logout.includes("window.localStorage, window.sessionStorage"), "local und session");
  assert.ok(logout.indexOf("clearIntakeDrafts") < logout.indexOf('window.location.replace("/login")'));
});

check("Kauf-Vermerk: 90 Tage, Altbestand \"1\" gestempelt", () => {
  const key = "gobd_ads_purchase:cs_test_1";
  assert.deepEqual(adsPurchaseExpiry("1", NOW), {
    action: "stamp",
    value: JSON.stringify({ at: iso(NOW) }),
    sent: true,
  });
  assert.deepEqual(adsPurchaseExpiry(JSON.stringify({ at: iso(NOW - 89 * DAY) }), NOW), { action: "keep", sent: true });
  assert.deepEqual(adsPurchaseExpiry(JSON.stringify({ at: iso(NOW - 91 * DAY) }), NOW), { action: "remove", sent: false });
  assert.deepEqual(adsPurchaseExpiry("x", NOW), { action: "keep", sent: false });
  const storage = new MemoryStorage();
  assert.equal(readAdsPurchaseFlag(storage, key, NOW), false);
  writeAdsPurchaseFlag(storage, key, NOW);
  assert.equal(readAdsPurchaseFlag(storage, key, NOW + 90 * DAY), true);
  assert.equal(readAdsPurchaseFlag(storage, key, NOW + 91 * DAY), false);
  assert.equal(storage.getItem(key), null, "abgelaufen: entfernt");
  storage.setItem(key, "1");
  assert.equal(readAdsPurchaseFlag(storage, key, NOW), true, "Altbestand gilt als gemeldet");
  assert.equal(storage.getItem(key), JSON.stringify({ at: iso(NOW) }));
  const tracking = read("lib/tracking.ts");
  assert.ok(tracking.includes("readAdsPurchaseFlag(window.localStorage"), "Tracking liest mit Ablauf");
  assert.ok(tracking.includes("writeAdsPurchaseFlag(window.sessionStorage"), "Tracking schreibt Zeitpunkt");
});

check("Intake liest den Entwurf mit Ablauf", () => {
  const form = read("app/intake/intake-form.tsx");
  assert.ok(form.includes("readIntakeDraftEntry(window.localStorage, localDraftKey"));
  assert.ok(!form.includes("window.localStorage.getItem(localDraftKey)"), "kein Lesen ohne Ablauf");
});

check("Nur Browser: kein Ablauf/Löschen für Server-Daten", () => {
  const lib = read("lib/browser-storage-expiry.ts");
  for (const forbidden of ["@vercel/blob", "googleapis", "mail-dedupe", "node:fs", "fetch("]) {
    assert.ok(!lib.includes(forbidden), `kein ${forbidden} im Browser-Ablauf`);
  }
});

console.log(`check-browser-storage-expiry: ${passed} Prüfungen ok`);
