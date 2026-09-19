import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { getSheetsTab, isSheetsConfigured } from "@/lib/env";
import {
  SHEET_COLUMNS,
  sheetRowValues,
  type SheetRow,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "intakes.json");

export type StoreResult = {
  backend: "sheets" | "file";
  row: SheetRow;
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

async function appendFileRow(row: SheetRow): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  let rows: SheetRow[] = [];
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    rows = JSON.parse(raw) as SheetRow[];
    if (!Array.isArray(rows)) rows = [];
  } catch {
    rows = [];
  }
  rows.push(row);
  await writeFile(DATA_FILE, JSON.stringify(rows, null, 2), "utf8");
}

export async function appendRecord(row: SheetRow): Promise<StoreResult> {
  if (isSheetsConfigured()) {
    await appendSheetRow(row);
    return { backend: "sheets", row };
  }

  console.warn(
    "[store] Google Sheets nicht konfiguriert — schreibe nach .data/intakes.json",
  );
  await appendFileRow(row);
  return { backend: "file", row };
}
