/**
 * Client-safe helpers for Intake-Entwürfe (keine Node-/Store-Imports).
 */
import type { IntakeAnswers } from "@/lib/types";

/** Gültig ab/bis and Änderungsgrund, stored with the Entwurf (R10). */
export type DraftVersionChange = {
  validFrom: string;
  validTo: string;
  changeSummary: string;
  changedBy: string;
};

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
  /** Absent on drafts saved before version fields were part of the Entwurf. */
  change?: DraftVersionChange;
};

/** Browser or server snapshot used to pick which Entwurf to restore. */
export type IntakeDraftSnapshot = {
  answers: IntakeAnswers;
  step: number;
  savedAt: string;
  revision?: number;
  change?: DraftVersionChange;
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

export function parseDraftVersionChange(value: unknown): DraftVersionChange | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" ? raw[key] : "");
  const change: DraftVersionChange = {
    validFrom: text("validFrom"),
    validTo: text("validTo"),
    changeSummary: text("changeSummary"),
    changedBy: text("changedBy"),
  };
  if (!change.validFrom && !change.validTo && !change.changeSummary && !change.changedBy) {
    return null;
  }
  return change;
}

export type DraftLoadDecision = {
  /** Saved Entwurf replaced the untouched form. */
  restored: boolean;
  answers: IntakeAnswers;
  step: number;
  change: DraftVersionChange;
  /**
   * Revision the next save starts from. Local edits keep at least the saved
   * revision so a later flush is not rejected as stale and then discarded.
   */
  revision: number;
};

/**
 * What the form shows once a saved Entwurf has been read.
 * Untouched form: restore the Entwurf, including Gültig ab/bis and Änderungsgrund.
 * Edits already typed on this page: those edits stay. The saved Entwurf must
 * not replace them.
 */
export function resolveDraftAfterLoad(input: {
  saved: Pick<IntakeDraftSnapshot, "answers" | "step" | "revision" | "change"> | null;
  localEdited: boolean;
  localRevision: number;
  current: {
    answers: IntakeAnswers;
    step: number;
    change: DraftVersionChange;
  };
}): DraftLoadDecision {
  const currentChange = input.current.change;
  if (!input.saved?.answers) {
    return {
      restored: false,
      answers: input.current.answers,
      step: input.current.step,
      change: currentChange,
      revision: input.localRevision,
    };
  }
  const savedRevision = draftRevision(input.saved);
  if (input.localEdited) {
    return {
      restored: false,
      answers: input.current.answers,
      step: input.current.step,
      change: currentChange,
      revision: Math.max(input.localRevision, savedRevision),
    };
  }
  const savedChange = input.saved.change ?? null;
  return {
    restored: true,
    answers: input.saved.answers,
    step: Number.isFinite(input.saved.step) ? Number(input.saved.step) : 0,
    change: savedChange
      ? {
          validFrom: savedChange.validFrom || currentChange.validFrom,
          validTo: savedChange.validTo,
          changeSummary: savedChange.changeSummary,
          changedBy: savedChange.changedBy || currentChange.changedBy,
        }
      : currentChange,
    revision: Math.max(input.localRevision, savedRevision),
  };
}
