import { getMeasureSheetsTab, isSheetsConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import {
  MEASURE_COLUMNS,
  measureCells,
  measureRowsFromValues,
  type MeasureRow,
} from "@/lib/measure-event";
import { isProductionMeasureEnv, measureVercelEnv } from "@/lib/measure-test";

export type MeasureSheetClient = {
  get(args: { spreadsheetId: string }): Promise<{
    data: {
      sheets?: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null;
    };
  }>;
  batchUpdate(args: {
    spreadsheetId: string;
    requestBody: { requests: Array<{ addSheet?: { properties: { title: string } } }> };
  }): Promise<{
    data: {
      replies?: Array<{ addSheet?: { properties?: { sheetId?: number | null } | null } | null } | null> | null;
    };
  }>;
  valuesGet(args: { spreadsheetId: string; range: string }): Promise<{
    data: { values?: unknown[][] | null } | null;
  }>;
  valuesAppend(args: {
    spreadsheetId: string;
    range: string;
    valueInputOption: "RAW";
    insertDataOption: "INSERT_ROWS";
    requestBody: { values: string[][] };
  }): Promise<{ data: unknown }>;
};

class MeasureHeaderError extends Error {
  constructor() {
    super("messluecken-header");
    this.name = "MeasureHeaderError";
  }
}

let prepared: { key: string; ready: Promise<void> } | null = null;
let installed: { client: MeasureSheetClient; configured: boolean } | null = null;

export function installMeasureSheetClientForTest(
  next: { client: MeasureSheetClient; configured: boolean } | null,
): void {
  installed = next;
  prepared = null;
}

export function clearMeasureSheetCache(): void {
  prepared = null;
}

function logMeasureError(error: unknown): void {
  const name = error instanceof Error && error.name ? error.name : "Error";
  console.error("[messluecken]", name);
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (id) return id;
  if (installed) return "messluecken-test";
  throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function sheetAlreadyExists(error: unknown): boolean {
  return /already exists/i.test(errorText(error));
}

function sheetIdOf(
  sheets: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null | undefined,
  tab: string,
): number | null {
  const id = sheets?.find((sheet) => sheet?.properties?.title === tab)?.properties?.sheetId;
  return typeof id === "number" ? id : null;
}

function headerCells(values: unknown[][] | null | undefined): string[] {
  const row = values?.[0];
  if (!Array.isArray(row)) return [];
  return row.map((cell) => String(cell ?? "").trim());
}

function headerMatches(cells: string[]): boolean {
  if (cells.length === 0 || cells.every((cell) => cell === "")) return false;
  return (
    MEASURE_COLUMNS.every((column, index) => cells[index] === column) &&
    cells.slice(MEASURE_COLUMNS.length).every((cell) => cell === "")
  );
}

function liveMeasureSheetClient(): MeasureSheetClient {
  const sheets = createSheetsClient();
  return {
    get: (args) => sheets.spreadsheets.get(args),
    batchUpdate: (args) => sheets.spreadsheets.batchUpdate(args),
    valuesGet: (args) =>
      sheets.spreadsheets.values.get(args, {
        headers: {
          "Cache-Control": "no-cache, no-store",
          Pragma: "no-cache",
        },
      }),
    valuesAppend: (args) => sheets.spreadsheets.values.append(args),
  } as MeasureSheetClient;
}

async function ensureMeasureSheet(client: MeasureSheetClient, id: string, tab: string): Promise<void> {
  const meta = await client.get({ spreadsheetId: id });
  let sheetId = sheetIdOf(meta.data.sheets, tab);
  if (sheetId == null) {
    try {
      const created = await client.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      });
      sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    } catch (error) {
      if (!sheetAlreadyExists(error)) throw error;
    }
  }
  if (sheetId == null) {
    const again = await client.get({ spreadsheetId: id });
    sheetId = sheetIdOf(again.data.sheets, tab);
  }
  if (sheetId == null) throw new Error("messluecken-sheet");
  const header = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A1:E1` });
  const cells = headerCells(header.data?.values);
  if (cells.length === 0 || cells.every((cell) => cell === "")) {
    await client.valuesAppend({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[...MEASURE_COLUMNS]] },
    });
    return;
  }
  if (!headerMatches(cells)) throw new MeasureHeaderError();
}

function ensureReady(client: MeasureSheetClient, id: string, tab: string): Promise<void> {
  const key = `${id}:${tab}`;
  if (prepared?.key === key) return prepared.ready;
  const pending = ensureMeasureSheet(client, id, tab).catch((error: unknown) => {
    if (prepared?.ready === pending) prepared = null;
    throw error;
  });
  prepared = { key, ready: pending };
  return pending;
}

/**
 * Live sheet writes happen only in production. Preview, development and a
 * missing VERCEL_ENV write nothing, so they cannot change standard numbers.
 * An installed test client may still append; the row is then forced to `test`
 * unless this process is production.
 */
export function liveMeasureWriteAllowed(input: {
  installed: boolean;
  automated: boolean;
  vercelEnv: string | undefined;
  configured: boolean;
}): boolean {
  if (!input.configured) return false;
  if (input.installed) return true;
  if (input.automated) return false;
  return input.vercelEnv === "production";
}

async function appendMeasure(client: MeasureSheetClient, row: MeasureRow): Promise<void> {
  const id = spreadsheetId();
  const tab = getMeasureSheetsTab();
  await ensureReady(client, id, tab);
  await client.valuesAppend({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [measureCells(row)] },
  });
}

/** Skips the live sheet during checks and outside production. Non-production rows that a test client still accepts are stored as `test`. */
export async function recordMeasureRow(row: MeasureRow): Promise<void> {
  const configured = installed ? installed.configured : isSheetsConfigured();
  const production = isProductionMeasureEnv();
  if (
    !liveMeasureWriteAllowed({
      installed: installed != null,
      automated: automatedRunForbidsLiveWrites(),
      vercelEnv: measureVercelEnv(),
      configured,
    })
  ) {
    return;
  }
  const stored = production ? row : { ...row, cohort: "test" as const };
  const client = installed?.client ?? liveMeasureSheetClient();
  try {
    await appendMeasure(client, stored);
  } catch (error) {
    logMeasureError(error);
  }
}

function sheetValues(values: unknown): string[][] {
  if (!Array.isArray(values)) return [];
  return values.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []));
}

export async function readMeasureRows(): Promise<{ configured: boolean; rows: MeasureRow[] }> {
  const configured = installed ? installed.configured : isSheetsConfigured();
  if (!configured) return { configured: false, rows: [] };
  if (!installed && automatedRunForbidsLiveWrites()) return { configured: true, rows: [] };
  const tab = getMeasureSheetsTab();
  const id = spreadsheetId();
  try {
    const client = installed?.client ?? liveMeasureSheetClient();
    const meta = await client.get({ spreadsheetId: id });
    if (sheetIdOf(meta.data.sheets, tab) == null) return { configured: true, rows: [] };
    const result = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A:E` });
    const values = sheetValues(result.data?.values);
    if (values.length > 0) {
      const header = values[0].map((cell) => cell.trim());
      const headerOk =
        MEASURE_COLUMNS.every((column, index) => header[index] === column) &&
        header.slice(MEASURE_COLUMNS.length).every((cell) => cell === "");
      if (!headerOk) throw new MeasureHeaderError();
    }
    return { configured: true, rows: measureRowsFromValues(values) };
  } catch (error) {
    logMeasureError(error);
    throw error;
  }
}
