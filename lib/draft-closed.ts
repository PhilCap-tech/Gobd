/**
 * A submitted form must not write its Entwurf again.
 *
 * Each intake page sends a random `formId` with its draft PUTs and with the
 * submit. After the submit is stored, the server marks (draftKey, formId) as
 * closed. A PUT from that page that arrives later (a retry still waiting, or
 * a slow request) is a no-op and does not bring the deleted Entwurf back.
 * A newly opened page has a new formId and saves normally.
 */
import { readMarker, writeMarker } from "@/lib/blob-marker";

const PREFIX = "draft-closed";
const FORM_ID = /^[A-Za-z0-9_-]{8,64}$/;
const closedHere = new Set<string>();

export function normalizeFormId(value: unknown): string {
  if (typeof value !== "string") return "";
  const id = value.trim();
  return FORM_ID.test(id) ? id : "";
}

function markerKey(draftKey: string, formId: string): string {
  return `${draftKey.trim()}\n${formId}`;
}

export async function closeDraftForm(draftKey: string, formId: string): Promise<void> {
  const id = normalizeFormId(formId);
  if (!draftKey.trim() || !id) return;
  const key = markerKey(draftKey, id);
  closedHere.add(key);
  await writeMarker(PREFIX, key, JSON.stringify({ at: new Date().toISOString() }));
}

export async function isDraftFormClosed(draftKey: string, formId: string): Promise<boolean> {
  const id = normalizeFormId(formId);
  if (!draftKey.trim() || !id) return false;
  const key = markerKey(draftKey, id);
  if (closedHere.has(key)) return true;
  let raw: string | null;
  try {
    raw = await readMarker(PREFIX, key);
  } catch (error) {
    // Blob down: save as before rather than lose the edit.
    console.error("[draft] Abschluss nicht gelesen", error instanceof Error ? error.name : "error");
    return false;
  }
  if (raw === null) return false;
  closedHere.add(key);
  return true;
}

/** Prebuild checks only. */
export function clearDraftClosedMemory(): void {
  closedHere.clear();
}
