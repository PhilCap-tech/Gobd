/**
 * Server-side Intake-Entwürfe (ergänzt localStorage).
 * Speicherung: Vercel Blob (prod) oder lokale Datei (Demo).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
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
  normalizeDraftKey,
} from "@/lib/intake-draft-shared";

function draftPathname(draftKey: string): string {
  const hash = createHash("sha256").update(draftKey).digest("hex").slice(0, 40);
  return `gobd/drafts/${hash}.json`;
}

function localDraftFile(draftKey: string): string {
  const hash = createHash("sha256").update(draftKey).digest("hex").slice(0, 40);
  return path.join(getFileFallbackDir(), "drafts", `${hash}.json`);
}

export async function saveIntakeDraft(draft: IntakeDraft): Promise<{ backend: "blob" | "file" }> {
  const body = JSON.stringify(draft);
  const pathname = draftPathname(draft.draftKey);

  if (isBlobConfigured()) {
    try {
      await put(pathname, body, {
        access: "public",
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return { backend: "blob" };
    } catch (error) {
      console.error("[draft] Blob-Schreiben fehlgeschlagen — Datei-Fallback", error);
    }
  }

  const file = localDraftFile(draft.draftKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
  return { backend: "file" };
}

export async function loadIntakeDraft(draftKey: string): Promise<IntakeDraft | null> {
  if (!draftKey) return null;

  if (isBlobConfigured()) {
    try {
      const result = await get(draftPathname(draftKey), {
        access: "public",
        useCache: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      if (result?.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        const parsed = JSON.parse(text) as IntakeDraft;
        if (!draftIsEmpty(parsed)) return parsed;
      }
    } catch (error) {
      console.warn("[draft] Blob-Lesen fehlgeschlagen", error);
    }
  }

  try {
    const raw = await readFile(localDraftFile(draftKey), "utf8");
    const parsed = JSON.parse(raw) as IntakeDraft;
    return draftIsEmpty(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export async function clearIntakeDraft(draftKey: string): Promise<void> {
  if (!draftKey) return;
  if (isBlobConfigured()) {
    try {
      await del(draftPathname(draftKey), { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (error) {
      console.warn("[draft] Blob-Löschen fehlgeschlagen", error);
    }
  }
  try {
    await unlink(localDraftFile(draftKey));
  } catch {
    // Datei fehlte bereits
  }
}
