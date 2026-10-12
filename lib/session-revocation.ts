/**
 * Server-side logout. A copied `gobd_session` stays valid until `exp` unless
 * the mailbox is marked here. The mark lives next to the checkout-grant
 * files: private Blob when configured, otherwise `.data` (or `/tmp` on Vercel).
 * No new service.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { del, get, put, type GetCommandOptions, type PutCommandOptions } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/env";

function dataDir(): string {
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    return path.join(tmpdir(), "gobd-data");
  }
  return path.join(process.cwd(), ".data");
}

function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 40);
}

function revocationFile(email: string): string {
  return path.join(dataDir(), "session-revocations", `${emailHash(email)}.json`);
}

function revocationBlobPath(email: string): string {
  return `gobd/session-revocations/${emailHash(email)}.json`;
}

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
}

function writeOptions(token: string): PutCommandOptions {
  return {
    access: "private",
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  };
}

function readOptions(token: string): GetCommandOptions {
  return { access: "private", useCache: false, token };
}

function failureClass(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const ctor = (error as { constructor?: { name?: unknown } }).constructor?.name;
    if (typeof ctor === "string" && ctor && ctor !== "Object") return ctor;
  }
  return "Unknown";
}

function normalizeEmail(email: string): string {
  const value = email.trim().toLowerCase();
  if (!value.includes("@") || /\s/.test(value)) return "";
  return value;
}

async function readRaw(email: string): Promise<string | null> {
  const token = blobToken();
  if (isBlobConfigured() && token) {
    try {
      const result = await get(revocationBlobPath(email), readOptions(token));
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return await new Response(result.stream).text();
    } catch (error) {
      if (failureClass(error) === "BlobNotFoundError") return null;
      throw error;
    }
  }
  try {
    return await readFile(revocationFile(email), "utf8");
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

function revokedAtFrom(raw: string | null): number {
  if (!raw) return 0;
  try {
    const value = (JSON.parse(raw) as { revokedAt?: unknown }).revokedAt;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Unix-Millisekunden. 0, wenn diese Mailbox noch nie abgemeldet wurde. Lesefehler zählen als 0. */
export async function sessionRevokedAt(email: string): Promise<number> {
  const address = normalizeEmail(email);
  if (!address) return 0;
  try {
    return revokedAtFrom(await readRaw(address));
  } catch (error) {
    console.error(
      "[auth] Sitzungsstand nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
    return 0;
  }
}

/**
 * Cookie mit `iat` vor diesem Zeitpunkt ist abgemeldet.
 * Gleicher Millisekundenwert bleibt gültig, damit ein gerade neu ausgestelltes
 * Cookie nicht mit dem alten zusammenfällt.
 */
export async function isSessionRevoked(email: string, issuedAt: number): Promise<boolean> {
  if (!Number.isFinite(issuedAt)) return true;
  const revokedAt = await sessionRevokedAt(email);
  return issuedAt < revokedAt;
}

/** Alle bisher ausgestellten Sitzungen dieser Mailbox verwerfen. Schreibfehler werfen. */
export async function revokeSessionsForEmail(email: string): Promise<void> {
  const address = normalizeEmail(email);
  if (!address) return;
  const revokedAt = Math.max(Date.now(), (await sessionRevokedAt(address)) + 1);
  const body = JSON.stringify({ revokedAt });
  const token = blobToken();
  if (isBlobConfigured() && token) {
    await put(revocationBlobPath(address), body, writeOptions(token));
    return;
  }
  const file = revocationFile(address);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
}

/** Nur für Checks. */
export async function forgetSessionRevocation(email: string): Promise<void> {
  const address = normalizeEmail(email);
  if (!address) return;
  const token = blobToken();
  if (isBlobConfigured() && token) {
    try {
      await del(revocationBlobPath(address), { token });
    } catch (error) {
      if (failureClass(error) !== "BlobNotFoundError") throw error;
    }
    return;
  }
  try {
    await unlink(revocationFile(address));
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code !== "ENOENT") throw error;
  }
}
