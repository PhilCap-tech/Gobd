import { getMagnetStepsSheetsTab, isSheetsConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import { MAGNET_STEP_COLUMNS, magnetStepCells, type MagnetStepRow } from "@/lib/vorlagen/step-event";

export type MagnetStepSheetClient = {
  get(args: { spreadsheetId: string }): Promise<{
    data: { sheets?: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null };
  }>;
  batchUpdate(args: {
    spreadsheetId: string;
    requestBody: { requests: Array<{ addSheet?: { properties: { title: string } } }> };
  }): Promise<{ data: { replies?: Array<{ addSheet?: { properties?: { sheetId?: number | null } | null } | null } | null> | null } }>;
  valuesGet(args: { spreadsheetId: string; range: string }): Promise<{ data: { values?: unknown[][] | null } | null }>;
  valuesAppend(args: {
    spreadsheetId: string;
    range: string;
    valueInputOption: "RAW";
    insertDataOption: "INSERT_ROWS";
    requestBody: { values: string[][] };
  }): Promise<{ data: unknown }>;
};

let installed: { client: MagnetStepSheetClient; configured: boolean } | null = null;
let prepared: { key: string; ready: Promise<void> } | null = null;

export function installMagnetStepSheetClientForTest(
  next: { client: MagnetStepSheetClient; configured: boolean } | null,
): void {
  installed = next;
  prepared = null;
}

export function clearMagnetStepSheetCache(): void {
  prepared = null;
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (id) return id;
  if (installed) return "magnet-steps-test";
  throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
}

function headerCells(values: unknown[][] | null | undefined): string[] {
  const row = values?.[0];
  if (!Array.isArray(row)) return [];
  return row.map((cell) => String(cell ?? "").trim());
}

function sheetIdOf(
  sheets: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null | undefined,
  tab: string,
): number | null {
  const id = sheets?.find((sheet) => sheet?.properties?.title === tab)?.properties?.sheetId;
  return typeof id === "number" ? id : null;
}

async function ensure(client: MagnetStepSheetClient, id: string, tab: string): Promise<void> {
  const meta = await client.get({ spreadsheetId: id });
  let sheetId = sheetIdOf(meta.data.sheets, tab);
  if (sheetId == null) {
    const created = await client.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
    sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
  }
  if (sheetId == null) throw new Error("magnet-step-sheet");
  const header = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A1:H1` });
  const cells = headerCells(header.data?.values);
  if (cells.length === 0 || cells.every((cell) => cell === "")) {
    await client.valuesAppend({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[...MAGNET_STEP_COLUMNS]] },
    });
    return;
  }
  const matches =
    MAGNET_STEP_COLUMNS.every((column, index) => cells[index] === column) &&
    cells.slice(MAGNET_STEP_COLUMNS.length).every((cell) => cell === "");
  if (!matches) throw new Error("magnet-step-header");
}

/** Skips the live sheet during checks and when Sheets is not configured. */
export async function recordMagnetStep(row: MagnetStepRow): Promise<void> {
  const configured = installed ? installed.configured : isSheetsConfigured();
  if (!configured) return;
  if (!installed && automatedRunForbidsLiveWrites()) return;
  const client = installed?.client;
  if (!client) {
    if (automatedRunForbidsLiveWrites()) return;
    try {
      const live = liveClient();
      await append(live, row);
    } catch (error) {
      console.error("[magnet-step]", error instanceof Error ? error.name : "error");
    }
    return;
  }
  try {
    await append(client, row);
  } catch (error) {
    console.error("[magnet-step]", error instanceof Error ? error.name : "error");
  }
}

function liveClient(): MagnetStepSheetClient {
  const sheets = createSheetsClient();
  return {
    get: (args) => sheets.spreadsheets.get(args),
    batchUpdate: (args) => sheets.spreadsheets.batchUpdate(args),
    valuesGet: (args) => sheets.spreadsheets.values.get(args),
    valuesAppend: (args) => sheets.spreadsheets.values.append(args),
  } as MagnetStepSheetClient;
}

async function append(client: MagnetStepSheetClient, row: MagnetStepRow): Promise<void> {
  const id = spreadsheetId();
  const tab = getMagnetStepsSheetsTab();
  const key = `${id}:${tab}`;
  if (!prepared || prepared.key !== key) {
    const pending = ensure(client, id, tab);
    prepared = { key, ready: pending };
  }
  await prepared.ready;
  await client.valuesAppend({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [magnetStepCells(row)] },
  });
}
