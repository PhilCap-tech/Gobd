/**
 * Slice A: Mitgliedschaft, Einladung, fünf Aktive, Token, kein PDF.
 * Keine echten Adressen. Versand nur an delivered@resend.dev, und nur über den Mock.
 *
 *   npx tsx scripts/check-membership-invite.ts
 */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GET as verifyGet } from "../app/auth/verify/route";
import { postAccept } from "../app/api/auth/invite/accept/route";
import { downloadPdf } from "../app/api/docs/[id]/download/route";
import { postInvite } from "../app/api/auth/invite/route";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifyInviteToken,
  verifyMagicToken,
  verifySessionToken,
} from "../lib/auth";
import { sessionOwnerDenial } from "../lib/checkout-access";
import type { Entity } from "../lib/entities";
import { getMagicLinkSecret } from "../lib/env";
import { installSheetsHandler } from "../lib/sheets-client";
import { SHEETS_RETRY_MESSAGE, SheetsUnavailableError } from "../lib/sheets-unavailable";
import { setMailDedupeTestHooks } from "../lib/mail-dedupe";
import { pdfAllowedForMembership } from "../lib/membership-access";
import {
  INVITE_ACCEPT_LIMIT_MESSAGE,
  INVITE_LIMIT_MESSAGE,
  INVITE_LINK_INVALID,
  INVITE_RESEND_WINDOW_MS,
  INVITE_SELF_MESSAGE,
  acceptInvite,
  inviteMitwirkende,
  previewInvite,
} from "../lib/membership-invite";
import { INVITE_MAIL_FROM } from "../lib/membership-mail";
import {
  clearMembershipReadCache,
  getMembership,
  insertMembership,
  listMemberships,
  listMembershipsByEntity,
  listMembershipsByMember,
  setMembershipStoreTestHooks,
} from "../lib/membership-store";
import {
  hashInviteJti,
  inviteHashMatches,
  MEMBERSHIP_SHEET_COLUMNS,
  membershipSheetValues,
  type Membership,
} from "../lib/memberships";
import { emptySheetRow } from "../lib/types";

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
  stnr: "99/111/22222",
  ustId: "DE111222333",
});

function signRaw(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getMagicLinkSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function tokenFromMail(text: string): string {
  const match = text.match(/\/auth\/invite\?token=([^\s<]+)/);
  if (!match?.[1]) return "";
  return decodeURIComponent(match[1]);
}

function cookieValue(response: Response): string {
  const line = response.headers.getSetCookie().find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  if (!line) return "";
  const raw = line.split(";")[0]?.slice(SESSION_COOKIE.length + 1) ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

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

const env = process.env as Record<string, string | undefined>;
const saved = {
  EMAIL_FROM: env.EMAIL_FROM,
  RESEND_API_KEY: env.RESEND_API_KEY,
  MAGIC_LINK_SECRET: env.MAGIC_LINK_SECRET,
};

async function main() {
  const mailDir = mkdtempSync(path.join(tmpdir(), "invite-mail-"));
  const storeDir = mkdtempSync(path.join(tmpdir(), "invite-store-"));
  const sent: Array<{ to?: string; from?: string; replyTo?: string; subject?: string; text?: string; html?: string; idempotencyKey?: string }> = [];
  let now = Date.parse("2026-10-14T12:00:00.000Z");
  let failNext = false;

  env.MAGIC_LINK_SECRET = env.MAGIC_LINK_SECRET || "membership-invite-test-secret";
  env.EMAIL_FROM = "other-sender@example.com";
  delete env.RESEND_API_KEY;

  setMembershipStoreTestHooks({ dir: storeDir });
  setMailDedupeTestHooks({
    dir: mailDir,
    now: () => now,
    send: async (input) => {
      sent.push(input);
      if (failNext) {
        failNext = false;
        return { stub: false, sent: false };
      }
      return { stub: false, sent: true, id: "email_test" };
    },
  });

  try {
    const response = await postInvite(
      new Request("http://localhost/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: nordlicht.entityId,
          memberEmail: `  ${MEMBER.toUpperCase()}  `,
          moduleIds: ["m09", "m03"],
        }),
      }),
      {
        sessionEmail: async () => OWNER,
        ownedEntity: async () => nordlicht,
        invite: inviteMitwirkende,
      },
    );
    const raw = await response.text();
    const payload = JSON.parse(raw) as { ok?: boolean; membershipId?: string; throttled?: boolean };
    ok(response.status === 200 && payload.ok && payload.membershipId, "invitation returns ok");
    ok(!raw.includes("/auth/invite"), "HTTP response has no invite link");
    ok(!raw.includes("token="), "HTTP response has no token");
    ok(!raw.includes(TAX) && !raw.includes(VAT), "HTTP response has no tax number or VAT id");

    ok(sent.length === 1, "one invitation mail");
    const mail = sent[0];
    ok(mail?.to === MEMBER, "mail goes only to delivered@resend.dev");
    ok(mail?.from === INVITE_MAIL_FROM, "from is the info@ sender");
    ok(mail?.from?.includes("info@gobd-doku-erstellen.de"), "from address is info@gobd-doku-erstellen.de");
    ok(mail?.replyTo === OWNER, "reply-to is the owner");
    ok(mail?.subject?.includes("Einladung") && mail.subject.includes("Nordlicht GmbH"), "subject names the firm and Einladung");
    ok(Boolean(mail?.idempotencyKey), "send uses the central idempotency key");
    const token = tokenFromMail(mail?.text ?? "");
    ok(token.length > 20, "link is in the mail body");
    ok(!(mail?.subject ?? "").includes(token), "subject has no token");
    ok(!(mail?.text ?? "").includes(TAX) && !(mail?.html ?? "").includes(VAT), "mail has no tax number or VAT id");
    ok((mail?.text ?? "").includes("Mitwirkende") && !(mail?.text ?? "").includes("Mitarbeitende"), "mail says Mitwirkende");

    const row = await getMembership(payload.membershipId!);
    ok(Boolean(row), "membership can be read");
    const byMember = await listMembershipsByMember(MEMBER);
    const byEntity = await listMembershipsByEntity(nordlicht.entityId);
    ok(byMember.some((item) => item.membershipId === row?.membershipId), "read by member email");
    ok(byEntity.some((item) => item.membershipId === row?.membershipId), "read by entity id");
    ok(row?.tokenHash === hashInviteJti((await verifyInviteToken(token))?.jti ?? ""), "only the jti hash is stored");
    ok(!readFileSync(path.join(storeDir, "memberships.json"), "utf8").includes(token), "file store has no raw token");

    const firstPreview = await previewInvite(token, async () => nordlicht);
    const hashAfterGet = (await getMembership(payload.membershipId!))?.tokenHash;
    const secondPreview = await previewInvite(token, async () => nordlicht);
    ok(firstPreview.ok && secondPreview.ok, "acceptance page accepts the token twice");
    if (!firstPreview.ok) throw new Error("preview");
    ok(firstPreview.name === "Nordlicht GmbH", "payload has the firm name");
    ok(firstPreview.street === "Hafenstraße 4" && firstPreview.zip === "20457" && firstPreview.city === "Hamburg", "payload has the address");
    ok(!("stnr" in firstPreview) && !("ustId" in firstPreview) && !("ust_id" in firstPreview), "payload has no tax fields");
    ok(!JSON.stringify(firstPreview).includes(TAX) && !JSON.stringify(firstPreview).includes(VAT), "payload values omit tax and VAT");
    ok(hashAfterGet === row?.tokenHash && (await getMembership(payload.membershipId!))?.tokenHash === hashAfterGet, "GET leaves token_hash unchanged");

    const verify = await verifyGet(new Request(`http://localhost/auth/verify?token=${encodeURIComponent(token)}`));
    ok((await verifyMagicToken(token)) === null, "invite token is not a magic link");
    ok(!cookieValue(verify), "GET /auth/verify sets no session cookie");
    ok(!(verify.headers.get("location") ?? "").includes(token), "verify redirect does not echo the token");

    const again = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: nordlicht,
      memberEmail: MEMBER,
      moduleIds: ["m03", "m09"],
    });
    ok(again.ok && again.throttled, "immediate resend is throttled");
    ok(sent.length === 1, "throttled resend does not send a second mail");
    ok((await listMembershipsByEntity(nordlicht.entityId)).filter((item) => item.memberEmail === MEMBER && item.status !== "revoked").length === 1, "no second pending row");
    ok(inviteHashMatches((await getMembership(payload.membershipId!))?.tokenHash ?? "", (await verifyInviteToken(token))?.jti ?? ""), "throttled resend keeps the mailed token");

    const other = await inviteMitwirkende({
      ownerEmail: OTHER_OWNER,
      entity: suedlicht,
      memberEmail: MEMBER,
      moduleIds: [],
    });
    ok(other.ok && other.membershipId !== payload.membershipId, "same mail can join another owner's firm");
    const both = await listMembershipsByMember(MEMBER);
    ok(new Set(both.map((item) => item.ownerEmail)).size === 2, "two memberships keep both owners");

    now += INVITE_RESEND_WINDOW_MS + 1000;
    const resent = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: nordlicht,
      memberEmail: MEMBER,
      moduleIds: ["m03", "m09"],
    });
    ok(resent.ok && !resent.throttled, "resend after the window sends again");
    ok(sent.length === 3, "the other firm and the resend each send once");
    const rotated = tokenFromMail(sent[2]?.text ?? "");
    ok(rotated && rotated !== token, "resend rotates the token");
    const stale = await previewInvite(token, async () => nordlicht);
    const fresh = await previewInvite(rotated, async () => nordlicht);
    ok(!stale.ok && fresh.ok && stale.message === INVITE_LINK_INVALID, "previous link dies, new link works");

    const self = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: nordlicht,
      memberEmail: OWNER.toUpperCase(),
      moduleIds: [],
    });
    ok(!self.ok && self.error === INVITE_SELF_MESSAGE, "owner cannot invite their own address");

    const limitFirm = firm({
      entityId: "ent-limit",
      userEmail: OWNER,
      name: "Grenz GmbH",
    });
    for (let index = 0; index < 5; index += 1) {
      await insertMembership(activeRow(limitFirm, `person-${index}@example.com`));
    }
    const beforeLimit = sent.length;
    const blocked = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: limitFirm,
      memberEmail: MEMBER,
      moduleIds: [],
    });
    ok(!blocked.ok && blocked.error === INVITE_LIMIT_MESSAGE, "a sixth active member is rejected");
    ok(sent.length === beforeLimit, "rejected invitation sends no mail");
    ok((await listMembershipsByEntity(limitFirm.entityId)).filter((item) => item.status === "active").length === 5, "the five active rows stay");

    const expired = signRaw({
      typ: "invite",
      email: MEMBER,
      membershipId: payload.membershipId,
      jti: "expired-jti",
      exp: Date.now() - 5_000,
    });
    const expiredPreview = await previewInvite(expired, async () => nordlicht);
    ok(!expiredPreview.ok, "expired token is rejected");
    if (expiredPreview.ok) throw new Error("expired preview");

    const outageInvite = await postInvite(
      new Request("http://localhost/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: nordlicht.entityId,
          memberEmail: MEMBER,
          moduleIds: [],
        }),
      }),
      {
        sessionEmail: async () => OWNER,
        ownedEntity: async () => {
          throw new SheetsUnavailableError(429);
        },
        invite: inviteMitwirkende,
      },
    );
    const outageInviteBody = (await outageInvite.json()) as { error?: string };
    ok(outageInvite.status === 503, "invite read outage is 503");
    ok(outageInviteBody.error === SHEETS_RETRY_MESSAGE, "invite outage uses the retry sentence");
    ok(outageInviteBody.error !== "Kein Zugriff.", "invite outage is not a missing firm");

    await assert.rejects(
      () =>
        acceptInvite(rotated, async () => {
          throw new SheetsUnavailableError(503);
        }),
      (error: unknown) => error instanceof SheetsUnavailableError,
      "accept does not turn a company read error into an invalid link",
    );
    const outageAccept = await postAccept(
      new Request("http://localhost/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rotated }),
      }),
      async () => {
        throw new SheetsUnavailableError(503);
      },
    );
    const outageAcceptBody = (await outageAccept.json()) as { error?: string };
    ok(outageAccept.status === 503, "accept read outage is 503");
    ok(outageAcceptBody.error === SHEETS_RETRY_MESSAGE, "accept outage uses the retry sentence");
    ok(outageAcceptBody.error !== INVITE_LINK_INVALID, "accept outage is not an invalid link");

    const accepted = await postAccept(
      new Request("http://localhost/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rotated }),
      }),
      async () => nordlicht,
    );
    const acceptedBody = await accepted.text();
    ok(accepted.status === 200, "accept succeeds once");
    ok(!acceptedBody.includes(TAX) && !acceptedBody.includes(rotated), "accept response has no tax data and no token");
    ok(verifySessionToken(cookieValue(accepted)) === MEMBER, "session mail is the invited person");
    ok(verifySessionToken(cookieValue(accepted)) !== OWNER, "session mail is not the owner");
    const consumed = await acceptInvite(rotated, async () => nordlicht);
    ok(!consumed.ok && consumed.message === expiredPreview.message, "used token and expired token share one message");
    ok((await getMembership(payload.membershipId!))?.status === "active", "acceptance sets active");
    ok((await getMembership(payload.membershipId!))?.tokenHash === "", "acceptance clears the hash");

    const pendingLimit = firm({
      entityId: "ent-accept-limit",
      userEmail: OWNER,
      name: "Annahme GmbH",
    });
    const pending = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: pendingLimit,
      memberEmail: "wartend@example.com",
      moduleIds: ["m01"],
    });
    ok(pending.ok, "a pending invitation is stored before the firm is full");
    if (!pending.ok) throw new Error("pending invite");
    const pendingToken = tokenFromMail(sent.at(-1)?.text ?? "");
    const hashBefore = (await getMembership(pending.membershipId))?.tokenHash;
    for (let index = 0; index < 5; index += 1) {
      await insertMembership(activeRow(pendingLimit, `aktiv-${index}@example.com`));
    }
    const refused = await acceptInvite(pendingToken, async () => pendingLimit);
    ok(!refused.ok && refused.message === INVITE_ACCEPT_LIMIT_MESSAGE, "acceptance stops at five active members");
    const pendingRow = await getMembership(pending.membershipId);
    ok(pendingRow?.status === "pending" && pendingRow.tokenHash === hashBefore, "the pending row and its hash stay");

    failNext = true;
    const failedFirm = firm({ entityId: "ent-fail", userEmail: OWNER, name: "Fehler GmbH" });
    const failed = await inviteMitwirkende({
      ownerEmail: OWNER,
      entity: failedFirm,
      memberEmail: "nochmal@example.com",
      moduleIds: [],
    });
    ok(!failed.ok, "a failed send is reported");
    ok(!failed.ok && failed.code === "mail", "failure is not a success payload");
    const failedRow = (await listMembershipsByEntity(failedFirm.entityId))[0];
    ok(failedRow?.status === "pending" && failedRow.tokenHash === "", "failed send leaves no usable hash");

    const membership = await getMembership(payload.membershipId!);
    ok(
      pdfAllowedForMembership({
        sessionEmail: MEMBER,
        documentEmail: OWNER,
        documentEntityId: nordlicht.entityId,
        membership,
      }) === false,
      "an active membership does not grant the PDF",
    );
    ok(
      pdfAllowedForMembership({
        sessionEmail: OWNER,
        documentEmail: OWNER,
        documentEntityId: nordlicht.entityId,
        membership: null,
      }) === true,
      "the owner can still read their PDF",
    );
    ok(sessionOwnerDenial(MEMBER, OWNER) === 403, "a member is not the document owner");

    const download = await downloadPdf(
      new Request("http://localhost/api/docs/doc-nordlicht/download", {
        headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(MEMBER)}` },
      }),
      "doc-nordlicht",
      async () => ({
        ...emptySheetRow(),
        documentId: "doc-nordlicht",
        email: OWNER,
        entityId: nordlicht.entityId,
        company: nordlicht.name,
        pdfUrl: "gobd/doc-nordlicht/v1.pdf",
      }),
    );
    const downloadBody = await download.text();
    ok(download.status === 403, "PDF download answers 403 for the member");
    ok(!downloadBody.includes("%PDF") && !downloadBody.includes(TAX), "the 403 body has no PDF and no tax data");

    const page = readFileSync(path.join(root, "app/auth/invite/page.tsx"), "utf8");
    const form = readFileSync(path.join(root, "app/auth/invite/accept-form.tsx"), "utf8");
    const panel = readFileSync(path.join(root, "app/account/firma/mitwirkende-panel.tsx"), "utf8");
    ok(!page.includes("AGB") && !form.includes("AGB") && !panel.includes("AGB"), "no AGB prompt");
    ok(!page.includes("stnr") && !page.includes("ustId") && !page.includes("ust_id"), "acceptance page does not name tax fields");
    ok(!page.includes("/api/docs") && !form.includes("download"), "acceptance page has no PDF download");
    ok(panel.includes("Mitwirkende") && !panel.includes("Mitarbeitende"), "the role is Mitwirkende");
    ok(readFileSync(path.join(root, "app/api/docs/[id]/download/route.ts"), "utf8").includes("pdfAllowedForMembership"), "download uses the membership PDF rule");
    const firmPage = readFileSync(path.join(root, "app/account/firma/[id]/page.tsx"), "utf8");
    ok(firmPage.includes("entityUnavailable"), "firm page records a read failure separately");
    ok(
      firmPage.includes("unavailable ? SHEETS_RETRY_MESSAGE"),
      "a firm read failure shows the retry sentence",
    );
    const invitePage = readFileSync(path.join(root, "app/auth/invite/page.tsx"), "utf8");
    ok(invitePage.includes("previewUnavailable"), "invite page records a read failure separately");
    const accountPage = readFileSync(path.join(root, "app/account/page.tsx"), "utf8");
    const emptyAt = accountPage.indexOf("Zu dieser E-Mail liegt noch keine Firma vor.");
    const readyAt = accountPage.indexOf("firmsReady");
    ok(readyAt >= 0 && emptyAt > readyAt, "the empty firm list is only the successful read");

    const savedSheets = {
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      sheet: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      vercel: process.env.VERCEL,
    };
    setMembershipStoreTestHooks(null);
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheets@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "test-key";
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
    const sheetRow: Membership = {
      membershipId: "mem-sheet",
      ownerEmail: OWNER,
      memberEmail: MEMBER,
      entityId: nordlicht.entityId,
      status: "pending",
      moduleIds: "",
      tokenHash: "",
      invitedAt: "2026-10-14T08:00:00.000Z",
      acceptedAt: "",
      revokedAt: "",
      invitedBy: OWNER,
      updatedAt: "2026-10-14T08:00:00.000Z",
    };
    try {
      let valueGets = 0;
      installSheetsHandler(async ({ op, args }) => {
        if (op === "spreadsheets.get") {
          return { data: { sheets: [{ properties: { title: "memberships" } }] } };
        }
        if (op === "values.get") {
          valueGets += 1;
          if (valueGets <= 2) {
            const error = new Error("quota") as Error & { response?: { status: number } };
            error.response = { status: 429 };
            throw error;
          }
          const range = typeof args.range === "string" ? args.range : "";
          if (range.includes("A1:")) {
            return { data: { values: [[...MEMBERSHIP_SHEET_COLUMNS]] } };
          }
          return { data: { values: [membershipSheetValues(sheetRow)] } };
        }
        throw new Error(`unexpected ${op}`);
      });
      clearMembershipReadCache();
      const recovered = await listMemberships();
      ok(
        recovered.some((row) => row.membershipId === "mem-sheet"),
        "a membership read retries 429 and then returns the row",
      );
      ok(valueGets >= 3, "the 429 was retried before the row was read");

      clearMembershipReadCache();
      installSheetsHandler(async () => {
        const error = new Error("down") as Error & { response?: { status: number } };
        error.response = { status: 503 };
        throw error;
      });
      process.env.VERCEL = "1";
      await assert.rejects(
        () => listMemberships(),
        (error: unknown) => error instanceof SheetsUnavailableError,
        "a membership read outage stays an error and is not an empty list",
      );
    } finally {
      installSheetsHandler(null);
      clearMembershipReadCache();
      const restore = (name: string, value: string | undefined) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      };
      restore("GOOGLE_SERVICE_ACCOUNT_EMAIL", savedSheets.email);
      restore("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", savedSheets.key);
      restore("GOOGLE_SHEETS_SPREADSHEET_ID", savedSheets.sheet);
      restore("VERCEL", savedSheets.vercel);
    }

    console.log("check-membership-invite: ok");
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
