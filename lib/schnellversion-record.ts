/**
 * Kauf der Schnellversion je Konto. PDF über den bestehenden Speicher
 * (storePdf: Blob, wenn ein Token da ist, sonst lokale Datei).
 * Während check/build kein Blob-Schreiben.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { storePdf } from "@/lib/blob";
import { assertLiveWriteAllowed } from "@/lib/live-write-guard";
import { SV_DOWNLOAD_DAYS, svDownloadStillOpen } from "@/lib/schnellversion-copy";

export type SvPurchase = {
  id: string;
  email: string;
  company: string;
  purchasedAt: string;
  documentId: string;
  pdfPath: string;
  creditUsedAt: string;
};

const memory = new Map<string, SvPurchase[]>();

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
  const byId = new Map<string, SvPurchase>();
  for (const row of [...fromFile, ...fromMemory]) byId.set(row.id, row);
  return [...byId.values()];
}

export async function listSvPurchases(email: string): Promise<SvPurchase[]> {
  const key = emailKey(email);
  const fromMemory = memory.get(key) ?? [];
  const fromFile = (await readFileRows()).filter((row) => emailKey(row.email) === key);
  const byId = new Map<string, SvPurchase>();
  for (const row of [...fromFile, ...fromMemory]) byId.set(row.id, row);
  return [...byId.values()];
}

export async function saveSvPurchase(input: {
  email: string;
  company: string;
  purchasedAt: string;
  pdf: Buffer;
}): Promise<SvPurchase> {
  const id = randomUUID();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (token) assertLiveWriteAllowed("blob");
  const stored = await storePdf({
    familyId: `sv49-${id}`,
    documentId: id,
    version: 1,
    buffer: input.pdf,
  });
  const row: SvPurchase = {
    id,
    email: emailKey(input.email),
    company: input.company.trim(),
    purchasedAt: input.purchasedAt,
    documentId: id,
    pdfPath: stored.pathname,
    creditUsedAt: "",
  };
  const key = row.email;
  const next = [...(memory.get(key) ?? []), row];
  memory.set(key, next);
  const all = await readFileRows();
  all.push(row);
  await writeFileRows(all);
  return row;
}

export async function readSvPdf(row: SvPurchase): Promise<Buffer | null> {
  if (!row.pdfPath) return null;
  try {
    return await readFile(row.pdfPath);
  } catch {
    return null;
  }
}

export async function markSvCreditUsed(email: string, purchaseId: string, at: string): Promise<boolean> {
  const key = emailKey(email);
  const rows = await listSvPurchases(key);
  const row = rows.find((item) => item.id === purchaseId);
  if (!row || row.creditUsedAt.trim()) return false;
  row.creditUsedAt = at;
  memory.set(key, rows.filter((item) => emailKey(item.email) === key));
  const all = await readFileRows();
  const index = all.findIndex((item) => item.id === purchaseId);
  if (index >= 0) all[index] = { ...all[index], creditUsedAt: at };
  await writeFileRows(all);
  return true;
}

export function purchaseHash(email: string): string {
  return createHash("sha256").update(emailKey(email)).digest("hex").slice(0, 24);
}
