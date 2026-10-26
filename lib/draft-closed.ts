/**
 * A submitted form must not write its Entwurf again.
 *
 * Each intake page sends a random `formId` with its draft PUTs and with the
 * submit. After the submit is stored, the server marks (draftKey, formId) as
 * closed. A PUT from that page that arrives later (a retry still waiting, or
 * a slow request) is a no-op and does not bring the deleted Entwurf back.
 * A newly opened page has a new formId and saves normally.
 *
 * Markers older than MARKER_TTL_MS (7 days) count as absent; nothing is
 * deleted. The in-memory copy is a bounded LRU.
 */
import { markerExpired, readMarker, writeMarker } from "@/lib/blob-marker";

const PREFIX = "draft-closed";
const FORM_ID = /^[A-Za-z0-9_-]{8,64}$/;
/** Most recent closed pages kept in memory per instance. */
export const CLOSED_MEMORY_LIMIT = 500;
/** key -> closed at (ms). Map order is the LRU order (oldest first). */
const closedHere = new Map<string, number>();

export function normalizeFormId(value: unknown): string {
  if (typeof value !== "string") return "";
  const id = value.trim();
  return FORM_ID.test(id) ? id : "";
}

function markerKey(draftKey: string, formId: string): string {
  return `${draftKey.trim()}\n${formId}`;
}

function remember(key: string, at: number): void {
  closedHere.delete(key);
  closedHere.set(key, at);
  while (closedHere.size > CLOSED_MEMORY_LIMIT) {
    const oldest = closedHere.keys().next().value;
    if (oldest === undefined) break;
    closedHere.delete(oldest);
  }
}

export async function closeDraftForm(draftKey: string, formId: string, now = Date.now()): Promise<void> {
  const id = normalizeFormId(formId);
  if (!draftKey.trim() || !id) return;
  const key = markerKey(draftKey, id);
  remember(key, now);
  await writeMarker(PREFIX, key, JSON.stringify({ at: new Date(now).toISOString() }));
}

export async function isDraftFormClosed(draftKey: string, formId: string, now = Date.now()): Promise<boolean> {
  const id = normalizeFormId(formId);
  if (!draftKey.trim() || !id) return false;
  const key = markerKey(draftKey, id);
  const known = closedHere.get(key);
  if (known !== undefined) {
    if (!markerExpired(new Date(known).toISOString(), now)) {
      remember(key, known);
      return true;
    }
    closedHere.delete(key);
    return false;
  }
  let raw: string | null;
  try {
    raw = await readMarker(PREFIX, key);
  } catch (error) {
    // Blob down: save as before rather than lose the edit.
    console.error("[draft] Abschluss nicht gelesen", error instanceof Error ? error.name : "error");
    return false;
  }
  if (raw === null) return false;
  let at = "";
  try {
    at = (JSON.parse(raw) as { at?: string }).at ?? "";
  } catch {
    at = "";
  }
  if (markerExpired(at, now)) return false;
  remember(key, Date.parse(at));
  return true;
}

/** Entries in memory (prebuild checks). */
export function draftClosedMemorySize(): number {
  return closedHere.size;
}

/** Prebuild checks only. */
export function clearDraftClosedMemory(): void {
  closedHere.clear();
}
