import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { getReadinessSheetsTab, isSheetsConfigured } from "@/lib/env";
import { queryIdsEqual } from "@/lib/query";
import {
  READINESS_SHEET_COLUMNS,
  coerceReadinessLead,
  emptyReadinessLead,
  readinessFieldForHeader,
  readinessRowFromValues,
  readinessRowValues,
  type ReadinessLead,
} from "@/lib/readiness";
import { getFileFallbackDir } from "@/lib/store";

const FILE_NAME = "readiness-leads.json";

const SHEETS_GET_OPTS = {
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
} as const;

export type ReadinessStoreResult = {
  backend: "sheets" | "file";
  row: ReadinessLead;
  filePath?: string;
};

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

function quoteTab(tab: string): string {
  return `'${tab.replaceAll("'", "''")}'`;
}

async function ensureReadinessTab(): Promise<string> {
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const tab = getReadinessSheetsTab();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: "sheets.properties.title",
  });
  const exists = (meta.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === tab,
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tab } } }],
      },
    });
  }
  return tab;
}

async function ensureReadinessHeader(): Promise<string[]> {
  const tab = await ensureReadinessTab();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const existing = await sheets.spreadsheets.values.get(
    {
      spreadsheetId: id,
      range: `${quoteTab(tab)}!A1:AZ1`,
    },
    SHEETS_GET_OPTS,
  );
  const header = (existing.data.values?.[0] ?? []).map((cell) => String(cell));

  if (header.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${quoteTab(tab)}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [READINESS_SHEET_COLUMNS as unknown as string[]] },
    });
    return [...READINESS_SHEET_COLUMNS];
  }

  const missing = READINESS_SHEET_COLUMNS.filter((col) => {
    const field = readinessFieldForHeader(col);
    if (!field) return true;
    return !header.some((cell) => readinessFieldForHeader(cell) === field);
  });
  if (missing.length === 0) {
    return header;
  }

  const next = [...header, ...missing];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${quoteTab(tab)}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [next] },
  });
  return next;
}

async function appendSheetRow(row: ReadinessLead): Promise<void> {
  const header = await ensureReadinessHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${quoteTab(getReadinessSheetsTab())}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [readinessRowValues(row, header)] },
  });
}

async function readSheetRows(): Promise<ReadinessLead[]> {
  const header = await ensureReadinessHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const result = await sheets.spreadsheets.values.get(
    {
      spreadsheetId: spreadsheetId(),
      range: `${quoteTab(getReadinessSheetsTab())}!A2:AZ`,
    },
    SHEETS_GET_OPTS,
  );
  const values = result.data.values ?? [];
  return values
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) =>
      readinessRowFromValues(
        header,
        row.map((cell) => String(cell ?? "")),
      ),
    );
}

function filePath(): string {
  return path.join(getFileFallbackDir(), FILE_NAME);
}

async function readFileRows(file: string): Promise<ReadinessLead[]> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => coerceReadinessLead(item))
      .filter((row): row is ReadinessLead => Boolean(row));
  } catch {
    return [];
  }
}

async function appendFileRow(row: ReadinessLead): Promise<string> {
  const dir = getFileFallbackDir();
  const file = path.join(dir, FILE_NAME);
  const rows = await readFileRows(file);
  rows.push(row);
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(rows, null, 2), "utf8");
  return file;
}

export async function appendReadinessRecord(
  row: ReadinessLead,
): Promise<ReadinessStoreResult> {
  const complete = { ...emptyReadinessLead(), ...row };
  if (isSheetsConfigured()) {
    try {
      await appendSheetRow(complete);
      return { backend: "sheets", row: complete };
    } catch (error) {
      console.error(
        "[readiness-store] Google Sheets append fehlgeschlagen — Datei-Fallback",
        error,
      );
    }
  } else {
    console.warn(
      "[readiness-store] Google Sheets nicht konfiguriert — schreibe nach",
      filePath(),
    );
  }

  const storedPath = await appendFileRow(complete);
  return { backend: "file", row: complete, filePath: storedPath };
}

async function loadReadinessRows(): Promise<ReadinessLead[]> {
  if (isSheetsConfigured()) {
    try {
      const sheetRows = await readSheetRows();
      const fileRows = await readFileRows(filePath());
      if (fileRows.length === 0) return sheetRows;
      const seen = new Set(sheetRows.map((row) => row.documentId));
      return [
        ...sheetRows,
        ...fileRows.filter((row) => row.documentId && !seen.has(row.documentId)),
      ];
    } catch (error) {
      console.error(
        "[readiness-store] Google Sheets lesen fehlgeschlagen — Datei-Fallback",
        error,
      );
    }
  }
  return readFileRows(filePath());
}

export async function findReadinessLeadById(
  documentId: string,
): Promise<ReadinessLead | null> {
  const id = documentId.trim();
  if (!id) return null;
  const rows = await loadReadinessRows();
  const matches = rows.filter((row) => queryIdsEqual(row.documentId, id));
  return matches.at(-1) ?? null;
}
