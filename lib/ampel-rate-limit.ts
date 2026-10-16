import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ipAddress } from "@vercel/functions/headers";
import { getAmpelRateSheetsTab, isSheetsConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import { getFileFallbackDir } from "@/lib/store";

export const AMPEL_IP_LIMIT = 5;
export const AMPEL_IP_WINDOW_MS = 60 * 60 * 1000;
export const AMPEL_EMAIL_LIMIT = 3;
export const AMPEL_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Hashed IP, timestamps, and request counts. [Default, Philip prüft] */
export const AMPEL_RATE_RETENTION_DAYS = 7;
export const AMPEL_RATE_RETENTION_MS = AMPEL_RATE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type AmpelRateDecision = "ok" | "ip" | "email";

export type AmpelRateHold = {
  ipSlot: number;
  emailSlot: number;
  /** Rows returned by the confirming `values.get`. */
  rows?: number;
  /** Rows in that read with the same IP hash and window. */
  match?: number;
};

export type AmpelRateConfirm = "ok" | "ip" | "email" | "missing";

export type AmpelRateOrigin = "sheets" | "file" | "memory" | "closed";

export type AmpelRateStore = {
  /** Which counter actually ran. Missing means an injected test store. */
  origin?: AmpelRateOrigin;
  take(input: { ipKey: string; emailKey: string; now: number; hold?: AmpelRateHold }): Promise<AmpelRateDecision>;
  /** Checks the position reserved by `take`. Does not append another row. */
  confirm(input: {
    ipKey: string;
    emailKey: string;
    now: number;
    ipSlot: number;
    emailSlot: number;
  }): Promise<AmpelRateConfirm>;
};

type Ledger = Record<string, number[]>;

const IP_HEADER_SOURCES = ["x-real-ip", "x-vercel-forwarded-for", "x-forwarded-for"] as const;

export type AmpelIpSource = (typeof IP_HEADER_SOURCES)[number] | "";

export type AmpelRateTrace =
  | { kind: "sheets"; pos: number; win: number; rows: number; match: number }
  | { kind: "limit"; pos: number; rows?: number; match?: number }
  | { kind: "failopen"; err: string }
  | { kind: "skip"; reason: string };

function firstHeaderValue(value: string | null | undefined): string {
  if (!value) return "";
  const first = value.split(",")[0]?.trim() ?? "";
  if (!first || first.length > 80 || first.toLowerCase() === "unknown") return "";
  return first;
}

function requestHeaders(input: Request | Headers): Headers {
  if (input instanceof Headers) return input;
  return input.headers;
}

/**
 * `ipAddress()` reads `x-real-ip`, the client address Vercel calculated.
 * `x-vercel-forwarded-for` is only the next choice: its first hop can change
 * while that address stays the same. An empty or `unknown` value is not an address.
 */
export function readAmpelClientIp(input: Request | Headers): { ip: string; source: AmpelIpSource } {
  const headers = requestHeaders(input);
  const fromIpAddress = firstHeaderValue(ipAddress(input));
  if (fromIpAddress) return { ip: fromIpAddress, source: "x-real-ip" };
  for (const source of ["x-vercel-forwarded-for", "x-forwarded-for"] as const) {
    const ip = firstHeaderValue(headers.get(source));
    if (ip) return { ip, source };
  }
  return { ip: "", source: "" };
}

export function ampelClientIp(input: Request | Headers): string {
  return readAmpelClientIp(input).ip;
}

function headerToken(value: string): string {
  return value.replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "unknown";
}

function headerCount(value: number): number {
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : 0;
}

function countSuffix(rows: number | undefined, match: number | undefined): string {
  if (typeof rows !== "number" || typeof match !== "number") return "";
  return `;rows=${headerCount(rows)};match=${headerCount(match)}`;
}

/** `x-ampel-rl` names the path. It never carries the address or the IP header name. */
export function ampelRateResponseHeader(trace: AmpelRateTrace): string {
  if (trace.kind === "sheets") {
    const win = Number.isInteger(trace.win) && trace.win >= 0 && trace.win <= 10_000_000 ? trace.win : 0;
    return `src=sheets;pos=${headerCount(trace.pos)};win=${win}${countSuffix(trace.rows, trace.match)}`;
  }
  if (trace.kind === "limit") return `src=limit;pos=${headerCount(trace.pos)}${countSuffix(trace.rows, trace.match)}`;
  if (trace.kind === "failopen") return `src=failopen;err=${headerToken(trace.err)}`;
  return `src=skip;reason=${headerToken(trace.reason)}`;
}

/** One PII-free line: header source, slot number, and a hash of the address. */
export function ampelRateLogLine(source: string, slot: number, ip: string): string {
  const hash = createHash("sha256").update(ip || "none").digest("hex").slice(0, 12);
  const safeSlot = Number.isInteger(slot) && slot > 0 ? slot : 0;
  const safeSource = (IP_HEADER_SOURCES as readonly string[]).includes(source) ? source : "none";
  return `[ampel] rate src=${safeSource} slot=${safeSlot} ip=${hash}`;
}

/** Stores a hash, never the raw address. */
export function ampelRateIpKey(ip: string): string {
  return `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
}

export function pruneAmpelRateLedger(
  ledger: Ledger,
  now: number,
  retentionMs = AMPEL_RATE_RETENTION_MS,
): Ledger {
  const next: Ledger = {};
  for (const [key, stamps] of Object.entries(ledger)) {
    const fresh = stamps.filter((at) => now - at < retentionMs);
    if (fresh.length > 0) next[key] = fresh;
  }
  return next;
}

export function judgeAmpelRate(
  hits: { ip: number[]; email: number[] },
  now: number,
): { decision: AmpelRateDecision; ip: number[]; email: number[] } {
  const ipWindow = Math.min(AMPEL_IP_WINDOW_MS, AMPEL_RATE_RETENTION_MS);
  const emailWindow = Math.min(AMPEL_EMAIL_WINDOW_MS, AMPEL_RATE_RETENTION_MS);
  const ip = hits.ip.filter((at) => now - at < ipWindow);
  const email = hits.email.filter((at) => now - at < emailWindow);
  if (ip.length >= AMPEL_IP_LIMIT) return { decision: "ip", ip, email };
  if (email.length >= AMPEL_EMAIL_LIMIT) return { decision: "email", ip, email };
  ip.push(now);
  email.push(now);
  return { decision: "ok", ip, email };
}


/**
 * Logs a rate-store problem. `reason` is a fixed token. The error name is
 * kept; the message is not, so an address cannot leak into the line.
 */
export function logAmpelRateFailure(reason: string, error?: unknown): void {
  const safeReason = reason.replace(/[^a-z0-9-]/gi, "").slice(0, 48);
  const name = error instanceof Error ? error.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 48) : "";
  const detail = name ? `reason=${safeReason};name=${name}` : `reason=${safeReason}`;
  console.error("[ampel] Rate-Limit fehlgeschlagen", detail);
}

export function ampelRateWindowId(now: number, windowMs: number): number {
  return Math.floor(now / windowMs);
}

/**
 * One row on `ampel_rate`: IP hash, IP window, timestamp, request id,
 * then the email hash and email window. Sheets appends are serialized, so
 * the returned row number is a total order. Rows are not deleted.
 */
export const AMPEL_RATE_SHEET_COLUMNS = [
  "key_hash",
  "window_id",
  "at",
  "request_id",
  "email_hash",
  "email_window",
] as const;

const SHEETS_GET_OPTS = {
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
} as const;

/** sha256 of the logical key. The IP key is already a hash. No plaintext address or email. */
export function ampelRateStoredHash(logicalKey: string): string {
  return createHash("sha256").update(logicalKey).digest("hex").slice(0, 32);
}

const REQUEST_ID_COLUMN = 3;

type AmpelRateCell = {
  userEnteredValue?: { stringValue?: string | null; numberValue?: number | null } | null;
  formattedValue?: string | null;
};

type AmpelRateGridSheet = {
  properties?: { title?: string | null; sheetId?: number | null } | null;
  data?: Array<{
    rowData?: Array<{ values?: Array<AmpelRateCell | null> | null } | null> | null;
  } | null> | null;
};

export type AmpelRateUpdatedSpreadsheet = {
  sheets?: Array<AmpelRateGridSheet | null> | null;
};

/**
 * How many matching rows sit at or before this attempt's request id.
 * Rows after that id were committed later. The id itself has to be in the
 * grid; a missing id means this snapshot does not contain the append.
 */
export function ampelRateCountThroughRequest(
  rows: readonly (readonly string[])[],
  keyColumn: number,
  windowColumn: number,
  keyHash: string,
  windowId: number,
  requestId: string,
): number | null {
  const windowText = String(windowId);
  let ownIndex = -1;
  for (let index = 0; index < rows.length; index += 1) {
    if ((rows[index]?.[REQUEST_ID_COLUMN] ?? "") === requestId) {
      ownIndex = index;
      break;
    }
  }
  if (ownIndex < 0) return null;
  let count = 0;
  for (let index = 0; index <= ownIndex; index += 1) {
    const row = rows[index] ?? [];
    if ((row[keyColumn] ?? "") === keyHash && (row[windowColumn] ?? "") === windowText) count += 1;
  }
  return count;
}

function cellText(cell: AmpelRateCell | null | undefined): string {
  const entered = cell?.userEnteredValue;
  if (typeof entered?.stringValue === "string") return entered.stringValue;
  if (typeof entered?.numberValue === "number" && Number.isFinite(entered.numberValue)) return String(entered.numberValue);
  const effective = cell && "effectiveValue" in cell ? (cell as { effectiveValue?: { stringValue?: string | null; numberValue?: number | null } | null }).effectiveValue : null;
  if (typeof effective?.stringValue === "string") return effective.stringValue;
  if (typeof effective?.numberValue === "number" && Number.isFinite(effective.numberValue)) return String(effective.numberValue);
  if (typeof cell?.formattedValue === "string") return cell.formattedValue;
  return "";
}

/** `values.get` cells: strings stay strings, numbers are not locale-formatted. */
export function ampelRateCellString(cell: unknown): string {
  if (typeof cell === "string") return cell;
  if (typeof cell === "number" && Number.isFinite(cell)) return String(cell);
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return "";
}

export function ampelRateRowsFromValues(values: readonly (readonly unknown[])[] | null | undefined): string[][] {
  return (values ?? []).map((row) => (row ?? []).map((cell) => ampelRateCellString(cell)));
}

/** Every row in the read with this hash and window, including rows after our own. */
export function ampelRateMatchCount(
  rows: readonly (readonly string[])[],
  keyColumn: number,
  windowColumn: number,
  keyHash: string,
  windowId: number,
): number {
  const windowText = String(windowId);
  let count = 0;
  for (const row of rows) {
    if ((row?.[keyColumn] ?? "") === keyHash && (row?.[windowColumn] ?? "") === windowText) count += 1;
  }
  return count;
}

/** Data rows from the append response, in sheet order. Null when the grid is missing. */
export function ampelRateRowsFromUpdate(
  spreadsheet: AmpelRateUpdatedSpreadsheet | null | undefined,
  tab: string,
): string[][] | null {
  const sheet = spreadsheet?.sheets?.find((item) => item?.properties?.title === tab) ?? spreadsheet?.sheets?.[0];
  const rowData = sheet?.data?.[0]?.rowData;
  if (!rowData) return null;
  return rowData.map((row) => (row?.values ?? []).map((cell) => cellText(cell)));
}

export type AmpelRateSheetClient = {
  get(args: {
    spreadsheetId: string;
  }): Promise<{
    data: { sheets?: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null };
  }>;
  batchUpdate(args: {
    spreadsheetId: string;
    requestBody: {
      requests: Array<{
        addSheet?: { properties: { title: string } };
        appendCells?: {
          sheetId: number;
          fields: string;
          rows: Array<{ values: Array<{ userEnteredValue: { stringValue: string } }> }>;
        };
      }>;
      includeSpreadsheetInResponse?: boolean;
      responseIncludeGridData?: boolean;
      responseRanges?: string[];
    };
  }): Promise<{
    data: {
      replies?: Array<{ addSheet?: { properties?: { sheetId?: number | null } | null } | null } | null> | null;
      updatedSpreadsheet?: AmpelRateUpdatedSpreadsheet | null;
    };
  }>;
  valuesGet(
    args: { spreadsheetId: string; range: string; valueRenderOption?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA" },
    options?: { headers?: Record<string, string> },
  ): Promise<{ data: { values?: unknown[][] | null } | null }>;
  valuesAppend(args: {
    spreadsheetId: string;
    range: string;
    valueInputOption: "RAW";
    insertDataOption: "INSERT_ROWS";
    requestBody: { values: string[][] };
  }): Promise<{ data: { updates?: { updatedRange?: string | null } | null } | null }>;
};

let preparedSheet: { key: string; ready: Promise<number> } | null = null;

export function clearAmpelRateSheetCache(): void {
  preparedSheet = null;
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
  return id;
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

function sheetIdOf(
  sheets: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null | undefined,
  tab: string,
): number | null {
  const id = sheets?.find((sheet) => sheet?.properties?.title === tab)?.properties?.sheetId;
  return typeof id === "number" ? id : null;
}

function ensureAmpelRateSheet(client: AmpelRateSheetClient, id: string, tab: string): Promise<number> {
  const key = `${id}:${tab}`;
  if (preparedSheet?.key === key) return preparedSheet.ready;
  const pending = openAmpelRateSheet(client, id, tab).then(
    (sheetId) => sheetId,
    (error: unknown) => {
      if (preparedSheet?.ready === pending) preparedSheet = null;
      throw error;
    },
  );
  preparedSheet = { key, ready: pending };
  return pending;
}

async function openAmpelRateSheet(client: AmpelRateSheetClient, id: string, tab: string): Promise<number> {
  const meta = await client.get({ spreadsheetId: id });
  let sheetId = sheetIdOf(meta.data.sheets, tab);
  if (sheetId == null) {
    try {
      const created = await client.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      });
      sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    } catch (error) {
      if (!sheetAlreadyExists(error)) throw error;
    }
  }
  if (sheetId == null) {
    const again = await client.get({ spreadsheetId: id });
    sheetId = sheetIdOf(again.data.sheets, tab);
  }
  if (sheetId == null) throw new Error("ampel-rate-sheet");
  const header = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A1:F1` }, SHEETS_GET_OPTS);
  const first = (header.data?.values?.[0] ?? []).map((cell) => String(cell ?? "").trim());
  if (first.some((cell) => cell.length > 0)) return sheetId;
  await client.valuesAppend({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[...AMPEL_RATE_SHEET_COLUMNS]] },
  });
  return sheetId;
}

function liveAmpelRateSheetClient(): AmpelRateSheetClient {
  const sheets = createSheetsClient();
  return {
    get: (args) => sheets.spreadsheets.get(args),
    batchUpdate: (args) => sheets.spreadsheets.batchUpdate(args),
    valuesGet: (args, options) => sheets.spreadsheets.values.get(args, options),
    valuesAppend: (args) => sheets.spreadsheets.values.append(args),
  };
}

function stringCell(value: string): { userEnteredValue: { stringValue: string } } {
  return { userEnteredValue: { stringValue: value } };
}

/**
 * Appends one row, then counts a `values.get` of the whole tab.
 *
 * `AppendCellsRequest` has no reply (`Schema$Response` has no `appendCells`
 * field). `includeSpreadsheetInResponse` returns `updatedSpreadsheet`, and
 * `responseRanges` limits that snapshot. `responseIncludeGridData` is ignored
 * only when the HTTP `fields` mask is set; this call does not set one.
 * `GridData.rowData` is one entry per row starting at `startRow`, and the
 * block this append returns is the row just written. Counting that block is
 * always position 1. `values.get` on `A:F` has no end row and returns every
 * stored row. `UNFORMATTED_VALUE` keeps a numeric `window_id` as a number;
 * the count stringifies it instead of reading `formattedValue`. Position is
 * the matches at or before this request id. A missing id throws, so a
 * one-row grid is never reported as position 1. Any Sheets error is
 * rethrown so the caller still sends.
 */
export function createSheetsAmpelRateStore(client: AmpelRateSheetClient = liveAmpelRateSheetClient()): AmpelRateStore {
  const tab = getAmpelRateSheetsTab();
  return {
    origin: "sheets",
    async take({ ipKey, emailKey, now, hold }) {
      try {
        const id = spreadsheetId();
        const sheetId = await ensureAmpelRateSheet(client, id, tab);
        const ipWindow = ampelRateWindowId(now, AMPEL_IP_WINDOW_MS);
        const emailWindow = ampelRateWindowId(now, AMPEL_EMAIL_WINDOW_MS);
        const ipHash = ampelRateStoredHash(ipKey);
        const emailHash = ampelRateStoredHash(emailKey);
        const requestId = randomBytes(8).toString("hex");
        await client.batchUpdate({
          spreadsheetId: id,
          requestBody: {
            requests: [
              {
                appendCells: {
                  sheetId,
                  fields: "userEnteredValue",
                  rows: [
                    {
                      values: [
                        stringCell(ipHash),
                        stringCell(String(ipWindow)),
                        stringCell(String(now)),
                        stringCell(requestId),
                        stringCell(emailHash),
                        stringCell(String(emailWindow)),
                      ],
                    },
                  ],
                },
              },
            ],
            includeSpreadsheetInResponse: true,
            responseIncludeGridData: true,
            responseRanges: [`${tab}!A2:F`],
          },
        });
        const read = await client.valuesGet(
          { spreadsheetId: id, range: `${tab}!A:F`, valueRenderOption: "UNFORMATTED_VALUE" },
          SHEETS_GET_OPTS,
        );
        const rows = ampelRateRowsFromValues(read.data?.values);
        const emailPos = ampelRateCountThroughRequest(rows, 4, 5, emailHash, emailWindow, requestId);
        const ipPos = ampelRateCountThroughRequest(rows, 0, 1, ipHash, ipWindow, requestId);
        const match = ampelRateMatchCount(rows, 0, 1, ipHash, ipWindow);
        if (hold) {
          hold.ipSlot = ipPos ?? 0;
          hold.emailSlot = emailPos ?? 0;
          hold.rows = rows.length;
          hold.match = match;
        }
        if (emailPos == null || ipPos == null || emailPos < 1 || ipPos < 1) throw new Error("ampel-rate-position");
        if (emailPos > AMPEL_EMAIL_LIMIT) return "email";
        if (ipPos > AMPEL_IP_LIMIT) return "ip";
        return "ok";
      } catch (error) {
        logAmpelRateFailure("sheets", error);
        throw error;
      }
    },
    async confirm({ ipSlot, emailSlot }) {
      if (ipSlot < 1 || ipSlot > AMPEL_IP_LIMIT || emailSlot < 1 || emailSlot > AMPEL_EMAIL_LIMIT) return "missing";
      return "ok";
    },
  };
}


/** No shared store. A take here throws; submit logs it and still sends the mail. */
export function createClosedAmpelRateStore(): AmpelRateStore {
  return {
    origin: "closed",
    async take() {
      throw new Error("ampel-rate-unshared");
    },
    async confirm() {
      throw new Error("ampel-rate-unshared");
    },
  };
}

function ledgerConfirm(
  hits: { ip: number[]; email: number[] },
  now: number,
  ipSlot: number,
  emailSlot: number,
): AmpelRateConfirm {
  if (ipSlot < 1 || ipSlot > AMPEL_IP_LIMIT || emailSlot < 1 || emailSlot > AMPEL_EMAIL_LIMIT) return "missing";
  const ipWindow = Math.min(AMPEL_IP_WINDOW_MS, AMPEL_RATE_RETENTION_MS);
  const emailWindow = Math.min(AMPEL_EMAIL_WINDOW_MS, AMPEL_RATE_RETENTION_MS);
  const ip = hits.ip.filter((at) => now - at < ipWindow);
  const email = hits.email.filter((at) => now - at < emailWindow);
  if (ip.length === 0 || email.length === 0) return "missing";
  if (ip.length > AMPEL_IP_LIMIT) return "ip";
  if (email.length > AMPEL_EMAIL_LIMIT) return "email";
  return "ok";
}

export function createMemoryAmpelRateStore(): AmpelRateStore {
  const hits = new Map<string, number[]>();
  return {
    origin: "memory",
    async take({ ipKey, emailKey, now, hold }) {
      const judged = judgeAmpelRate(
        { ip: hits.get(ipKey) ?? [], email: hits.get(emailKey) ?? [] },
        now,
      );
      hits.set(ipKey, judged.ip);
      hits.set(emailKey, judged.email);
      if (hold) {
        hold.ipSlot = judged.ip.length;
        hold.emailSlot = judged.email.length;
      }
      return judged.decision;
    },
    async confirm({ ipKey, emailKey, now, ipSlot, emailSlot }) {
      return ledgerConfirm(
        { ip: hits.get(ipKey) ?? [], email: hits.get(emailKey) ?? [] },
        now,
        ipSlot,
        emailSlot,
      );
    },
  };
}

async function loadLedger(file: string): Promise<Ledger> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const ledger: Ledger = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      ledger[key] = value.filter((item): item is number => typeof item === "number");
    }
    return ledger;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function saveLedger(file: string, ledger: Ledger): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(ledger));
  await rename(temp, file);
}

export function createFileAmpelRateStore(file: string): AmpelRateStore {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    origin: "file",
    take(input) {
      const run = chain.then(async () => {
        const ledger = pruneAmpelRateLedger(await loadLedger(file), input.now);
        const judged = judgeAmpelRate(
          { ip: ledger[input.ipKey] ?? [], email: ledger[input.emailKey] ?? [] },
          input.now,
        );
        if (judged.ip.length > 0) ledger[input.ipKey] = judged.ip;
        else delete ledger[input.ipKey];
        if (judged.email.length > 0) ledger[input.emailKey] = judged.email;
        else delete ledger[input.emailKey];
        await saveLedger(file, ledger);
        if (input.hold) {
          input.hold.ipSlot = judged.ip.length;
          input.hold.emailSlot = judged.email.length;
        }
        return judged.decision;
      }, async () => {
        throw new Error("ampel-rate-chain");
      });
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    async confirm(input) {
      const ledger = await loadLedger(file);
      return ledgerConfirm(
        { ip: ledger[input.ipKey] ?? [], email: ledger[input.emailKey] ?? [] },
        input.now,
        input.ipSlot,
        input.emailSlot,
      );
    },
  };
}

let sharedStore: AmpelRateStore | null = null;

function vercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

export function clearAmpelRateStoreCache(): void {
  sharedStore = null;
}

export function ampelRateStore(): AmpelRateStore {
  if (!sharedStore) {
    const file = path.join(getFileFallbackDir(), "ampel-rate.json");
    if (automatedRunForbidsLiveWrites()) sharedStore = createFileAmpelRateStore(file);
    else if (isSheetsConfigured()) sharedStore = createSheetsAmpelRateStore();
    else if (vercelRuntime()) sharedStore = createClosedAmpelRateStore();
    else sharedStore = createFileAmpelRateStore(file);
  }
  return sharedStore;
}
