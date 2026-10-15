/**
 * Schreibt die Historie. Ein Fehler hier darf Speichern, Einladen und
 * Widerruf nicht abbrechen. Antworttexte kommen hier nicht an.
 */
import {
  draftConflictSummary,
  draftSavedSummary,
  inviteSummary,
  normalizeAuditModules,
  uploadAddedSummary,
  type AuditRole,
} from "@/lib/audit-log";
import { recordAudit } from "@/lib/audit-store";

type Base = {
  actorEmail: string;
  actorRole: AuditRole;
  ownerEmail: string;
  entityId: string;
  moduleIds?: string | readonly string[];
  at?: string;
};

async function safely(
  context: { action: string; entityId: string },
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error("[audit] nicht geschrieben", {
      action: context.action,
      entityId: context.entityId,
      error: error instanceof Error ? error.name : "error",
    });
  }
}

function present(input: { actorEmail: string; entityId: string }): boolean {
  return Boolean(input.actorEmail.trim() && input.entityId.trim());
}

export async function noteDraftSaved(
  input: Base & { draftRevision: number },
): Promise<void> {
  if (!present(input)) return;
  const moduleIds = normalizeAuditModules(input.moduleIds ?? "");
  await safely({ action: "draft.saved", entityId: input.entityId }, () =>
    recordAudit({
      at: input.at,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      ownerEmail: input.ownerEmail,
      entityId: input.entityId,
      action: "draft.saved",
      moduleIds,
      draftRevision: input.draftRevision,
      summary: draftSavedSummary(input.actorRole, moduleIds, input.draftRevision),
    }),
  );
}

export async function noteDraftConflict(
  input: Base & { draftRevision: number },
): Promise<void> {
  if (!present(input)) return;
  const moduleIds = normalizeAuditModules(input.moduleIds ?? "");
  await safely({ action: "draft.conflict", entityId: input.entityId }, () =>
    recordAudit({
      at: input.at,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      ownerEmail: input.ownerEmail,
      entityId: input.entityId,
      action: "draft.conflict",
      moduleIds,
      draftRevision: input.draftRevision,
      summary: draftConflictSummary(input.actorRole, moduleIds, input.draftRevision),
    }),
  );
}

export async function noteUploadAdded(input: Base): Promise<void> {
  if (!present(input)) return;
  const moduleIds = normalizeAuditModules(input.moduleIds ?? "");
  await safely({ action: "upload.added", entityId: input.entityId }, () =>
    recordAudit({
      at: input.at,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      ownerEmail: input.ownerEmail,
      entityId: input.entityId,
      action: "upload.added",
      moduleIds,
      summary: uploadAddedSummary(input.actorRole, moduleIds),
    }),
  );
}

export async function noteInvite(input: {
  action: "invite.sent" | "invite.accepted" | "invite.revoked" | "invite.failed" | "membership.modules_changed";
  actorEmail: string;
  actorRole: AuditRole;
  ownerEmail: string;
  entityId: string;
  memberEmail: string;
  moduleIds?: string | readonly string[];
  at?: string;
}): Promise<void> {
  if (!present(input)) return;
  const moduleIds = normalizeAuditModules(input.moduleIds ?? "");
  await safely({ action: input.action, entityId: input.entityId }, () =>
    recordAudit({
      at: input.at,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      ownerEmail: input.ownerEmail,
      entityId: input.entityId,
      action: input.action,
      moduleIds,
      summary: inviteSummary(input.action, input.memberEmail, moduleIds),
    }),
  );
}
