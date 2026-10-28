/**
 * Karteikarte audit_log, sonst .data/audit-log.json.
 * draft.saved bündelt 15 Minuten auf eine Zeile und trägt die letzte Revision.
 * Die Zeile wird dafür fortgeschrieben. Alles andere wird nur angehängt.
 * Alte Zeilen bleiben liegen; die Auslieferung filtert.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AUDIT_PAGE_SIZE,
  AUDIT_SHEET_COLUMNS,
  DRAFT_SAVED_WINDOW_MS,
  auditDeliverable,
  clipSummary,
  isAuditAction,
  normalizeAuditModules,
  sameDraftSavedBundle,
  toAuditListItem,
  type AuditAction,
  type AuditEvent,
  type AuditListItem,
  type AuditRole,
  type AuditSheetColumn,
} from "@/lib/audit-log";
import { getAuditSheetsTab, isSheetsConfigured } from "@/lib/env";
import { createSheetsClient } from "@/lib/sheets-client";
import {
  retrySheetsCall,
  SheetsUnavailableError,
  isSheetsOutage,
  sheetsStatusCode,
} from "@/lib/sheets-outage";
import { getFileFallbackDir } from "@/lib/store";

const FILE_NAME = "audit-log.json";

const SHEETS_GET_OPTS = {
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
} as const;

const FIELDS: Record<AuditSheetColumn, keyof AuditEvent> = {
  event_id: "eventId",
  at: "at",
  actor_email: "actorEmail",
  actor_role: "actorRole",
  owner_email: "ownerEmail",
  entity_id: "entityId",
  action: "action",
  module_ids: "moduleIds",
  draft_revision: "draftRevision",
  summary: "summary",
};

let fileRootOverride: string | null = null;
let chain: Promise<unknown> = Promise.resolve();
let preparedSheet: { key: string; header: Promise<string[]> } | null = null;

export function clearAuditSheetCache(): void {
  preparedSheet = null;
}

export function setAuditStoreTestHooks(hooks: { dir: string } | null): void {
  fileRootOverride = hooks?.dir ?? null;
  chain = Promise.resolve();
  clearAuditSheetCache();
}

export type AuditWrite = {
  at?: string;
  actorEmail: string;
  actorRole: AuditRole;
  ownerEmail: string;
  entityId: string;
  action: AuditAction;
  moduleIds?: string | readonly string[];
  draftRevision?: number | "";
  summary: string;
};

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

function withLock<T>(run: () => Promise<T>): Promise<T> {
  const current = chain.then(run, run);
  chain = current.then(
    () => undefined,
    () => undefined,
  );
  return current;
}

function primaryFile(): string {
  if (fileRootOverride) return path.join(fileRootOverride, FILE_NAME);
  return path.join(getFileFallbackDir(), FILE_NAME);
}

function tmpFile(): string {
  return path.join(tmpdir(), "gobd-data", FILE_NAME);
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
  return id;
}

function sheetsUnavailable(error: unknown): never {
  if (isSheetsOutage(error)) throw error;
  throw new SheetsUnavailableError(sheetsStatusCode(error));
}

function cell(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return "";
}

function headerField(header: string): keyof AuditEvent | null {
  const key = header.trim().toLowerCase() as AuditSheetColumn;
  return FIELDS[key] ?? null;
}

export function auditSheetValues(event: AuditEvent, header: readonly string[]): string[] {
  return header.map((column) => {
    const field = headerField(column);
    if (!field) return "";
    return cell(event[field]);
  });
}

function parseAudit(header: readonly string[], row: readonly string[]): AuditEvent | null {
  const picked: Partial<Record<keyof AuditEvent, string>> = {};
  header.forEach((column, index) => {
    const field = headerField(column);
    if (!field) return;
    picked[field] = row[index] ?? "";
  });
  const action = picked.action ?? "";
  const role = picked.actorRole ?? "";
  if (!isAuditAction(action)) return null;
  if (role !== "owner" && role !== "member") return null;
  const eventId = (picked.eventId ?? "").trim();
  const entityId = (picked.entityId ?? "").trim();
  if (!eventId || !entityId) return null;
  const revisionRaw = (picked.draftRevision ?? "").trim();
  const revision = revisionRaw === "" ? "" : Number(revisionRaw);
  return {
    eventId,
    at: (picked.at ?? "").trim(),
    actorEmail: (picked.actorEmail ?? "").trim().toLowerCase(),
    actorRole: role,
    ownerEmail: (picked.ownerEmail ?? "").trim().toLowerCase(),
    entityId,
    action,
    moduleIds: normalizeAuditModules(picked.moduleIds ?? ""),
    draftRevision: typeof revision === "number" && Number.isFinite(revision) ? revision : "",
    summary: clipSummary(picked.summary ?? ""),
  };
}

async function readFileRows(file: string): Promise<AuditEvent[]> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => coerceAudit(item))
      .filter((row): row is AuditEvent => Boolean(row));
  } catch {
    return [];
  }
}

function coerceAudit(item: unknown): AuditEvent | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Partial<AuditEvent>;
  return parseAudit(AUDIT_SHEET_COLUMNS, [
    cell(row.eventId),
    cell(row.at),
    cell(row.actorEmail),
    cell(row.actorRole),
    cell(row.ownerEmail),
    cell(row.entityId),
    cell(row.action),
    cell(row.moduleIds),
    cell(row.draftRevision),
    cell(row.summary),
  ]);
}

async function writeFileRows(file: string, rows: AuditEvent[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

async function readAllFileRows(): Promise<AuditEvent[]> {
  const primary = await readFileRows(primaryFile());
  if (fileRootOverride) return primary;
  const fallback = tmpFile();
  if (fallback === primaryFile()) return primary;
  const extra = await readFileRows(fallback);
  const map = new Map<string, AuditEvent>();
  for (const row of [...primary, ...extra]) map.set(row.eventId, row);
  return [...map.values()];
}

async function writeFileStore(rows: AuditEvent[]): Promise<void> {
  const file = primaryFile();
  try {
    await writeFileRows(file, rows);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const fallback = tmpFile();
    if (!fileRootOverride && (code === "EROFS" || code === "EACCES" || code === "EPERM") && file !== fallback) {
      await writeFileRows(fallback, rows);
      return;
    }
    throw error;
  }
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

/**
 * Legt den Tab an, wenn er fehlt, und schreibt die Kopfzeile genau einmal.
 * Parallele Aufrufe teilen sich denselben Lauf. Ein zweiter Lauf nutzt den Cache.
 * „already exists“ ist kein Fehler: ein anderer Prozess war schneller.
 */
export function ensureAuditSheet(): Promise<string[]> {
  const tab = getAuditSheetsTab();
  const id = spreadsheetId();
  const key = `${id}:${tab}`;
  if (preparedSheet?.key === key) return preparedSheet.header;
  const pending = openAuditSheet(tab, id).then(
    (header) => header,
    (error: unknown) => {
      if (preparedSheet?.header === pending) preparedSheet = null;
      throw error;
    },
  );
  preparedSheet = { key, header: pending };
  return pending;
}

async function openAuditSheet(tab: string, id: string): Promise<string[]> {
  const sheets = createSheetsClient();
  const meta = await retrySheetsCall("audit.meta", () => sheets.spreadsheets.get({ spreadsheetId: id }));
  const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === tab);
  if (!exists) {
    await retrySheetsCall("audit.addSheet", async () => {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: id,
          requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
        });
      } catch (error) {
        if (!sheetAlreadyExists(error)) throw error;
      }
    });
  }
  const existing = await retrySheetsCall("audit.header", () =>
    sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A1:AZ1` }, SHEETS_GET_OPTS),
  );
  const header = (existing.data.values?.[0] ?? []).map((item) => String(item));
  if (header.length === 0) {
    await retrySheetsCall("audit.header", () =>
      sheets.spreadsheets.values.append({
        spreadsheetId: id,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [AUDIT_SHEET_COLUMNS as unknown as string[]] },
      }),
    );
    return [...AUDIT_SHEET_COLUMNS];
  }
  const missing = AUDIT_SHEET_COLUMNS.filter(
    (column) => !header.some((cellName) => headerField(cellName) === FIELDS[column]),
  );
  if (missing.length === 0) return header;
  const next = [...header, ...missing];
  await retrySheetsCall("audit.header", () =>
    sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [next] },
    }),
  );
  return next;
}

async function readSheetRows(): Promise<AuditEvent[]> {
  const header = await ensureAuditSheet();
  const tab = getAuditSheetsTab();
  const sheets = createSheetsClient();
  const result = await retrySheetsCall("audit.values", () =>
    sheets.spreadsheets.values.get(
      { spreadsheetId: spreadsheetId(), range: `${tab}!A2:AZ` },
      SHEETS_GET_OPTS,
    ),
  );
  const rowNumbers = new Map<string, number>();
  const rows: AuditEvent[] = [];
  (result.data.values ?? []).forEach((row, index) => {
    if (!row.some((item) => String(item ?? "").trim())) return;
    const parsed = parseAudit(header, row.map((item) => String(item ?? "")));
    if (!parsed) return;
    rows.push(parsed);
    if (!rowNumbers.has(parsed.eventId)) rowNumbers.set(parsed.eventId, index + 2);
  });
  lastSheetRowNumbers = rowNumbers;
  return rows;
}

/**
 * Row numbers from the latest full read. recordAudit reads the sheet right
 * before it replaces a row, so the replace can reuse that position instead of
 * reading the whole tab a second time.
 */
let lastSheetRowNumbers = new Map<string, number>();

async function appendSheetRow(row: AuditEvent): Promise<void> {
  const header = await ensureAuditSheet();
  const sheets = createSheetsClient();
  await retrySheetsCall("audit.append", () =>
    sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId(),
      range: `${getAuditSheetsTab()}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [auditSheetValues(row, header)] },
    }),
  );
}

async function updateSheetRow(row: AuditEvent, rowNumber?: number): Promise<boolean> {
  const header = await ensureAuditSheet();
  const sheets = createSheetsClient();
  const tab = getAuditSheetsTab();
  const id = spreadsheetId();
  if (rowNumber && rowNumber >= 2) {
    await retrySheetsCall("audit.update", () =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: id,
        requestBody: {
          valueInputOption: "RAW",
          data: [{ range: `${tab}!A${rowNumber}`, values: [auditSheetValues(row, header)] }],
        },
      }),
    );
    return true;
  }
  const result = await retrySheetsCall("audit.values", () =>
    sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A2:AZ` }, SHEETS_GET_OPTS),
  );
  const values = result.data.values ?? [];
  const updates: Array<{ range: string; values: string[][] }> = [];
  for (let index = 0; index < values.length; index += 1) {
    const current = parseAudit(header, (values[index] ?? []).map((item) => String(item ?? "")));
    if (!current || current.eventId !== row.eventId) continue;
    updates.push({ range: `${tab}!A${index + 2}`, values: [auditSheetValues(row, header)] });
  }
  if (updates.length === 0) return false;
  await retrySheetsCall("audit.update", () =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: id,
      requestBody: { valueInputOption: "RAW", data: updates },
    }),
  );
  return true;
}

async function loadRows(): Promise<AuditEvent[]> {
  lastSheetRowNumbers = new Map();
  if (fileRootOverride) return readAllFileRows();
  if (isSheetsConfigured()) {
    try {
      const sheetRows = await readSheetRows();
      if (isVercelRuntime()) return sheetRows;
      const map = new Map<string, AuditEvent>();
      for (const row of [...sheetRows, ...(await readAllFileRows())]) map.set(row.eventId, row);
      return [...map.values()];
    } catch (error) {
      if (isVercelRuntime()) sheetsUnavailable(error);
      console.error(
        "[audit] Google Sheets lesen fehlgeschlagen — falle auf Datei zurück",
        error instanceof Error ? error.name : "error",
      );
    }
  } else if (isVercelRuntime()) {
    throw new SheetsUnavailableError(0);
  }
  return readAllFileRows();
}

async function persist(
  rows: AuditEvent[],
  changed: AuditEvent,
  mode: "insert" | "replace",
  rowNumber?: number,
): Promise<void> {
  if (fileRootOverride) {
    await writeFileStore(rows);
    return;
  }
  if (isSheetsConfigured()) {
    try {
      if (mode === "insert") await appendSheetRow(changed);
      else {
        const updated = await updateSheetRow(changed, rowNumber);
        if (!updated) await appendSheetRow(changed);
      }
      if (!isVercelRuntime()) {
        try {
          await writeFileStore(rows);
        } catch (error) {
          console.warn(
            "[audit] Datei nach Sheets-Schreiben nicht geschrieben",
            error instanceof Error ? error.name : "error",
          );
        }
      }
      return;
    } catch (error) {
      if (isVercelRuntime()) sheetsUnavailable(error);
      console.error(
        "[audit] Google Sheets schreiben fehlgeschlagen — falle auf Datei zurück",
        error instanceof Error ? error.name : "error",
      );
    }
  } else if (isVercelRuntime()) {
    throw new SheetsUnavailableError(0);
  }
  await writeFileStore(rows);
}

export async function recordAudit(input: AuditWrite): Promise<AuditEvent> {
  return withLock(async () => {
    const atDate = input.at ? new Date(input.at) : new Date();
    const at = Number.isNaN(atDate.getTime()) ? new Date().toISOString() : atDate.toISOString();
    const moduleIds = normalizeAuditModules(input.moduleIds ?? "");
    const summary = clipSummary(input.summary);
    const actorEmail = input.actorEmail.trim().toLowerCase();
    const entityId = input.entityId.trim();
    const rows = await loadRows();
    if (input.action === "draft.saved") {
      const match = [...rows].reverse().find((row) => {
        if (!sameDraftSavedBundle(row, { actorEmail, entityId, moduleIds })) return false;
        const start = Date.parse(row.at);
        if (Number.isNaN(start)) return false;
        const age = atDate.getTime() - start;
        return age >= 0 && age < DRAFT_SAVED_WINDOW_MS;
      });
      if (match) {
        const updated: AuditEvent = {
          ...match,
          draftRevision: input.draftRevision ?? "",
          summary,
        };
        const next = rows.map((row) => (row.eventId === match.eventId ? updated : row));
        await persist(next, updated, "replace", lastSheetRowNumbers.get(match.eventId));
        return updated;
      }
    }
    const event: AuditEvent = {
      eventId: randomUUID(),
      at,
      actorEmail,
      actorRole: input.actorRole,
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      entityId,
      action: input.action,
      moduleIds,
      draftRevision: input.draftRevision ?? "",
      summary,
    };
    await persist([...rows, event], event, "insert");
    return event;
  });
}

/** Alle gespeicherten Zeilen dieser Firma, auch die, die nicht mehr ausgeliefert werden. */
export async function listAuditStored(entityId: string): Promise<AuditEvent[]> {
  const id = entityId.trim();
  const rows = await loadRows();
  return rows.filter((row) => row.entityId === id);
}

export async function listAuditForEntity(entityId: string, now = new Date()): Promise<AuditEvent[]> {
  const rows = await listAuditStored(entityId);
  return rows
    .filter((row) => auditDeliverable(row, now))
    .sort((a, b) => b.at.localeCompare(a.at) || b.eventId.localeCompare(a.eventId));
}

export async function readAuditPage(
  entityId: string,
  offset: number,
  now = new Date(),
): Promise<{ entries: AuditListItem[]; nextOffset: number | null }> {
  const all = await listAuditForEntity(entityId, now);
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const slice = all.slice(start, start + AUDIT_PAGE_SIZE);
  const next = start + slice.length;
  return {
    entries: slice.map(toAuditListItem),
    nextOffset: next < all.length ? next : null,
  };
}

/** Löschlauf v3: alle gespeicherten Zeilen (nur lesen). */
export async function listAllAuditStored(): Promise<AuditEvent[]> {
  return loadRows();
}

/**
 * Löschlauf v3: eine Zeile schwärzen (Zeile bleibt, damit Zeilennummern
 * stabil bleiben). Der Aufrufer liefert die geschwärzte Fassung.
 */
export async function replaceAuditEventForRetention(redacted: AuditEvent): Promise<boolean> {
  return withLock(async () => {
    const rows = await loadRows();
    if (!rows.some((row) => row.eventId === redacted.eventId)) return false;
    const next = rows.map((row) => (row.eventId === redacted.eventId ? redacted : row));
    await persist(next, redacted, "replace", lastSheetRowNumbers.get(redacted.eventId));
    return true;
  });
}
