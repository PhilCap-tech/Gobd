/**
 * Tab `plan_firms` (Preismodell v2, R1 neu): eine Zeile je Firma bzw. Platz,
 * Upsert nach slot_id, verknüpft über die E-Mail. Gleiches Muster wie
 * lib/plan-store.ts (gecachter Grid-Read, Datei-Fallback lokal/Checks).
 * Wird nur gelesen, wenn PLAN_ACCESS_ENABLED (Default: PRICING_MODEL=v2) gilt.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { google } from "googleapis";
import { getPlanFirmsSheetsTab, isSheetsConfigured } from "@/lib/env";
import { PLAN_FIRM_SHEET_COLUMNS, type FirmSource, type PlanFirmRow } from "@/lib/plan-firms";
import { readCachedGrid } from "@/lib/sheets-grid";
import { createTtlSingleflight, INTAKE_READ_TTL_MS, SHEETS_HEADER_TTL_MS } from "@/lib/sheets-outage";
import { getFileFallbackDir } from "@/lib/store";
import { emailsEqual } from "@/lib/types";

const FILE_NAME = "plan-firms.json";
const headerCache = createTtlSingleflight<string[]>(SHEETS_HEADER_TTL_MS);
const valuesCache = createTtlSingleflight<string[][]>(INTAKE_READ_TTL_MS);

type Reader = () => Promise<PlanFirmRow[]>;
let readerOverride: Reader | null = null;
let writerOverride: ((row: PlanFirmRow) => Promise<void>) | null = null;

/** Checks only. `null` restores the store. */
export function setPlanFirmStoreForTests(
  hooks: { read: Reader; write: (row: PlanFirmRow) => Promise<void> } | null,
): void {
  readerOverride = hooks?.read ?? null;
  writerOverride = hooks?.write ?? null;
}

export function clearPlanFirmReadCache(): void {
  headerCache.clear();
  valuesCache.clear();
}

type Column = (typeof PLAN_FIRM_SHEET_COLUMNS)[number];
const FIELD: Record<Column, keyof PlanFirmRow> = {
  email: "email",
  slot_id: "slotId",
  entity_id: "entityId",
  source: "source",
  purchased_at: "purchasedAt",
  retention_until: "retentionUntil",
  change_credits: "changeCredits",
  last_change_paid_at: "lastChangePaidAt",
  notice30_at: "notice30At",
  notice7_at: "notice7At",
  deleted_at: "deletedAt",
  refunded_at: "refundedAt",
  processed_sessions: "processedSessions",
  updated_at: "updatedAt",
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function coercePlanFirmRow(value: unknown): PlanFirmRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const email = str(row.email).toLowerCase();
  const slotId = str(row.slotId);
  if (!email || !slotId) return null;
  const source: FirmSource = row.source === "extra" || row.source === "member" ? row.source : "entry";
  const credits = Number(row.changeCredits);
  return {
    email,
    slotId,
    entityId: str(row.entityId),
    source,
    purchasedAt: str(row.purchasedAt),
    retentionUntil: str(row.retentionUntil),
    changeCredits: Number.isInteger(credits) && credits > 0 ? credits : 0,
    lastChangePaidAt: str(row.lastChangePaidAt),
    notice30At: str(row.notice30At),
    notice7At: str(row.notice7At),
    deletedAt: str(row.deletedAt),
    refundedAt: str(row.refundedAt),
    processedSessions: str(row.processedSessions),
    updatedAt: str(row.updatedAt),
  };
}

export function planFirmRowFromSheet(header: string[], values: string[]): PlanFirmRow | null {
  const record: Record<string, unknown> = {};
  for (const column of PLAN_FIRM_SHEET_COLUMNS) {
    const index = header.indexOf(column);
    const raw = index < 0 ? "" : (values[index] ?? "");
    record[FIELD[column]] = column === "change_credits" ? Number(raw || 0) : raw;
  }
  return coercePlanFirmRow(record);
}

export function planFirmSheetValues(
  row: PlanFirmRow,
  header: readonly string[] = PLAN_FIRM_SHEET_COLUMNS,
): string[] {
  return header.map((column) => {
    const field = FIELD[column as Column];
    if (!field) return "";
    const value = row[field];
    return typeof value === "number" ? String(value) : (value ?? "");
  });
}

function files(): string[] {
  const primary = path.join(getFileFallbackDir(), FILE_NAME);
  const tmp = path.join(tmpdir(), "gobd-data", FILE_NAME);
  return primary === tmp ? [primary] : [primary, tmp];
}

async function readJson(file: string): Promise<PlanFirmRow[]> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    return Array.isArray(parsed)
      ? parsed.map(coercePlanFirmRow).filter((row): row is PlanFirmRow => Boolean(row))
      : [];
  } catch {
    return [];
  }
}

function merge(...lists: PlanFirmRow[][]): PlanFirmRow[] {
  const map = new Map<string, PlanFirmRow>();
  for (const row of lists.flat()) {
    const prev = map.get(row.slotId);
    if (!prev || row.updatedAt.localeCompare(prev.updatedAt) >= 0) map.set(row.slotId, row);
  }
  return [...map.values()];
}

async function readFiles(): Promise<PlanFirmRow[]> {
  return merge(...(await Promise.all(files().map(readJson))));
}

async function writeFileRow(row: PlanFirmRow): Promise<void> {
  let lastError: unknown = null;
  for (const file of files()) {
    try {
      await mkdir(path.dirname(file), { recursive: true });
      const rows = (await readJson(file)).filter((item) => item.slotId !== row.slotId);
      await writeFile(file, JSON.stringify([...rows, row], null, 2), "utf8");
      return;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code !== "EROFS" && code !== "EACCES" && code !== "EPERM") throw error;
      lastError = error;
    }
  }
  throw lastError;
}

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!email || !key || !id) throw new Error("Google Sheets unvollständig konfiguriert");
  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return { sheets: google.sheets({ version: "v4", auth }), id };
}

async function ensureHeader(): Promise<string[]> {
  const tab = getPlanFirmsSheetsTab();
  const { sheets, id } = sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  if (!meta.data.sheets?.some((sheet) => sheet.properties?.title === tab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A1:AZ1` });
  const header = (existing.data.values?.[0] ?? []).map((value) => String(value));
  const missing = PLAN_FIRM_SHEET_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length === 0) return header;
  const next = [...header, ...missing];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [next] },
  });
  headerCache.clear();
  return next;
}

async function readSheetRows(): Promise<PlanFirmRow[]> {
  const grid = await readCachedGrid({
    tab: getPlanFirmsSheetsTab(),
    op: "plan_firms",
    headerRange: "A1:AZ1",
    valuesRange: "A2:AZ",
    headerCache,
    valuesCache,
  });
  return grid.values
    .map((values) => planFirmRowFromSheet(grid.header, values))
    .filter((row): row is PlanFirmRow => Boolean(row));
}

async function writeSheetRow(row: PlanFirmRow): Promise<void> {
  const header = await ensureHeader();
  const { sheets, id } = sheetsClient();
  const tab = getPlanFirmsSheetsTab();
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A2:AZ` });
  const line = planFirmSheetValues(row, header);
  const values = result.data.values ?? [];
  for (let index = 0; index < values.length; index += 1) {
    const current = planFirmRowFromSheet(header, (values[index] ?? []).map((value) => String(value ?? "")));
    if (current?.slotId !== row.slotId) continue;
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${tab}!A${index + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [line] },
    });
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [line] },
  });
}

/** Alle Firmen-Zeilen. Lesefehler wird geworfen (fail closed). */
export async function listPlanFirmRowsStrict(): Promise<PlanFirmRow[]> {
  if (readerOverride) return readerOverride();
  return isSheetsConfigured() ? merge(await readSheetRows(), await readFiles()) : readFiles();
}

export async function listPlanFirmsByEmailStrict(email: string): Promise<PlanFirmRow[]> {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];
  return (await listPlanFirmRowsStrict()).filter((row) => emailsEqual(row.email, needle));
}

export async function savePlanFirmRow(row: PlanFirmRow): Promise<void> {
  const stored = coercePlanFirmRow(row);
  if (!stored) throw new Error("Firmen-Zeile unvollständig");
  if (writerOverride) return writerOverride(stored);
  if (isSheetsConfigured()) {
    await writeSheetRow(stored);
    valuesCache.clear();
    try {
      await writeFileRow(stored);
    } catch (error) {
      console.warn("[plan_firms] Datei nach Sheet nicht geschrieben", error instanceof Error ? error.name : "error");
    }
    return;
  }
  await writeFileRow(stored);
}
