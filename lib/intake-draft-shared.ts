/**
 * Client-safe helpers for Intake-Entwürfe (keine Node-/Store-Imports).
 */
import type { IntakeAnswers } from "@/lib/types";

export type IntakeDraft = {
  draftKey: string;
  email: string;
  stripeSessionId: string;
  documentId: string;
  entityId: string;
  step: number;
  answers: IntakeAnswers;
  updatedAt: string;
  /**
   * Monotonic edit counter from the client. Missing on drafts saved before
   * revision tracking (treated as 0). A higher revision always wins, even
   * when its timestamp is older — an in-flight save must not overwrite a
   * later edit just because the server stamped it later.
   */
  revision?: number;
};

/** Browser or server snapshot used to pick which Entwurf to restore. */
export type IntakeDraftSnapshot = {
  answers: IntakeAnswers;
  step: number;
  savedAt: string;
  revision?: number;
};

export function normalizeDraftKey(parts: {
  sessionId?: string;
  documentId?: string;
  areaFromDocumentId?: string;
  email?: string;
  entityId?: string;
  modus?: string;
}): string {
  if (parts.documentId?.trim()) return `doc:${parts.documentId.trim()}`;
  if (parts.areaFromDocumentId?.trim()) {
    return `area:${parts.areaFromDocumentId.trim()}:${parts.modus === "bereich" ? "bereich" : "gesamt"}`;
  }
  if (parts.sessionId?.trim()) {
    return `session:${parts.sessionId.trim()}:${parts.modus === "bereich" ? "bereich" : "gesamt"}`;
  }
  const email = parts.email?.trim().toLowerCase() ?? "";
  const entity = parts.entityId?.trim() ?? "";
  if (email) {
    return `email:${email}:${entity || "default"}:${parts.modus === "bereich" ? "bereich" : "gesamt"}`;
  }
  return "";
}

export function draftIsNewer(serverUpdatedAt: string, clientUpdatedAt: string): boolean {
  if (!clientUpdatedAt) return Boolean(serverUpdatedAt);
  return serverUpdatedAt.localeCompare(clientUpdatedAt) > 0;
}

export function draftIsEmpty(draft: IntakeDraft | null | undefined): boolean {
  if (!draft) return true;
  if (!draft.draftKey) return true;
  if (!draft.answers || typeof draft.answers !== "object") return true;
  return false;
}

/** Positive integer revisions only. Missing, zero, or garbage counts as unset. */
export function draftRevision(value: { revision?: number } | null | undefined): number {
  const revision = value?.revision;
  if (typeof revision !== "number" || !Number.isFinite(revision) || revision <= 0) return 0;
  return Math.floor(revision);
}

/**
 * Whether a PUT may replace the stored draft.
 * Revisions decide when either side has one. Otherwise the older timestamp rule applies.
 * An equal revision is accepted so a repeated flush of the same edit is not a conflict.
 */
export function incomingDraftWins(
  incoming: { revision?: number; clientUpdatedAt?: string },
  existing: { revision?: number; updatedAt?: string } | null | undefined,
): boolean {
  if (!existing) return true;
  const incomingRev = draftRevision(incoming);
  const existingRev = draftRevision(existing);
  if (incomingRev > 0 || existingRev > 0) return incomingRev >= existingRev;
  return !draftIsNewer(existing.updatedAt ?? "", incoming.clientUpdatedAt ?? "");
}

/**
 * Pick the snapshot to restore. Higher revision wins over a newer clock time.
 * Without revisions, the later timestamp wins (server on a tie, if passed first).
 */
export function preferIntakeSnapshot<T extends IntakeDraftSnapshot>(
  left: T | null,
  right: T | null,
): T | null {
  if (!left) return right;
  if (!right) return left;
  const leftRev = draftRevision(left);
  const rightRev = draftRevision(right);
  if (leftRev !== rightRev) return leftRev > rightRev ? left : right;
  return left.savedAt.localeCompare(right.savedAt) >= 0 ? left : right;
}
