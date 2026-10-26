/**
 * Small JSON markers in the private Blob store, file fallback without a token.
 * Same pattern as the mail ledger: create is exclusive (`allowOverwrite: false`
 * on Blob, `wx` on disk), so two instances cannot both create one marker.
 * No new service and no new env.
 */
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobNotFoundError, BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { getFileFallbackDir } from "@/lib/store";

let dirOverride: string | null = null;

/** Isolated file root for prebuild checks. `null` restores the default. */
export function setBlobMarkerTestDir(dir: string | null): void {
  dirOverride = dir;
}

function storageId(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function blobEnabled(): boolean {
  if (dirOverride) return false;
  if (automatedRunForbidsLiveWrites()) return false;
  return isBlobConfigured() && Boolean(blobToken());
}

function blobPath(prefix: string, key: string): string {
  return `gobd/${prefix}/${storageId(key)}.json`;
}

function filePath(prefix: string, key: string): string {
  const root = dirOverride ?? getFileFallbackDir();
  return path.join(root, prefix, `${storageId(key)}.json`);
}

function errorName(error: unknown): string {
  return error instanceof Error ? (error.constructor?.name ?? error.name) : "";
}

function isConflict(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  if (errorName(error) === "BlobPreconditionFailedError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists") || message.includes("precondition");
}

function isMissing(error: unknown): boolean {
  return error instanceof BlobNotFoundError || errorName(error) === "BlobNotFoundError";
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

const JSON_TYPE = "application/json; charset=utf-8";

export async function createMarker(prefix: string, key: string, body: string): Promise<"created" | "exists"> {
  if (blobEnabled()) {
    try {
      await put(blobPath(prefix, key), body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: JSON_TYPE,
        token: blobToken(),
      });
      return "created";
    } catch (error) {
      if (isConflict(error)) return "exists";
      throw error;
    }
  }
  const file = filePath(prefix, key);
  await mkdir(path.dirname(file), { recursive: true });
  let handle;
  try {
    handle = await open(file, "wx");
  } catch (error) {
    if (errorCode(error) === "EEXIST") return "exists";
    throw error;
  }
  try {
    await handle.writeFile(body, "utf8");
  } finally {
    await handle.close();
  }
  return "created";
}

export async function readMarker(prefix: string, key: string): Promise<string | null> {
  if (blobEnabled()) {
    try {
      const result = await get(blobPath(prefix, key), {
        access: "private",
        useCache: false,
        token: blobToken(),
      });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return await new Response(result.stream).text();
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
  try {
    return await readFile(filePath(prefix, key), "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

export async function writeMarker(prefix: string, key: string, body: string): Promise<void> {
  if (blobEnabled()) {
    await put(blobPath(prefix, key), body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: JSON_TYPE,
      token: blobToken(),
    });
    return;
  }
  const file = filePath(prefix, key);
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, file);
}

export async function removeMarker(prefix: string, key: string): Promise<void> {
  if (blobEnabled()) {
    try {
      await del(blobPath(prefix, key), { token: blobToken() });
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    return;
  }
  try {
    await unlink(filePath(prefix, key));
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}
