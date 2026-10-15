import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getMembershipsSheetsTab, isSheetsConfigured } from "@/lib/env";
import {
  coerceMembership,
  MEMBERSHIP_SHEET_COLUMNS,
  membershipFieldForHeader,
  membershipSheetValues,
  parseMembership,
  sameMembershipPair,
  isOpenMembership,
  type Membership,
} from "@/lib/memberships";
import { createSheetsClient } from "@/lib/sheets-client";
import {
  createTtlSingleflight,
  retrySheetsCall,
  SheetsUnavailableError,
  isSheetsOutage,
  sheetsStatusCode,
} from "@/lib/sheets-outage";
import { getFileFallbackDir } from "@/lib/store";

const FILE_NAME = "memberships.json";

const SHEETS_GET_OPTS = {
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
} as const;

let fileRootOverride: string | null = null;
let chain: Promise<unknown> = Promise.resolve();

/** Short enough that a new invitation shows up, long enough to absorb a 429 burst. */
const MEMBERSHIP_READ_TTL_MS = 10_000;
const membershipRowsCache = createTtlSingleflight<Membership[]>(MEMBERSHIP_READ_TTL_MS);

export function clearMembershipReadCache(): void {
  membershipRowsCache.clear();
}

/** Isoliertes Verzeichnis für die Prüfung. Kein Sheet, kein Produktionspfad. */
export function setMembershipStoreTestHooks(hooks: { dir: string } | null): void {
  fileRootOverride = hooks?.dir ?? null;
  chain = Promise.resolve();
  clearMembershipReadCache();
}

export class MembershipConflictError extends Error {
  readonly code = "conflict" as const;

  constructor() {
    super("Für diese Person liegt bereits eine Mitgliedschaft vor.");
    this.name = "MembershipConflictError";
  }
}

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

async function readFileRows(file: string): Promise<Membership[]> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => coerceMembership(item))
      .filter((row): row is Membership => Boolean(row));
  } catch {
    return [];
  }
}

async function writeFileRows(file: string, rows: Membership[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

async function readAllFileRows(): Promise<Membership[]> {
  const primary = await readFileRows(primaryFile());
  if (fileRootOverride) return primary;
  const fallback = tmpFile();
  if (fallback === primaryFile()) return primary;
  const extra = await readFileRows(fallback);
  return mergeRows(primary, extra);
}

function mergeRows(primary: Membership[], extra: Membership[]): Membership[] {
  const map = new Map<string, Membership>();
  for (const row of [...primary, ...extra]) {
    const prev = map.get(row.membershipId);
    if (!prev || row.updatedAt.localeCompare(prev.updatedAt) >= 0) {
      map.set(row.membershipId, row);
    }
  }
  return [...map.values()];
}

async function writeFileStore(rows: Membership[]): Promise<void> {
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

async function ensureHeader(): Promise<string[]> {
  const tab = getMembershipsSheetsTab();
  const sheets = createSheetsClient();
  const id = spreadsheetId();
  const meta = await retrySheetsCall("memberships.meta", () =>
    sheets.spreadsheets.get({ spreadsheetId: id }),
  );
  const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === tab);
  if (!exists) {
    await retrySheetsCall("memberships.addSheet", () =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      }),
    );
  }
  const existing = await retrySheetsCall("memberships.header", () =>
    sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A1:AZ1` }, SHEETS_GET_OPTS),
  );
  const header = (existing.data.values?.[0] ?? []).map((cell) => String(cell));
  if (header.length === 0) {
    await retrySheetsCall("memberships.header", () =>
      sheets.spreadsheets.values.append({
        spreadsheetId: id,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [MEMBERSHIP_SHEET_COLUMNS as unknown as string[]] },
      }),
    );
    return [...MEMBERSHIP_SHEET_COLUMNS];
  }
  const missing = MEMBERSHIP_SHEET_COLUMNS.filter((col) => {
    const field = membershipFieldForHeader(col);
    if (!field) return true;
    return !header.some((cell) => membershipFieldForHeader(cell) === field);
  });
  if (missing.length === 0) return header;
  const next = [...header, ...missing];
  await retrySheetsCall("memberships.header", () =>
    sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [next] },
    }),
  );
  return next;
}

async function readMembershipSheet(): Promise<Membership[]> {
  const header = await ensureHeader();
  const tab = getMembershipsSheetsTab();
  const sheets = createSheetsClient();
  const result = await retrySheetsCall("memberships.values", () =>
    sheets.spreadsheets.values.get(
      { spreadsheetId: spreadsheetId(), range: `${tab}!A2:AZ` },
      SHEETS_GET_OPTS,
    ),
  );
  return (result.data.values ?? [])
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => parseMembership(header, row.map((cell) => String(cell ?? ""))))
    .filter((row): row is Membership => Boolean(row));
}

async function readSheetRows(fresh = false): Promise<Membership[]> {
  return membershipRowsCache.read(readMembershipSheet, fresh);
}

async function appendSheetRow(row: Membership): Promise<void> {
  const header = await ensureHeader();
  const sheets = createSheetsClient();
  await retrySheetsCall("memberships.append", () =>
    sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId(),
      range: `${getMembershipsSheetsTab()}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [membershipSheetValues(row, header)] },
    }),
  );
  clearMembershipReadCache();
}

async function updateSheetRow(row: Membership): Promise<boolean> {
  const header = await ensureHeader();
  const sheets = createSheetsClient();
  const tab = getMembershipsSheetsTab();
  const id = spreadsheetId();
  const result = await retrySheetsCall("memberships.values", () =>
    sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A2:AZ` }, SHEETS_GET_OPTS),
  );
  const values = result.data.values ?? [];
  const updates: Array<{ range: string; values: string[][] }> = [];
  for (let index = 0; index < values.length; index += 1) {
    const current = parseMembership(
      header,
      (values[index] ?? []).map((cell) => String(cell ?? "")),
    );
    if (!current || current.membershipId !== row.membershipId) continue;
    updates.push({
      range: `${tab}!A${index + 2}`,
      values: [membershipSheetValues(row, header)],
    });
  }
  if (updates.length === 0) return false;
  await retrySheetsCall("memberships.update", () =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: id,
      requestBody: { valueInputOption: "RAW", data: updates },
    }),
  );
  clearMembershipReadCache();
  return true;
}

async function loadRows(fresh = false): Promise<Membership[]> {
  if (fileRootOverride) return readAllFileRows();
  if (isSheetsConfigured()) {
    try {
      const sheetRows = await readSheetRows(fresh);
      if (isVercelRuntime()) return sheetRows;
      return mergeRows(sheetRows, await readAllFileRows());
    } catch (error) {
      if (isVercelRuntime()) sheetsUnavailable(error);
      console.error(
        "[memberships] Google Sheets lesen fehlgeschlagen — falle auf Datei zurück",
        error instanceof Error ? error.name : "error",
      );
    }
  } else if (isVercelRuntime()) {
    throw new SheetsUnavailableError(0);
  }
  return readAllFileRows();
}

async function persist(rows: Membership[], changed: Membership, mode: "insert" | "replace"): Promise<void> {
  if (fileRootOverride) {
    await writeFileStore(rows);
    return;
  }
  if (isSheetsConfigured()) {
    try {
      if (mode === "insert") {
        await appendSheetRow(changed);
      } else {
        const updated = await updateSheetRow(changed);
        if (!updated) await appendSheetRow(changed);
      }
      if (!isVercelRuntime()) {
        try {
          await writeFileStore(rows);
        } catch (error) {
          console.warn(
            "[memberships] Datei nach Sheets-Schreiben nicht geschrieben",
            error instanceof Error ? error.name : "error",
          );
        }
      }
      return;
    } catch (error) {
      if (isVercelRuntime()) sheetsUnavailable(error);
      console.error(
        "[memberships] Google Sheets schreiben fehlgeschlagen — falle auf Datei zurück",
        error instanceof Error ? error.name : "error",
      );
    }
  } else if (isVercelRuntime()) {
    throw new SheetsUnavailableError(0);
  }
  await writeFileStore(rows);
}

export async function listMemberships(options?: { fresh?: boolean }): Promise<Membership[]> {
  return loadRows(options?.fresh ?? false);
}

export async function listMembershipsByMember(
  email: string,
  options?: { fresh?: boolean },
): Promise<Membership[]> {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];
  const rows = await listMemberships(options);
  return rows.filter((row) => row.memberEmail === needle);
}

/** Aktive Mitgliedschaft dieser Mail an genau dieser Firma. Jeder Schreibzugriff liest neu. */
export async function findActiveMembership(
  memberEmail: string,
  entityId: string,
): Promise<Membership | null> {
  const id = entityId.trim();
  if (!id) return null;
  const rows = await listMembershipsByMember(memberEmail, { fresh: true });
  return rows.find((row) => row.status === "active" && row.entityId === id) ?? null;
}

export async function listMembershipsByEntity(entityId: string): Promise<Membership[]> {
  const id = entityId.trim();
  if (!id) return [];
  const rows = await listMemberships();
  return rows.filter((row) => row.entityId === id);
}

export async function getMembership(membershipId: string): Promise<Membership | null> {
  const id = membershipId.trim();
  if (!id) return null;
  const rows = await listMemberships();
  return rows.find((row) => row.membershipId === id) ?? null;
}

export async function insertMembership(row: Membership): Promise<Membership> {
  return withLock(async () => {
    const rows = await loadRows();
    if (rows.some((item) => item.membershipId === row.membershipId)) {
      throw new MembershipConflictError();
    }
    if (
      isOpenMembership(row) &&
      rows.some(
        (item) =>
          isOpenMembership(item) && sameMembershipPair(item, row.memberEmail, row.entityId),
      )
    ) {
      throw new MembershipConflictError();
    }
    const next = [...rows, row];
    await persist(next, row, "insert");
    return row;
  });
}

export async function replaceMembership(row: Membership): Promise<Membership | null> {
  return withLock(async () => {
    const rows = await loadRows();
    const index = rows.findIndex((item) => item.membershipId === row.membershipId);
    if (index < 0) return null;
    if (
      isOpenMembership(row) &&
      rows.some(
        (item) =>
          item.membershipId !== row.membershipId &&
          isOpenMembership(item) &&
          sameMembershipPair(item, row.memberEmail, row.entityId),
      )
    ) {
      throw new MembershipConflictError();
    }
    const next = rows.slice();
    next[index] = row;
    await persist(next, row, "replace");
    return row;
  });
}
