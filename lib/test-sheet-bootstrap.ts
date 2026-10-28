/**
 * Test-Tabelle selbst anlegen (Preismodell 2026-11, CoS 28.10.).
 *
 * Philip legt nur eine LEERE Google-Tabelle an und teilt sie mit dem
 * Service-Account. Beim Start legt die App jeden fehlenden Tab mit der
 * Kopfzeile an, die der Code erwartet. Keine Datenzeilen.
 *
 * Harte Sperre: läuft NUR, wenn
 *   GOBD_DATA_ENV=test UND
 *   GOOGLE_SHEETS_SPREADSHEET_ID === GOBD_TEST_SPREADSHEET_ID (beide gesetzt) UND
 *   VERCEL_ENV !== "production" UND
 *   der Start-Schutz (data-env-guard) ok ist.
 * Sonst wird keine einzige Sheets-Anfrage gestellt.
 *
 * Idempotent: vorhandene Tabs und nicht leere Kopfzeilen bleiben unberührt.
 * Es wird nie die Produktions-Tabelle gelesen; die Köpfe kommen aus dem Code.
 */
import { AMPEL_RATE_SHEET_COLUMNS } from "@/lib/ampel-rate-limit";
import { AMPEL_STEP_COLUMNS } from "@/lib/ampel-step-event";
import { AUDIT_SHEET_COLUMNS } from "@/lib/audit-log";
import { dataEnvVerdict } from "@/lib/data-env-guard";
import { ENTITY_SHEET_COLUMNS } from "@/lib/entities";
import {
  getAmpelRateSheetsTab,
  getAmpelStepsSheetsTab,
  getAuditSheetsTab,
  getEntitiesSheetsTab,
  getHomeCtaSheetsTab,
  getLifecycleSheetsTab,
  getMembershipsSheetsTab,
  getPlanFirmsSheetsTab,
  getPlansSheetsTab,
  getProfilesSheetsTab,
  getReadinessSheetsTab,
  getSheetsTab,
} from "@/lib/env";
import { HOME_CTA_COLUMNS } from "@/lib/home-cta-event";
import { LIFECYCLE_SHEET_COLUMNS } from "@/lib/kuendigung-store";
import { MEMBERSHIP_SHEET_COLUMNS } from "@/lib/memberships";
import { PLAN_SHEET_COLUMNS } from "@/lib/plan";
import { PLAN_FIRM_SHEET_COLUMNS } from "@/lib/plan-firms";
import { PROFILE_SHEET_COLUMNS } from "@/lib/profile";
import { READINESS_SHEET_COLUMNS } from "@/lib/readiness";
import { createSheetsClient } from "@/lib/sheets-client";
import { SHEET_COLUMNS } from "@/lib/types";

type Env = Record<string, string | undefined>;

export type TestSheetTab = { title: string; header: readonly string[]; source: string };

/** Alle Tabs, die der Code liest oder schreibt, mit der Kopfzeile aus dem Code. */
export function testSheetTabs(): TestSheetTab[] {
  return [
    { title: getSheetsTab(), header: SHEET_COLUMNS, source: "lib/types.ts SHEET_COLUMNS" },
    { title: getReadinessSheetsTab(), header: READINESS_SHEET_COLUMNS, source: "lib/readiness.ts READINESS_SHEET_COLUMNS" },
    { title: getEntitiesSheetsTab(), header: ENTITY_SHEET_COLUMNS, source: "lib/entities.ts ENTITY_SHEET_COLUMNS" },
    { title: getProfilesSheetsTab(), header: PROFILE_SHEET_COLUMNS, source: "lib/profile.ts PROFILE_SHEET_COLUMNS" },
    { title: getMembershipsSheetsTab(), header: MEMBERSHIP_SHEET_COLUMNS, source: "lib/memberships.ts MEMBERSHIP_SHEET_COLUMNS" },
    { title: getAuditSheetsTab(), header: AUDIT_SHEET_COLUMNS, source: "lib/audit-log.ts AUDIT_SHEET_COLUMNS" },
    { title: getLifecycleSheetsTab(), header: LIFECYCLE_SHEET_COLUMNS, source: "lib/kuendigung-store.ts LIFECYCLE_SHEET_COLUMNS" },
    { title: getPlansSheetsTab(), header: PLAN_SHEET_COLUMNS, source: "lib/plan.ts PLAN_SHEET_COLUMNS" },
    { title: getPlanFirmsSheetsTab(), header: PLAN_FIRM_SHEET_COLUMNS, source: "lib/plan-firms.ts PLAN_FIRM_SHEET_COLUMNS" },
    { title: getAmpelRateSheetsTab(), header: AMPEL_RATE_SHEET_COLUMNS, source: "lib/ampel-rate-limit.ts AMPEL_RATE_SHEET_COLUMNS" },
    { title: getAmpelStepsSheetsTab(), header: AMPEL_STEP_COLUMNS, source: "lib/ampel-step-event.ts AMPEL_STEP_COLUMNS" },
    { title: getHomeCtaSheetsTab(), header: HOME_CTA_COLUMNS, source: "lib/home-cta-event.ts HOME_CTA_COLUMNS" },
  ];
}

export type BootstrapGate = { ok: true; spreadsheetId: string } | { ok: false; reason: string };

/** Nur IDs werden verglichen; kein Wert wird geloggt oder zurückgegeben (außer der Test-ID selbst an den Aufrufer). */
export function testSheetBootstrapGate(env: Env = process.env): BootstrapGate {
  if (env.GOBD_DATA_ENV?.trim().toLowerCase() !== "test") return { ok: false, reason: "GOBD_DATA_ENV ist nicht test" };
  if (env.VERCEL_ENV?.trim() === "production") return { ok: false, reason: "Produktion" };
  const sheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  const testId = env.GOBD_TEST_SPREADSHEET_ID?.trim() ?? "";
  if (!sheetId || !testId) return { ok: false, reason: "Tabellen-ID fehlt" };
  if (sheetId !== testId) return { ok: false, reason: "Tabelle ist nicht die erklärte Test-Tabelle" };
  const verdict = dataEnvVerdict(env);
  if (!verdict.ok) return { ok: false, reason: "Start-Schutz nicht ok" };
  return { ok: true, spreadsheetId: testId };
}

export type BootstrapResult =
  | { ran: false; reason: string }
  | { ran: true; createdTabs: string[]; headerTabs: string[] };

function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function bootstrapTestSheet(env: Env = process.env): Promise<BootstrapResult> {
  const gate = testSheetBootstrapGate(env);
  if (!gate.ok) return { ran: false, reason: gate.reason };
  const id = gate.spreadsheetId;
  const sheets = createSheetsClient();
  const tabs = testSheetTabs();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets.properties.title" });
  const existing = new Set((meta.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? ""));
  const missingTabs = tabs.filter((tab) => !existing.has(tab.title));
  if (missingTabs.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: missingTabs.map((tab) => ({ addSheet: { properties: { title: tab.title } } })) },
    });
  }

  const rows = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: id,
    ranges: tabs.map((tab) => `${quoteTab(tab.title)}!1:1`),
  });
  const ranges = rows.data.valueRanges ?? [];
  const emptyHeader = tabs.filter((_, index) =>
    (ranges[index]?.values?.[0] ?? []).every((cell) => String(cell ?? "").trim() === ""),
  );
  if (emptyHeader.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: id,
      requestBody: {
        valueInputOption: "RAW",
        data: emptyHeader.map((tab) => ({ range: `${quoteTab(tab.title)}!A1`, values: [[...tab.header]] })),
      },
    });
  }
  return { ran: true, createdTabs: missingTabs.map((t) => t.title), headerTabs: emptyHeader.map((t) => t.title) };
}

/** Aus instrumentation.ts: blockiert den Start nicht, wirft nie. */
export async function bootstrapTestSheetOnStart(): Promise<void> {
  if (!testSheetBootstrapGate().ok) return;
  try {
    const result = await bootstrapTestSheet();
    if (result.ran) {
      console.info("[test-sheet-bootstrap]", { created: result.createdTabs.length, headers: result.headerTabs.length });
    }
  } catch (error) {
    console.warn("[test-sheet-bootstrap] fehlgeschlagen", { name: error instanceof Error ? error.name : "unknown" });
  }
}
