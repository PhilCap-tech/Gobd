import { createHash } from "node:crypto";
import { get, put, type GetCommandOptions, type PutCommandOptions } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/env";
import type { SheetRow } from "@/lib/types";

/**
 * One document row in the existing private Blob store.
 * Shared by every instance, so a download does not re-read the sheet.
 */
const memory = new Map<string, SheetRow>();

type IndexIo = {
  get: (pathname: string) => Promise<SheetRow | null>;
  put: (pathname: string, row: SheetRow) => Promise<void>;
};

let installed: IndexIo | null = null;

export function installDocumentIndex(io: IndexIo | null): void {
  installed = io;
}

export function clearDocumentIndexMemory(): void {
  memory.clear();
}

export function peekDocumentIndex(documentId: string): SheetRow | null {
  const id = documentId.trim();
  if (!id) return null;
  return memory.get(id) ?? null;
}

export function rememberDocumentIndex(row: SheetRow): void {
  const id = row.documentId.trim();
  if (!id) return;
  memory.set(id, row);
}

function indexPath(documentId: string): string {
  const hash = createHash("sha256").update(documentId.trim()).digest("hex").slice(0, 40);
  return `gobd/doc-index/${hash}.json`;
}

function token(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function writeOptions(blobToken: string): PutCommandOptions {
  return {
    access: "private",
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken,
  };
}

function readOptions(blobToken: string): GetCommandOptions {
  return { access: "private", useCache: false, token: blobToken };
}

function coerceRow(value: unknown): SheetRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as SheetRow;
  if (typeof row.documentId !== "string" || !row.documentId.trim()) return null;
  return row;
}

export async function readDocumentIndex(documentId: string): Promise<SheetRow | null> {
  const id = documentId.trim();
  if (!id) return null;
  const cached = memory.get(id);
  if (cached) return cached;
  const pathname = indexPath(id);
  try {
    if (installed) {
      const row = await installed.get(pathname);
      if (row) memory.set(id, row);
      return row;
    }
    const blobToken = token();
    if (!isBlobConfigured() || !blobToken) return null;
    const result = await get(pathname, readOptions(blobToken));
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const row = coerceRow(JSON.parse(await new Response(result.stream).text()));
    if (!row) return null;
    memory.set(id, row);
    return row;
  } catch (error) {
    const name =
      error && typeof error === "object"
        ? (error as { constructor?: { name?: string } }).constructor?.name
        : "";
    if (name === "BlobNotFoundError") return null;
    console.error("[store] Dokumentindex nicht gelesen", name || "error");
    return null;
  }
}

/** Own write. Replaces the cached row so the next download does not hit Sheets. */
export async function writeDocumentIndex(row: SheetRow): Promise<void> {
  const id = row.documentId.trim();
  if (!id) return;
  memory.set(id, row);
  const pathname = indexPath(id);
  try {
    if (installed) {
      await installed.put(pathname, row);
      return;
    }
    const blobToken = token();
    if (!isBlobConfigured() || !blobToken) return;
    await put(pathname, JSON.stringify(row), writeOptions(blobToken));
  } catch (error) {
    const name = error instanceof Error ? error.name : "error";
    console.error("[store] Dokumentindex nicht geschrieben", name);
  }
}
