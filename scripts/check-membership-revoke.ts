/**
 * Widerruf (Konzept 4.4, Oberfläche 7.1, die Widerrufszeilen aus Slice D).
 * Keine echten Adressen. Versand nur an delivered@resend.dev oder @example.com, und nur über den Mock.
 *
 *   npx tsx scripts/check-membership-revoke.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postRevoke } from "../app/api/auth/invite/revoke/route";
import { createSessionToken, verifySessionToken } from "../lib/auth";
import type { Entity } from "../lib/entities";
import { setMailDedupeTestHooks } from "../lib/mail-dedupe";
import { firmAccessForSession, pdfAllowedForMembership } from "../lib/membership-access";
import { REVOKE_CONFIRM } from "../lib/membership-copy";
import { INVITE_LINK_INVALID, acceptInvite, inviteMitwirkende, previewInvite, revokeMitwirkende } from "../lib/membership-invite";
import { INVITE_MAIL_FROM, buildRevokeMail } from "../lib/membership-mail";
import {
  getMembership,
  insertMembership,
  listMembershipsByEntity,
  setMembershipStoreTestHooks,
} from "../lib/membership-store";
import { activeCountForEntity, type Membership } from "../lib/memberships";

function ok(condition: unknown, message: string) {
  assert.ok(condition, message);
  console.log("ok:", message);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEMBER = "delivered@resend.dev";
const OWNER = "inhaber@example.com";
const OTHER_OWNER = "andere-inhaberin@example.com";
const TAX = "12/345/67890";
const VAT = "DE123456789";
const ANSWER = "Lagerbestand 4711";
const WHEN = new Date("2026-10-14T12:00:00.000Z");

function firm(partial: Partial<Entity> & Pick<Entity, "entityId" | "userEmail" | "name">): Entity {
  return {
    street: "Hafenstraße 4",
    zip: "20457",
    city: "Hamburg",
    stnr: TAX,
    ustId: VAT,
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-14T08:00:00.000Z",
    checkoutPrefill: "",
    ...partial,
  };
}

const nordlicht = firm({
  entityId: "ent-nordlicht",
  userEmail: OWNER,
  name: "Nordlicht GmbH",
});

const suedlicht = firm({
  entityId: "ent-suedlicht",
  userEmail: OTHER_OWNER,
  name: "Südlicht KG",
  street: "Speicherstraße 2",
  zip: "28195",
  city: "Bremen",
});

const eigene = firm({
  entityId: "ent-eigene",
  userEmail: MEMBER,
  name: "Eigene Firma",
  stnr: "",
  ustId: "",
});

function activeRow(entity: Entity, memberEmail: string): Membership {
  const now = "2026-10-14T09:00:00.000Z";
  return {
    membershipId: randomUUID(),
    ownerEmail: entity.userEmail,
    memberEmail,
    entityId: entity.entityId,
    status: "active",
    moduleIds: "",
    tokenHash: "",
    invitedAt: now,
    acceptedAt: now,
    revokedAt: "",
    invitedBy: entity.userEmail,
    updatedAt: now,
  };
}

function tokenFromMail(text: string): string {
  const match = text.match(/\/auth\/invite\?token=([^\s<]+)/);
  if (!match?.[1]) return "";
  return decodeURIComponent(match[1]);
}

type SentMail = {
  to?: string;
  from?: string;
  replyTo?: string;
  subject?: string;
  text?: string;
  html?: string;
  idempotencyKey?: string;
};

const env = process.env as Record<string, string | undefined>;
const saved = {
  EMAIL_FROM: env.EMAIL_FROM,
  RESEND_API_KEY: env.RESEND_API_KEY,
  MAGIC_LINK_SECRET: env.MAGIC_LINK_SECRET,
};

function allowedRecipient(address: string | undefined): boolean {
  if (!address) return false;
  return address === MEMBER || address.endsWith("@example.com");
}

async function main() {
  const mailDir = mkdtempSync(path.join(tmpdir(), "revoke-mail-"));
  const storeDir = mkdtempSync(path.join(tmpdir(), "revoke-store-"));
  const sent: SentMail[] = [];
  let failNext = false;

  env.MAGIC_LINK_SECRET = env.MAGIC_LINK_SECRET || "membership-revoke-test-secret";
  env.EMAIL_FROM = "other-sender@example.com";
  delete env.RESEND_API_KEY;

  setMembershipStoreTestHooks({ dir: storeDir });
  setMailDedupeTestHooks({
    dir: mailDir,
    now: () => WHEN.getTime(),
    send: async (input) => {
      if (failNext) {
        failNext = false;
        return { stub: false, sent: false };
      }
      sent.push(input);
      return { stub: false, sent: true, id: "email_test" };
    },
  });

  const entities = new Map<string, Entity>([
    [nordlicht.entityId, nordlicht],
    [suedlicht.entityId, suedlicht],
    [eigene.entityId, eigene],
  ]);

  try {
    const invited = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: nordlicht,
      memberEmail: MEMBER,
      moduleIds: ["m03"],
    });
    ok(invited.ok, "invitation is stored");
    if (!invited.ok) throw new Error("invite");
    const inviteMail = sent.at(-1);
    const token = tokenFromMail(inviteMail?.text ?? "");
    ok(Boolean(token) && (await previewInvite(token, async () => nordlicht)).ok, "pending link works before revocation");

    const http = await postRevoke(
      new Request("http://localhost/api/auth/invite/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: nordlicht.entityId, membershipId: invited.membershipId }),
      }),
      {
        sessionEmail: async () => OWNER,
        ownedEntity: async (entityId) => entities.get(entityId) ?? null,
        revoke: (input) => revokeMitwirkende({ ...input, now: WHEN }),
      },
    );
    const raw = await http.text();
    const payload = JSON.parse(raw) as { ok?: boolean; mailed?: boolean; already?: boolean; membershipId?: string };
    ok(http.status === 200 && payload.ok && payload.mailed && !payload.already, "owner revocation returns ok");
    ok(!raw.includes("token") && !raw.includes(TAX) && !raw.includes(VAT) && !raw.includes(ANSWER), "HTTP response has no token, tax data, or answer text");

    const revoked = await getMembership(invited.membershipId);
    ok(revoked?.status === "revoked" && revoked.tokenHash === "" && revoked.revokedAt === WHEN.toISOString(), "pending row is revoked and the hash is empty");
    const deadPreview = await previewInvite(token, async () => nordlicht);
    const deadAccept = await acceptInvite(token, async () => nordlicht);
    ok(!deadPreview.ok && !deadAccept.ok && deadPreview.message === INVITE_LINK_INVALID && deadAccept.message === INVITE_LINK_INVALID, "revoked invite link is unusable");

    const note = sent.at(-1);
    const expected = buildRevokeMail({ firmName: nordlicht.name, revokedAt: WHEN.toISOString() });
    ok(note?.to === MEMBER && allowedRecipient(note?.to), "revocation mail goes only to delivered@resend.dev");
    ok(note?.from === INVITE_MAIL_FROM && note.from.includes("info@gobd-doku-erstellen.de"), "revocation mail is from info@");
    ok(note?.replyTo === OWNER, "reply-to is the owner");
    ok(note?.text === expected.text && note.html === expected.html, "mail names the firm and the time");
    ok(note?.subject?.includes("Nordlicht GmbH") && note.subject.includes("Mitwirkende"), "subject names the firm and the role");
    ok(!(note?.text ?? "").includes("Mitarbeitende") && !(note?.html ?? "").includes("Mitarbeitende"), "mail says Mitwirkende");
    ok(!(note?.text ?? "").includes(TAX) && !(note?.text ?? "").includes(ANSWER) && !(note?.text ?? "").includes("AGB") && !(note?.text ?? "").includes(token), "mail has no tax number, answer text, statute, or token");
    ok(Boolean(note?.idempotencyKey), "revocation mail uses the central idempotency key");

    const again = await revokeMitwirkende({
      ownerEmail: OWNER,
      entity: nordlicht,
      membershipId: invited.membershipId,
      now: WHEN,
    });
    ok(again.ok && again.already && !again.mailed && sent.length === 2, "a second revocation sends no second mail");

    const renewed = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: nordlicht,
      memberEmail: MEMBER,
      moduleIds: ["m09"],
    });
    ok(renewed.ok && renewed.membershipId !== invited.membershipId, "a new invitation receives a new membership id");
    ok((await getMembership(invited.membershipId))?.status === "revoked", "the revoked row stays revoked");
    if (!renewed.ok) throw new Error("renew");
    const withdrawn = await revokeMitwirkende({
      ownerEmail: OWNER,
      entity: nordlicht,
      membershipId: renewed.membershipId,
      now: WHEN,
    });
    ok(withdrawn.ok && withdrawn.mailed, "the new invitation can be withdrawn");

    const active = activeRow(nordlicht, MEMBER);
    await insertMembership(active);
    const removed = await revokeMitwirkende({
      ownerEmail: OWNER,
      entity: nordlicht,
      membershipId: active.membershipId,
      now: WHEN,
    });
    ok(removed.ok && removed.mailed, "an active member can be removed");
    ok(activeCountForEntity(await listMembershipsByEntity(nordlicht.entityId), nordlicht.entityId) === 0, "removal frees the active slot");
    const removedRow = await getMembership(active.membershipId);
    ok(removedRow?.status === "revoked", "the active row is revoked");

    const other = activeRow(suedlicht, MEMBER);
    await insertMembership(other);
    const session = createSessionToken(MEMBER);
    ok(verifySessionToken(session) === MEMBER, "the session cookie stays valid");
    const here = firmAccessForSession({
      sessionEmail: MEMBER,
      entityOwnerEmail: nordlicht.userEmail,
      entityId: nordlicht.entityId,
      memberships: [removedRow!, other],
    });
    const there = firmAccessForSession({
      sessionEmail: MEMBER,
      entityOwnerEmail: suedlicht.userEmail,
      entityId: suedlicht.entityId,
      memberships: [removedRow!, other],
    });
    const own = firmAccessForSession({
      sessionEmail: MEMBER,
      entityOwnerEmail: eigene.userEmail,
      entityId: eigene.entityId,
      memberships: [removedRow!],
    });
    ok(!here.ok && here.status === 403, "this firm answers 403 after revocation");
    ok(there.ok && there.via === "membership", "a membership at another owner stays reachable");
    ok(own.ok && own.via === "owner", "an own firm of the same email stays reachable");
    ok(
      pdfAllowedForMembership({
        sessionEmail: OWNER,
        documentEmail: OWNER,
        documentEntityId: nordlicht.entityId,
        membership: removedRow,
      }),
      "the owner can still read the PDF",
    );
    ok(
      !pdfAllowedForMembership({
        sessionEmail: MEMBER,
        documentEmail: OWNER,
        documentEntityId: nordlicht.entityId,
        membership: removedRow,
      }),
      "the removed person still cannot read the PDF",
    );

    const limitFirm = firm({ entityId: "ent-limit", userEmail: OWNER, name: "Grenz GmbH" });
    entities.set(limitFirm.entityId, limitFirm);
    const seats: Membership[] = [];
    for (let index = 0; index < 5; index += 1) {
      const row = activeRow(limitFirm, `person-${index}@example.com`);
      seats.push(row);
      await insertMembership(row);
    }
    const blocked = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: limitFirm,
      memberEmail: MEMBER,
      moduleIds: [],
    });
    ok(!blocked.ok && blocked.error?.includes("fünf"), "five active members still block a new invitation");
    const before = sent.length;
    const [first, second] = await Promise.all([
      revokeMitwirkende({ ownerEmail: OWNER, entity: limitFirm, membershipId: seats[0]!.membershipId, now: WHEN }),
      revokeMitwirkende({ ownerEmail: OWNER, entity: limitFirm, membershipId: seats[0]!.membershipId, now: WHEN }),
    ]);
    const outcomes = [first, second];
    ok(outcomes.filter((item) => item.ok && item.mailed).length === 1, "a double click sends one revocation mail");
    ok(outcomes.filter((item) => item.ok && item.already).length === 1, "the second click finds the row already revoked");
    ok(sent.length === before + 1 && allowedRecipient(sent.at(-1)?.to), "only one synthetic revocation mail was captured");
    ok(activeCountForEntity(await listMembershipsByEntity(limitFirm.entityId), limitFirm.entityId) === 4, "one revoked seat is free");
    const reopened = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: limitFirm,
      memberEmail: MEMBER,
      moduleIds: [],
    });
    ok(reopened.ok, "a new invitation is possible once a seat is free");
    if (!reopened.ok) throw new Error("reopen");
    const reopenedToken = tokenFromMail(sent.at(-1)?.text ?? "");
    const accepted = await acceptInvite(reopenedToken, async () => limitFirm);
    ok(accepted.ok, "the freed seat can be filled again");
    ok(activeCountForEntity(await listMembershipsByEntity(limitFirm.entityId), limitFirm.entityId) === 5, "the firm is full again at five");

    failNext = true;
    const quietBefore = sent.length;
    const quiet = await revokeMitwirkende({
      ownerEmail: OWNER,
      entity: limitFirm,
      membershipId: seats[1]!.membershipId,
      now: WHEN,
    });
    ok(quiet.ok && !quiet.mailed && !quiet.already, "access ends even when the mail fails");
    ok((await getMembership(seats[1]!.membershipId))?.status === "revoked", "the row stays revoked after a mail failure");
    ok(sent.length === quietBefore, "a failed mail is not recorded as sent");
    const quietAgain = await revokeMitwirkende({
      ownerEmail: OWNER,
      entity: limitFirm,
      membershipId: seats[1]!.membershipId,
      now: WHEN,
    });
    ok(quietAgain.ok && quietAgain.already && sent.length === quietBefore, "a later click does not send the failed mail again");

    const stranger = await postRevoke(
      new Request("http://localhost/api/auth/invite/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: nordlicht.entityId, membershipId: randomUUID() }),
      }),
      {
        sessionEmail: async () => OWNER,
        ownedEntity: async (entityId) => entities.get(entityId) ?? null,
        revoke: revokeMitwirkende,
      },
    );
    ok(stranger.status === 404, "an unknown membership is not revoked");
    const anon = await postRevoke(
      new Request("http://localhost/api/auth/invite/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: nordlicht.entityId, membershipId: active.membershipId }),
      }),
      {
        sessionEmail: async () => null,
        ownedEntity: async () => nordlicht,
        revoke: revokeMitwirkende,
      },
    );
    ok(anon.status === 401, "revocation requires a session");
    const foreign = await postRevoke(
      new Request("http://localhost/api/auth/invite/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: nordlicht.entityId, membershipId: other.membershipId }),
      }),
      {
        sessionEmail: async () => MEMBER,
        ownedEntity: async () => null,
        revoke: revokeMitwirkende,
      },
    );
    ok(foreign.status === 403, "only the owner can revoke");
    ok((await getMembership(other.membershipId))?.status === "active", "the other membership is untouched");

    ok(sent.every((item) => allowedRecipient(item.to)), "every captured mail uses a synthetic recipient");

    const panel = readFileSync(path.join(root, "app/account/firma/mitwirkende-panel.tsx"), "utf8");
    const copy = readFileSync(path.join(root, "lib/membership-copy.ts"), "utf8");
    const mailSource = readFileSync(path.join(root, "lib/membership-mail.ts"), "utf8");
    ok(panel.includes("{REVOKE_CONFIRM}") && copy.includes(REVOKE_CONFIRM), "the confirmation uses the concept sentence");
    ok(panel.includes("Zugriff entziehen") && panel.includes("Zurücknehmen") && panel.includes("Abbrechen"), "both actions ask before they run");
    ok(panel.includes("Mitwirkende") && !panel.includes("Mitarbeitende"), "the panel says Mitwirkende");
    ok(!panel.includes("AGB") && !copy.includes("AGB") && !mailSource.includes("AGB"), "no statute prompt in the revocation copy");
    ok(!mailSource.includes("Mitarbeitende"), "the mail source says Mitwirkende");

    console.log("check-membership-revoke: ok");
  } finally {
    setMailDedupeTestHooks(null);
    setMembershipStoreTestHooks(null);
    if (saved.EMAIL_FROM === undefined) delete env.EMAIL_FROM;
    else env.EMAIL_FROM = saved.EMAIL_FROM;
    if (saved.RESEND_API_KEY === undefined) delete env.RESEND_API_KEY;
    else env.RESEND_API_KEY = saved.RESEND_API_KEY;
    if (saved.MAGIC_LINK_SECRET === undefined) delete env.MAGIC_LINK_SECRET;
    else env.MAGIC_LINK_SECRET = saved.MAGIC_LINK_SECRET;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
