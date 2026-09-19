import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { google } from "googleapis";
import { getSheetsTab, isSheetsConfigured } from "@/lib/env";
import {
  SHEET_COLUMNS,
  sheetRowValues,
  type SheetRow,
} from "@/lib/types";

const FILE_NAME = "intakes.json";

export type StoreResult = {
  backend: "sheets" | "file";
  row: SheetRow;
  filePath?: string;
};

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

function isFsUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "EROFS" || code === "EACCES" || code === "EPERM";
}

/**
 * Locally: `process.cwd()/.data`. On Vercel the app filesystem is read-only
 * except `/tmp`, so we write under `os.tmpdir()` when `VERCEL=1`.
 */
export function getFileFallbackDir(): string {
  if (isVercelRuntime()) {
    return path.join(tmpdir(), "gobd-data");
  }
  return path.join(process.cwd(), ".data");
}

export function getFileFallbackPath(): string {
  return path.join(getFileFallbackDir(), FILE_NAME);
}

function tmpFallbackPath(): string {
  return path.join(tmpdir(), "gobd-data", FILE_NAME);
}

function sheetsAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  if (!email || !key) {
    throw new Error("Google-Service-Account unvollständig");
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function appendSheetRow(row: SheetRow): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
  }

  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const tab = getSheetsTab();
  const range = `${tab}!A1`;

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:V1`,
  });

  const header = existing.data.values?.[0] ?? [];
  if (header.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [SHEET_COLUMNS as unknown as string[]] },
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [sheetRowValues(row)] },
  });
}

async function readRows(file: string): Promise<SheetRow[]> {
  try {
    const raw = await readFile(file, "utf8");
    const rows = JSON.parse(raw) as SheetRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function writeRows(dir: string, file: string, rows: SheetRow[]): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

async function appendFileRow(row: SheetRow): Promise<string> {
  const primaryDir = getFileFallbackDir();
  const primaryFile = path.join(primaryDir, FILE_NAME);

  try {
    const rows = await readRows(primaryFile);
    rows.push(row);
    await writeRows(primaryDir, primaryFile, rows);
    return primaryFile;
  } catch (error) {
    const tmpFile = tmpFallbackPath();
    if (isFsUnavailable(error) && primaryFile !== tmpFile) {
      console.warn(
        "[store] Datei-Fallback nicht beschreibbar — weiche auf tmpdir aus",
        error,
      );
      const tmpDir = path.dirname(tmpFile);
      const rows = await readRows(tmpFile);
      rows.push(row);
      await writeRows(tmpDir, tmpFile, rows);
      return tmpFile;
    }
    throw error;
  }
}

export async function appendRecord(row: SheetRow): Promise<StoreResult> {
  if (isSheetsConfigured()) {
    try {
      await appendSheetRow(row);
      return { backend: "sheets", row };
    } catch (error) {
      console.error(
        "[store] Google Sheets append fehlgeschlagen — falle auf Datei zurück",
        error,
      );
    }
  } else {
    console.warn(
      "[store] Google Sheets nicht konfiguriert — schreibe nach",
      getFileFallbackPath(),
    );
  }

  const filePath = await appendFileRow(row);
  return { backend: "file", row, filePath };
}
