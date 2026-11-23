/**
 * Kaufzeilen und offene Checkouts im privaten Blob, wie Entwürfe und PDFs.
 * Ohne Token nur der Prozess und, außerhalb von Produktion, eine lokale Datei.
 * Checks und Builds schreiben den Blob nicht. Preview nur mit erklärtem Testziel.
 */

import { get, list, put, del } from "@vercel/blob";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { svBlobWritesOpen, svPreviewTestTarget } from "@/lib/schnellversion-data-env";

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

export function svSessionClaimPath(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
  return `${PREFIX}/claim/${safe}.json`;
}

export function svCounted99Path(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
  return `${PREFIX}/counted-99/${safe}.json`;
}

/** Merker, dass sv_purchase für diese Session schon geschrieben wurde. Nicht der Zählmarker. */
export function svEventSentPath(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
  return `${PREFIX}/event-sent/${safe}.json`;
}

export function svSessionBlobPath(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
  return `${PREFIX}/session/${safe}.json`;
}

export function svReserveBlobPath(purchaseId: string): string {
  return `${PREFIX}/reserve/${purchaseId}.json`;
}

export function svBlobEnabled(): boolean {
  if (automatedRunForbidsLiveWrites()) return false;
  return svBlobWritesOpen(process.env);
}

function token(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

/** Test-Store, wenn die aktive ID eine andere ist. Sonst der gesetzte Token. */
function blobAuth(): { token: string } | { storeId: string } {
  const target = svPreviewTestTarget();
  if (target?.mode === "store") return { storeId: target.blobStoreId };
  return { token: token() };
}

export async function putSvJson(pathname: string, value: unknown, allowOverwrite: boolean): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite,
    contentType: "application/json; charset=utf-8",
    ...blobAuth(),
  });
}

export async function putSvBytes(pathname: string, body: Buffer, contentType: string): Promise<void> {
  await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...blobAuth(),
  });
}

export async function getSvBytes(pathname: string): Promise<Buffer | null> {
  const auth = blobAuth();
  if ("token" in auth && !auth.token) return null;
  try {
    const result = await get(pathname, { access: "private", useCache: false, ...auth });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  } catch {
    return null;
  }
}

export async function getSvJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: "private", useCache: false, ...blobAuth() });
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
    await del(pathname, blobAuth());
  } catch {
    /* abgelaufene Reservierung darf fehlen */
  }
}

export async function listSvJson<T>(prefix: string): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  try {
  do {
    const page = await list({ prefix, cursor, limit: 100, ...blobAuth() });
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
