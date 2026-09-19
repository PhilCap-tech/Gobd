import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { google } from "googleapis";
import { getSheetsTab, isSheetsConfigured } from "@/lib/env";
import { parseDocumentVersion, rowsInFamily } from "@/lib/documents";
import {
  SHEET_COLUMNS,
  coerceSheetRow,
  emailsEqual,
  emptySheetRow,
  parseSheetRow,
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

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
  }
  return id;
}

async function ensureSheetHeader(): Promise<string[]> {
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const tab = getSheetsTab();
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${tab}!A1:AZ1`,
  });
  const header = (existing.data.values?.[0] ?? []).map((cell) => String(cell));

  if (header.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [SHEET_COLUMNS as unknown as string[]] },
    });
    return [...SHEET_COLUMNS];
  }

  const missing = SHEET_COLUMNS.filter((col) => !header.includes(col));
  if (missing.length === 0) {
    return header;
  }

  const next = [...header, ...missing];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [next] },
  });
  return next;
}

async function appendSheetRow(row: SheetRow): Promise<void> {
  const header = await ensureSheetHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${getSheetsTab()}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [sheetRowValues(row, header)] },
  });
}

async function readSheetRows(): Promise<SheetRow[]> {
  const header = await ensureSheetHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${getSheetsTab()}!A2:AZ`,
  });
  const values = result.data.values ?? [];
  return values
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => parseSheetRow(header, row.map((cell) => String(cell ?? ""))));
}

async function readRows(file: string): Promise<SheetRow[]> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => coerceSheetRow(item))
      .filter((row): row is SheetRow => Boolean(row));
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

async function readAllFileRows(): Promise<SheetRow[]> {
  const primary = await readRows(getFileFallbackPath());
  const tmpFile = tmpFallbackPath();
  if (tmpFile === getFileFallbackPath()) {
    return primary;
  }
  const tmpRows = await readRows(tmpFile);
  if (tmpRows.length === 0) return primary;
  if (primary.length === 0) return tmpRows;
  const seen = new Set(
    primary.map(
      (row) => row.documentId || `${row.stripeSessionId}:${row.timestamp}`,
    ),
  );
  const merged = [...primary];
  for (const row of tmpRows) {
    const key = row.documentId || `${row.stripeSessionId}:${row.timestamp}`;
    if (!seen.has(key)) {
      merged.push(row);
      seen.add(key);
    }
  }
  return merged;
}

export async function appendRecord(row: SheetRow): Promise<StoreResult> {
  const complete = { ...emptySheetRow(), ...row };
  if (isSheetsConfigured()) {
    try {
      await appendSheetRow(complete);
      return { backend: "sheets", row: complete };
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

  const filePath = await appendFileRow(complete);
  return { backend: "file", row: complete, filePath };
}

async function loadRows(): Promise<{ backend: "sheets" | "file"; rows: SheetRow[] }> {
  if (isSheetsConfigured()) {
    try {
      return { backend: "sheets", rows: await readSheetRows() };
    } catch (error) {
      console.error(
        "[store] Google Sheets lesen fehlgeschlagen — falle auf Datei zurück",
        error,
      );
    }
  }
  return { backend: "file", rows: await readAllFileRows() };
}

export async function findDocumentById(documentId: string): Promise<SheetRow | null> {
  if (!documentId) return null;
  const { rows } = await loadRows();
  const matches = rows.filter((row) => row.documentId === documentId);
  return matches.at(-1) ?? null;
}

export async function listDocumentsByEmail(email: string): Promise<SheetRow[]> {
  if (!email.trim()) return [];
  const { rows } = await loadRows();
  return rows
    .filter((row) => row.documentId && emailsEqual(row.email, email))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function listDocumentFamily(documentId: string): Promise<SheetRow[]> {
  if (!documentId) return [];
  const { rows } = await loadRows();
  return rowsInFamily(rows, documentId);
}

/** Latest PDF row for a Stripe (or stub) checkout session. */
export async function findLatestDocumentByStripeSessionId(
  sessionId: string,
): Promise<SheetRow | null> {
  if (!sessionId.trim()) return null;
  const { rows } = await loadRows();
  const matches = rows.filter(
    (row) =>
      Boolean(row.documentId) &&
      row.stripeSessionId &&
      row.stripeSessionId === sessionId,
  );
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => {
    const versionDiff = parseDocumentVersion(b) - parseDocumentVersion(a);
    if (versionDiff !== 0) return versionDiff;
    return b.timestamp.localeCompare(a.timestamp);
  });
  return sorted[0] ?? null;
}
