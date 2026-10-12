import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { google } from "googleapis";
import { getLifecycleSheetsTab, isSheetsConfigured } from "@/lib/env";
import {
  emptyLifecycleRow,
  type EndReason,
  type LifecyclePhase,
  type LifecycleRow,
} from "@/lib/kuendigung";
import { getFileFallbackDir } from "@/lib/store";
import { emailsEqual } from "@/lib/types";

const FILE_NAME = "subscription-lifecycle.json";

export const LIFECYCLE_SHEET_COLUMNS = [
  "email",
  "stripe_customer_id",
  "stripe_subscription_id",
  "phase",
  "cancel_at_period_end",
  "period_end",
  "ended_at",
  "restore_until",
  "purge_at",
  "end_reason",
  "confirm_mail_at",
  "reminder_mail_at",
  "reactivated_at",
  "last_event_id",
  "updated_at",
] as const;

const PHASES = new Set<LifecyclePhase>(["active", "cancel_scheduled", "restore", "purged"]);
const REASONS = new Set<EndReason>(["", "customer_cancel", "payment_failed", "refund", "other"]);

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

function sheetsAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google-Service-Account unvollständig");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
  return id;
}

export function coerceLifecycleRow(value: unknown): LifecycleRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<LifecycleRow>;
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
  const subscriptionId =
    typeof row.stripeSubscriptionId === "string" ? row.stripeSubscriptionId.trim() : "";
  if (!email || !subscriptionId) return null;
  const phase = PHASES.has(row.phase as LifecyclePhase) ? (row.phase as LifecyclePhase) : "active";
  const endReason = REASONS.has(row.endReason as EndReason) ? (row.endReason as EndReason) : "";
  return {
    email,
    stripeCustomerId: typeof row.stripeCustomerId === "string" ? row.stripeCustomerId.trim() : "",
    stripeSubscriptionId: subscriptionId,
    phase,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
    periodEnd: typeof row.periodEnd === "string" ? row.periodEnd : "",
    endedAt: typeof row.endedAt === "string" ? row.endedAt : "",
    restoreUntil: typeof row.restoreUntil === "string" ? row.restoreUntil : "",
    purgeAt: typeof row.purgeAt === "string" ? row.purgeAt : "",
    endReason,
    confirmMailAt: typeof row.confirmMailAt === "string" ? row.confirmMailAt : "",
    reminderMailAt: typeof row.reminderMailAt === "string" ? row.reminderMailAt : "",
    reactivatedAt: typeof row.reactivatedAt === "string" ? row.reactivatedAt : "",
    lastEventId: typeof row.lastEventId === "string" ? row.lastEventId : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}

function cell(header: string[], values: string[], name: string): string {
  const index = header.indexOf(name);
  if (index < 0) return "";
  return values[index] ?? "";
}

export function lifecycleRowFromSheet(header: string[], values: string[]): LifecycleRow | null {
  const flag = cell(header, values, "cancel_at_period_end").trim().toLowerCase();
  return coerceLifecycleRow({
    email: cell(header, values, "email"),
    stripeCustomerId: cell(header, values, "stripe_customer_id"),
    stripeSubscriptionId: cell(header, values, "stripe_subscription_id"),
    phase: cell(header, values, "phase"),
    cancelAtPeriodEnd: flag === "true" || flag === "1" || flag === "ja",
    periodEnd: cell(header, values, "period_end"),
    endedAt: cell(header, values, "ended_at"),
    restoreUntil: cell(header, values, "restore_until"),
    purgeAt: cell(header, values, "purge_at"),
    endReason: cell(header, values, "end_reason"),
    confirmMailAt: cell(header, values, "confirm_mail_at"),
    reminderMailAt: cell(header, values, "reminder_mail_at"),
    reactivatedAt: cell(header, values, "reactivated_at"),
    lastEventId: cell(header, values, "last_event_id"),
    updatedAt: cell(header, values, "updated_at"),
  });
}

export function lifecycleSheetValues(row: LifecycleRow): string[] {
  return [
    row.email,
    row.stripeCustomerId,
    row.stripeSubscriptionId,
    row.phase,
    row.cancelAtPeriodEnd ? "true" : "false",
    row.periodEnd,
    row.endedAt,
    row.restoreUntil,
    row.purgeAt,
    row.endReason,
    row.confirmMailAt,
    row.reminderMailAt,
    row.reactivatedAt,
    row.lastEventId,
    row.updatedAt,
  ];
}

async function readJsonFile(file: string): Promise<LifecycleRow[]> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceLifecycleRow).filter((row): row is LifecycleRow => Boolean(row));
  } catch {
    return [];
  }
}

async function writeJsonFile(file: string, rows: LifecycleRow[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

function mergeRows(primary: LifecycleRow[], extra: LifecycleRow[]): LifecycleRow[] {
  const map = new Map<string, LifecycleRow>();
  for (const row of [...primary, ...extra]) {
    const key = row.stripeSubscriptionId;
    const prev = map.get(key);
    if (!prev || row.updatedAt.localeCompare(prev.updatedAt) >= 0) map.set(key, row);
  }
  return [...map.values()];
}

async function readAllFiles(): Promise<LifecycleRow[]> {
  const primary = await readJsonFile(filePath(getFileFallbackDir()));
  const tmp = tmpFilePath();
  if (tmp === filePath(getFileFallbackDir())) return primary;
  return mergeRows(primary, await readJsonFile(tmp));
}

async function writeFileRow(row: LifecycleRow): Promise<void> {
  const primary = filePath(getFileFallbackDir());
  try {
    const rows = await readJsonFile(primary);
    await writeJsonFile(primary, upsertRow(rows, row));
  } catch (error) {
    if (!isFsUnavailable(error)) throw error;
    const tmp = tmpFilePath();
    const rows = await readJsonFile(tmp);
    await writeJsonFile(tmp, upsertRow(rows, row));
  }
}

function upsertRow(rows: LifecycleRow[], row: LifecycleRow): LifecycleRow[] {
  let replaced = false;
  const next = rows.map((item) => {
    if (item.stripeSubscriptionId !== row.stripeSubscriptionId) return item;
    replaced = true;
    return row;
  });
  if (!replaced) next.push(row);
  return next;
}

async function ensureHeader(): Promise<string[]> {
  const tab = getLifecycleSheetsTab();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === tab);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${tab}!A1:AZ1`,
  });
  const header = (existing.data.values?.[0] ?? []).map((cellValue) => String(cellValue));
  if (header.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...LIFECYCLE_SHEET_COLUMNS]] },
    });
    return [...LIFECYCLE_SHEET_COLUMNS];
  }
  const missing = LIFECYCLE_SHEET_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length === 0) return header;
  const next = [...header, ...missing];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [next] },
  });
  return next;
}

async function readSheetRows(): Promise<LifecycleRow[]> {
  const header = await ensureHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${getLifecycleSheetsTab()}!A2:AZ`,
  });
  return (result.data.values ?? [])
    .map((row) => lifecycleRowFromSheet(header, row.map((cellValue) => String(cellValue ?? ""))))
    .filter((row): row is LifecycleRow => Boolean(row));
}

async function writeSheetRow(row: LifecycleRow): Promise<void> {
  const header = await ensureHeader();
  const sheets = google.sheets({ version: "v4", auth: sheetsAuth() });
  const id = spreadsheetId();
  const tab = getLifecycleSheetsTab();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${tab}!A2:AZ`,
  });
  const values = result.data.values ?? [];
  const line = lifecycleSheetValuesAligned(row, header);
  for (let index = 0; index < values.length; index += 1) {
    const current = lifecycleRowFromSheet(
      header,
      (values[index] ?? []).map((cellValue) => String(cellValue ?? "")),
    );
    if (!current || current.stripeSubscriptionId !== row.stripeSubscriptionId) continue;
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

function lifecycleSheetValuesAligned(row: LifecycleRow, header: string[]): string[] {
  const byName = new Map(LIFECYCLE_SHEET_COLUMNS.map((column, index) => [column, lifecycleSheetValues(row)[index] ?? ""]));
  return header.map((column) => byName.get(column as (typeof LIFECYCLE_SHEET_COLUMNS)[number]) ?? "");
}

export async function listLifecycleRows(): Promise<LifecycleRow[]> {
  if (isSheetsConfigured()) {
    try {
      return mergeRows(await readSheetRows(), await readAllFiles());
    } catch (error) {
      console.error("[kuendigung] Sheet lesen fehlgeschlagen — Datei", error);
    }
  }
  return readAllFiles();
}

export async function listLifecycleByEmail(email: string): Promise<LifecycleRow[]> {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];
  const rows = await listLifecycleRows();
  return rows.filter((row) => emailsEqual(row.email, needle));
}

export async function findLifecycleBySubscription(
  subscriptionId: string,
): Promise<LifecycleRow | null> {
  const id = subscriptionId.trim();
  if (!id) return null;
  const rows = await listLifecycleRows();
  return rows.find((row) => row.stripeSubscriptionId === id) ?? null;
}

export async function saveLifecycleRow(row: LifecycleRow): Promise<void> {
  const stored = coerceLifecycleRow(row);
  if (!stored) {
    throw new Error("Lifecycle-Zeile unvollständig");
  }
  if (isSheetsConfigured()) {
    try {
      await writeSheetRow(stored);
      try {
        await writeFileRow(stored);
      } catch (error) {
        console.warn("[kuendigung] Datei nach Sheet nicht geschrieben", error);
      }
      return;
    } catch (error) {
      console.error("[kuendigung] Sheet schreiben fehlgeschlagen — Datei", error);
    }
  }
  await writeFileRow(stored);
}

export function blankLifecycle(input: {
  email: string;
  customerId: string;
  subscriptionId: string;
  at: string;
}): LifecycleRow {
  return emptyLifecycleRow({
    email: input.email,
    customerId: input.customerId,
    subscriptionId: input.subscriptionId,
    updatedAt: input.at,
  });
}
