import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ampelStepDate } from "@/lib/ampel-step-event";
import { getFileFallbackDir } from "@/lib/store";
import {
  KANZLEI_PREVIEW_SEED,
  KANZLEI_RETENTION,
  buildMonthReport,
  emailDomain,
  emptyKanzleiFile,
  isKanzleiId,
  isKanzleiSlug,
  kanzleiPreviewSeedEnabled,
  nameShown,
  websiteDomain,
  type KanzleiAttribution,
  type KanzleiBlockEntry,
  type KanzleiConsentProof,
  type KanzleiCountKind,
  type KanzleiCountRow,
  type KanzleiDevice,
  type KanzleiMonthReport,
  type KanzleiToolboxFile,
  type KanzleiToolboxRecord,
} from "@/lib/kanzlei-toolbox";

/**
 * Kanzlei register (consent, verification, revocation) and day counts.
 *
 * Not Google Sheets and not Vercel Blob: preview deployments share the
 * production workbook and the production blob store. This draft must not
 * write either. The file lives under the local data directory, or in the
 * instance temp directory on Vercel. It holds no UTM parameter, no free-text
 * ref, no IP address, no user agent, no referrer and no click id.
 */

const FILE_NAME = "kanzlei-toolbox.json";

let fileOverride: string | null = null;
let chain: Promise<unknown> = Promise.resolve();

export function setKanzleiToolboxFileForTest(file: string | null): void {
  fileOverride = file;
  chain = Promise.resolve();
}

export function kanzleiToolboxFilePath(): string {
  if (fileOverride) return fileOverride;
  return path.join(getFileFallbackDir(), FILE_NAME);
}

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isRecord(value: unknown): value is KanzleiToolboxRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<KanzleiToolboxRecord>;
  return typeof row.kanzleiId === "string" && isKanzleiId(row.kanzleiId) && typeof row.slug === "string" && isKanzleiSlug(row.slug);
}

function parseFile(raw: string): KanzleiToolboxFile {
  try {
    const parsed = JSON.parse(raw) as Partial<KanzleiToolboxFile>;
    const file = emptyKanzleiFile();
    if (Array.isArray(parsed.records)) file.records = parsed.records.filter(isRecord);
    if (Array.isArray(parsed.reservedSlugs)) {
      file.reservedSlugs = parsed.reservedSlugs.filter((item): item is string => typeof item === "string" && isKanzleiSlug(item));
    }
    if (Array.isArray(parsed.domainLocks)) {
      file.domainLocks = parsed.domainLocks.filter((item): item is string => typeof item === "string" && item.includes("."));
    }
    if (Array.isArray(parsed.counts)) file.counts = parsed.counts.filter(isCount);
    if (Array.isArray(parsed.attributions)) file.attributions = parsed.attributions.filter(isAttribution);
    if (Array.isArray(parsed.consentProofs)) file.consentProofs = parsed.consentProofs.filter(isProof);
    if (Array.isArray(parsed.blocklist)) file.blocklist = parsed.blocklist.filter(isBlock);
    return file;
  } catch {
    return emptyKanzleiFile();
  }
}

function isCount(value: unknown): value is KanzleiCountRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<KanzleiCountRow>;
  return (
    typeof row.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
    typeof row.kanzleiId === "string" &&
    (row.kanzleiId === "" || isKanzleiId(row.kanzleiId)) &&
    (row.device === "mobile" || row.device === "desktop") &&
    (row.kind === "redirect" || row.kind === "start" || row.kind === "complete") &&
    typeof row.n === "number" &&
    Number.isInteger(row.n) &&
    row.n > 0
  );
}

function isAttribution(value: unknown): value is KanzleiAttribution {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<KanzleiAttribution>;
  return typeof row.leadId === "string" && row.leadId.length > 0 && typeof row.kanzleiId === "string" && isKanzleiId(row.kanzleiId) && typeof row.at === "string";
}

function isProof(value: unknown): value is KanzleiConsentProof {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<KanzleiConsentProof>;
  return typeof row.kanzleiId === "string" && isKanzleiId(row.kanzleiId) && typeof row.consentText === "string";
}

function isBlock(value: unknown): value is KanzleiBlockEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<KanzleiBlockEntry>;
  return typeof row.domain === "string" && typeof row.kanzleiId === "string" && typeof row.at === "string";
}

async function readFileStore(): Promise<KanzleiToolboxFile> {
  try {
    return parseFile(await readFile(kanzleiToolboxFilePath(), "utf8"));
  } catch {
    return emptyKanzleiFile();
  }
}

async function writeFileStore(file: KanzleiToolboxFile): Promise<void> {
  const target = kanzleiToolboxFilePath();
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(file), "utf8");
  await rename(tmp, target);
}

function addMonths(iso: string, months: number): number {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 0;
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
}

function addDays(iso: string, days: number): number {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return 0;
  return time + days * 24 * 60 * 60 * 1000;
}

function endOfYearPlusYears(iso: string, years: number): number {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return 0;
  const year = new Date(time).getUTCFullYear();
  return Date.UTC(year + 1 + years, 0, 1);
}

function archiveProof(file: KanzleiToolboxFile, record: KanzleiToolboxRecord, nowIso: string): void {
  if (!record.consentText && !record.doiConfirmedAt) return;
  if (file.consentProofs.some((item) => item.kanzleiId === record.kanzleiId && item.registeredAt === record.registeredAt)) return;
  file.consentProofs.push({
    kanzleiId: record.kanzleiId,
    consentText: record.consentText,
    consentTextVersion: record.consentTextVersion,
    registeredAt: record.registeredAt,
    doiConfirmedAt: record.doiConfirmedAt,
    revokedAt: record.removedAt || nowIso,
  });
}

/** Applies the draft retention periods. Returns whether the file changed. */
export function purgeKanzleiToolboxFile(file: KanzleiToolboxFile, now = new Date()): boolean {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  let changed = false;
  const kept: KanzleiToolboxRecord[] = [];
  for (const record of file.records) {
    if (record.status === "pending_doi" && nowMs >= addDays(record.registeredAt, KANZLEI_RETENTION.unconfirmedDays)) {
      if (!file.reservedSlugs.includes(record.slug)) file.reservedSlugs.push(record.slug);
      changed = true;
      continue;
    }
    const ended = record.status === "removed" || record.status === "declined" || record.status === "blocked";
    const endedAt = record.removedAt || record.registeredAt;
    if (ended && record.email && nowMs >= addDays(endedAt, KANZLEI_RETENTION.contactDays)) {
      archiveProof(file, record, nowIso);
      record.displayName = "";
      record.website = "";
      record.email = "";
      record.city = "";
      record.consentText = "";
      record.verification = { ...record.verification, impressumUrl: "", note: "Kontaktdaten gelöscht" };
      changed = true;
    }
    kept.push(record);
  }
  file.records = kept;

  const proofs = file.consentProofs.filter((proof) => {
    const basis = proof.revokedAt || proof.doiConfirmedAt || proof.registeredAt;
    return nowMs < endOfYearPlusYears(basis, KANZLEI_RETENTION.consentYears);
  });
  if (proofs.length !== file.consentProofs.length) changed = true;
  file.consentProofs = proofs;

  const blocks = file.blocklist.filter((entry) => nowMs < addMonths(entry.at, KANZLEI_RETENTION.blockYears * 12));
  if (blocks.length !== file.blocklist.length) changed = true;
  file.blocklist = blocks;

  const attributions = file.attributions.filter((entry) => nowMs < addMonths(entry.at, KANZLEI_RETENTION.attributionMonths));
  if (attributions.length !== file.attributions.length) changed = true;
  file.attributions = attributions;

  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - KANZLEI_RETENTION.aggregateMonths);
  const cutoffDate = ampelStepDate(cutoff);
  const nextCounts: KanzleiCountRow[] = [];
  for (const row of file.counts) {
    if (row.date >= cutoffDate) {
      nextCounts.push(row);
      continue;
    }
    if (row.kanzleiId) changed = true;
    const existing = nextCounts.find(
      (item) => item.date === row.date && item.kanzleiId === "" && item.device === row.device && item.kind === row.kind,
    );
    if (existing) existing.n += row.n;
    else nextCounts.push({ ...row, kanzleiId: "" });
  }
  file.counts = nextCounts;
  return changed;
}

async function load(): Promise<KanzleiToolboxFile> {
  const file = await readFileStore();
  if (purgeKanzleiToolboxFile(file)) await writeFileStore(file);
  return file;
}

export async function readKanzleiToolbox(): Promise<KanzleiToolboxFile> {
  return withLock(load);
}

export async function updateKanzleiToolbox(change: (file: KanzleiToolboxFile) => void): Promise<KanzleiToolboxFile> {
  return withLock(async () => {
    const file = await load();
    change(file);
    purgeKanzleiToolboxFile(file);
    await writeFileStore(file);
    return file;
  });
}

export function listKanzleiRecords(file: KanzleiToolboxFile): KanzleiToolboxRecord[] {
  const rows = [...file.records];
  if (!kanzleiPreviewSeedEnabled()) return rows;
  if (rows.some((item) => item.kanzleiId === KANZLEI_PREVIEW_SEED.kanzleiId || item.slug === KANZLEI_PREVIEW_SEED.slug)) return rows;
  return [KANZLEI_PREVIEW_SEED, ...rows];
}

export function findKanzleiBySlug(file: KanzleiToolboxFile, slug: string): KanzleiToolboxRecord | null {
  return listKanzleiRecords(file).find((item) => item.slug === slug) ?? null;
}

export function findKanzleiById(file: KanzleiToolboxFile, kanzleiId: string): KanzleiToolboxRecord | null {
  return listKanzleiRecords(file).find((item) => item.kanzleiId === kanzleiId) ?? null;
}

export function publicKanzleiRecord(record: KanzleiToolboxRecord | null): KanzleiToolboxRecord | null {
  if (!record || !nameShown(record)) return null;
  return record;
}

export async function lookupPublicKanzlei(slug: string): Promise<KanzleiToolboxRecord | null> {
  if (!isKanzleiSlug(slug)) return null;
  const file = await readKanzleiToolbox();
  return publicKanzleiRecord(findKanzleiBySlug(file, slug));
}

export async function lookupVerifiedById(kanzleiId: string): Promise<KanzleiToolboxRecord | null> {
  if (!isKanzleiId(kanzleiId)) return null;
  const file = await readKanzleiToolbox();
  return publicKanzleiRecord(findKanzleiById(file, kanzleiId));
}

export async function addKanzleiCount(input: {
  kanzleiId: string;
  kind: KanzleiCountKind;
  device: KanzleiDevice;
  now?: Date;
}): Promise<void> {
  const record = await lookupVerifiedById(input.kanzleiId);
  if (!record || record.test) return;
  const date = ampelStepDate(input.now ?? new Date());
  await updateKanzleiToolbox((file) => {
    const existing = file.counts.find(
      (row) => row.date === date && row.kanzleiId === input.kanzleiId && row.device === input.device && row.kind === input.kind,
    );
    if (existing) existing.n += 1;
    else file.counts.push({ date, kanzleiId: input.kanzleiId, device: input.device, kind: input.kind, n: 1 });
  });
}

export async function noteKanzleiLead(input: { leadId: string; kanzleiId: string; at: string }): Promise<void> {
  if (!input.leadId || !isKanzleiId(input.kanzleiId)) return;
  const record = await lookupVerifiedById(input.kanzleiId);
  if (!record || record.test) return;
  await updateKanzleiToolbox((file) => {
    if (file.attributions.some((item) => item.leadId === input.leadId && item.kanzleiId === input.kanzleiId)) return;
    file.attributions.push({ leadId: input.leadId, kanzleiId: input.kanzleiId, at: input.at });
  });
}

export function kanzleiMonthReport(file: KanzleiToolboxFile, kanzleiId: string, month: string): KanzleiMonthReport {
  return buildMonthReport(file.counts, kanzleiId, month);
}

export function domainBlocked(file: KanzleiToolboxFile, website: string): boolean {
  const domain = websiteDomain(website);
  return Boolean(domain && file.blocklist.some((entry) => entry.domain === domain));
}

export function domainTaken(file: KanzleiToolboxFile, email: string, website: string): boolean {
  const domain = websiteDomain(website) || emailDomain(email);
  if (!domain) return false;
  if (file.domainLocks.includes(domain)) return true;
  return listKanzleiRecords(file).some((record) => {
    if (record.test) return false;
    if (record.status === "removed" || record.status === "declined" || record.status === "blocked") return false;
    return websiteDomain(record.website) === domain || emailDomain(record.email) === domain;
  });
}
