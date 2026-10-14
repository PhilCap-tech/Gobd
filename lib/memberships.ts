import { createHash, timingSafeEqual } from "node:crypto";
import { emailsEqual } from "@/lib/types";

/** Höchstens fünf aktive Mitwirkende je Firma. */
export const MAX_ACTIVE_MEMBERS_PER_FIRM = 5;

export type MembershipStatus = "pending" | "active" | "revoked";

export type Membership = {
  membershipId: string;
  ownerEmail: string;
  memberEmail: string;
  entityId: string;
  status: MembershipStatus;
  /** Kommagetrennt `m01`…`m24`, oder leer für alle aktiven Module. */
  moduleIds: string;
  tokenHash: string;
  invitedAt: string;
  acceptedAt: string;
  revokedAt: string;
  invitedBy: string;
  updatedAt: string;
};

export const MEMBERSHIP_SHEET_COLUMNS = [
  "membership_id",
  "owner_email",
  "member_email",
  "entity_id",
  "status",
  "module_ids",
  "token_hash",
  "invited_at",
  "accepted_at",
  "revoked_at",
  "invited_by",
  "updated_at",
] as const;

export type MembershipSheetColumn = (typeof MEMBERSHIP_SHEET_COLUMNS)[number];

export const MEMBERSHIP_SHEET_COLUMN_FIELDS = {
  membership_id: "membershipId",
  owner_email: "ownerEmail",
  member_email: "memberEmail",
  entity_id: "entityId",
  status: "status",
  module_ids: "moduleIds",
  token_hash: "tokenHash",
  invited_at: "invitedAt",
  accepted_at: "acceptedAt",
  revoked_at: "revokedAt",
  invited_by: "invitedBy",
  updated_at: "updatedAt",
} as const satisfies Record<MembershipSheetColumn, keyof Membership>;

const MODULE_ID = /^m(?:0[1-9]|1\d|2[0-4])$/;

export function emptyMembership(): Membership {
  return {
    membershipId: "",
    ownerEmail: "",
    memberEmail: "",
    entityId: "",
    status: "pending",
    moduleIds: "",
    tokenHash: "",
    invitedAt: "",
    acceptedAt: "",
    revokedAt: "",
    invitedBy: "",
    updatedAt: "",
  };
}

export function normalizeMemberEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || /\s/.test(email)) return null;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || !domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return null;
  }
  return email;
}

/** Leer heißt: alle aktiven Module. Ungültige IDs ergeben null. */
export function parseModuleIds(value: unknown): string[] | null {
  if (value == null || value === "") return [];
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const ids = [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
  if (ids.length > 24) return null;
  if (ids.some((id) => !MODULE_ID.test(id))) return null;
  return ids.sort();
}

export function formatModuleIds(ids: readonly string[]): string {
  return [...ids].sort().join(",");
}

export function moduleIdList(moduleIds: string): string[] {
  return parseModuleIds(moduleIds) ?? [];
}

export function hashInviteJti(jti: string): string {
  return createHash("sha256").update(jti).digest("hex");
}

export function inviteHashMatches(stored: string, jti: string): boolean {
  const hash = hashInviteJti(jti);
  const left = Buffer.from(stored);
  const right = Buffer.from(hash);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function normalizeHeaderKey(col: string): string {
  return col.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const HEADER_FIELDS: Record<string, keyof Membership> = (() => {
  const map: Record<string, keyof Membership> = {};
  for (const [column, field] of Object.entries(MEMBERSHIP_SHEET_COLUMN_FIELDS) as Array<
    [MembershipSheetColumn, keyof Membership]
  >) {
    map[column] = field;
    map[normalizeHeaderKey(column)] = field;
    map[field] = field;
    map[field.toLowerCase()] = field;
  }
  return map;
})();

export function membershipFieldForHeader(header: string): keyof Membership | undefined {
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  return HEADER_FIELDS[trimmed] ?? HEADER_FIELDS[normalizeHeaderKey(trimmed)];
}

function asStatus(value: string): MembershipStatus | null {
  if (value === "pending" || value === "active" || value === "revoked") return value;
  return null;
}

export function membershipSheetValues(
  row: Membership,
  header: readonly string[] = MEMBERSHIP_SHEET_COLUMNS,
): string[] {
  return header.map((col) => {
    const field =
      membershipFieldForHeader(col) ??
      MEMBERSHIP_SHEET_COLUMN_FIELDS[col as MembershipSheetColumn];
    return field ? row[field] : "";
  });
}

export function parseMembership(header: string[], values: string[]): Membership | null {
  const raw: Partial<Record<keyof Membership, string>> = {};
  header.forEach((col, index) => {
    const field = membershipFieldForHeader(col);
    if (!field) return;
    raw[field] = String(values[index] ?? "").trim();
  });
  return normalizeMembership({
    ...raw,
    status: asStatus(raw.status ?? "") ?? undefined,
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeMembership(value: Partial<Membership> | null | undefined): Membership | null {
  if (!value) return null;
  const status = asStatus(text(value.status));
  const membershipId = text(value.membershipId);
  const entityId = text(value.entityId);
  const ownerEmail = text(value.ownerEmail).toLowerCase();
  const memberEmail = normalizeMemberEmail(text(value.memberEmail));
  if (!status || !membershipId || !entityId || !ownerEmail || !memberEmail) return null;
  const modules = parseModuleIds(text(value.moduleIds));
  return {
    membershipId,
    ownerEmail,
    memberEmail,
    entityId,
    status,
    moduleIds: modules ? formatModuleIds(modules) : "",
    tokenHash: text(value.tokenHash),
    invitedAt: text(value.invitedAt),
    acceptedAt: text(value.acceptedAt),
    revokedAt: text(value.revokedAt),
    invitedBy: text(value.invitedBy).toLowerCase(),
    updatedAt: text(value.updatedAt),
  };
}

export function coerceMembership(value: unknown): Membership | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return normalizeMembership({
    membershipId: text(raw.membershipId) || text(raw.membership_id),
    ownerEmail: text(raw.ownerEmail) || text(raw.owner_email),
    memberEmail: text(raw.memberEmail) || text(raw.member_email),
    entityId: text(raw.entityId) || text(raw.entity_id),
    status: (text(raw.status) || "pending") as MembershipStatus,
    moduleIds: text(raw.moduleIds) || text(raw.module_ids),
    tokenHash: text(raw.tokenHash) || text(raw.token_hash),
    invitedAt: text(raw.invitedAt) || text(raw.invited_at),
    acceptedAt: text(raw.acceptedAt) || text(raw.accepted_at),
    revokedAt: text(raw.revokedAt) || text(raw.revoked_at),
    invitedBy: text(raw.invitedBy) || text(raw.invited_by),
    updatedAt: text(raw.updatedAt) || text(raw.updated_at),
  });
}

export function isOpenMembership(row: Pick<Membership, "status">): boolean {
  return row.status === "pending" || row.status === "active";
}

export function sameMembershipPair(
  row: Pick<Membership, "memberEmail" | "entityId">,
  memberEmail: string,
  entityId: string,
): boolean {
  return row.entityId === entityId && emailsEqual(row.memberEmail, memberEmail);
}

export function activeCountForEntity(rows: readonly Membership[], entityId: string): number {
  return rows.filter((row) => row.entityId === entityId && row.status === "active").length;
}

export function activeLimitReached(count: number): boolean {
  return count >= MAX_ACTIVE_MEMBERS_PER_FIRM;
}

/** Firma, wie eine Mitwirkende sie sehen darf. Steuernummer und USt-IdNr. fehlen. */
export function publicFirmForMember(entity: {
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
}): { name: string; street: string; zip: string; city: string } {
  return {
    name: text(entity.name),
    street: text(entity.street),
    zip: text(entity.zip),
    city: text(entity.city),
  };
}
