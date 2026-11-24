/**
 * sv_visit-Zählzeilen: 24 Monate nach dem Zähltag (Spalte H), keine Kohorte.
 * Andere SV-Ereignisse bleiben. Trockenlauf löscht auch bei PURGE=1 nichts.
 * Reine Funktionsprüfung mit gemocktem Store: kein Netz, kein Blob.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SvPurchase } from "../lib/schnellversion-record";

for (const name of [
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_STORE_ID",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "VERCEL_ENV",
  "RETENTION_DRY_RUN_ENABLED",
  "RETENTION_EXECUTE_ENABLED",
  "MEASURE_RETENTION_EXECUTE_ENABLED",
  "MEASURE_RETENTION_DRY_RUN_ENABLED",
]) {
  delete process.env[name];
}
process.env.TMPDIR = mkdtempSync(path.join(tmpdir(), "gobd-sv-visit-ret-"));

const TODAY = "2026-11-24";
const HEADER = ["name", "arm", "variante", "branche_vorlage", "value", "step", "ziel", "day"];

function row(name: string, day: string, arm = ""): string[] {
  return [name, arm, "b", "", "0", "0", "", day];
}

function freshPurchase(now: Date): SvPurchase {
  return {
    id: "sv_fresh",
    email: "fresh@example.com",
    company: "Frisch GmbH",
    purchasedAt: now.toISOString(),
    documentId: "doc_fresh",
    pdfPath: "/tmp/fresh.pdf",
    creditUsedAt: "",
    consentAt: now.toISOString(),
    sessionId: "cs_test_fresh",
    creditReservedAt: "",
    creditReservationId: "",
    answersJson: "{}",
    downloadTokenHash: "ab".repeat(32),
  };
}

async function main(): Promise<void> {
  const { getSchnellversionEventSheetsTab } = await import("@/lib/env");
  const { countRowsToDelete, MEASURE_COUNT_TABS, planSvVisitPurge, shiftMonths } = await import("@/lib/measure-retention");
  const { runScheduledSvPurge, runSvPurge } = await import("@/lib/schnellversion-purge");
  const { SV_EVENT_TAB } = await import("@/lib/schnellversion-store");

  assert.equal(shiftMonths(TODAY, -24), "2024-11-24");
  assert.equal(SV_EVENT_TAB, "schnellversion_49");
  assert.equal(getSchnellversionEventSheetsTab(), SV_EVENT_TAB);
  assert.equal(MEASURE_COUNT_TABS.schnellversion_49.dateIndex, 7);
  assert.equal(MEASURE_COUNT_TABS.schnellversion_49.eventName, "sv_visit");
  assert.equal("cohortIndex" in MEASURE_COUNT_TABS.schnellversion_49, false, "SV-Tabelle ohne Kohortenregel");
  assert.equal(MEASURE_COUNT_TABS.home_cta.dateIndex, 0);
  assert.equal(MEASURE_COUNT_TABS.messluecken.cohortIndex, 4);

  const boundary = countRowsToDelete({
    tab: "schnellversion_49",
    today: TODAY,
    values: [HEADER, row("sv_visit", "2024-11-24"), row("sv_visit", "2024-11-23")],
  });
  assert.deepEqual(boundary.rows, [3], "genau 24 Monate: bleibt; ein Tag älter: fällt");
  assert.equal(boundary.testRows, 0);
  assert.equal(boundary.unparseable, 0);

  const missing = countRowsToDelete({
    tab: "schnellversion_49",
    today: TODAY,
    values: [HEADER, row("sv_visit", ""), row("sv_visit", "kein-datum"), row("sv_visit", "2024-11-23")],
  });
  assert.deepEqual(missing.rows, [4], "nur die Zeile mit lesbarem, fälligem Tag fällt");
  assert.equal(missing.unparseable, 2, "fehlendes oder unlesbares Datum wird nur gezählt");

  const armTest = countRowsToDelete({
    tab: "schnellversion_49",
    today: TODAY,
    values: [
      HEADER,
      row("sv_visit", "2026-11-16", "test"),
      row("sv_visit", "2026-11-16", "control"),
      row("sv_visit", "2024-11-23", "test"),
    ],
  });
  assert.deepEqual(armTest.rows, [4], "arm=test nach 8 Tagen bleibt; nur die 24-Monats-Grenze zählt");
  assert.equal(armTest.testRows, 0, "arm=test ist keine 7-Tage-Testkohorte");

  const others = countRowsToDelete({
    tab: "schnellversion_49",
    today: TODAY,
    values: [
      HEADER,
      row("sv_home_view", "2020-01-01", "test"),
      row("sv_click", "2020-01-01", "control"),
      row("sv_purchase", "2020-01-01", "test"),
      row("sv_question_step", "2020-01-01", "control"),
      row("purchase_99", "2020-01-01", "test"),
      row("sv_visit", "2024-11-23"),
    ],
  });
  assert.deepEqual(others.rows, [7], "andere SV-Ereignisse werden nie gelöscht");
  assert.equal(others.testRows, 0);

  const columnH = countRowsToDelete({
    tab: "schnellversion_49",
    today: TODAY,
    values: [
      HEADER,
      ["sv_visit", "test", "b", "", "0", "0", "", "2024-11-23"],
      ["sv_visit", "2020-01-01", "b", "", "0", "0", "", "2026-11-20"],
      ["2020-01-01", "", "b", "", "0", "0", "", "2026-11-20"],
    ],
  });
  assert.deepEqual(columnH.rows, [2], "Datum kommt aus Spalte H, nicht aus A");

  const homeUnchanged = countRowsToDelete({
    tab: "home_cta",
    today: TODAY,
    values: [
      ["date", "cta", "device"],
      ["2024-11-23", "hero_muster", "desktop"],
      ["2024-11-24", "home_view", "mobile"],
      ["2026-11-01", "home_view", "mobile"],
    ],
  });
  assert.deepEqual(homeUnchanged.rows, [2], "home_cta bleibt bei Spalte A und 24 Monaten");
  assert.equal(homeUnchanged.unparseable, 0);

  const messUnchanged = countRowsToDelete({
    tab: "messluecken",
    today: TODAY,
    values: [
      ["date", "metric", "n", "channel", "cohort"],
      ["2026-11-16", "intake_start", "", "direct", "test"],
      ["2024-11-23", "intake_start", "", "direct", "standard"],
      ["2026-11-20", "intake_start", "", "direct", "standard"],
    ],
  });
  assert.deepEqual(messUnchanged.rows, [2, 3], "Messlücken-Regeln (7 Tage test, 24 Monate standard) unverändert");
  assert.equal(messUnchanged.testRows, 1);

  const plan = planSvVisitPurge(
    [
      HEADER,
      row("sv_visit", "2023-08-02"),
      row("sv_visit", "nicht-datum"),
      row("sv_home_view", "2020-01-01", "test"),
      row("sv_visit", "2024-11-23"),
    ],
    TODAY,
  );
  assert.deepEqual(plan.rows, [2, 5]);
  assert.equal(plan.unparseable, 1);
  assert.equal(plan.dayMin, "2023-08-02");
  assert.equal(plan.dayMax, "2024-11-23");

  const now = new Date("2026-11-24T12:00:00.000Z");
  const visitValues = [
    HEADER,
    row("sv_visit", "2023-08-02"),
    row("sv_visit", "kein-tag"),
    row("sv_home_view", "2020-01-01", "test"),
    row("sv_visit", "2024-11-24"),
    row("sv_visit", "2024-11-23", "test"),
  ];

  const removedDry: number[][] = [];
  const dry = await runScheduledSvPurge(now, { SCHNELLVERSION_49_PURGE: "1" }, async () => [], {
    dryRun: true,
    visits: {
      list: async () => visitValues,
      remove: async (rows) => {
        removedDry.push(rows);
      },
    },
  });
  assert.ok(dry);
  assert.equal(dry.dryRun, true);
  assert.equal(dry.visitsDue, 2);
  assert.equal(dry.visitsDeleted, 0, "Trockenlauf + PURGE=1 löscht 0 Besuchszeilen");
  assert.equal(dry.visitsUnparseable, 1);
  assert.equal(dry.visitDayMin, "2023-08-02");
  assert.equal(dry.visitDayMax, "2024-11-23");
  assert.equal(dry.deleted, 0);
  assert.equal(dry.recordsDeleted, 0);
  assert.deepEqual(removedDry, []);
  const dryLog = JSON.stringify(dry);
  assert.equal(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(dryLog), false, "Log ohne E-Mail");
  assert.match(dryLog, /"visitsDeleted":0/);
  console.log("ok: Trockenlauf + PURGE=1 löscht nichts; Beispiel-Log [loeschlauf] Schnellversion", dryLog);

  const removedSharp: number[][] = [];
  const sharp = await runScheduledSvPurge(now, { SCHNELLVERSION_49_PURGE: "1" }, async () => [], {
    visits: {
      list: async () => visitValues,
      remove: async (rows) => {
        removedSharp.push(rows);
      },
    },
  });
  assert.ok(sharp);
  assert.equal(sharp.dryRun, false);
  assert.equal(sharp.visitsDue, 2);
  assert.equal(sharp.visitsDeleted, 2);
  assert.deepEqual(removedSharp, [[6, 2]], "scharfer Lauf löscht nur fällige sv_visit-Zeilen, von hinten");

  const purchaseOnly = await runSvPurge([freshPurchase(now)], now, { SCHNELLVERSION_49_PURGE: "1" });
  assert.equal(purchaseOnly.dryRun, false);
  assert.equal(purchaseOnly.due, 0);
  assert.equal(purchaseOnly.deleted, 0);
  assert.equal(purchaseOnly.recordsDue, 0);
  assert.equal(purchaseOnly.recordsDeleted, 0, "frischer Kaufdatensatz bleibt; 30-Tage-/12-Monats-Frist unverändert");

  const dse = readFileSync("content/legal/datenschutz-v3.md", "utf8").split("\n");
  assert.ok(
    dse[64]?.startsWith(
      "Statistik zur Schnellversion. Bei jedem Aufruf unserer Startseite zählen wir, auch ohne Ihre Einwilligung, wie oft die Startseite aufgerufen wird.",
    ),
    "DSE Z. 65 beginnt mit dem freigegebenen NEU-Text",
  );
  assert.ok(
    dse[64]?.includes(
      "Haben Sie im Cookie-Banner „Marketing erlauben“ gewählt, zählen wir zusätzlich die Schritte in der Schnellversion",
    ),
    "DSE Z. 65 behält den bisherigen Rest der Zeile",
  );
  assert.ok(
    dse[185]?.includes(
      "Die Zählwerte löschen wir 24 Monate nach dem jeweiligen Zähltag.<!-- if:schnellversion --> Das gilt auch für die Zählung der Startseitenaufrufe zur Schnellversion (Abschnitt 6).<!-- endif --> Daten aus internen Tests",
    ),
    "DSE § 21 Z. 186 trägt den engen Zusatzsatz hinter der Flag-Marke",
  );

  console.log("ok: Grenze 24 Monate, fehlendes Datum, Spalte H, arm=test 8 Tage, andere Ereignisse, Kauf-Fristen");
  console.log("check-sv-visit-retention: ok");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
