import { getKanzleiToolboxSheetsTab, isSheetsConfigured } from "@/lib/env";
import {
  KANZLEI_PURGE_KINDS,
  KANZLEI_TOOLBOX_SHEET_ENABLED,
  KANZLEI_TOOLBOX_STATUSES,
  emptyKanzleiFile,
  emptyKanzleiVerification,
  isKanzleiId,
  isKanzleiSlug,
  type KanzleiAttribution,
  type KanzleiBlockEntry,
  type KanzleiConsentProof,
  type KanzleiCountRow,
  type KanzleiDevice,
  type KanzleiPurgeKind,
  type KanzleiPurgeLogRow,
  type KanzleiToolboxFile,
  type KanzleiToolboxRecord,
  type KanzleiToolboxStatus,
  type KanzleiVerification,
} from "@/lib/kanzlei-toolbox";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";

/**
 * Tab `kanzlei_toolbox` on the existing spreadsheet. Reads and writes stay
 * off until `KANZLEI_TOOLBOX_SHEET_ENABLED` is true. Preview deployments and
 * check runs never open the live sheet.
 */

export const KANZLEI_TOOLBOX_SHEET_COLUMNS = ["row_kind", "row_id", "body", "logged_on"] as const;

export type KanzleiToolboxSheetClient = {
  get(args: { spreadsheetId: string }): Promise<{
    data: {
      sheets?: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null;
    };
  }>;
  batchUpdate(args: {
    spreadsheetId: string;
    requestBody: { requests: Array<{ addSheet?: { properties: { title: string } } }> };
  }): Promise<{ data: { replies?: Array<{ addSheet?: { properties?: { sheetId?: number | null } | null } | null } | null> | null } }>;
  valuesGet(args: { spreadsheetId: string; range: string }): Promise<{ data: { values?: unknown[][] | null } | null }>;
  valuesUpdate(args: {
    spreadsheetId: string;
    range: string;
    valueInputOption: "RAW";
    requestBody: { values: string[][] };
  }): Promise<{ data: unknown }>;
};

let enabledOverride: boolean | null = null;
let installed: KanzleiToolboxSheetClient | null = null;

export function setKanzleiToolboxSheetEnabledForTest(value: boolean | null): void {
  enabledOverride = value;
}

export function installKanzleiToolboxSheetClientForTest(client: KanzleiToolboxSheetClient | null): void {
  installed = client;
}

export function kanzleiToolboxSheetEnabled(): boolean {
  return enabledOverride ?? KANZLEI_TOOLBOX_SHEET_ENABLED;
}

/** Preview and `check:*` / build must not touch the shared production sheet. */
export function kanzleiToolboxLiveSheetBlocked(): boolean {
  return process.env.VERCEL_ENV === "preview" || automatedRunForbidsLiveWrites();
}

export function kanzleiToolboxSheetIoAllowed(): boolean {
  if (!kanzleiToolboxSheetEnabled()) return false;
  if (installed) return true;
  if (kanzleiToolboxLiveSheetBlocked()) return false;
  return isSheetsConfigured();
}

export function kanzleiToolboxUsesSheet(): boolean {
  return kanzleiToolboxSheetIoAllowed();
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (id) return id;
  if (installed) return "kanzlei-toolbox-test";
  throw new Error("kanzlei-toolbox-sheet");
}

function sheetClient(): KanzleiToolboxSheetClient {
  if (installed) return installed;
  if (kanzleiToolboxLiveSheetBlocked()) throw new Error("kanzlei-toolbox-sheet-blocked");
  const sheets = createSheetsClient();
  return {
    get: (args) => sheets.spreadsheets.get(args),
    batchUpdate: (args) => sheets.spreadsheets.batchUpdate(args),
    valuesGet: (args) => sheets.spreadsheets.values.get(args),
    valuesUpdate: (args) => sheets.spreadsheets.values.update(args),
  } as KanzleiToolboxSheetClient;
}

function logSheetError(error: unknown): void {
  const name = error instanceof Error && error.name ? error.name : "Error";
  console.error("[kanzlei-toolbox]", name);
}

function sheetTitle(meta: { properties?: { title?: string | null; sheetId?: number | null } | null } | null): string {
  return meta?.properties?.title ?? "";
}

function cellsOf(row: unknown): string[] {
  if (!Array.isArray(row)) return [];
  return row.map((cell) => String(cell ?? ""));
}

function headerMatches(row: string[]): boolean {
  return KANZLEI_TOOLBOX_SHEET_COLUMNS.every((column, index) => row[index] === column);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bool(value: unknown): boolean {
  return value === true;
}

function statusOf(value: unknown): KanzleiToolboxStatus | null {
  return typeof value === "string" && (KANZLEI_TOOLBOX_STATUSES as readonly string[]).includes(value)
    ? (value as KanzleiToolboxStatus)
    : null;
}

function deviceOf(value: unknown): KanzleiDevice | null {
  return value === "mobile" || value === "desktop" ? value : null;
}

function verificationOf(value: unknown): KanzleiVerification {
  const row = asRecord(value);
  const base = emptyKanzleiVerification();
  if (!row) return base;
  return {
    emailDomain: text(row.emailDomain),
    websiteDomain: text(row.websiteDomain),
    domainsMatch: bool(row.domainsMatch),
    freemail: bool(row.freemail),
    impressumUrl: text(row.impressumUrl),
    impressumReachable: bool(row.impressumReachable),
    nameInImpressum: bool(row.nameInImpressum),
    verzeichnisChecked: bool(row.verzeichnisChecked),
    impressumManual: bool(row.impressumManual),
    checkedAt: text(row.checkedAt),
    note: text(row.note),
  };
}

function recordOf(body: string): KanzleiToolboxRecord | null {
  try {
    const row = asRecord(JSON.parse(body));
    if (!row) return null;
    const status = statusOf(row.status);
    if (!status || !isKanzleiId(text(row.kanzleiId)) || !isKanzleiSlug(text(row.slug))) return null;
    return {
      kanzleiId: text(row.kanzleiId),
      slug: text(row.slug),
      displayName: text(row.displayName),
      website: text(row.website),
      email: text(row.email),
      city: text(row.city),
      status,
      test: bool(row.test),
      registeredAt: text(row.registeredAt),
      doiConfirmedAt: text(row.doiConfirmedAt),
      verifiedAt: text(row.verifiedAt),
      removedAt: text(row.removedAt),
      reportOptIn: bool(row.reportOptIn),
      consentAt: text(row.consentAt),
      consentText: text(row.consentText),
      consentTextVersion: text(row.consentTextVersion),
      authorityConfirmed: bool(row.authorityConfirmed),
      termsAccepted: bool(row.termsAccepted),
      verification: verificationOf(row.verification),
      reportTokenHash: /^[a-f0-9]{64}$/.test(text(row.reportTokenHash)) ? text(row.reportTokenHash) : "",
      reportTokenExp:
        typeof row.reportTokenExp === "number" && Number.isFinite(row.reportTokenExp) && row.reportTokenExp > 0
          ? row.reportTokenExp
          : 0,
    };
  } catch {
    return null;
  }
}

function countOf(id: string, body: string): KanzleiCountRow | null {
  const parts = id.split("|");
  if (parts.length !== 4) return null;
  const [date, kanzleiId, deviceRaw, kind] = parts;
  const device = deviceOf(deviceRaw);
  if (!date || !device || (kind !== "redirect" && kind !== "start" && kind !== "complete")) return null;
  if (kanzleiId !== "" && !isKanzleiId(kanzleiId)) return null;
  try {
    const parsed = asRecord(JSON.parse(body));
    const n = parsed?.n;
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) return null;
    return { date, kanzleiId, device, kind, n };
  } catch {
    return null;
  }
}

function attributionOf(id: string, body: string): KanzleiAttribution | null {
  if (!id) return null;
  try {
    const parsed = asRecord(JSON.parse(body));
    if (!parsed || !isKanzleiId(text(parsed.kanzleiId)) || !text(parsed.at)) return null;
    return { leadId: id, kanzleiId: text(parsed.kanzleiId), at: text(parsed.at) };
  } catch {
    return null;
  }
}

function proofOf(body: string): KanzleiConsentProof | null {
  try {
    const parsed = asRecord(JSON.parse(body));
    if (!parsed || !isKanzleiId(text(parsed.kanzleiId))) return null;
    return {
      kanzleiId: text(parsed.kanzleiId),
      consentText: text(parsed.consentText),
      consentTextVersion: text(parsed.consentTextVersion),
      registeredAt: text(parsed.registeredAt),
      doiConfirmedAt: text(parsed.doiConfirmedAt),
      revokedAt: text(parsed.revokedAt),
    };
  } catch {
    return null;
  }
}

function blockOf(id: string, body: string): KanzleiBlockEntry | null {
  if (!id) return null;
  try {
    const parsed = asRecord(JSON.parse(body));
    if (!parsed || !text(parsed.at)) return null;
    return { domain: id, kanzleiId: text(parsed.kanzleiId), reason: text(parsed.reason), at: text(parsed.at) };
  } catch {
    return null;
  }
}

function purgeOf(id: string, body: string, loggedOn: string): KanzleiPurgeLogRow | null {
  const split = id.indexOf(":");
  if (split <= 0) return null;
  const date = id.slice(0, split);
  const kind = id.slice(split + 1);
  if (date !== loggedOn || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!(KANZLEI_PURGE_KINDS as readonly string[]).includes(kind)) return null;
  if (!/^\d+$/.test(body)) return null;
  const n = Number(body);
  if (!Number.isInteger(n) || n <= 0) return null;
  return { date, kind: kind as KanzleiPurgeKind, n };
}

export function kanzleiToolboxFileFromSheet(values: unknown[][]): KanzleiToolboxFile {
  const file = emptyKanzleiFile();
  const [header, ...rows] = values;
  if (!header || !headerMatches(cellsOf(header))) return file;
  for (const raw of rows) {
    const cells = cellsOf(raw);
    if (cells.every((cell) => cell === "")) continue;
    const [kind, id, body, loggedOn] = cells;
    if (kind === "record") {
      const record = recordOf(body ?? "");
      if (record) file.records.push(record);
    } else if (kind === "slug" && isKanzleiSlug(id ?? "")) {
      file.reservedSlugs.push(id);
    } else if (kind === "domain" && (id ?? "").includes(".")) {
      file.domainLocks.push(id);
    } else if (kind === "count") {
      const count = countOf(id ?? "", body ?? "");
      if (count) file.counts.push(count);
    } else if (kind === "attribution") {
      const attribution = attributionOf(id ?? "", body ?? "");
      if (attribution) file.attributions.push(attribution);
    } else if (kind === "proof") {
      const proof = proofOf(body ?? "");
      if (proof) file.consentProofs.push(proof);
    } else if (kind === "block") {
      const block = blockOf(id ?? "", body ?? "");
      if (block) file.blocklist.push(block);
    } else if (kind === "purge") {
      const purge = purgeOf(id ?? "", body ?? "", loggedOn ?? "");
      if (purge) file.purgeLog.push(purge);
    }
  }
  return file;
}

export function kanzleiToolboxSheetRows(file: KanzleiToolboxFile): string[][] {
  const rows: string[][] = [[...KANZLEI_TOOLBOX_SHEET_COLUMNS]];
  for (const record of file.records) {
    rows.push(["record", record.kanzleiId, JSON.stringify(record), ""]);
  }
  for (const slug of file.reservedSlugs) rows.push(["slug", slug, "", ""]);
  for (const domain of file.domainLocks) rows.push(["domain", domain, "", ""]);
  for (const count of file.counts) {
    rows.push(["count", `${count.date}|${count.kanzleiId}|${count.device}|${count.kind}`, JSON.stringify({ n: count.n }), count.date]);
  }
  for (const attribution of file.attributions) {
    rows.push(["attribution", attribution.leadId, JSON.stringify({ kanzleiId: attribution.kanzleiId, at: attribution.at }), ""]);
  }
  for (const proof of file.consentProofs) {
    rows.push(["proof", `${proof.kanzleiId}|${proof.registeredAt}`, JSON.stringify(proof), ""]);
  }
  for (const block of file.blocklist) {
    rows.push(["block", block.domain, JSON.stringify({ kanzleiId: block.kanzleiId, reason: block.reason, at: block.at }), ""]);
  }
  for (const purge of file.purgeLog) {
    rows.push(["purge", `${purge.date}:${purge.kind}`, String(purge.n), purge.date]);
  }
  return rows;
}

function tabRange(tab: string, range: string): string {
  return `${tab}!${range}`;
}

async function ensureTab(client: KanzleiToolboxSheetClient, id: string, tab: string): Promise<void> {
  const meta = await client.get({ spreadsheetId: id });
  if (meta.data.sheets?.some((sheet) => sheetTitle(sheet) === tab)) return;
  await client.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
  });
}

export async function readKanzleiToolboxSheet(): Promise<KanzleiToolboxFile> {
  if (!kanzleiToolboxSheetIoAllowed()) return emptyKanzleiFile();
  const client = sheetClient();
  const id = spreadsheetId();
  const tab = getKanzleiToolboxSheetsTab();
  const meta = await client.get({ spreadsheetId: id });
  if (!meta.data.sheets?.some((sheet) => sheetTitle(sheet) === tab)) return emptyKanzleiFile();
  const result = await client.valuesGet({ spreadsheetId: id, range: tabRange(tab, "A:D") });
  const values = result.data?.values ?? [];
  const header = cellsOf(values[0]);
  if (header.some((cell) => cell !== "") && !headerMatches(header)) throw new Error("kanzlei-toolbox-header");
  return kanzleiToolboxFileFromSheet(values);
}

export async function writeKanzleiToolboxSheet(file: KanzleiToolboxFile): Promise<void> {
  if (!kanzleiToolboxSheetIoAllowed()) return;
  const client = sheetClient();
  const id = spreadsheetId();
  const tab = getKanzleiToolboxSheetsTab();
  try {
    await ensureTab(client, id, tab);
    const existing = await client.valuesGet({ spreadsheetId: id, range: tabRange(tab, "A:D") });
    const previous = existing.data?.values ?? [];
    const header = cellsOf(previous[0]);
    if (header.some((cell) => cell !== "") && !headerMatches(header)) throw new Error("kanzlei-toolbox-header");
    const next = kanzleiToolboxSheetRows(file);
    const height = Math.max(next.length, previous.length, 1);
    const padded = next.map((row) => [...row]);
    while (padded.length < height) padded.push(["", "", "", ""]);
    await client.valuesUpdate({
      spreadsheetId: id,
      range: tabRange(tab, `A1:D${height}`),
      valueInputOption: "RAW",
      requestBody: { values: padded },
    });
  } catch (error) {
    logSheetError(error);
    throw error;
  }
}
