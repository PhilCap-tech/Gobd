import { del, get, head, list } from "@vercel/blob";
import {
  classifyBlobPathname,
  derivedDocumentPaths,
  derivedDraftPaths,
  draftPayloadMatchesEmail,
  emptyPathWipe,
  safeErrorMessage,
  type AccountRecord,
  type AccountScope,
  type BlobObjectWipe,
  type PathWipe,
  type WipeAccountResult,
} from "@/lib/admin-wipe";

const DRAFT_CONTENT_BUDGET_MS = 8_000;
const LIST_PAGE_LIMIT = 20;

export type BlobStoreIo = {
  list: (options: {
    prefix?: string;
    cursor?: string;
    limit?: number;
    token?: string;
  }) => Promise<{
    blobs: Array<{ pathname?: string; uploadedAt?: Date | string }>;
    hasMore?: boolean;
    cursor?: string;
  }>;
  del: (target: string | string[], options?: { token?: string }) => Promise<void>;
  head: (
    target: string,
    options?: { token?: string },
  ) => Promise<{ pathname?: string; uploadedAt?: Date | string }>;
  get: (
    pathname: string,
    options: { access: "public" | "private"; token?: string; useCache?: boolean },
  ) => Promise<{
    statusCode?: number;
    stream?: ReadableStream<Uint8Array> | null;
    blob?: { uploadedAt?: Date | string };
  } | null>;
};

const defaultBlobIo: BlobStoreIo = {
  list,
  del,
  head,
  get: (pathname, options) => get(pathname, options),
};

export function blobErrorName(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && name && name !== "Error") return name;
    const ctor = (error as { constructor?: { name?: unknown } }).constructor?.name;
    if (typeof ctor === "string" && ctor && ctor !== "Object" && ctor !== "Error") return ctor;
  }
  return "Unknown";
}

export function isBlobNotFound(error: unknown): boolean {
  return blobErrorName(error) === "BlobNotFoundError";
}

export function blobUploadedAtIso(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}

function cleanPath(pathname: string): string {
  return pathname.replace(/^\/+/, "");
}

function isSafeBlobPath(pathname: string): boolean {
  return pathname.startsWith("gobd/") && !pathname.includes("..") && !pathname.includes("\\");
}

function blobToken(token: string | undefined): string | undefined {
  const trimmed = token?.trim();
  return trimmed ? trimmed : undefined;
}

async function mapPool<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
}

async function listBlobPrefix(
  prefix: string,
  io: BlobStoreIo,
  token: string,
): Promise<string[]> {
  const pathnames: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < LIST_PAGE_LIMIT; page += 1) {
    const result = await io.list({ prefix, cursor, limit: 1000, token });
    for (const blob of result.blobs) {
      if (!blob.pathname) continue;
      const pathname = cleanPath(blob.pathname);
      if (pathname) pathnames.push(pathname);
    }
    if (!result.hasMore || !result.cursor) break;
    cursor = result.cursor;
  }
  return pathnames;
}

async function readBlobText(
  pathname: string,
  io: BlobStoreIo,
  token: string,
): Promise<string | null> {
  for (const access of ["public", "private"] as const) {
    try {
      const result = await io.get(pathname, { access, token, useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) continue;
      return await new Response(result.stream).text();
    } catch {
      // The store may be private while older objects were written as public.
    }
  }
  return null;
}

type Inspected = {
  present: BlobObjectWipe[];
  failures: BlobObjectWipe[];
};

type ProbeHit = { found: true; uploadedAt?: string };
type ProbeMiss = { found: false; error?: string };

async function releaseStream(stream: ReadableStream<Uint8Array> | null | undefined): Promise<void> {
  if (!stream) return;
  try {
    await stream.cancel();
  } catch {
    // The body may already be closed.
  }
}

/**
 * Consistent read for the private store. `get()` with `useCache: false`
 * returns null on HTTP 404 and bypasses the CDN. `head()` has no such
 * switch; a just-deleted object can stay visible there for up to a minute.
 */
async function readUncached(
  pathname: string,
  io: BlobStoreIo,
  token: string,
): Promise<ProbeHit | ProbeMiss> {
  let errorName: string | undefined;
  for (const access of ["private", "public"] as const) {
    try {
      const result = await io.get(pathname, { access, token, useCache: false });
      if (result?.statusCode === 200 && result.stream) {
        const uploadedAt = blobUploadedAtIso(result.blob?.uploadedAt);
        await releaseStream(result.stream);
        return uploadedAt ? { found: true, uploadedAt } : { found: true };
      }
    } catch (error) {
      if (!isBlobNotFound(error)) errorName = blobErrorName(error);
    }
  }
  return errorName ? { found: false, error: errorName } : { found: false };
}

async function probeBlob(
  pathname: string,
  io: BlobStoreIo,
  token: string,
): Promise<ProbeHit | ProbeMiss> {
  let headUploadedAt: string | undefined;
  let headFound = false;
  let headMissing = false;
  let headError: string | undefined;
  try {
    const meta = await io.head(pathname, { token });
    headFound = true;
    headUploadedAt = blobUploadedAtIso(meta.uploadedAt);
  } catch (error) {
    if (isBlobNotFound(error)) headMissing = true;
    else headError = blobErrorName(error);
  }

  const body = await readUncached(pathname, io, token);
  if (body.found || headFound) {
    return { found: true, uploadedAt: headUploadedAt || (body.found ? body.uploadedAt : undefined) };
  }
  if (headMissing && !body.error) return { found: false };
  const name = body.error || headError;
  if (name) return { found: false, error: name };
  return { found: false };
}

/** `head()` plus an uncached `get()`. `list()` only discovers candidates. */
export async function inspectBlobs(
  pathnames: readonly string[],
  io: BlobStoreIo,
  token: string,
): Promise<Inspected> {
  const present: BlobObjectWipe[] = [];
  const failures: BlobObjectWipe[] = [];
  await mapPool([...new Set(pathnames)], 4, async (pathname) => {
    if (!isSafeBlobPath(pathname)) {
      failures.push({ pathname, error: "Ungültiger Blob-Pfad" });
      return;
    }
    const probe = await probeBlob(pathname, io, token);
    if (probe.found) {
      const entry: BlobObjectWipe = { pathname };
      if (probe.uploadedAt) entry.uploadedAt = probe.uploadedAt;
      present.push(entry);
      return;
    }
    if (probe.error) {
      failures.push({ pathname, error: `Prüfung fehlgeschlagen: ${probe.error}` });
    }
  });
  present.sort((a, b) => a.pathname.localeCompare(b.pathname));
  failures.sort((a, b) => a.pathname.localeCompare(b.pathname));
  return { present, failures };
}

function wipeFromInspect(inspected: Inspected): PathWipe {
  const wipe = emptyPathWipe();
  wipe.pathnames = inspected.present.map((blob) => blob.pathname);
  wipe.matched = wipe.pathnames.length;
  wipe.blobs = [...inspected.present, ...inspected.failures].sort((a, b) =>
    a.pathname.localeCompare(b.pathname),
  );
  if (inspected.failures.length > 0) {
    wipe.error = `${inspected.failures.length} Pfad(e) nicht prüfbar`;
  }
  return wipe;
}

async function deleteOne(
  pathname: string,
  io: BlobStoreIo,
  token: string,
): Promise<BlobObjectWipe> {
  if (!isSafeBlobPath(pathname)) {
    return { pathname, deleted: false, error: "Ungültiger Blob-Pfad" };
  }
  let delError: string | undefined;
  try {
    await io.del(pathname, { token });
  } catch (error) {
    if (!isBlobNotFound(error)) {
      delError = `del() fehlgeschlagen: ${blobErrorName(error)}`;
    }
  }
  let lastHit: ProbeHit | undefined;
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const body = await readUncached(pathname, io, token);
    if (!body.found && !body.error) {
      return { pathname, deleted: true };
    }
    if (body.found) lastHit = body;
    else lastError = body.error;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (lastHit) {
    const entry: BlobObjectWipe = {
      pathname,
      deleted: false,
      error: delError ? `${delError}; Blob nach del() noch vorhanden` : "Blob nach del() noch vorhanden",
    };
    if (lastHit.uploadedAt) entry.uploadedAt = lastHit.uploadedAt;
    return entry;
  }
  return {
    pathname,
    deleted: false,
    error: delError ?? `Prüfung fehlgeschlagen: ${lastError ?? "Unknown"}`,
  };
}

/**
 * Deletes by pathname with the store token, then counts a path only when
 * `head()` and an uncached `get()` both miss it. `del()` resolving is not
 * success: the API does not throw when the pathname is already gone.
 */
export async function deleteVerifiedBlobs(
  pathnames: readonly string[],
  io: BlobStoreIo,
  token: string,
): Promise<{ deleted: number; blobs: BlobObjectWipe[] }> {
  const blobs: BlobObjectWipe[] = [];
  await mapPool([...new Set(pathnames)], 4, async (pathname) => {
    blobs.push(await deleteOne(pathname, io, token));
  });
  blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
  return { deleted: blobs.filter((blob) => blob.deleted).length, blobs };
}

export async function commitBlobWipe(
  wipe: PathWipe,
  io: BlobStoreIo = defaultBlobIo,
  token: string | undefined = process.env.BLOB_READ_WRITE_TOKEN,
): Promise<void> {
  const resolved = blobToken(token);
  if (!resolved) {
    wipe.deleted = 0;
    wipe.error = wipe.error ?? "BLOB_READ_WRITE_TOKEN fehlt — Blob übersprungen";
    return;
  }
  if (wipe.pathnames.length === 0) {
    wipe.deleted = 0;
    return;
  }
  const result = await deleteVerifiedBlobs(wipe.pathnames, io, resolved);
  wipe.deleted = result.deleted;
  const untouched = (wipe.blobs ?? []).filter((blob) => !wipe.pathnames.includes(blob.pathname));
  wipe.blobs = [...result.blobs, ...untouched].sort((a, b) => a.pathname.localeCompare(b.pathname));
  const failed = result.blobs.filter((blob) => !blob.deleted);
  if (failed.length > 0) {
    const summary = `${failed.length} Pfad(e) nicht gelöscht`;
    wipe.error = wipe.error ? `${wipe.error}; ${summary}` : summary;
  }
}

type BlobPlan = WipeAccountResult["blob"];

export async function planAccountBlobs(
  scope: AccountScope,
  records: readonly AccountRecord[],
  io: BlobStoreIo = defaultBlobIo,
  token: string | undefined = process.env.BLOB_READ_WRITE_TOKEN,
): Promise<BlobPlan> {
  const plan: BlobPlan = {
    drafts: emptyPathWipe(),
    documents: emptyPathWipe(),
    uploads: emptyPathWipe(),
    contentChecks: 0,
    contentChecksSkipped: 0,
  };
  const resolved = blobToken(token);
  if (!resolved) {
    plan.skipped = "BLOB_READ_WRITE_TOKEN fehlt — Blob übersprungen";
    plan.drafts = emptyPathWipe(plan.skipped);
    plan.documents = emptyPathWipe(plan.skipped);
    plan.uploads = emptyPathWipe(plan.skipped);
    return plan;
  }

  const listErrors: string[] = [];
  const draftCandidates = new Set<string>(derivedDraftPaths(scope));
  let listedDrafts: string[] = [];
  try {
    listedDrafts = await listBlobPrefix("gobd/drafts/", io, resolved);
  } catch (error) {
    listErrors.push(safeErrorMessage(error));
  }
  try {
    const deadline = Date.now() + DRAFT_CONTENT_BUDGET_MS;
    const unchecked: string[] = [];
    for (const pathname of listedDrafts) {
      const kind = classifyBlobPathname(pathname, scope);
      if (kind === "draft") {
        draftCandidates.add(pathname);
        continue;
      }
      if (!pathname.startsWith("gobd/drafts/") || pathname.slice("gobd/drafts/".length).includes("/")) {
        continue;
      }
      unchecked.push(pathname);
    }
    await mapPool(unchecked, 4, async (pathname) => {
      if (Date.now() > deadline) {
        plan.contentChecksSkipped += 1;
        return;
      }
      plan.contentChecks += 1;
      const text = await readBlobText(pathname, io, resolved);
      if (!text) return;
      try {
        if (draftPayloadMatchesEmail(JSON.parse(text) as unknown, scope.email)) {
          draftCandidates.add(pathname);
        }
      } catch {
        // Not JSON — leave it.
      }
    });
    plan.drafts = wipeFromInspect(await inspectBlobs([...draftCandidates], io, resolved));

    const documentCandidates = new Set<string>(derivedDocumentPaths(records));
    await mapPool(scope.familyIds, 3, async (familyId) => {
      try {
        for (const pathname of await listBlobPrefix(`gobd/${familyId}/`, io, resolved)) {
          if (classifyBlobPathname(pathname, scope) === "document") {
            documentCandidates.add(pathname);
          }
        }
      } catch (error) {
        listErrors.push(safeErrorMessage(error));
      }
    });
    plan.documents = wipeFromInspect(await inspectBlobs([...documentCandidates], io, resolved));

    const uploadCandidates = new Set<string>();
    await mapPool(scope.uploadOwners, 3, async (owner) => {
      try {
        for (const pathname of await listBlobPrefix(`gobd/uploads/${owner}/`, io, resolved)) {
          if (classifyBlobPathname(pathname, scope) === "upload") {
            uploadCandidates.add(pathname);
          }
        }
      } catch (error) {
        listErrors.push(safeErrorMessage(error));
      }
    });
    plan.uploads = wipeFromInspect(await inspectBlobs([...uploadCandidates], io, resolved));
  } catch (error) {
    listErrors.push(safeErrorMessage(error));
  }
  if (listErrors.length > 0) {
    plan.error = listErrors[0];
  }

  if (plan.contentChecksSkipped > 0) {
    plan.drafts.skipped =
      "Weitere Entwürfe nicht inhaltlich geprüft (Zeitbudget). Abgeleitete draftKeys wurden per head() geprüft.";
  }
  return plan;
}
