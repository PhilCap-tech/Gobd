import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put, type GetCommandOptions, type PutCommandOptions } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/env";
import {
  draftIsEmpty,
  loadIntakeDraft,
  normalizeDraftKey,
  type IntakeDraft,
} from "@/lib/intake-draft";
import { getFileFallbackDir } from "@/lib/store";
import { emailsEqual } from "@/lib/types";

const INDEX_LIMIT = 24;

type IndexEntry = { draftKey: string; updatedAt: string };
type DraftIndex = { entries: IndexEntry[] };

function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 40);
}

function indexFile(email: string): string {
  return path.join(getFileFallbackDir(), "draft-index", `${emailHash(email)}.json`);
}

function indexBlobPath(email: string): string {
  return `gobd/draft-index/${emailHash(email)}.json`;
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

function parseIndex(raw: string): DraftIndex {
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown };
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const clean: IndexEntry[] = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const draftKey = (entry as { draftKey?: unknown }).draftKey;
      const updatedAt = (entry as { updatedAt?: unknown }).updatedAt;
      if (typeof draftKey !== "string" || !draftKey.trim()) continue;
      clean.push({
        draftKey: draftKey.trim(),
        updatedAt: typeof updatedAt === "string" ? updatedAt : "",
      });
    }
    return { entries: clean.slice(0, INDEX_LIMIT) };
  } catch {
    return { entries: [] };
  }
}

function failureClass(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const ctor = (error as { constructor?: { name?: unknown } }).constructor?.name;
    if (typeof ctor === "string" && ctor && ctor !== "Object") return ctor;
  }
  return "Unknown";
}

async function readIndex(email: string): Promise<DraftIndex> {
  const token = blobToken();
  if (isBlobConfigured() && token) {
    try {
      const result = await get(indexBlobPath(email), readOptions(token));
      if (!result || result.statusCode !== 200 || !result.stream) return { entries: [] };
      return parseIndex(await new Response(result.stream).text());
    } catch (error) {
      if (failureClass(error) === "BlobNotFoundError") return { entries: [] };
      throw error;
    }
  }
  try {
    return parseIndex(await readFile(indexFile(email), "utf8"));
  } catch {
    return { entries: [] };
  }
}

async function writeIndex(email: string, index: DraftIndex): Promise<void> {
  const body = JSON.stringify({ entries: index.entries.slice(0, INDEX_LIMIT) });
  const token = blobToken();
  if (isBlobConfigured() && token) {
    if (index.entries.length === 0) {
      try {
        await del(indexBlobPath(email), { token });
      } catch (error) {
        if (failureClass(error) !== "BlobNotFoundError") throw error;
      }
      return;
    }
    await put(indexBlobPath(email), body, writeOptions(token));
    return;
  }
  const file = indexFile(email);
  if (index.entries.length === 0) {
    try {
      await unlink(file);
    } catch {
      // already gone
    }
    return;
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
}

export function openDraftCompany(
  draft: Pick<IntakeDraft, "answers"> | null | undefined,
): string {
  const value = draft?.answers?.katalog?.A01?.values?.company;
  return typeof value === "string" ? value.trim() : "";
}

export function openDraftLabel(draft: IntakeDraft): string {
  return openDraftCompany(draft) || "Verfahrensdokumentation";
}

export function openDraftIsBereich(draft: Pick<IntakeDraft, "draftKey">): boolean {
  return draft.draftKey.endsWith(":bereich");
}

function draftText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function openDraftContinuePath(
  draft: Pick<IntakeDraft, "documentId" | "stripeSessionId" | "entityId">,
): string {
  const documentId = draftText(draft.documentId);
  const sessionId = draftText(draft.stripeSessionId);
  if (documentId) {
    const params = new URLSearchParams({ document_id: documentId });
    if (sessionId) params.set("session_id", sessionId);
    return `/intake?${params.toString()}`;
  }
  if (sessionId) return `/intake?session_id=${encodeURIComponent(sessionId)}`;
  const entityId = draftText(draft.entityId);
  if (entityId) return `/intake?entity_id=${encodeURIComponent(entityId)}`;
  return "/intake";
}

export function isUndeliveredDraft(
  draft: Pick<IntakeDraft, "documentId" | "stripeSessionId">,
  delivered: readonly { documentId?: string; stripeSessionId?: string }[],
): boolean {
  const documentId = draftText(draft.documentId);
  const sessionId = draftText(draft.stripeSessionId);
  return !delivered.some((row) => {
    const rowDocument = draftText(row.documentId);
    if (!rowDocument) return false;
    if (documentId && rowDocument === documentId) return true;
    return Boolean(sessionId) && draftText(row.stripeSessionId) === sessionId;
  });
}

/** Remember a saved Entwurf under the owner email. The path is a hash, not the address. */
export async function rememberOpenDraft(draft: IntakeDraft): Promise<boolean> {
  const email = draft.email.trim().toLowerCase();
  const draftKey = draft.draftKey.trim();
  if (!email || !draftKey || draftIsEmpty(draft)) return false;
  try {
    const index = await readIndex(email);
    const entries = index.entries.filter((entry) => entry.draftKey !== draftKey);
    entries.unshift({ draftKey, updatedAt: draft.updatedAt });
    await writeIndex(email, { entries: entries.slice(0, INDEX_LIMIT) });
    return true;
  } catch (error) {
    console.error("[draft] Index schreiben fehlgeschlagen", failureClass(error));
    return false;
  }
}

export async function forgetOpenDraft(email: string, draftKey: string): Promise<void> {
  const owner = email.trim().toLowerCase();
  const key = draftKey.trim();
  if (!owner || !key) return;
  try {
    const index = await readIndex(owner);
    const entries = index.entries.filter((entry) => entry.draftKey !== key);
    if (entries.length === index.entries.length) return;
    await writeIndex(owner, { entries });
  } catch (error) {
    console.error("[draft] Index löschen fehlgeschlagen", failureClass(error));
  }
}

/** Open Entwürfe of this login. A draft whose stored email differs is dropped. */
export async function listOpenDraftsForEmail(email: string): Promise<IntakeDraft[]> {
  const owner = email.trim().toLowerCase();
  if (!owner) return [];
  try {
    const index = await readIndex(owner);
    const drafts: IntakeDraft[] = [];
    const keep: IndexEntry[] = [];
    for (const entry of index.entries) {
      const draft = await loadIntakeDraft(entry.draftKey);
      if (!draft || draftIsEmpty(draft) || !emailsEqual(draft.email, owner)) continue;
      drafts.push(draft);
      keep.push(entry);
    }
    if (keep.length !== index.entries.length) {
      await writeIndex(owner, { entries: keep });
    }
    drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return drafts;
  } catch (error) {
    console.error("[draft] Index lesen fehlgeschlagen", failureClass(error));
    return [];
  }
}

async function loadSessionDrafts(sessionId: string): Promise<IntakeDraft[]> {
  const id = sessionId.trim();
  if (!id) return [];
  const found: IntakeDraft[] = [];
  for (const modus of ["gesamt", "bereich"] as const) {
    const key = normalizeDraftKey({ sessionId: id, modus });
    try {
      const draft = await loadIntakeDraft(key);
      if (!draft || draftIsEmpty(draft)) continue;
      found.push(draft);
    } catch (error) {
      console.error("[draft] Fortsetzen fehlgeschlagen", failureClass(error));
    }
  }
  found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return found;
}

/**
 * Any saved Entwurf for this checkout, regardless of who is logged in.
 * Used only to see that the session was already used. Not an access grant.
 */
export async function loadSessionDraftAnyOwner(sessionId: string): Promise<IntakeDraft | null> {
  const found = await loadSessionDrafts(sessionId);
  return found[0] ?? null;
}

/**
 * Server-Entwurf to this checkout session, only when the stored email is the login.
 * A foreign login gets nothing, even if it knows the session id.
 */
export async function loadOwnerSessionDraft(
  email: string,
  sessionId: string,
): Promise<IntakeDraft | null> {
  const owner = email.trim().toLowerCase();
  const id = sessionId.trim();
  if (!owner || !id) return null;
  const found = (await loadSessionDrafts(id)).filter((draft) => emailsEqual(draft.email, owner));
  return found[0] ?? null;
}
