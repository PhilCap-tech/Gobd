import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { google } from "googleapis";
import { parseDocumentVersion, rowsInFamily } from "@/lib/documents";
import { getReadinessSheetsTab, getSheetsTab, isSheetsConfigured } from "@/lib/env";
import { normalizeQueryId, queryIdsEqual } from "@/lib/query";
import { listStripeCustomerIdByEmail } from "@/lib/stripe";
import {
  coerceReadinessLead,
  emptyReadinessLead,
  parseReadinessLead,
  readinessSheetValues,
  READINESS_SHEET_COLUMNS,
  type ReadinessLead,
} from "@/lib/readiness";
import {
  SHEET_COLUMNS,
  coerceSheetRow,
  emailsEqual,
  emptySheetRow,
  sheetFieldForHeader,
  sheetRowFromValues,
  sheetRowValues,
  toSheetRow,
  type SheetRow,
} from "@/lib/types";

const FILE_NAME = "intakes.json";
const READINESS_FILE_NAME = "readiness-leads.json";

const SHEETS_GET_OPTS = {
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
} as const;

const SESSION_LOOKUP_BACKOFF_MS = [300, 500, 800, 800];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function readinessFilePath(dir: string): string {
  return path.join(dir, READINESS_FILE_NAME);
}

function tmpReadinessFallbackPath(): string {
  return path.join(tmpdir(), "gobd-data", READINESS_FILE_NAME);
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

async function ensureSpreadsheetTab(tab: string): Promise<void> {
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === tab);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tab } } }],
    },
  });
}

async function ensureSheetHeader(): Promise<string[]> {
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const tab = getSheetsTab();
  const existing = await sheets.spreadsheets.values.get(
    {
      spreadsheetId: id,
      range: `${tab}!A1:AZ1`,
    },
    SHEETS_GET_OPTS,
  );
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

  const missing = SHEET_COLUMNS.filter((col) => {
    const field = sheetFieldForHeader(col);
    if (!field) return true;
    return !header.some((cell) => sheetFieldForHeader(cell) === field);
  });
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
  const result = await sheets.spreadsheets.values.get(
    {
      spreadsheetId: spreadsheetId(),
      range: `${getSheetsTab()}!A2:AZ`,
    },
    SHEETS_GET_OPTS,
  );
  const values = result.data.values ?? [];
  return values
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) =>
      sheetRowFromValues(
        header,
        row.map((cell) => String(cell ?? "")),
      ),
    );
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

function rowIdentity(row: SheetRow): string {
  return row.documentId || `${row.stripeSessionId}:${row.timestamp}`;
}

function mergeRows(primary: SheetRow[], extra: SheetRow[]): SheetRow[] {
  if (extra.length === 0) return primary;
  if (primary.length === 0) return extra;
  const seen = new Set(primary.map(rowIdentity));
  const merged = [...primary];
  for (const row of extra) {
    const key = rowIdentity(row);
    if (!seen.has(key)) {
      merged.push(row);
      seen.add(key);
    }
  }
  return merged;
}

async function readAllFileRows(): Promise<SheetRow[]> {
  const primary = await readRows(getFileFallbackPath());
  const tmpFile = tmpFallbackPath();
  if (tmpFile === getFileFallbackPath()) {
    return primary;
  }
  return mergeRows(primary, await readRows(tmpFile));
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
      const sheetRows = await readSheetRows();
      const fileRows = await readAllFileRows();
      return { backend: "sheets", rows: mergeRows(sheetRows, fileRows) };
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
  const id = normalizeQueryId(documentId);
  if (!id) return null;
  const { rows } = await loadRows();
  const matches = rows.filter((row) => queryIdsEqual(row.documentId, id));
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

export async function findRowByStripeSessionId(
  sessionId: string,
): Promise<SheetRow | null> {
  const normalized = normalizeQueryId(sessionId);
  if (!normalized) return null;
  const { rows } = await loadRows();
  return (
    rows
      .filter((row) => queryIdsEqual(row.stripeSessionId, normalized))
      .at(-1) ?? null
  );
}

function stripeCustomerIdFromRow(row: SheetRow): string {
  return row.stripeCustomerId.trim();
}

/** Paid webhook rows and completed (non-stub) intake rows. */
function isPaidLikeStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s === "paid" ||
    s.startsWith("paid") ||
    s === "intake_submitted" ||
    s === "intake_resubmitted"
  );
}

function latestCustomerIdFromRows(
  rows: SheetRow[],
  email: string,
): string | null {
  const forEmail = rows.filter((row) => emailsEqual(row.email, email));
  const byTime = (a: SheetRow, b: SheetRow) =>
    b.timestamp.localeCompare(a.timestamp);

  const paidWithId = forEmail
    .filter((row) => isPaidLikeStatus(row.status) && stripeCustomerIdFromRow(row))
    .sort(byTime);
  if (paidWithId[0]) return stripeCustomerIdFromRow(paidWithId[0]);

  const anyWithId = forEmail
    .filter((row) => stripeCustomerIdFromRow(row))
    .sort(byTime);
  return anyWithId[0] ? stripeCustomerIdFromRow(anyWithId[0]) : null;
}

async function persistLinkedStripeCustomerId(
  email: string,
  customerId: string,
): Promise<void> {
  try {
    await appendRecord(
      toSheetRow({
        identity: {
          email,
          company: "",
          stripeSessionId: "",
          stripeCustomerId: customerId,
          stub: false,
        },
        status: "stripe_customer_linked",
        deliveryStatus: "",
      }),
    );
  } catch (error) {
    console.error(
      "[store] stripe_customer_id aus Stripe-Lookup konnte nicht gespeichert werden",
      error,
    );
  }
}

/**
 * Latest non-empty Stripe customer id for this e-mail.
 * Prefers paid/intake rows, then any row with `stripe_customer_id`.
 * If still empty and STRIPE_SECRET_KEY is set, lists Stripe customers by e-mail
 * (short cache) and persists the id so checkout/webhook gaps do not hide the portal.
 */
export async function findLatestStripeCustomerIdByEmail(
  email: string,
): Promise<string | null> {
  if (!email.trim()) return null;
  const { rows } = await loadRows();
  const fromRows = latestCustomerIdFromRows(rows, email);
  if (fromRows) return fromRows;

  const fromStripe = await listStripeCustomerIdByEmail(email);
  if (fromStripe) {
    await persistLinkedStripeCustomerId(email, fromStripe);
  }
  return fromStripe;
}

function latestRowForSession(
  rows: SheetRow[],
  sessionId: string,
): SheetRow | null {
  const matches = rows.filter(
    (row) =>
      Boolean(row.documentId) &&
      row.stripeSessionId &&
      queryIdsEqual(row.stripeSessionId, sessionId),
  );
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => {
    const versionDiff = parseDocumentVersion(b) - parseDocumentVersion(a);
    if (versionDiff !== 0) return versionDiff;
    return b.timestamp.localeCompare(a.timestamp);
  });
  return sorted[0] ?? null;
}

/**
 * Latest PDF row for a Stripe (or stub) checkout session.
 * Pass `attempts` > 1 to retry load+lookup across Sheets read-after-write lag.
 */
export async function findLatestDocumentByStripeSessionId(
  sessionId: string,
  options?: { attempts?: number; backoffMs?: readonly number[] },
): Promise<SheetRow | null> {
  const normalized = normalizeQueryId(sessionId);
  if (!normalized) return null;
  const attempts = Math.max(1, options?.attempts ?? 1);
  const backoff = options?.backoffMs ?? SESSION_LOOKUP_BACKOFF_MS;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      const wait = backoff[Math.min(i - 1, backoff.length - 1)] ?? 500;
      await sleep(wait);
    }
    const { backend, rows } = await loadRows();
    const match = latestRowForSession(rows, normalized);
    if (match) return match;
    if (backend !== "sheets") break;
  }
  return null;
}

const SUCCESS_LOOKUP_ATTEMPTS = 5;

/** Prefer document_id, then session_id, with retries for Sheets lag. */
export async function findSuccessDocument(input: {
  documentId?: string;
  sessionId?: string;
}): Promise<SheetRow | null> {
  const documentId = normalizeQueryId(input.documentId);
  const sessionId = normalizeQueryId(input.sessionId);
  if (!documentId && !sessionId) return null;

  const attempts = sessionId ? SUCCESS_LOOKUP_ATTEMPTS : 1;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      const wait =
        SESSION_LOOKUP_BACKOFF_MS[
          Math.min(i - 1, SESSION_LOOKUP_BACKOFF_MS.length - 1)
        ] ?? 500;
      await sleep(wait);
    }
    const { backend, rows } = await loadRows();
    if (documentId) {
      const byId = rows.filter((row) => queryIdsEqual(row.documentId, documentId)).at(-1);
      if (byId) return byId;
    }
    if (sessionId) {
      const bySession = latestRowForSession(rows, sessionId);
      if (bySession) return bySession;
    }
    if (backend !== "sheets") break;
  }
  return null;
}

export type ReadinessStoreResult = {
  backend: "sheets" | "file";
  lead: ReadinessLead;
  filePath?: string;
};

async function ensureReadinessSheetHeader(): Promise<string[]> {
  const tab = getReadinessSheetsTab();
  await ensureSpreadsheetTab(tab);
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const existing = await sheets.spreadsheets.values.get(
    {
      spreadsheetId: id,
      range: `${tab}!A1:AZ1`,
    },
    SHEETS_GET_OPTS,
  );
  const header = (existing.data.values?.[0] ?? []).map((cell) => String(cell));

  if (header.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [READINESS_SHEET_COLUMNS as unknown as string[]] },
    });
    return [...READINESS_SHEET_COLUMNS];
  }

  const missing = READINESS_SHEET_COLUMNS.filter((col) => !header.includes(col));
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

async function appendReadinessSheetRow(lead: ReadinessLead): Promise<void> {
  const header = await ensureReadinessSheetHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${getReadinessSheetsTab()}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [readinessSheetValues(lead, header)] },
  });
}

async function readReadinessSheetRows(): Promise<ReadinessLead[]> {
  const header = await ensureReadinessSheetHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const result = await sheets.spreadsheets.values.get(
    {
      spreadsheetId: spreadsheetId(),
      range: `${getReadinessSheetsTab()}!A2:AZ`,
    },
    SHEETS_GET_OPTS,
  );
  const values = result.data.values ?? [];
  return values
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) =>
      parseReadinessLead(
        header,
        row.map((cell) => String(cell ?? "")),
      ),
    );
}

async function readReadinessFileRows(file: string): Promise<ReadinessLead[]> {
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

async function writeReadinessFileRows(
  dir: string,
  file: string,
  rows: ReadinessLead[],
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

async function appendReadinessFileRow(lead: ReadinessLead): Promise<string> {
  const primaryDir = getFileFallbackDir();
  const primaryFile = readinessFilePath(primaryDir);

  try {
    const rows = await readReadinessFileRows(primaryFile);
    rows.push(lead);
    await writeReadinessFileRows(primaryDir, primaryFile, rows);
    return primaryFile;
  } catch (error) {
    const tmpFile = tmpReadinessFallbackPath();
    if (isFsUnavailable(error) && primaryFile !== tmpFile) {
      console.warn(
        "[store] Readiness-Datei-Fallback nicht beschreibbar — weiche auf tmpdir aus",
        error,
      );
      const tmpDir = path.dirname(tmpFile);
      const rows = await readReadinessFileRows(tmpFile);
      rows.push(lead);
      await writeReadinessFileRows(tmpDir, tmpFile, rows);
      return tmpFile;
    }
    throw error;
  }
}

function mergeReadinessLeads(
  primary: ReadinessLead[],
  extra: ReadinessLead[],
): ReadinessLead[] {
  if (extra.length === 0) return primary;
  if (primary.length === 0) return extra;
  const seen = new Set(primary.map((row) => row.leadId || `${row.email}:${row.timestamp}`));
  const merged = [...primary];
  for (const row of extra) {
    const key = row.leadId || `${row.email}:${row.timestamp}`;
    if (!seen.has(key)) {
      merged.push(row);
      seen.add(key);
    }
  }
  return merged;
}

async function readAllReadinessFileRows(): Promise<ReadinessLead[]> {
  const primary = await readReadinessFileRows(readinessFilePath(getFileFallbackDir()));
  const tmpFile = tmpReadinessFallbackPath();
  if (tmpFile === readinessFilePath(getFileFallbackDir())) {
    return primary;
  }
  return mergeReadinessLeads(primary, await readReadinessFileRows(tmpFile));
}

export function getReadinessFileFallbackPath(): string {
  return readinessFilePath(getFileFallbackDir());
}

export async function appendReadinessLead(
  lead: ReadinessLead,
): Promise<ReadinessStoreResult> {
  const complete = { ...emptyReadinessLead(), ...lead };
  if (isSheetsConfigured()) {
    try {
      await appendReadinessSheetRow(complete);
      return { backend: "sheets", lead: complete };
    } catch (error) {
      console.error(
        "[store] Readiness Google Sheets append fehlgeschlagen — falle auf Datei zurück",
        error,
      );
    }
  } else {
    console.warn(
      "[store] Google Sheets nicht konfiguriert — schreibe Readiness nach",
      getReadinessFileFallbackPath(),
    );
  }

  const filePath = await appendReadinessFileRow(complete);
  return { backend: "file", lead: complete, filePath };
}

async function loadReadinessLeads(): Promise<{
  backend: "sheets" | "file";
  rows: ReadinessLead[];
}> {
  if (isSheetsConfigured()) {
    try {
      const sheetRows = await readReadinessSheetRows();
      const fileRows = await readAllReadinessFileRows();
      return { backend: "sheets", rows: mergeReadinessLeads(sheetRows, fileRows) };
    } catch (error) {
      console.error(
        "[store] Readiness Google Sheets lesen fehlgeschlagen — falle auf Datei zurück",
        error,
      );
    }
  }
  return { backend: "file", rows: await readAllReadinessFileRows() };
}

export async function findReadinessLeadById(
  leadId: string,
): Promise<ReadinessLead | null> {
  const id = normalizeQueryId(leadId);
  if (!id) return null;
  const { rows } = await loadReadinessLeads();
  const matches = rows.filter((row) => queryIdsEqual(row.leadId, id));
  return matches.at(-1) ?? null;
}
