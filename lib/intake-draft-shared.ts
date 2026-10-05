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
