/**
 * Löschlauf /api/cron/loeschlauf: `?modus=trockenlauf` löscht auch bei
 * SCHNELLVERSION_49_PURGE=1 keine Schnellversion-Daten, der scharfe Lauf schon.
 * Ruft die echte Route auf. Store: In-Memory der Schnellversion (kein Blob, kein Sheet, kein Netz).
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const name of [
  "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID", "GOOGLE_SHEETS_SPREADSHEET_ID", "RESEND_API_KEY", "STRIPE_SECRET_KEY",
  "VERCEL_ENV", "RETENTION_DRY_RUN_ENABLED", "RETENTION_EXECUTE_ENABLED", "MEASURE_RETENTION_EXECUTE_ENABLED",
]) delete process.env[name];
process.env.TMPDIR = mkdtempSync(path.join(tmpdir(), "gobd-sv-trocken-"));
const CHECK_SECRET = "check-sv-trockenlauf";
process.env.CRON_SECRET = CHECK_SECRET;
process.env.SCHNELLVERSION_49_PURGE = "1";
if (!(process.env.npm_lifecycle_event ?? "").startsWith("check:")) process.env.npm_lifecycle_event = "check:sv-trockenlauf";

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const record = await import("@/lib/schnellversion-record");
  const { GET } = await import("@/app/api/cron/loeschlauf/route");
  const now = Date.now();
  const seed = async (name: string, ageDays: number) => {
    const row = await record.saveSvPurchase({
      email: `${name}@example.com`,
      company: `${name} GmbH`,
      purchasedAt: new Date(now - ageDays * DAY).toISOString(),
      pdf: Buffer.from("pdf"),
      consentAt: new Date(now - ageDays * DAY).toISOString(),
      sessionId: `cs_test_trocken_${name}`,
      answersJson: "{}",
      downloadTokenHash: "ab".repeat(32),
    });
    writeFileSync(row.pdfPath, "pdf");
    return row;
  };
  const delivery = await seed("pdf31", 31);
  const yearOld = await seed("jahr400", 400);
  const fresh = await seed("frisch2", 2);
  const find = async (id: string) => (await record.listAllSvPurchases()).find((row) => row.id === id);
  const call = (query: string) =>
    GET(new Request(`http://localhost/api/cron/loeschlauf${query}`, { headers: { authorization: `Bearer ${CHECK_SECRET}` } }));

  const dry = await call("?modus=trockenlauf");
  assert.notEqual(dry.status, 401, "Trockenlauf autorisiert");
  for (const row of [delivery, yearOld, fresh]) {
    const after = await find(row.id);
    assert.ok(after, `Trockenlauf + PURGE=1: Datensatz ${row.company} bleibt`);
    assert.equal(after.pdfPath, row.pdfPath, `Trockenlauf + PURGE=1: PDF-Pfad ${row.company} bleibt`);
    assert.equal(after.downloadTokenHash, row.downloadTokenHash, `Trockenlauf + PURGE=1: Token ${row.company} bleibt`);
    assert.ok(existsSync(row.pdfPath), `Trockenlauf + PURGE=1: PDF-Datei ${row.company} bleibt`);
  }
  console.log("ok: Trockenlauf + PURGE=1 löscht nichts (0 von 2 fälligen)");

  const sharp = await call("");
  assert.equal(sharp.status, 200, "scharfer Lauf 200");
  const cleared = await find(delivery.id);
  assert.ok(cleared && cleared.pdfPath === "" && cleared.downloadTokenHash === "", "scharf: PDF und Token nach 30 Tagen leer");
  assert.ok(!existsSync(delivery.pdfPath), "scharf: PDF-Datei nach 30 Tagen weg");
  assert.equal(await find(yearOld.id), undefined, "scharf: Kaufdatensatz nach 12 Monaten weg");
  const kept = await find(fresh.id);
  assert.ok(kept && kept.pdfPath === fresh.pdfPath && kept.downloadTokenHash === fresh.downloadTokenHash, "scharf: frischer Datensatz bleibt");
  assert.ok(existsSync(fresh.pdfPath), "scharf: frische PDF-Datei bleibt");
  console.log("ok: scharfer Lauf löscht die fälligen (PDF/Token 30 Tage, Datensatz 12 Monate)");
  console.log("check-sv-trockenlauf: 2 Prüfungen ok");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
