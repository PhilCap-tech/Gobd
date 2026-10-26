/**
 * Tab `plans` (Preismodell v2): eine Zeile je Konto, Upsert nach E-Mail.
 * Alte Tabs und Zeilen bleiben unberührt. Lesen gecacht (ein Grid-Read je
 * TTL), damit die Sheets-Quote (60 Reads/min) nicht steigt.
 * Ohne Sheets: Datei im Fallback-Verzeichnis (lokal, Checks).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { google } from "googleapis";
import { getPlansSheetsTab, isSheetsConfigured } from "@/lib/env";
import { PLAN_SHEET_COLUMNS, type PlanKind, type PlanRow } from "@/lib/plan";
import { readCachedGrid } from "@/lib/sheets-grid";
import {
  createTtlSingleflight,
  INTAKE_READ_TTL_MS,
  SHEETS_HEADER_TTL_MS,
  sheetsStatusCode,
} from "@/lib/sheets-outage";
import { getFileFallbackDir } from "@/lib/store";
import { emailsEqual } from "@/lib/types";

const FILE_NAME = "plans.json";

const planHeaderCache = createTtlSingleflight<string[]>(SHEETS_HEADER_TTL_MS);
const planValuesCache = createTtlSingleflight<string[][]>(INTAKE_READ_TTL_MS);

type PlanReader = () => Promise<PlanRow[]>;
let readerOverride: PlanReader | null = null;
let writerOverride: ((row: PlanRow) => Promise<void>) | null = null;

/** Checks only. `null` restores the store. */
export function setPlanStoreForTests(
  hooks: { read: PlanReader; write: (row: PlanRow) => Promise<void> } | null,
): void {
  readerOverride = hooks?.read ?? null;
  writerOverride = hooks?.write ?? null;
}

export function clearPlanReadCache(): void {
  planHeaderCache.clear();
  planValuesCache.clear();
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function coercePlanRow(value: unknown): PlanRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const email = str(row.email).toLowerCase();
  if (!email) return null;
  const plan: PlanKind = row.plan === "member" ? "member" : "single";
  const credits = Number(row.changeCredits);
  return {
    email,
    plan,
    stripeCustomerId: str(row.stripeCustomerId),
    purchasedAt: str(row.purchasedAt),
    retentionUntil: str(row.retentionUntil),
    changeCredits: Number.isInteger(credits) && credits > 0 ? credits : 0,
    lastChangePaidAt: str(row.lastChangePaidAt),
    memberSubscriptionId: str(row.memberSubscriptionId),
    memberStatus: str(row.memberStatus),
    memberPeriodEnd: str(row.memberPeriodEnd),
    memberCancelAt: str(row.memberCancelAt),
    memberEndedAt: str(row.memberEndedAt),
    notice30At: str(row.notice30At),
    notice7At: str(row.notice7At),
    deletedAt: str(row.deletedAt),
    refundedAt: str(row.refundedAt),
    processedSessions: str(row.processedSessions),
    lastEventId: str(row.lastEventId),
    updatedAt: str(row.updatedAt),
  };
}

const FIELD_BY_COLUMN: Record<(typeof PLAN_SHEET_COLUMNS)[number], keyof PlanRow> = {
  email: "email",
  plan: "plan",
  stripe_customer_id: "stripeCustomerId",
  purchased_at: "purchasedAt",
  retention_until: "retentionUntil",
  change_credits: "changeCredits",
  last_change_paid_at: "lastChangePaidAt",
  member_subscription_id: "memberSubscriptionId",
  member_status: "memberStatus",
  member_period_end: "memberPeriodEnd",
  member_cancel_at: "memberCancelAt",
  member_ended_at: "memberEndedAt",
  notice30_at: "notice30At",
  notice7_at: "notice7At",
  deleted_at: "deletedAt",
  refunded_at: "refundedAt",
  processed_sessions: "processedSessions",
  last_event_id: "lastEventId",
  updated_at: "updatedAt",
};

export function planRowFromSheet(header: string[], values: string[]): PlanRow | null {
  const record: Record<string, unknown> = {};
  for (const column of PLAN_SHEET_COLUMNS) {
    const index = header.indexOf(column);
    const raw = index < 0 ? "" : (values[index] ?? "");
    record[FIELD_BY_COLUMN[column]] = column === "change_credits" ? Number(raw || 0) : raw;
  }
  return coercePlanRow(record);
}

export function planSheetValues(row: PlanRow, header: readonly string[] = PLAN_SHEET_COLUMNS): string[] {
  return header.map((column) => {
    const field = FIELD_BY_COLUMN[column as (typeof PLAN_SHEET_COLUMNS)[number]];
    if (!field) return "";
    const value = row[field];
    return typeof value === "number" ? String(value) : (value ?? "");
  });
}

function filePath(dir: string): string {
  return path.join(dir, FILE_NAME);
}

function tmpFilePath(): string {
  return path.join(tmpdir(), "gobd-data", FILE_NAME);
}

function isFsUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: string }).code;
  return code === "EROFS" || code === "EACCES" || code === "EPERM";
}

async function readJsonFile(file: string): Promise<PlanRow[]> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coercePlanRow).filter((row): row is PlanRow => Boolean(row));
  } catch {
    return [];
  }
}

function upsert(rows: PlanRow[], row: PlanRow): PlanRow[] {
  let replaced = false;
  const next = rows.map((item) => {
    if (!emailsEqual(item.email, row.email)) return item;
    replaced = true;
    return row;
  });
  if (!replaced) next.push(row);
  return next;
}

function merge(primary: PlanRow[], extra: PlanRow[]): PlanRow[] {
  const map = new Map<string, PlanRow>();
  for (const row of [...primary, ...extra]) {
    const prev = map.get(row.email);
    if (!prev || row.updatedAt.localeCompare(prev.updatedAt) >= 0) map.set(row.email, row);
  }
  return [...map.values()];
}

async function readAllFiles(): Promise<PlanRow[]> {
  const primary = await readJsonFile(filePath(getFileFallbackDir()));
  const tmp = tmpFilePath();
  if (tmp === filePath(getFileFallbackDir())) return primary;
  return merge(primary, await readJsonFile(tmp));
}

async function writeFileRow(row: PlanRow): Promise<void> {
  const primary = filePath(getFileFallbackDir());
  try {
    await mkdir(path.dirname(primary), { recursive: true });
    await writeFile(primary, JSON.stringify(upsert(await readJsonFile(primary), row), null, 2), "utf8");
  } catch (error) {
    if (!isFsUnavailable(error)) throw error;
    const tmp = tmpFilePath();
    await mkdir(path.dirname(tmp), { recursive: true });
    await writeFile(tmp, JSON.stringify(upsert(await readJsonFile(tmp), row), null, 2), "utf8");
  }
}

function sheetsAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google-Service-Account unvollständig");
  return new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
  return id;
}

async function ensureHeader(): Promise<string[]> {
  const tab = getPlansSheetsTab();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  if (!meta.data.sheets?.some((sheet) => sheet.properties?.title === tab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A1:AZ1` });
  const header = (existing.data.values?.[0] ?? []).map((value) => String(value));
  const missing = PLAN_SHEET_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length === 0) return header;
  const next = [...header, ...missing];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [next] },
  });
  planHeaderCache.clear();
  return next;
}

async function readSheetRows(): Promise<PlanRow[]> {
  const grid = await readCachedGrid({
    tab: getPlansSheetsTab(),
    op: "plans",
    headerRange: "A1:AZ1",
    valuesRange: "A2:AZ",
    headerCache: planHeaderCache,
    valuesCache: planValuesCache,
  });
  return grid.values
    .map((values) => planRowFromSheet(grid.header, values))
    .filter((row): row is PlanRow => Boolean(row));
}

async function writeSheetRow(row: PlanRow): Promise<void> {
  const header = await ensureHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const tab = getPlansSheetsTab();
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A2:AZ` });
  const values = result.data.values ?? [];
  const line = planSheetValues(row, header);
  for (let index = 0; index < values.length; index += 1) {
    const current = planRowFromSheet(header, (values[index] ?? []).map((value) => String(value ?? "")));
    if (!current || !emailsEqual(current.email, row.email)) continue;
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

/** Alle Pläne. Ein Lesefehler wird geworfen (fail closed), nicht durch die leere Datei ersetzt. */
export async function listPlanRowsStrict(): Promise<PlanRow[]> {
  if (readerOverride) return readerOverride();
  return isSheetsConfigured() ? merge(await readSheetRows(), await readAllFiles()) : readAllFiles();
}

export async function findPlanByEmailStrict(email: string): Promise<PlanRow | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const rows = await listPlanRowsStrict();
  return rows.find((row) => emailsEqual(row.email, needle)) ?? null;
}

/** Nicht für Zugangsentscheidungen: ein Lesefehler ergibt `null`. */
export async function findPlanByEmail(email: string): Promise<PlanRow | null> {
  try {
    return await findPlanByEmailStrict(email);
  } catch (error) {
    console.error(
      "[plans] Lesen fehlgeschlagen",
      JSON.stringify({
        error: error instanceof Error ? error.name || "Error" : typeof error,
        status: sheetsStatusCode(error),
      }),
    );
    return null;
  }
}

export async function findPlanBySubscription(subscriptionId: string): Promise<PlanRow | null> {
  const id = subscriptionId.trim();
  if (!id) return null;
  const rows = await listPlanRowsStrict();
  return rows.find((row) => row.memberSubscriptionId === id) ?? null;
}

export async function savePlanRow(row: PlanRow): Promise<void> {
  const stored = coercePlanRow(row);
  if (!stored) throw new Error("Plan-Zeile unvollständig");
  if (writerOverride) return writerOverride(stored);
  if (isSheetsConfigured()) {
    await writeSheetRow(stored);
    planValuesCache.clear();
    try {
      await writeFileRow(stored);
    } catch (error) {
      console.warn("[plans] Datei nach Sheet nicht geschrieben", error instanceof Error ? error.name : "error");
    }
    return;
  }
  await writeFileRow(stored);
}
