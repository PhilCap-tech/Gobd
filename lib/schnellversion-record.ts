/**
 * Kauf der Schnellversion je Konto. PDF über den bestehenden Speicher
 * (storePdf: Blob, wenn ein Token da ist, sonst lokale Datei).
 * Während check/build kein Blob-Schreiben.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
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
}): Promise<SvPurchase> {
  const id = randomUUID();
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
  const key = row.email;
  const next = [...(memory.get(key) ?? []), row];
  memory.set(key, next);
  const all = await readFileRows();
  all.push(row);
  await writeFileRows(all);
  await persistPurchase(row);
  return row;
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
