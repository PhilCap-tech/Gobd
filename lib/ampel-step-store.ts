import { getAmpelStepsSheetsTab, isSheetsConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import {
  AMPEL_STEP_COLUMNS,
  ampelStepCells,
  ampelStepRowsFromValues,
  type AmpelStepRow,
} from "@/lib/ampel-step-event";

export type AmpelStepSheetClient = {
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

class AmpelStepHeaderError extends Error {
  constructor() {
    super("ampel-step-header");
    this.name = "AmpelStepHeaderError";
  }
}

let prepared: { key: string; ready: Promise<void> } | null = null;
let installed: { client: AmpelStepSheetClient; configured: boolean } | null = null;

export function installAmpelStepSheetClientForTest(
  next: { client: AmpelStepSheetClient; configured: boolean } | null,
): void {
  installed = next;
  prepared = null;
}

export function clearAmpelStepSheetCache(): void {
  prepared = null;
}

function logAmpelStepError(error: unknown): void {
  const name = error instanceof Error && error.name ? error.name : "Error";
  console.error("[ampel-step]", name);
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (id) return id;
  if (installed) return "ampel-steps-test";
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
    AMPEL_STEP_COLUMNS.every((column, index) => cells[index] === column) &&
    cells.slice(AMPEL_STEP_COLUMNS.length).every((cell) => cell === "")
  );
}

function liveAmpelStepSheetClient(): AmpelStepSheetClient {
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
  } as AmpelStepSheetClient;
}

async function ensureAmpelStepSheet(client: AmpelStepSheetClient, id: string, tab: string): Promise<void> {
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
  if (sheetId == null) throw new Error("ampel-step-sheet");
  const header = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A1:H1` });
  const cells = headerCells(header.data?.values);
  if (cells.length === 0 || cells.every((cell) => cell === "")) {
    await client.valuesAppend({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[...AMPEL_STEP_COLUMNS]] },
    });
    return;
  }
  if (!headerMatches(cells)) throw new AmpelStepHeaderError();
}

function ensureReady(client: AmpelStepSheetClient, id: string, tab: string): Promise<void> {
  const key = `${id}:${tab}`;
  if (prepared?.key === key) return prepared.ready;
  const pending = ensureAmpelStepSheet(client, id, tab).catch((error: unknown) => {
    if (prepared?.ready === pending) prepared = null;
    throw error;
  });
  prepared = { key, ready: pending };
  return pending;
}

async function appendAmpelStep(client: AmpelStepSheetClient, row: AmpelStepRow): Promise<void> {
  const id = spreadsheetId();
  const tab = getAmpelStepsSheetsTab();
  await ensureReady(client, id, tab);
  const cells = ampelStepCells(row);
  await client.valuesAppend({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [cells] },
  });
}

/** Skips the live sheet during checks and when Sheets is not configured. */
export async function recordAmpelStep(row: AmpelStepRow): Promise<void> {
  const configured = installed ? installed.configured : isSheetsConfigured();
  if (!configured) return;
  if (!installed && automatedRunForbidsLiveWrites()) return;
  const client = installed?.client ?? liveAmpelStepSheetClient();
  try {
    await appendAmpelStep(client, row);
  } catch (error) {
    logAmpelStepError(error);
  }
}

function sheetValues(values: unknown): string[][] {
  if (!Array.isArray(values)) return [];
  return values.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []));
}

export async function readAmpelStepRows(): Promise<{ configured: boolean; rows: AmpelStepRow[] }> {
  if (!isSheetsConfigured()) return { configured: false, rows: [] };
  const tab = getAmpelStepsSheetsTab();
  const id = spreadsheetId();
  const client = liveAmpelStepSheetClient();
  try {
    const meta = await client.get({ spreadsheetId: id });
    if (sheetIdOf(meta.data.sheets, tab) == null) return { configured: true, rows: [] };
    const result = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A:H` });
    const values = sheetValues(result.data?.values);
    if (values.length > 0) {
      const header = values[0].map((cell) => cell.trim());
      const headerOk =
        AMPEL_STEP_COLUMNS.every((column, index) => header[index] === column) &&
        header.slice(AMPEL_STEP_COLUMNS.length).every((cell) => cell === "");
      if (!headerOk) throw new AmpelStepHeaderError();
    }
    return { configured: true, rows: ampelStepRowsFromValues(values) };
  } catch (error) {
    logAmpelStepError(error);
    throw error;
  }
}
