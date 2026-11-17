/**
 * Kauf der Schnellversion je Konto. PDF über den bestehenden Speicher
 * (storePdf: Blob, wenn ein Token da ist, sonst lokale Datei).
 * Während check/build kein Blob-Schreiben.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { storePdf } from "@/lib/blob";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { SV_DOWNLOAD_DAYS, svDownloadStillOpen } from "@/lib/schnellversion-copy";
import {
  claimSvJson,
  deleteSvJson,
  getSvJson,
  listSvJson,
  putSvJson,
  svBlobEnabled,
  svPurchaseBlobPath,
  svReserveBlobPath,
  svSessionBlobPath,
} from "@/lib/schnellversion-persist";

export type SvPurchase = {
  id: string;
  email: string;
  company: string;
  purchasedAt: string;
  documentId: string;
  pdfPath: string;
  creditUsedAt: string;
  consentAt: string;
  sessionId: string;
  creditReservedAt: string;
  creditReservationId: string;
  answersJson: string;
  /** SHA-256 des Download-Tokens. Die Session-ID allein reicht nicht. */
  downloadTokenHash: string;
};

const memory = new Map<string, SvPurchase[]>();
const sessionClaims = new Set<string>();
const committedPurchases = new Map<string, SvPurchase>();
const committedIndex = new Map<string, string>();
const committedEvents = new Set<string>();
const commitFailures = new Set<"purchase" | "index" | "event">();

export type SvCommitStep = "purchase" | "index" | "event";

/** Nur der Check. Der nächste Schreibschritt wirft, ohne zu speichern. */
export function failSvCommitStepForTest(step: SvCommitStep | null): void {
  if (!step) {
    commitFailures.clear();
    return;
  }
  commitFailures.add(step);
}

export function purchaseIdForSession(sessionId: string): string {
  return createHash("sha256").update(`sv49-purchase:${sessionId.trim()}`).digest("hex").slice(0, 32);
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

export function companyKey(company: string): string {
  return company.trim().toLowerCase().replace(/\s+/g, " ");
}

export function creditStillOpen(row: SvPurchase, company: string, now: Date): boolean {
  if (row.creditUsedAt.trim()) return false;
  if (companyKey(row.company) !== companyKey(company)) return false;
  return svDownloadStillOpen(row.purchasedAt, now);
}

export function downloadStillOpen(row: SvPurchase, now: Date): boolean {
  return svDownloadStillOpen(row.purchasedAt, now);
}

export function anrechnungBis(purchasedAt: string): Date {
  const bought = Date.parse(purchasedAt);
  return new Date((Number.isFinite(bought) ? bought : Date.now()) + SV_DOWNLOAD_DAYS * 24 * 60 * 60 * 1000);
}

function filePath(): string {
  return path.join(tmpdir(), "gobd-sv49-purchases.json");
}

async function readFileRows(): Promise<SvPurchase[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as SvPurchase[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileRows(rows: SvPurchase[]): Promise<void> {
  if ((process.env.VERCEL_ENV ?? "").trim() === "production") return;
  if ((process.env.npm_lifecycle_event ?? "").startsWith("check:") || process.env.npm_lifecycle_event === "prebuild" || process.env.npm_lifecycle_event === "build") {
    return;
  }
  await mkdir(path.dirname(filePath()), { recursive: true });
  await writeFile(filePath(), JSON.stringify(rows), "utf8");
}

export function resetSvPurchasesForTest(): void {
  memory.clear();
}

export async function listAllSvPurchases(): Promise<SvPurchase[]> {
  const fromFile = await readFileRows();
  const fromMemory = [...memory.values()].flat();
  const fromBlob = svBlobEnabled() ? await listSvJson<SvPurchase>("gobd/sv49/purchase/") : [];
  const byId = new Map<string, SvPurchase>();
  for (const row of [...fromBlob, ...fromFile, ...fromMemory]) byId.set(row.id, row);
  return [...byId.values()];
}

export async function listSvPurchases(email: string): Promise<SvPurchase[]> {
  const key = emailKey(email);
  const fromMemory = memory.get(key) ?? [];
  const fromFile = (await readFileRows()).filter((row) => emailKey(row.email) === key);
  const fromBlob = (await listAllSvPurchases()).filter((row) => emailKey(row.email) === key);
  const byId = new Map<string, SvPurchase>();
  for (const row of [...fromBlob, ...fromFile, ...fromMemory]) byId.set(row.id, row);
  return [...byId.values()];
}

function sessionClaimFile(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
  return path.join(tmpdir(), "gobd-sv49-claims", `${safe}.lock`);
}

/** Eine Session darf nur eine Kaufzeile anlegen. Blob: Create-only. Lokal: exklusive Datei. */
export async function claimSvSession(sessionId: string): Promise<"created" | "exists"> {
  const id = sessionId.trim();
  if (!id) return "exists";
  if (svBlobEnabled()) {
    const { claimSvJson, svSessionClaimPath } = await import("@/lib/schnellversion-persist");
    return claimSvJson(svSessionClaimPath(id), { sessionId: id });
  }
  if (sessionClaims.has(id)) return "exists";
  if (automatedRunForbidsLiveWrites() || (process.env.VERCEL_ENV ?? "").trim() === "production") {
    sessionClaims.add(id);
    return "created";
  }
  try {
    await mkdir(path.dirname(sessionClaimFile(id)), { recursive: true });
    await writeFile(sessionClaimFile(id), id, { flag: "wx" });
    sessionClaims.add(id);
    return "created";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return "exists";
    sessionClaims.add(id);
    return "created";
  }
}

/** Nach einem Fehler zwischen Claim und Kauf, damit die nächste Zustellung neu anlegen kann. */
export async function releaseSvSession(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  sessionClaims.delete(id);
  if (svBlobEnabled()) {
    const { deleteSvJson, svSessionClaimPath } = await import("@/lib/schnellversion-persist");
    await deleteSvJson(svSessionClaimPath(id));
  }
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(sessionClaimFile(id));
  } catch {
    /* Datei fehlte bereits */
  }
}

export async function saveSvPurchase(input: {
  email: string;
  company: string;
  purchasedAt: string;
  pdf: Buffer;
  consentAt: string;
  sessionId: string;
  answersJson: string;
  downloadTokenHash: string;
}, arm: "" | "control" | "test" = ""): Promise<SvPurchase> {
  const id = purchaseIdForSession(input.sessionId);
  const pdfPath = await storePurchasePdf(id, input.pdf);
  const row: SvPurchase = {
    id,
    email: emailKey(input.email),
    company: input.company.trim(),
    purchasedAt: input.purchasedAt,
    documentId: id,
    pdfPath,
    creditUsedAt: "",
    consentAt: input.consentAt,
    sessionId: input.sessionId,
    creditReservedAt: "",
    creditReservationId: "",
    answersJson: input.answersJson,
    downloadTokenHash: input.downloadTokenHash,
  };
  await commitSvPurchase(row, arm);
  return row;
}

function rememberPurchase(row: SvPurchase): void {
  const key = row.email;
  const current = memory.get(key) ?? [];
  memory.set(key, current.some((item) => item.id === row.id) ? current.map((item) => (item.id === row.id ? row : item)) : [...current, row]);
}

function fileWritesAllowed(): boolean {
  return !automatedRunForbidsLiveWrites() && (process.env.VERCEL_ENV ?? "").trim() !== "production";
}

async function upsertFilePurchase(row: SvPurchase): Promise<void> {
  if (!fileWritesAllowed()) {
    committedPurchases.set(row.sessionId, row);
    return;
  }
  const all = await readFileRows();
  const index = all.findIndex((item) => item.id === row.id || item.sessionId === row.sessionId);
  if (index >= 0) all[index] = row;
  else all.push(row);
  await writeFileRows(all);
  committedPurchases.set(row.sessionId, row);
}

async function readDurablePurchase(sessionId: string): Promise<SvPurchase | null> {
  const id = purchaseIdForSession(sessionId);
  if (svBlobEnabled()) {
    const { getSvJson, svPurchaseBlobPath } = await import("@/lib/schnellversion-persist");
    const row = await getSvJson<SvPurchase>(svPurchaseBlobPath(id));
    return row?.sessionId === sessionId ? row : null;
  }
  if (fileWritesAllowed()) {
    return (await readFileRows()).find((item) => item.sessionId === sessionId) ?? null;
  }
  return committedPurchases.get(sessionId) ?? null;
}

function sessionIndexFile(): string {
  return path.join(tmpdir(), "gobd-sv49-session-index.json");
}

function countedFile(): string {
  return path.join(tmpdir(), "gobd-sv49-counted-49.json");
}

async function readJsonObject(file: string): Promise<Record<string, string>> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeJsonObject(file: string, value: Record<string, string>): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), "utf8");
}

async function writeSessionIndex(sessionId: string, purchaseId: string): Promise<void> {
  if (commitFailures.has("index")) throw new Error("Session-Index nicht gespeichert");
  if (svBlobEnabled()) {
    const { putSvJson, svSessionBlobPath } = await import("@/lib/schnellversion-persist");
    await putSvJson(svSessionBlobPath(sessionId), purchaseId, true);
  } else if (fileWritesAllowed()) {
    const all = await readJsonObject(sessionIndexFile());
    all[sessionId] = purchaseId;
    await writeJsonObject(sessionIndexFile(), all);
  }
  committedIndex.set(sessionId, purchaseId);
}

async function readSessionIndex(sessionId: string): Promise<string | null> {
  if (svBlobEnabled()) {
    const { getSvJson, svSessionBlobPath } = await import("@/lib/schnellversion-persist");
    return (await getSvJson<string>(svSessionBlobPath(sessionId))) ?? null;
  }
  if (fileWritesAllowed()) return (await readJsonObject(sessionIndexFile()))[sessionId] ?? null;
  return committedIndex.get(sessionId) ?? null;
}

async function eventIsDurable(sessionId: string): Promise<boolean> {
  if (svBlobEnabled()) {
    const { getSvJson } = await import("@/lib/schnellversion-persist");
    return Boolean(await getSvJson(svCounted49Path(sessionId)));
  }
  if (fileWritesAllowed()) return Boolean((await readJsonObject(countedFile()))[sessionId]);
  return committedEvents.has(sessionId);
}

async function markPurchaseCounted(sessionId: string, arm: "" | "control" | "test"): Promise<void> {
  if (commitFailures.has("event")) throw new Error("Kaufzählung nicht gespeichert");
  if (await eventIsDurable(sessionId)) {
    committedEvents.add(sessionId);
    return;
  }
  if (arm === "control" || arm === "test") {
    const { persistSvPurchaseEvent } = await import("@/lib/schnellversion-store");
    await persistSvPurchaseEvent({
      name: "sv_purchase",
      arm,
      variante: "b",
      branche_vorlage: "",
      value: 49,
      step: 0,
      ziel: "",
    });
  }
  if (svBlobEnabled()) {
    const { claimSvJson } = await import("@/lib/schnellversion-persist");
    const claim = await claimSvJson(svCounted49Path(sessionId), { sessionId });
    if (claim === "exists") {
      committedEvents.add(sessionId);
      return;
    }
  } else if (fileWritesAllowed()) {
    const all = await readJsonObject(countedFile());
    all[sessionId] = "1";
    await writeJsonObject(countedFile(), all);
  }
  committedEvents.add(sessionId);
}

/** Zeile, Session-Index und Zählung. Erst danach gilt der Kauf. Der Speicher allein reicht nicht. */
export async function commitSvPurchase(row: SvPurchase, arm: "" | "control" | "test"): Promise<void> {
  if (commitFailures.has("purchase")) throw new Error("Kaufzeile nicht gespeichert");
  if (svBlobEnabled()) {
    const { putSvJson, svPurchaseBlobPath } = await import("@/lib/schnellversion-persist");
    await putSvJson(svPurchaseBlobPath(row.id), row, true);
  }
  await upsertFilePurchase(row);
  await writeSessionIndex(row.sessionId, row.id);
  await markPurchaseCounted(row.sessionId, arm);
  rememberPurchase(row);
}

/** Alle drei dauerhaften Teile, sonst null. */
export async function completeSvPurchase(sessionId: string): Promise<SvPurchase | null> {
  const row = await readDurablePurchase(sessionId);
  if (!row) return null;
  if ((await readSessionIndex(sessionId)) !== row.id) return null;
  if (!(await eventIsDurable(sessionId))) return null;
  committedEvents.add(sessionId);
  return row;
}

function svCounted49Path(sessionId: string): string {
  return `gobd/sv49/counted-49/${purchaseIdForSession(sessionId)}.json`;
}

/** Blob, wenn ein Token da ist. Sonst eine lokale Datei, auch im Check, nie der Produktions-Blob. */
async function storePurchasePdf(id: string, pdf: Buffer): Promise<string> {
  if (svBlobEnabled()) {
    const stored = await storePdf({
      familyId: `sv49-${id}`,
      documentId: id,
      version: 1,
      buffer: pdf,
    });
    return stored.pathname;
  }
  const dir = path.join(tmpdir(), "gobd-sv49-pdf");
  await mkdir(dir, { recursive: true });
  const pathname = path.join(dir, `${id}.pdf`);
  if (!automatedRunForbidsLiveWrites()) await writeFile(pathname, pdf);
  return pathname;
}

async function persistPurchase(row: SvPurchase): Promise<void> {
  if (!svBlobEnabled()) return;
  await putSvJson(svPurchaseBlobPath(row.id), row, true);
  if (row.sessionId.trim()) await putSvJson(svSessionBlobPath(row.sessionId), row.id, true);
}

export function pdfPathIsBlob(pdfPath: string): boolean {
  return pdfPath.startsWith("gobd/");
}

export async function readSvPdf(row: SvPurchase): Promise<Buffer | null> {
  if (!row.pdfPath) return null;
  if (pdfPathIsBlob(row.pdfPath)) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
    if (!token) return null;
    const { get } = await import("@vercel/blob");
    const result = await get(row.pdfPath, { access: "private", token });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  try {
    return await readFile(row.pdfPath);
  } catch {
    return null;
  }
}

export async function findSvPurchaseBySession(sessionId: string): Promise<SvPurchase | null> {
  const id = sessionId.trim();
  if (!id) return null;
  const known = (await listAllSvPurchases()).find((row) => row.sessionId === id);
  if (known) return known;
  if (!svBlobEnabled()) return null;
  const purchaseId = await getSvJson<string>(svSessionBlobPath(id));
  if (!purchaseId) return null;
  return getSvJson<SvPurchase>(svPurchaseBlobPath(purchaseId));
}

async function replaceSvPurchase(row: SvPurchase): Promise<void> {
  const key = emailKey(row.email);
  const current = memory.get(key) ?? [];
  memory.set(key, current.map((item) => (item.id === row.id ? row : item)).concat(current.some((item) => item.id === row.id) ? [] : [row]));
  const all = await readFileRows();
  const index = all.findIndex((item) => item.id === row.id);
  if (index >= 0) all[index] = row;
  else all.push(row);
  await writeFileRows(all);
  await persistPurchase(row);
}

export async function reserveSvCredit(purchaseId: string, token: string, now: Date): Promise<boolean> {
  const { reserveDecision, CREDIT_RESERVE_MS } = await import("@/lib/schnellversion-credit");
  const all = await listAllSvPurchases();
  const row = all.find((item) => item.id === purchaseId);
  if (!row) return false;
  const next = reserveDecision(row, token, now);
  if (!next) return false;
  if (svBlobEnabled()) {
    const pathName = svReserveBlobPath(row.id);
    const claim = await claimSvJson(pathName, { token, at: now.toISOString() });
    if (claim === "exists") {
      const held = await getSvJson<{ token: string; at: string }>(pathName);
      const at = Date.parse(held?.at ?? "");
      const fresh = held && Number.isFinite(at) && now.getTime() - at < CREDIT_RESERVE_MS;
      if (!held || held.token !== token) {
        if (fresh) return false;
        await deleteSvJson(pathName);
        const retry = await claimSvJson(pathName, { token, at: now.toISOString() });
        if (retry !== "created") return false;
      }
    }
  }
  await replaceSvPurchase(next);
  return next.creditReservationId === token;
}

export function hashDownloadToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newDownloadToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashDownloadToken(token) };
}

export function downloadTokenMatches(token: string, hash: string): boolean {
  if (!token.trim() || !/^[a-f0-9]{64}$/.test(hash)) return false;
  const digest = hashDownloadToken(token.trim());
  return timingSafeEqual(Buffer.from(digest), Buffer.from(hash));
}

/** Login des Käufers oder das am Kauf gespeicherte Token. Zusätzlich die 30 Tage. */
export function svDownloadAllowed(
  row: SvPurchase,
  input: { email: string; token: string; now: Date },
): boolean {
  if (!downloadStillOpen(row, input.now)) return false;
  const mail = emailKey(input.email);
  if (mail && mail === emailKey(row.email)) return true;
  return downloadTokenMatches(input.token, row.downloadTokenHash);
}

export async function markSvCreditUsed(email: string, purchaseId: string, at: string): Promise<boolean> {
  const key = emailKey(email);
  const rows = await listSvPurchases(key);
  const row = rows.find((item) => item.id === purchaseId);
  if (!row || row.creditUsedAt.trim()) return false;
  await replaceSvPurchase({ ...row, creditUsedAt: at });
  return true;
}

export function purchaseHash(email: string): string {
  return createHash("sha256").update(emailKey(email)).digest("hex").slice(0, 24);
}
