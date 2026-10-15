/**
 * Änderungshistorie der Mitwirkung. Keine Antworttexte.
 * Inhalt bleibt, solange die Firma besteht. Einladung, Widerruf und
 * Moduländerung werden nach 24 Monaten nicht mehr ausgeliefert.
 * Es wird nichts automatisch gelöscht.
 */
import { modulById } from "@/lib/module/katalog";
import { moduleIdList } from "@/lib/memberships";
import { emailsEqual } from "@/lib/types";

export const AUDIT_PAGE_SIZE = 20;
export const AUDIT_SUMMARY_MAX = 200;
export const DRAFT_SAVED_WINDOW_MS = 15 * 60 * 1000;
export const AUDIT_LIMIT_MONTHS = 24;

export const AUDIT_ACTIONS = [
  "invite.sent",
  "invite.accepted",
  "invite.revoked",
  "invite.failed",
  "membership.modules_changed",
  "draft.saved",
  "draft.conflict",
  "upload.added",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditRole = "owner" | "member";

export type AuditEvent = {
  eventId: string;
  at: string;
  actorEmail: string;
  actorRole: AuditRole;
  ownerEmail: string;
  entityId: string;
  action: AuditAction;
  moduleIds: string;
  draftRevision: number | "";
  summary: string;
};

export const AUDIT_SHEET_COLUMNS = [
  "event_id",
  "at",
  "actor_email",
  "actor_role",
  "owner_email",
  "entity_id",
  "action",
  "module_ids",
  "draft_revision",
  "summary",
] as const;

export type AuditSheetColumn = (typeof AUDIT_SHEET_COLUMNS)[number];

const CONTENT_ACTIONS = new Set<AuditAction>(["draft.saved", "draft.conflict", "upload.added"]);
const LIMITED_ACTIONS = new Set<AuditAction>([
  "invite.sent",
  "invite.accepted",
  "invite.revoked",
  "invite.failed",
  "membership.modules_changed",
]);

const ACTION_SET = new Set<string>(AUDIT_ACTIONS);

export function isAuditAction(value: string): value is AuditAction {
  return ACTION_SET.has(value);
}

export function clipSummary(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= AUDIT_SUMMARY_MAX) return clean;
  return clean.slice(0, AUDIT_SUMMARY_MAX);
}

export function normalizeAuditModules(moduleIds: string | readonly string[]): string {
  const raw = typeof moduleIds === "string" ? moduleIdList(moduleIds) : moduleIds;
  return [...new Set(raw.map((id) => id.trim()).filter(Boolean))].sort().join(",");
}

export function moduleListLabel(moduleIds: string): string {
  const numbers = normalizeAuditModules(moduleIds)
    .split(",")
    .filter(Boolean)
    .map((id) => modulById(id)?.nr)
    .filter((nr): nr is number => typeof nr === "number")
    .sort((a, b) => a - b);
  if (numbers.length === 0) return "";
  if (numbers.length === 1) return `Modul ${numbers[0]}`;
  return `Module ${numbers.join(", ")}`;
}

function roleLabel(role: AuditRole): string {
  return role === "owner" ? "Inhaber" : "Mitwirkung";
}

function briefEmail(email: string): string {
  const value = email.trim().toLowerCase();
  if (value.length <= 60) return value;
  return `${value.slice(0, 57)}…`;
}

function withModules(moduleIds: string, emptyLabel = ""): string {
  return moduleListLabel(moduleIds) || emptyLabel;
}

export function draftSavedSummary(role: AuditRole, moduleIds: string, revision: number): string {
  const parts = [roleLabel(role), "Entwurf gespeichert"];
  const mods = moduleListLabel(moduleIds);
  if (mods) parts.push(mods);
  if (revision > 0) parts.push(`Revision ${revision}`);
  return clipSummary(parts.join(" · "));
}

export function draftConflictSummary(role: AuditRole, moduleIds: string, revision: number): string {
  const parts = [roleLabel(role), "Speichern abgelehnt"];
  const mods = moduleListLabel(moduleIds);
  if (mods) parts.push(mods);
  if (revision > 0) parts.push(`Revision ${revision}`);
  return clipSummary(parts.join(" · "));
}

export function uploadAddedSummary(role: AuditRole, moduleIds: string): string {
  const parts = [roleLabel(role), "Datei hinzugefügt"];
  const mods = moduleListLabel(moduleIds);
  if (mods) parts.push(mods);
  return clipSummary(parts.join(" · "));
}

export function inviteSummary(
  action: "invite.sent" | "invite.accepted" | "invite.revoked" | "invite.failed" | "membership.modules_changed",
  memberEmail: string,
  moduleIds: string,
): string {
  const who = briefEmail(memberEmail);
  const mods = withModules(moduleIds, "alle aktiven Module");
  if (action === "invite.sent") {
    return clipSummary(`Inhaber · Einladung gesendet · ${who} · ${mods}`);
  }
  if (action === "invite.accepted") {
    return clipSummary(`Mitwirkung · Einladung angenommen · ${mods}`);
  }
  if (action === "invite.failed") {
    return clipSummary(`Inhaber · Einladung nicht gesendet · ${who}`);
  }
  if (action === "membership.modules_changed") {
    return clipSummary(`Inhaber · Module geändert · ${who} · ${mods}`);
  }
  return clipSummary(`Inhaber · Zugriff entzogen · ${who}`);
}

/** Inhalt bleibt. Einladung, Widerruf und Moduländerung nur 24 Monate. */
export function auditDeliverable(event: AuditEvent, now: Date): boolean {
  if (CONTENT_ACTIONS.has(event.action)) return true;
  if (!LIMITED_ACTIONS.has(event.action)) return false;
  const at = Date.parse(event.at);
  if (Number.isNaN(at)) return false;
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - AUDIT_LIMIT_MONTHS);
  return at >= cutoff.getTime();
}

export function sameDraftSavedBundle(
  row: AuditEvent,
  input: { actorEmail: string; entityId: string; moduleIds: string },
): boolean {
  return (
    row.action === "draft.saved" &&
    emailsEqual(row.actorEmail, input.actorEmail) &&
    row.entityId === input.entityId &&
    row.moduleIds === input.moduleIds
  );
}

export function formatAuditWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = pick("day");
  const month = pick("month");
  const year = pick("year");
  const hour = pick("hour");
  const minute = pick("minute");
  if (!day || !month || !year || !hour || !minute) return "";
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

export type AuditListItem = {
  eventId: string;
  when: string;
  actorEmail: string;
  line: string;
};

export function toAuditListItem(event: AuditEvent): AuditListItem {
  return {
    eventId: event.eventId,
    when: formatAuditWhen(event.at),
    actorEmail: event.actorEmail,
    line: event.summary,
  };
}
