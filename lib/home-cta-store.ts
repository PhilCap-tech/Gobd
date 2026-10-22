import { getHomeCtaSheetsTab, isSheetsConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import {
  HOME_CTA_COLUMNS,
  homeCtaCells,
  homeCtaRowsFromValues,
  type HomeCtaRow,
} from "@/lib/home-cta-event";

export type HomeCtaSheetClient = {
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

class HomeCtaHeaderError extends Error {
  constructor() {
    super("home-cta-header");
    this.name = "HomeCtaHeaderError";
  }
}

let prepared: { key: string; ready: Promise<void> } | null = null;
let installed: { client: HomeCtaSheetClient; configured: boolean } | null = null;

export function installHomeCtaSheetClientForTest(
  next: { client: HomeCtaSheetClient; configured: boolean } | null,
): void {
  installed = next;
  prepared = null;
}

export function clearHomeCtaSheetCache(): void {
  prepared = null;
}

function logHomeCtaError(error: unknown): void {
  const name = error instanceof Error && error.name ? error.name : "Error";
  console.error("[home-cta]", name);
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (id) return id;
  if (installed) return "home-cta-test";
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
    HOME_CTA_COLUMNS.every((column, index) => cells[index] === column) &&
    cells.slice(HOME_CTA_COLUMNS.length).every((cell) => cell === "")
  );
}

function liveHomeCtaSheetClient(): HomeCtaSheetClient {
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
  } as HomeCtaSheetClient;
}

async function ensureHomeCtaSheet(client: HomeCtaSheetClient, id: string, tab: string): Promise<void> {
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
  if (sheetId == null) throw new Error("home-cta-sheet");
  const header = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A1:C1` });
  const cells = headerCells(header.data?.values);
  if (cells.length === 0 || cells.every((cell) => cell === "")) {
    await client.valuesAppend({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[...HOME_CTA_COLUMNS]] },
    });
    return;
  }
  if (!headerMatches(cells)) throw new HomeCtaHeaderError();
}

function ensureReady(client: HomeCtaSheetClient, id: string, tab: string): Promise<void> {
  const key = `${id}:${tab}`;
  if (prepared?.key === key) return prepared.ready;
  const pending = ensureHomeCtaSheet(client, id, tab).catch((error: unknown) => {
    if (prepared?.ready === pending) prepared = null;
    throw error;
  });
  prepared = { key, ready: pending };
  return pending;
}

async function appendHomeCta(client: HomeCtaSheetClient, row: HomeCtaRow): Promise<void> {
  const id = spreadsheetId();
  const tab = getHomeCtaSheetsTab();
  await ensureReady(client, id, tab);
  await client.valuesAppend({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [homeCtaCells(row)] },
  });
}

function previewSkipsWrites(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/** Skips the live sheet during checks, on preview, and when Sheets is not configured. */
export async function recordHomeCta(row: HomeCtaRow): Promise<void> {
  const configured = installed ? installed.configured : isSheetsConfigured();
  if (!configured) return;
  if (!installed && (automatedRunForbidsLiveWrites() || previewSkipsWrites())) return;
  const client = installed?.client ?? liveHomeCtaSheetClient();
  try {
    await appendHomeCta(client, row);
  } catch (error) {
    logHomeCtaError(error);
  }
}

function sheetValues(values: unknown): string[][] {
  if (!Array.isArray(values)) return [];
  return values.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []));
}

export async function readHomeCtaRows(): Promise<{ configured: boolean; rows: HomeCtaRow[] }> {
  const configured = installed ? installed.configured : isSheetsConfigured();
  if (!configured) return { configured: false, rows: [] };
  // Prebuild checks hold the live sheet credentials. Do not open that sheet
  // unless a test installed a client. Production has no check lifecycle event.
  if (!installed && automatedRunForbidsLiveWrites()) return { configured: true, rows: [] };
  const tab = getHomeCtaSheetsTab();
  const id = spreadsheetId();
  try {
    const client = installed?.client ?? liveHomeCtaSheetClient();
    const meta = await client.get({ spreadsheetId: id });
    if (sheetIdOf(meta.data.sheets, tab) == null) return { configured: true, rows: [] };
    const result = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A:C` });
    const values = sheetValues(result.data?.values);
    if (values.length > 0) {
      const header = values[0].map((cell) => cell.trim());
      const headerOk =
        HOME_CTA_COLUMNS.every((column, index) => header[index] === column) &&
        header.slice(HOME_CTA_COLUMNS.length).every((cell) => cell === "");
      if (!headerOk) throw new HomeCtaHeaderError();
    }
    return { configured: true, rows: homeCtaRowsFromValues(values) };
  } catch (error) {
    logHomeCtaError(error);
    throw error;
  }
}
