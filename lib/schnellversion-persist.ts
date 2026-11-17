/**
 * Kaufzeilen und offene Checkouts im privaten Blob, wie Entwürfe und PDFs.
 * Ohne Token nur der Prozess und, außerhalb von Produktion, eine lokale Datei.
 * Checks und Builds schreiben den Blob nicht.
 */

import { get, list, put, del } from "@vercel/blob";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";

const PREFIX = "gobd/sv49";

export function svPurchaseBlobPath(id: string): string {
  return `${PREFIX}/purchase/${id}.json`;
}

export function svPendingBlobPath(id: string): string {
  return `${PREFIX}/pending/${id}.json`;
}

export function svPendingSessionBlobPath(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
  return `${PREFIX}/pending-session/${safe}.json`;
}

export function svSessionBlobPath(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
  return `${PREFIX}/session/${safe}.json`;
}

export function svReserveBlobPath(purchaseId: string): string {
  return `${PREFIX}/reserve/${purchaseId}.json`;
}

export function svBlobEnabled(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!token) return false;
  if (automatedRunForbidsLiveWrites()) return false;
  if ((process.env.VERCEL_ENV ?? "").trim() === "preview") return false;
  return true;
}

function token(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

export async function putSvJson(pathname: string, value: unknown, allowOverwrite: boolean): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite,
    contentType: "application/json; charset=utf-8",
    token: token(),
  });
}

export async function getSvJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: "private", token: token(), useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  } catch {
    return null;
  }
}

function isConflict(error: unknown): boolean {
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  if (name === "BlobPreconditionFailedError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists") || message.includes("precondition");
}

/** Zweite Anlage desselben Pfads schlägt fehl. Das ist die Reservierung. */
export async function claimSvJson(pathname: string, value: unknown): Promise<"created" | "exists"> {
  try {
    await putSvJson(pathname, value, false);
    return "created";
  } catch (error) {
    if (isConflict(error)) return "exists";
    throw error;
  }
}

export async function deleteSvJson(pathname: string): Promise<void> {
  try {
    await del(pathname, { token: token() });
  } catch {
    /* abgelaufene Reservierung darf fehlen */
  }
}

export async function listSvJson<T>(prefix: string): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  try {
  do {
    const page = await list({ prefix, cursor, token: token(), limit: 100 });
    for (const blob of page.blobs) {
      const row = await getSvJson<T>(blob.pathname);
      if (row) rows.push(row);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  } catch {
    return rows;
  }
  return rows;
}
