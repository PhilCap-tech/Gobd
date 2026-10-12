import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put, type GetCommandOptions, type PutCommandOptions } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/env";
import { getFileFallbackDir } from "@/lib/store";

/** Nachweis, dass für diese Checkout-Session bereits ein Login ausgestellt wurde. */
export type CheckoutSessionGrant = { email: string };

function sessionHash(sessionId: string): string {
  return createHash("sha256").update(sessionId.trim()).digest("hex").slice(0, 40);
}

function grantFile(sessionId: string): string {
  return path.join(getFileFallbackDir(), "checkout-grants", `${sessionHash(sessionId)}.json`);
}

function grantBlobPath(sessionId: string): string {
  return `gobd/checkout-grants/${sessionHash(sessionId)}.json`;
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

function normalizeStoredEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@") || /\s/.test(email)) return "";
  return email;
}

async function readRaw(sessionId: string): Promise<string | null> {
  const token = blobToken();
  if (isBlobConfigured() && token) {
    try {
      const result = await get(grantBlobPath(sessionId), readOptions(token));
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return await new Response(result.stream).text();
    } catch (error) {
      if (failureClass(error) === "BlobNotFoundError") return null;
      throw error;
    }
  }
  try {
    return await readFile(grantFile(sessionId), "utf8");
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

/** Leer, wenn für diese Session noch kein Login ausgestellt wurde. Lesefehler zählen als leer. */
export async function checkoutSessionGrant(sessionId: string): Promise<CheckoutSessionGrant | null> {
  const id = sessionId.trim();
  if (!id) return null;
  try {
    const raw = await readRaw(id);
    if (!raw) return null;
    const email = normalizeStoredEmail((JSON.parse(raw) as { email?: unknown }).email);
    return email ? { email } : null;
  } catch (error) {
    console.error(
      "[checkout] Sitzungsnachweis nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
    return null;
  }
}

/** Hält fest, dass diese Checkout-Session einmal ein Login bekommen hat. */
export async function recordCheckoutSessionGrant(input: {
  sessionId: string;
  email: string;
}): Promise<void> {
  const sessionId = input.sessionId.trim();
  const email = normalizeStoredEmail(input.email);
  if (!sessionId || !email) return;
  const body = JSON.stringify({ email, grantedAt: new Date().toISOString() });
  const token = blobToken();
  if (isBlobConfigured() && token) {
    await put(grantBlobPath(sessionId), body, writeOptions(token));
    return;
  }
  const file = grantFile(sessionId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
}

/** Entfernt den Nachweis. Nur für Checks, kein öffentlicher Weg. */
export async function forgetCheckoutSessionGrant(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  const token = blobToken();
  if (isBlobConfigured() && token) {
    try {
      await del(grantBlobPath(id), { token });
    } catch (error) {
      if (failureClass(error) !== "BlobNotFoundError") throw error;
    }
    return;
  }
  try {
    await unlink(grantFile(id));
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code !== "ENOENT") throw error;
  }
}
