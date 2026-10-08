/**
 * Server-side Intake-Entwürfe (ergänzt localStorage).
 * Speicherung: privater Vercel Blob, oder lokale Datei nur ohne Token (Demo).
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  del,
  get,
  put,
  type GetBlobResult,
  type GetCommandOptions,
  type PutCommandOptions,
} from "@vercel/blob";
import { intakeDraftBlobPath, intakeDraftHash } from "@/lib/draft-path";
import { isBlobConfigured } from "@/lib/env";
import {
  draftIsEmpty,
  type IntakeDraft,
} from "@/lib/intake-draft-shared";
import { getFileFallbackDir } from "@/lib/store";

export type { IntakeDraft } from "@/lib/intake-draft-shared";
export {
  draftIsEmpty,
  draftIsNewer,
  draftRevision,
  incomingDraftWins,
  normalizeDraftKey,
  preferIntakeSnapshot,
} from "@/lib/intake-draft-shared";

/**
 * `gobd-blob` ist privat. `access: "public"` lehnt der Store ab; ein stiller
 * Datei-Fallback hat Entwürfe dann nur auf dem flüchtigen Function-Dateisystem
 * gehalten. Lesen geht nur authentifiziert über `get` (privater Host), nicht
 * per öffentlicher URL. Derselbe Pfad wird bei jedem Save überschrieben.
 */
const DRAFT_BLOB_ACCESS = "private" as const;

export type IntakeDraftBlobIo = {
  put: (pathname: string, body: string, options: PutCommandOptions) => Promise<unknown>;
  get: (pathname: string, options: GetCommandOptions) => Promise<GetBlobResult | null>;
  del: (pathname: string, options?: { token?: string }) => Promise<void>;
};

const defaultBlobIo: IntakeDraftBlobIo = { put, get, del };

export class IntakeDraftStorageError extends Error {
  readonly backend = "blob" as const;
  readonly operation: "read" | "write" | "delete";
  readonly errorClass: string;

  constructor(operation: "read" | "write" | "delete", error: unknown) {
    super("intake draft blob storage failed");
    this.name = "IntakeDraftStorageError";
    this.operation = operation;
    this.errorClass = blobFailureClass(error);
  }
}

function blobFailureClass(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const ctor = (error as { constructor?: { name?: unknown } }).constructor?.name;
    if (typeof ctor === "string" && ctor && ctor !== "Object") return ctor;
  }
  return "Unknown";
}

function isMissingBlob(error: unknown): boolean {
  return blobFailureClass(error) === "BlobNotFoundError";
}

function logBlobFailure(operation: "Lesen" | "Schreiben" | "Löschen", error: unknown): void {
  console.error(`[draft] Blob-${operation} fehlgeschlagen`, blobFailureClass(error));
}

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token && token.trim() ? token : undefined;
}

function draftPathname(draftKey: string): string {
  return intakeDraftBlobPath(draftKey);
}

function localDraftFile(draftKey: string): string {
  return path.join(getFileFallbackDir(), "drafts", `${intakeDraftHash(draftKey)}.json`);
}

function writeOptions(token: string): PutCommandOptions {
  return {
    access: DRAFT_BLOB_ACCESS,
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  };
}

function readOptions(token: string): GetCommandOptions {
  return {
    access: DRAFT_BLOB_ACCESS,
    useCache: false,
    token,
  };
}

async function readBlobDraft(
  draftKey: string,
  token: string,
  io: IntakeDraftBlobIo,
): Promise<IntakeDraft | null> {
  const result = await io.get(draftPathname(draftKey), readOptions(token));
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    const error = new UnexpectedBlobRead();
    logBlobFailure("Lesen", error);
    throw new IntakeDraftStorageError("read", error);
  }
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text) as IntakeDraft;
  return draftIsEmpty(parsed) ? null : parsed;
}

class UnexpectedBlobRead extends Error {
  constructor() {
    super("unexpected blob read");
    this.name = "UnexpectedBlobRead";
  }
}

async function readLocalDraft(draftKey: string): Promise<IntakeDraft | null> {
  try {
    const raw = await readFile(localDraftFile(draftKey), "utf8");
    const parsed = JSON.parse(raw) as IntakeDraft;
    return draftIsEmpty(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

async function writeLocalDraft(draftKey: string, body: string): Promise<void> {
  const file = localDraftFile(draftKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
}

export async function saveIntakeDraft(
  draft: IntakeDraft,
  io: IntakeDraftBlobIo = defaultBlobIo,
): Promise<{ backend: "blob" | "file" }> {
  const body = JSON.stringify(draft);
  const token = blobToken();

  if (isBlobConfigured() && token) {
    try {
      await io.put(draftPathname(draft.draftKey), body, writeOptions(token));
      return { backend: "blob" };
    } catch (error) {
      if (error instanceof IntakeDraftStorageError) throw error;
      logBlobFailure("Schreiben", error);
      throw new IntakeDraftStorageError("write", error);
    }
  }

  await writeLocalDraft(draft.draftKey, body);
  return { backend: "file" };
}

export async function loadIntakeDraft(
  draftKey: string,
  io: IntakeDraftBlobIo = defaultBlobIo,
): Promise<IntakeDraft | null> {
  if (!draftKey) return null;
  const token = blobToken();

  if (isBlobConfigured() && token) {
    try {
      return await readBlobDraft(draftKey, token, io);
    } catch (error) {
      if (error instanceof IntakeDraftStorageError) throw error;
      logBlobFailure("Lesen", error);
      throw new IntakeDraftStorageError("read", error);
    }
  }

  return readLocalDraft(draftKey);
}

export async function clearIntakeDraft(
  draftKey: string,
  io: IntakeDraftBlobIo = defaultBlobIo,
): Promise<void> {
  if (!draftKey) return;
  const token = blobToken();

  if (isBlobConfigured() && token) {
    try {
      await io.del(draftPathname(draftKey), { token });
    } catch (error) {
      if (!isMissingBlob(error)) {
        logBlobFailure("Löschen", error);
        throw new IntakeDraftStorageError("delete", error);
      }
    }
  }

  try {
    await unlink(localDraftFile(draftKey));
  } catch {
    // Datei fehlte bereits
  }
}
