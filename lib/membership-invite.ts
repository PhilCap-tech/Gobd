import { randomBytes, randomUUID } from "node:crypto";
import { createInviteToken, verifyInviteToken, type InviteTokenClaims } from "@/lib/auth";
import { getAppUrl, magicLinkDevFallbackAllowed } from "@/lib/env";
import { formatEntityAddress, entityOwnedByEmail, type Entity } from "@/lib/entities";
import { inviteMailKey, sendDedupedEmail } from "@/lib/mail-dedupe";
import { buildInviteMail, INVITE_MAIL_FROM } from "@/lib/membership-mail";
import {
  activeCountForEntity,
  activeLimitReached,
  formatModuleIds,
  hashInviteJti,
  inviteHashMatches,
  moduleIdList,
  normalizeMemberEmail,
  publicFirmForMember,
  sameMembershipPair,
  type Membership,
} from "@/lib/memberships";
import {
  getMembership,
  insertMembership,
  listMembershipsByEntity,
  MembershipConflictError,
  replaceMembership,
} from "@/lib/membership-store";
import { emailsEqual } from "@/lib/types";
import {
  INVITE_ACCEPT_LIMIT_MESSAGE,
  INVITE_ACTIVE_MESSAGE,
  INVITE_EMAIL_MESSAGE,
  INVITE_LIMIT_MESSAGE,
  INVITE_LINK_INVALID,
  INVITE_MAIL_FAILED,
  INVITE_SELF_MESSAGE,
} from "@/lib/membership-copy";

export {
  INVITE_ACCEPT_LIMIT_MESSAGE,
  INVITE_ACTIVE_MESSAGE,
  INVITE_EMAIL_MESSAGE,
  INVITE_LIMIT_MESSAGE,
  INVITE_LINK_INVALID,
  INVITE_MAIL_FAILED,
  INVITE_SELF_MESSAGE,
} from "@/lib/membership-copy";

/** Ein Doppelklick sendet eine Mail. Ein bewusstes erneutes Senden wartet diese Frist. */
export const INVITE_RESEND_WINDOW_MS = 60_000;

export type InviteFailureCode = "email" | "self" | "limit" | "active" | "mail" | "entity";

export type InviteOutcome =
  | { ok: true; membershipId: string; throttled: boolean }
  | { ok: false; error: string; code: InviteFailureCode };

export type InvitePreview =
  | {
      ok: true;
      email: string;
      ownerEmail: string;
      name: string;
      street: string;
      zip: string;
      city: string;
      address: string;
      moduleIds: string[];
    }
  | { ok: false; message: string };

export type AcceptOutcome =
  | { ok: true; email: string; entityId: string }
  | { ok: false; message: string };

type EntityLoader = (entityId: string) => Promise<Entity | null>;

const tails = new Map<string, Promise<void>>();

function lock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const current = previous.then(run, run);
  const settled = current.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, settled);
  void settled.then(() => {
    if (tails.get(key) === settled) tails.delete(key);
  });
  return current;
}

function inviteUrl(token: string): string {
  const params = new URLSearchParams({ token });
  return `${getAppUrl()}/auth/invite?${params.toString()}`;
}

async function claimsFor(token: string): Promise<InviteTokenClaims | null> {
  return verifyInviteToken(token);
}

async function pendingMatches(claims: InviteTokenClaims): Promise<Membership | null> {
  const row = await getMembership(claims.membershipId);
  if (!row || row.status !== "pending") return null;
  if (!emailsEqual(row.memberEmail, claims.email)) return null;
  if (!inviteHashMatches(row.tokenHash, claims.jti)) return null;
  return row;
}

/**
 * Annahmeseite. Der Token bleibt gültig: Mail-Programme rufen den Link vorab auf.
 */
export async function previewInvite(token: string, loadEntity: EntityLoader): Promise<InvitePreview> {
  const claims = await claimsFor(token);
  if (!claims) return { ok: false, message: INVITE_LINK_INVALID };
  const row = await pendingMatches(claims);
  if (!row) return { ok: false, message: INVITE_LINK_INVALID };
  const entity = await loadEntity(row.entityId);
  if (!entity || !emailsEqual(entity.userEmail, row.ownerEmail)) {
    return { ok: false, message: INVITE_LINK_INVALID };
  }
  const firm = publicFirmForMember(entity);
  return {
    ok: true,
    email: row.memberEmail,
    ownerEmail: row.ownerEmail,
    ...firm,
    address: formatEntityAddress(firm),
    moduleIds: moduleIdList(row.moduleIds),
  };
}

/**
 * Annahme verbraucht den Token genau einmal.
 * Abgelaufener und bereits verbrauchter Token ergeben dieselbe Meldung.
 */
export async function acceptInvite(token: string, loadEntity: EntityLoader): Promise<AcceptOutcome> {
  const claims = await claimsFor(token);
  if (!claims) return { ok: false, message: INVITE_LINK_INVALID };
  const initial = await pendingMatches(claims);
  if (!initial) return { ok: false, message: INVITE_LINK_INVALID };
  return lock(`accept:${initial.entityId}`, async () => {
    const row = await pendingMatches(claims);
    if (!row) return { ok: false, message: INVITE_LINK_INVALID };
    const entity = await loadEntity(row.entityId);
    if (!entity || !emailsEqual(entity.userEmail, row.ownerEmail)) {
      return { ok: false, message: INVITE_LINK_INVALID };
    }
    const rows = await listMembershipsByEntity(row.entityId);
    if (activeLimitReached(activeCountForEntity(rows, row.entityId))) {
      return { ok: false, message: INVITE_ACCEPT_LIMIT_MESSAGE };
    }
    const now = new Date().toISOString();
    const saved = await replaceMembership({
      ...row,
      status: "active",
      tokenHash: "",
      acceptedAt: now,
      updatedAt: now,
    });
    if (!saved) return { ok: false, message: INVITE_LINK_INVALID };
    return { ok: true, email: saved.memberEmail, entityId: saved.entityId };
  });
}

async function deliverInvite(row: Membership, entity: Entity): Promise<InviteOutcome> {
  const key = inviteMailKey(row.membershipId);
  const previousHash = row.tokenHash;
  const jti = randomBytes(32).toString("base64url");
  const token = createInviteToken({
    membershipId: row.membershipId,
    email: row.memberEmail,
    jti,
  });
  const stamped: Membership = {
    ...row,
    tokenHash: hashInviteJti(jti),
    updatedAt: new Date().toISOString(),
  };
  const stored = await replaceMembership(stamped);
  if (!stored) return { ok: false, error: INVITE_MAIL_FAILED, code: "mail" };

  const url = inviteUrl(token);
  const mail = buildInviteMail({
    firmName: entity.name,
    street: entity.street,
    zip: entity.zip,
    city: entity.city,
    ownerEmail: row.ownerEmail,
    inviteUrl: url,
  });
  const result = await sendDedupedEmail({
    dedupeKey: key,
    windowMs: INVITE_RESEND_WINDOW_MS,
    to: row.memberEmail,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    from: INVITE_MAIL_FROM,
    replyTo: row.ownerEmail,
  });

  if (result.duplicate) {
    await replaceMembership({ ...stored, tokenHash: previousHash, updatedAt: stored.updatedAt });
    return { ok: true, membershipId: row.membershipId, throttled: true };
  }

  const loggedOnly = result.stub && magicLinkDevFallbackAllowed();
  if (loggedOnly) {
    console.info("[invite] dev fallback Einladungslink — nur Server-Log, nicht in der Response");
    console.info(url);
  }
  if (result.sent || loggedOnly) {
    return { ok: true, membershipId: row.membershipId, throttled: false };
  }

  await replaceMembership({
    ...stored,
    tokenHash: "",
    updatedAt: new Date().toISOString(),
  });
  return { ok: false, error: INVITE_MAIL_FAILED, code: "mail" };
}

/**
 * Einladung nur durch den Inhaber. Der Rückgabewert enthält den Link nicht.
 */
export async function inviteMitwirkende(input: {
  ownerEmail: string;
  entity: Entity;
  memberEmail: string;
  moduleIds: string[];
}): Promise<InviteOutcome> {
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  if (!entityOwnedByEmail(input.entity, ownerEmail)) {
    return { ok: false, error: "Kein Zugriff.", code: "entity" };
  }
  const memberEmail = normalizeMemberEmail(input.memberEmail);
  if (!memberEmail) return { ok: false, error: INVITE_EMAIL_MESSAGE, code: "email" };
  if (emailsEqual(memberEmail, ownerEmail)) {
    return { ok: false, error: INVITE_SELF_MESSAGE, code: "self" };
  }
  const moduleIds = formatModuleIds(input.moduleIds);

  return lock(`${input.entity.entityId}:${memberEmail}`, async () => {
    const rows = await listMembershipsByEntity(input.entity.entityId);
    const existing = rows.find((row) => sameMembershipPair(row, memberEmail, input.entity.entityId) && (row.status === "pending" || row.status === "active"));
    if (existing?.status === "active") {
      return { ok: false, error: INVITE_ACTIVE_MESSAGE, code: "active" };
    }
    if (!existing && activeLimitReached(activeCountForEntity(rows, input.entity.entityId))) {
      return { ok: false, error: INVITE_LIMIT_MESSAGE, code: "limit" };
    }

    const now = new Date().toISOString();
    let row: Membership;
    if (existing) {
      row = {
        ...existing,
        moduleIds,
        updatedAt: now,
      };
      const replaced = await replaceMembership(row);
      if (!replaced) return { ok: false, error: INVITE_MAIL_FAILED, code: "mail" };
      row = replaced;
    } else {
      row = {
        membershipId: randomUUID(),
        ownerEmail,
        memberEmail,
        entityId: input.entity.entityId,
        status: "pending",
        moduleIds,
        tokenHash: "",
        invitedAt: now,
        acceptedAt: "",
        revokedAt: "",
        invitedBy: ownerEmail,
        updatedAt: now,
      };
      try {
        await insertMembership(row);
      } catch (error) {
        if (error instanceof MembershipConflictError) {
          return { ok: false, error: INVITE_ACTIVE_MESSAGE, code: "active" };
        }
        throw error;
      }
    }
    return deliverInvite(row, input.entity);
  });
}
