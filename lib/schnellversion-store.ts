/**
 * Ereignisse der Schnellversion, gleicher Weg wie die Homepage-Zählung:
 * dasselbe Sheet, eigene Tabelle `schnellversion_49`, keine Personenbezogenen Daten.
 * Checks schreiben nicht. Preview nur mit erklärtem Testziel.
 * Ohne Sheet-Zugang bleibt die Zeile im Prozess und, außerhalb von Produktion, in einer lokalen Datei.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { isSheetsConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import { SV_EVENT_NAMES, type SvEventName, type SvEventRow } from "@/lib/schnellversion-events";
import { svPreviewTestTarget } from "@/lib/schnellversion-data-env";
import { claimSvJson, svBlobEnabled, svCounted99Path } from "@/lib/schnellversion-persist";

export const SV_EVENT_TAB = "schnellversion_49";
export const SV_EVENT_COLUMNS = ["name", "arm", "variante", "branche_vorlage", "value", "step", "ziel", "day"] as const;

const FILE = "/tmp/gobd-sv49-events.jsonl";
const NAME_SET = new Set<string>(SV_EVENT_NAMES);

let memory: SvEventRow[] = [];
let prepared: Promise<void> | null = null;
let failPurchaseSink = false;

/** Nur der Check. Der nächste sv_purchase-Eintrag scheitert, bevor ein Marker entsteht. */
export function failSvPurchaseSinkForTest(next: boolean): void {
  failPurchaseSink = next;
}

type SheetClient = {
  get(args: { spreadsheetId: string }): Promise<{
    data: { sheets?: Array<{ properties?: { title?: string | null } | null } | null> | null };
  }>;
  batchUpdate(args: {
    spreadsheetId: string;
    requestBody: { requests: Array<{ addSheet?: { properties: { title: string } } }> };
  }): Promise<unknown>;
  valuesGet(args: { spreadsheetId: string; range: string }): Promise<{
    data: { values?: unknown[][] | null } | null;
  }>;
  valuesAppend(args: {
    spreadsheetId: string;
    range: string;
    valueInputOption: "RAW";
    insertDataOption: "INSERT_ROWS";
    requestBody: { values: string[][] };
  }): Promise<unknown>;
};

let installed: { client: SheetClient; configured: boolean } | null = null;

export function installSvEventSheetForTest(next: { client: SheetClient; configured: boolean } | null): void {
  installed = next;
  prepared = null;
}

export function resetSvEventsForTest(): void {
  memory = [];
  prepared = null;
}

function previewSkipsWrites(): boolean {
  return process.env.VERCEL_ENV === "preview" && !svPreviewTestTarget();
}

function sheetWritesAllowed(): boolean {
  const configured = installed ? installed.configured : isSheetsConfigured();
  if (!configured) return false;
  if (!installed && (automatedRunForbidsLiveWrites() || previewSkipsWrites())) return false;
  return true;
}

/** Kalendertag Europe/Berlin, YYYY-MM-DD. */
export function svEventDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(now);
}

function stamped(row: SvEventRow, now = new Date()): SvEventRow {
  return row.day && /^\d{4}-\d{2}-\d{2}$/.test(row.day) ? row : { ...row, day: svEventDay(now) };
}

function cells(row: SvEventRow): string[] {
  return [row.name, row.arm, row.variante, row.branche_vorlage, String(row.value), String(row.step), row.ziel, row.day ?? ""];
}

function spreadsheetId(): string {
  const target = svPreviewTestTarget();
  if (target) return target.spreadsheetId;
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (id) return id;
  if (installed) return "schnellversion-test";
  throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
}

async function ensureSheet(client: SheetClient): Promise<void> {
  const id = spreadsheetId();
  const meta = await client.get({ spreadsheetId: id });
  const exists = meta.data.sheets?.some((sheet) => sheet?.properties?.title === SV_EVENT_TAB);
  if (!exists) {
    try {
      await client.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: SV_EVENT_TAB } } }] },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/already exists/i.test(message)) throw error;
    }
  }
  const header = await client.valuesGet({ spreadsheetId: id, range: `${SV_EVENT_TAB}!A1:H1` });
  const first = header.data?.values?.[0];
  if (!first || first.every((cell) => String(cell ?? "").trim() === "")) {
    await client.valuesAppend({
      spreadsheetId: id,
      range: `${SV_EVENT_TAB}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[...SV_EVENT_COLUMNS]] },
    });
  }
}

function rowFromCells(cellsIn: string[]): SvEventRow | null {
  const name = cellsIn[0]?.trim() ?? "";
  if (!NAME_SET.has(name) || name === SV_EVENT_COLUMNS[0]) return null;
  const arm = cellsIn[1]?.trim() ?? "";
  if (arm !== "control" && arm !== "test" && arm !== "") return null;
  const value = Number(cellsIn[4] ?? "0");
  const step = Number(cellsIn[5] ?? "0");
  const ziel = cellsIn[6]?.trim() ?? "";
  return {
    name: name as SvEventName,
    arm: arm === "control" || arm === "test" ? arm : "",
    variante: "b",
    branche_vorlage: (cellsIn[3]?.trim() ?? "") as SvEventRow["branche_vorlage"],
    value: Number.isFinite(value) ? value : 0,
    step: Number.isFinite(step) ? step : 0,
    ziel: ziel === "einmalig" || ziel === "dauerhaft" ? ziel : "",
    day: /^\d{4}-\d{2}-\d{2}$/.test(cellsIn[7]?.trim() ?? "") ? cellsIn[7].trim() : undefined,
  };
}

async function appendSheet(row: SvEventRow): Promise<void> {
  const client = installed?.client ?? (createSheetsClient() as unknown as SheetClient);
  if (!prepared) prepared = ensureSheet(client);
  await prepared;
  await client.valuesAppend({
    spreadsheetId: spreadsheetId(),
    range: `${SV_EVENT_TAB}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [cells(row)] },
  });
}

const counted99 = new Set<string>();
const countedQueues = new Map<string, Promise<unknown>>();

function queueCounted<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = countedQueues.get(key) ?? Promise.resolve();
  const current = previous.then(run, run);
  countedQueues.set(
    key,
    current.then(
      () => undefined,
      () => undefined,
    ),
  );
  return current;
}

/** Ein 99-€-Kauf je Stripe-Session, auch bei wiederholter oder paralleler Zustellung. */
export function rememberPurchase99Once(input: {
  sessionId: string;
  eventId: string;
  arm: "control" | "test";
}): Promise<boolean> {
  const key = input.sessionId.trim() || input.eventId.trim();
  if (!key) return Promise.resolve(false);
  return queueCounted(key, async () => {
    if (counted99.has(key)) return false;
    if (svBlobEnabled()) {
      const claim = await claimSvJson(svCounted99Path(key), { sessionId: key, eventId: input.eventId });
      if (claim === "exists") {
        counted99.add(key);
        return false;
      }
    }
    counted99.add(key);
    rememberSvEvent({
      name: "purchase_99",
      arm: input.arm,
      variante: "b",
      branche_vorlage: "",
      value: 99,
      step: 0,
      ziel: "",
    });
    return true;
  });
}

/** Schreibt sv_purchase dauerhaft. Wirft, bevor ein Zähl-Marker gesetzt werden darf. */
export async function persistSvPurchaseEvent(row: SvEventRow, now = new Date()): Promise<void> {
  if (failPurchaseSink) throw new Error("Event nicht gespeichert");
  const stampedRow = stamped(row, now);
  const production = (process.env.VERCEL_ENV ?? "").trim() === "production";
  const writeFile = !production && !automatedRunForbidsLiveWrites();
  if (writeFile) appendFileSync(FILE, `${JSON.stringify(stampedRow)}\n`, "utf8");
  if (sheetWritesAllowed()) await appendSheet(stampedRow);
  memory.push(stampedRow);
}

export function rememberSvEvent(row: SvEventRow, now = new Date()): void {
  const stampedRow = stamped(row, now);
  memory.push(stampedRow);
  const production = (process.env.VERCEL_ENV ?? "").trim() === "production";
  if (!production && !automatedRunForbidsLiveWrites()) {
    try {
      appendFileSync(FILE, `${JSON.stringify(stampedRow)}\n`, "utf8");
    } catch {
      /* lokale Datei ist nur eine Hilfe */
    }
  }
  if (!sheetWritesAllowed()) return;
  void appendSheet(stampedRow).catch((error: unknown) => {
    const name = error instanceof Error && error.name ? error.name : "Error";
    console.error("[schnellversion]", name);
  });
}

function fileRows(): SvEventRow[] {
  try {
    const text = readFileSync(FILE, "utf8");
    const rows: SvEventRow[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as SvEventRow;
        if (parsed && typeof parsed.name === "string" && NAME_SET.has(parsed.name)) rows.push(parsed);
      } catch {
        /* kaputte Zeile */
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export async function readSvEvents(): Promise<SvEventRow[]> {
  if (sheetWritesAllowed()) {
    try {
      const client = installed?.client ?? (createSheetsClient() as unknown as SheetClient);
      const result = await client.valuesGet({
        spreadsheetId: spreadsheetId(),
        range: `${SV_EVENT_TAB}!A:H`,
      });
      const values = result.data?.values ?? [];
      const rows = values.map((row) => rowFromCells(row.map((cell) => String(cell ?? "")))).filter((row): row is SvEventRow => Boolean(row));
      if (rows.length) return rows;
    } catch (error) {
      const name = error instanceof Error && error.name ? error.name : "Error";
      console.error("[schnellversion]", name);
    }
  }
  const fromFile = automatedRunForbidsLiveWrites() || (process.env.VERCEL_ENV ?? "").trim() === "production" ? [] : fileRows();
  return fromFile.length ? fromFile : memory.slice();
}
