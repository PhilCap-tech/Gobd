/**
 * Mail links use an opaque id. The address stays in the private store under
 * the SHA-256 of that id. Links already sent stay verifiable. No mail is sent.
 *
 *   npx tsx scripts/check-mail-link-tokens.ts
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { POST as postAmpelAbmelden } from "@/app/api/ampel/abmelden/route";
import { GET as verifyMagicLink } from "@/app/auth/verify/route";
import {
  MAGIC_TTL_MS,
  SESSION_COOKIE,
  createInviteToken,
  createSessionToken,
  legacyInviteToken,
  legacyMagicToken,
  magicLinkUrl,
  readExpiredMagicToken,
  verifyInviteToken,
  verifyMagicToken,
  verifySessionToken,
} from "@/lib/auth";
import type { Entity } from "@/lib/entities";
import { MAGIC_LINK_WINDOW_MS } from "@/lib/mail-dedupe";
import { POST as postKanzleiAbmelden } from "@/app/api/kanzlei-merkblatt/abmelden/route";
import {
  AMPEL_DOI_TTL_MS,
  createAmpelDoiToken,
  createAmpelUnsubscribeToken,
  legacyAmpelDoiToken,
  legacyAmpelUnsubscribeToken,
  toAmpelReadinessLead,
  verifyAmpelDoiToken,
  verifyAmpelUnsubscribeToken,
} from "@/lib/ampel";
import { ampelConfirmUrl, ampelListUnsubscribeHeaders } from "@/lib/ampel-mail";
import { AMPEL_QUESTIONS } from "@/lib/ampel-questions";
import { encodeAmpelAnswers, type AmpelAnswerMap } from "@/lib/ampel-score";
import { createMemoryAmpelSuppressionStore, setAmpelSuppressionTestStore } from "@/lib/ampel-suppression";
import { setAmpelWithdrawTestDeps } from "@/lib/ampel-unsubscribe";
import { KANZLEI_CONSENT_TEXT_VERSION, KANZLEI_DOI_HOURS } from "@/lib/kanzlei-copy";
import { kanzleiConfirmUrl, kanzleiListUnsubscribeHeaders } from "@/lib/kanzlei-mail";
import { toKanzleiReadinessLead } from "@/lib/kanzlei-lead";
import {
  KANZLEI_DOI_TTL_MS,
  createKanzleiDoiToken,
  createKanzleiUnsubscribeToken,
  legacyKanzleiDoiToken,
  legacyKanzleiUnsubscribeToken,
  verifyKanzleiDoiToken,
  verifyKanzleiUnsubscribeToken,
} from "@/lib/kanzlei-token";
import { setKanzleiWithdrawTestDeps } from "@/lib/kanzlei-unsubscribe";
import {
  INVITE_RESEND_WINDOW_MS,
  acceptInvite,
  inviteLinkUrl,
  previewInvite,
} from "@/lib/membership-invite";
import { getMembership, insertMembership, setMembershipStoreTestHooks } from "@/lib/membership-store";
import { hashInviteJti, type Membership } from "@/lib/memberships";
import { kassenConfirmUrl } from "@/lib/kassen-check-mail";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import {
  isOpaqueMailLinkToken,
  mailLinkTokenFilePath,
  mailLinkTokenHash,
  mailLinkTokenStoreKind,
  readMailLinkTokenBody,
} from "@/lib/mail-link-token-store";
import type { ReadinessLead } from "@/lib/readiness";

if (!automatedRunForbidsLiveWrites()) {
  process.env.npm_lifecycle_event = "check:mail-link-tokens";
}
if (!process.env.MAGIC_LINK_SECRET?.trim()) {
  process.env.MAGIC_LINK_SECRET = "check-mail-link-offline-secret";
}

const EMAIL = "person.mail-link@example.com";
const REF = "Kanzlei Sondermerkmal";
const CONSENT_AT = "2026-10-16T08:00:00.000Z";
const NOW = 1_700_000_000_000;

function ampelAnswers(): string {
  const map: AmpelAnswerMap = {};
  for (const question of AMPEL_QUESTIONS) map[question.id] = "ja";
  const code = encodeAmpelAnswers(map);
  assert.ok(code);
  return code;
}

function payloadDecodable(token: string): boolean {
  for (const part of [token, ...token.split(".")]) {
    try {
      const parsed = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;
      if (!parsed || typeof parsed !== "object") continue;
      if ("email" in parsed || "purpose" in parsed || "answers" in parsed || "ref" in parsed) return true;
    } catch {
      /* random bytes are not a payload */
    }
  }
  return false;
}

function assertOpaqueLink(url: string, personal: readonly string[]): string {
  assert.equal(url.includes("@"), false, url);
  const token = new URL(url, "https://www.gobd-doku-erstellen.de").searchParams.get("token");
  assert.ok(token);
  assert.equal(isOpaqueMailLinkToken(token), true);
  assert.equal(token.includes("."), false);
  assert.equal(token.includes("@"), false);
  assert.equal(payloadDecodable(token), false);
  const decoded = decodeURIComponent(url);
  for (const value of personal) {
    assert.equal(decoded.toLowerCase().includes(value.toLowerCase()), false, value);
  }
  return token;
}

function assertHashOnly(token: string, email: string, expectExp: boolean): void {
  const file = mailLinkTokenFilePath(token);
  assert.ok(file);
  assert.equal(path.basename(file), mailLinkTokenHash(token));
  assert.equal(existsSync(path.join(path.dirname(file), token)), false);
  const body = readFileSync(file, "utf8");
  assert.equal(body.includes(token), false);
  const parsed = JSON.parse(body) as { hash?: string; email?: string; exp?: number };
  assert.equal(parsed.hash, mailLinkTokenHash(token));
  assert.equal(parsed.email, email);
  assert.equal(typeof parsed.exp === "number", expectExp);
  if (!expectExp) assert.equal("exp" in parsed, false);
}

async function oneClick(
  post: (request: Request) => Promise<Response>,
  url: string,
  token: string,
): Promise<Response> {
  return post(
    new Request(`${url}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    }),
  );
}

async function main(): Promise<void> {
  assert.equal(mailLinkTokenStoreKind(), "file", "the check must not open the production Blob");
  assert.equal(automatedRunForbidsLiveWrites(), true);

  const answers = ampelAnswers();
  const personal = [EMAIL, answers, REF];
  const ampelDoi = await createAmpelDoiToken(
    { email: EMAIL, answers, ref: REF, consentAt: CONSENT_AT },
    NOW,
  );
  assert.ok(ampelDoi);
  assertOpaqueLink(ampelConfirmUrl(ampelDoi), personal);
  assertHashOnly(ampelDoi, EMAIL, true);
  assert.ok(await verifyAmpelDoiToken(ampelDoi, NOW + AMPEL_DOI_TTL_MS));
  assert.equal(await verifyAmpelDoiToken(ampelDoi, NOW + AMPEL_DOI_TTL_MS + 1), null);

  const legacyDoi = legacyAmpelDoiToken(
    { email: EMAIL, answers, ref: REF, consentAt: CONSENT_AT },
    NOW,
  );
  assert.ok(legacyDoi);
  assert.equal(legacyDoi.includes("."), true);
  assert.equal(payloadDecodable(legacyDoi), true);
  assert.ok(await verifyAmpelDoiToken(legacyDoi, NOW + AMPEL_DOI_TTL_MS));
  assert.equal(await verifyAmpelDoiToken(legacyDoi, NOW + AMPEL_DOI_TTL_MS + 1), null);
  assert.equal(await readMailLinkTokenBody(legacyDoi), null);

  const kassen = await createAmpelDoiToken(
    { email: EMAIL, answers: "JJJJJJ", ref: REF, consentAt: CONSENT_AT, check: "kassen-check" },
    NOW,
  );
  assert.ok(kassen);
  assertOpaqueLink(kassenConfirmUrl(kassen), [EMAIL, "JJJJJJ", REF]);
  assertHashOnly(kassen, EMAIL, true);
  assert.equal((await verifyAmpelDoiToken(kassen, NOW))?.check, "kassen-check");
  assert.equal(await verifyAmpelDoiToken(kassen, NOW + AMPEL_DOI_TTL_MS + 1), null);

  const kanzlei = await createKanzleiDoiToken(
    { email: EMAIL, consentAt: CONSENT_AT, consentTextVersion: KANZLEI_CONSENT_TEXT_VERSION },
    NOW,
  );
  assert.ok(kanzlei);
  assertOpaqueLink(kanzleiConfirmUrl(kanzlei), [EMAIL]);
  assertHashOnly(kanzlei, EMAIL, true);
  assert.equal(KANZLEI_DOI_TTL_MS, KANZLEI_DOI_HOURS * 60 * 60 * 1000);
  assert.ok(await verifyKanzleiDoiToken(kanzlei, NOW + KANZLEI_DOI_TTL_MS));
  assert.equal(await verifyKanzleiDoiToken(kanzlei, NOW + KANZLEI_DOI_TTL_MS + 1), null);
  const legacyKanzleiDoi = legacyKanzleiDoiToken(
    { email: EMAIL, consentAt: CONSENT_AT, consentTextVersion: KANZLEI_CONSENT_TEXT_VERSION },
    NOW,
  );
  assert.ok(legacyKanzleiDoi);
  assert.equal(legacyKanzleiDoi.includes("."), true);
  assert.equal(await verifyKanzleiDoiToken(legacyKanzleiDoi, NOW + KANZLEI_DOI_TTL_MS + 1), null);

  const unsubA = await createAmpelUnsubscribeToken(EMAIL, CONSENT_AT);
  const unsubB = await createAmpelUnsubscribeToken(EMAIL, CONSENT_AT);
  assert.ok(unsubA && unsubB && unsubA !== unsubB);
  assertHashOnly(unsubA, EMAIL, false);
  assert.equal((await verifyAmpelUnsubscribeToken(unsubA))?.email, EMAIL);
  const ampelHeaders = await ampelListUnsubscribeHeaders(EMAIL, CONSENT_AT);
  assert.ok(ampelHeaders);
  const ampelOneClick = ampelHeaders["List-Unsubscribe"]?.match(/<([^>]+)>/)?.[1] ?? "";
  assertOpaqueLink(ampelOneClick, [EMAIL]);
  assert.equal(ampelHeaders["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");

  const legacyUnsub = legacyAmpelUnsubscribeToken(EMAIL, CONSENT_AT);
  const legacyUnsubAgain = legacyAmpelUnsubscribeToken(EMAIL, CONSENT_AT);
  assert.ok(legacyUnsub);
  assert.equal(legacyUnsub, legacyUnsubAgain);
  assert.equal(payloadDecodable(legacyUnsub), true);
  assert.equal((await verifyAmpelUnsubscribeToken(legacyUnsub))?.email, EMAIL);
  assert.equal(await readMailLinkTokenBody(legacyUnsub), null);

  const kanzleiUnsub = await createKanzleiUnsubscribeToken(EMAIL, CONSENT_AT);
  assert.ok(kanzleiUnsub);
  assertHashOnly(kanzleiUnsub, EMAIL, false);
  const kanzleiHeaders = await kanzleiListUnsubscribeHeaders(EMAIL, CONSENT_AT);
  assert.ok(kanzleiHeaders);
  const kanzleiOneClick = kanzleiHeaders["List-Unsubscribe"]?.match(/<([^>]+)>/)?.[1] ?? "";
  assertOpaqueLink(kanzleiOneClick, [EMAIL]);
  const legacyKanzleiUnsub = legacyKanzleiUnsubscribeToken(EMAIL, CONSENT_AT);
  assert.ok(legacyKanzleiUnsub);
  assert.equal((await verifyKanzleiUnsubscribeToken(legacyKanzleiUnsub))?.email, EMAIL);

  const ampelLeads = new Map<string, ReadinessLead>();
  const ampelLead = toAmpelReadinessLead({
    email: EMAIL,
    answers,
    ref: REF,
    consentAt: CONSENT_AT,
    doiConfirmedAt: CONSENT_AT,
    score: 100,
    light: "gruen",
    mailStatus: "sent",
    marketingOptIn: "confirmed",
  });
  ampelLeads.set(ampelLead.leadId, ampelLead);
  setAmpelSuppressionTestStore(createMemoryAmpelSuppressionStore());
  setAmpelWithdrawTestDeps({
    list: async () => [...ampelLeads.values()],
    save: async (lead) => {
      ampelLeads.set(lead.leadId, { ...lead });
    },
  });
  const legacyClick = await oneClick(
    postAmpelAbmelden,
    "https://www.gobd-doku-erstellen.de/api/ampel/abmelden",
    legacyUnsub,
  );
  assert.equal(legacyClick.status, 200);
  assert.equal(ampelLeads.get(ampelLead.leadId)?.marketingOptIn, "withdrawn");
  ampelLeads.set(ampelLead.leadId, { ...ampelLead });
  const opaqueClick = await oneClick(
    postAmpelAbmelden,
    "https://www.gobd-doku-erstellen.de/api/ampel/abmelden",
    unsubA,
  );
  assert.equal(opaqueClick.status, 200);
  assert.equal(ampelLeads.get(ampelLead.leadId)?.marketingOptIn, "withdrawn");

  const kanzleiLeads = new Map<string, ReadinessLead>();
  const kanzleiLead = toKanzleiReadinessLead({
    email: EMAIL,
    downloadedAt: CONSENT_AT,
    consentAt: CONSENT_AT,
    doiConfirmedAt: CONSENT_AT,
    marketingOptIn: "confirmed",
    consentTextVersion: KANZLEI_CONSENT_TEXT_VERSION,
    mailStatus: "doi_confirmed",
  });
  kanzleiLeads.set(kanzleiLead.leadId, kanzleiLead);
  setKanzleiWithdrawTestDeps({
    list: async () => [...kanzleiLeads.values()],
    save: async (lead) => {
      kanzleiLeads.set(lead.leadId, { ...lead });
    },
  });
  const legacyKanzleiClick = await oneClick(
    postKanzleiAbmelden,
    "https://www.gobd-doku-erstellen.de/api/kanzlei-merkblatt/abmelden",
    legacyKanzleiUnsub,
  );
  assert.equal(legacyKanzleiClick.status, 200);
  assert.equal(kanzleiLeads.get(kanzleiLead.leadId)?.marketingOptIn, "withdrawn");

  for (const file of ["lib/ampel-mail.ts", "lib/kassen-check-mail.ts", "lib/kanzlei-mail.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("legacyAmpel"), false, file);
    assert.equal(source.includes("legacyKanzlei"), false, file);
    assert.equal(source.includes("sendDedupedEmail"), true, file);
    assert.equal(source.includes("send" + "Email("), false, file);
  }
  for (const file of ["lib/ampel-confirm.ts", "lib/kanzlei-submit.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("legacyAmpel"), false, file);
    assert.equal(source.includes("legacyKanzlei"), false, file);
  }
  const storeSource = readFileSync("lib/mail-link-token-store.ts", "utf8");
  assert.equal(storeSource.includes('access: "private"'), true);
  assert.equal(storeSource.includes("automatedRunForbidsLiveWrites"), true);
  assert.equal(storeSource.includes("postbuild"), true);
  assert.equal(storeSource.includes("createHash(\"sha256\")"), true);

  await checkAuthLinks();

  console.log("check-mail-link-tokens: ok");
}

const OWNER = "owner.mail-link@example.com";

function authFirm(entityId: string): Entity {
  return {
    entityId,
    userEmail: OWNER,
    name: "Mail Link GmbH",
    street: "Hafenstraße 1",
    zip: "20457",
    city: "Hamburg",
    stnr: "",
    ustId: "",
    createdAt: CONSENT_AT,
    updatedAt: CONSENT_AT,
    checkoutPrefill: "",
  };
}

function pendingRow(input: { membershipId: string; entityId: string; tokenHash: string }): Membership {
  return {
    membershipId: input.membershipId,
    ownerEmail: OWNER,
    memberEmail: EMAIL,
    entityId: input.entityId,
    status: "pending",
    moduleIds: "",
    tokenHash: input.tokenHash,
    invitedAt: CONSENT_AT,
    acceptedAt: "",
    revokedAt: "",
    invitedBy: OWNER,
    updatedAt: CONSENT_AT,
  };
}

function storedPurpose(token: string): { purpose?: string; exp?: number; membershipId?: string } {
  const file = mailLinkTokenFilePath(token);
  assert.ok(file);
  return JSON.parse(readFileSync(file, "utf8")) as { purpose?: string; exp?: number; membershipId?: string };
}

async function checkAuthLinks(): Promise<void> {
  assert.equal(MAGIC_TTL_MS, 20 * 60 * 1000);
  assert.equal(MAGIC_LINK_WINDOW_MS, 60_000);
  assert.equal(INVITE_RESEND_WINDOW_MS, 60_000);

  const session = createSessionToken(EMAIL);
  assert.equal(session.includes("."), true);
  assert.equal(isOpaqueMailLinkToken(session), false);
  assert.equal(verifySessionToken(session), EMAIL);
  const sessionBody = JSON.parse(Buffer.from(session.split(".")[0] ?? "", "base64url").toString("utf8")) as {
    typ?: string;
    email?: string;
    iat?: number;
  };
  assert.equal(sessionBody.typ, "session");
  assert.equal(sessionBody.email, EMAIL);
  assert.equal(typeof sessionBody.iat, "number");

  const magicUrl = await magicLinkUrl(EMAIL, "/account", NOW);
  assert.ok(magicUrl);
  const magicToken = assertOpaqueLink(magicUrl, [EMAIL]);
  assert.deepEqual([...new URL(magicUrl).searchParams.keys()], ["token", "next"]);
  assertHashOnly(magicToken, EMAIL, true);
  const magicStored = storedPurpose(magicToken);
  assert.equal(magicStored.purpose, "magic");
  assert.equal(magicStored.exp, NOW + MAGIC_TTL_MS);
  assert.equal(await verifyMagicToken(magicToken, NOW + MAGIC_TTL_MS), EMAIL);
  assert.equal(await verifyMagicToken(magicToken, NOW + MAGIC_TTL_MS), EMAIL);
  assert.equal(await readExpiredMagicToken(magicToken, NOW + MAGIC_TTL_MS), null);
  assert.equal(await verifyMagicToken(magicToken, NOW + MAGIC_TTL_MS + 1), null);
  assert.equal(await readExpiredMagicToken(magicToken, NOW + MAGIC_TTL_MS + 1), EMAIL);

  const legacyMagic = legacyMagicToken(EMAIL, NOW);
  assert.equal(legacyMagic.includes("."), true);
  assert.equal(payloadDecodable(legacyMagic), true);
  assert.equal(await verifyMagicToken(legacyMagic, NOW + MAGIC_TTL_MS), EMAIL);
  assert.equal(await verifyMagicToken(legacyMagic, NOW + MAGIC_TTL_MS + 1), null);
  assert.equal(await readExpiredMagicToken(legacyMagic, NOW + MAGIC_TTL_MS + 1), EMAIL);
  assert.equal(await readMailLinkTokenBody(legacyMagic), null);

  const inviteMembershipId = "mem-opaque-invite";
  const inviteToken = await createInviteToken({ membershipId: inviteMembershipId, email: EMAIL }, NOW);
  assert.ok(inviteToken);
  const inviteUrl = inviteLinkUrl(inviteToken);
  assert.equal(assertOpaqueLink(inviteUrl, [EMAIL, inviteMembershipId, OWNER]), inviteToken);
  assert.deepEqual([...new URL(inviteUrl).searchParams.keys()], ["token"]);
  assertHashOnly(inviteToken, EMAIL, true);
  assert.equal(hashInviteJti(inviteToken), mailLinkTokenHash(inviteToken));
  const inviteStored = storedPurpose(inviteToken);
  assert.equal(inviteStored.purpose, "invite");
  assert.equal(inviteStored.membershipId, inviteMembershipId);
  assert.equal(inviteStored.exp, NOW + MAGIC_TTL_MS);
  const inviteClaims = await verifyInviteToken(inviteToken, NOW + MAGIC_TTL_MS);
  assert.equal(inviteClaims?.email, EMAIL);
  assert.equal(inviteClaims?.membershipId, inviteMembershipId);
  assert.equal(inviteClaims?.jti, inviteToken);
  assert.equal(await verifyInviteToken(inviteToken, NOW + MAGIC_TTL_MS + 1), null);
  assert.equal(await verifyMagicToken(inviteToken, NOW), null);

  const legacyJti = "legacy-invite-jti";
  const legacyInvite = legacyInviteToken(
    { membershipId: "mem-legacy-invite", email: EMAIL, jti: legacyJti },
    NOW,
  );
  assert.equal(legacyInvite.includes("."), true);
  assert.equal(payloadDecodable(legacyInvite), true);
  const legacyClaims = await verifyInviteToken(legacyInvite, NOW + MAGIC_TTL_MS);
  assert.equal(legacyClaims?.email, EMAIL);
  assert.equal(legacyClaims?.membershipId, "mem-legacy-invite");
  assert.equal(legacyClaims?.jti, legacyJti);
  assert.equal(await verifyInviteToken(legacyInvite, NOW + MAGIC_TTL_MS + 1), null);
  assert.equal(await readMailLinkTokenBody(legacyInvite), null);

  const dir = mkdtempSync(path.join(tmpdir(), "auth-mail-link-"));
  setMembershipStoreTestHooks({ dir });
  try {
    const opaqueFirm = authFirm("ent-opaque-invite");
    const liveInvite = await createInviteToken({
      membershipId: "mem-live-invite",
      email: EMAIL,
    });
    assert.ok(liveInvite);
    await insertMembership(
      pendingRow({
        membershipId: "mem-live-invite",
        entityId: opaqueFirm.entityId,
        tokenHash: hashInviteJti(liveInvite),
      }),
    );
    const loadOpaque = async () => opaqueFirm;
    assert.equal((await previewInvite(liveInvite, loadOpaque)).ok, true);
    assert.equal((await previewInvite(liveInvite, loadOpaque)).ok, true);
    assert.equal((await getMembership("mem-live-invite"))?.tokenHash, hashInviteJti(liveInvite));
    const inviteOnVerify = await verifyMagicLink(
      new Request(`http://localhost/auth/verify?token=${encodeURIComponent(liveInvite)}`),
    );
    assert.equal(
      inviteOnVerify.headers.getSetCookie().some((line) => line.startsWith(`${SESSION_COOKIE}=`)),
      false,
    );
    assert.equal((await acceptInvite(liveInvite, loadOpaque)).ok, true);
    const replay = await acceptInvite(liveInvite, loadOpaque);
    assert.equal(replay.ok, false, "replay of a used invite token fails");
    assert.equal((await previewInvite(liveInvite, loadOpaque)).ok, false);
    assert.equal((await getMembership("mem-live-invite"))?.tokenHash, "");

    const legacyFirm = authFirm("ent-legacy-invite");
    const liveLegacy = legacyInviteToken({
      membershipId: "mem-live-legacy",
      email: EMAIL,
      jti: "live-legacy-jti",
    });
    assert.ok(liveLegacy);
    await insertMembership(
      pendingRow({
        membershipId: "mem-live-legacy",
        entityId: legacyFirm.entityId,
        tokenHash: hashInviteJti("live-legacy-jti"),
      }),
    );
    assert.equal((await verifyInviteToken(liveLegacy))?.email, EMAIL);
    assert.equal((await acceptInvite(liveLegacy, async () => legacyFirm)).ok, true);
    assert.equal((await acceptInvite(liveLegacy, async () => legacyFirm)).ok, false);
  } finally {
    setMembershipStoreTestHooks(null);
  }

  for (const file of [
    "lib/login-mail.ts",
    "lib/membership-invite.ts",
    "lib/ops.ts",
    "app/api/intake/route.ts",
    "app/api/readiness/route.ts",
    "app/auth/verify/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("legacyMagicToken"), false, file);
    assert.equal(source.includes("legacyInviteToken"), false, file);
  }
  const opsSource = readFileSync("lib/ops.ts", "utf8");
  assert.equal(opsSource.includes("windowMs: MAGIC_LINK_WINDOW_MS"), true);
  const inviteSource = readFileSync("lib/membership-invite.ts", "utf8");
  assert.equal(inviteSource.includes("new URLSearchParams({ token })"), true);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    setAmpelWithdrawTestDeps(null);
    setAmpelSuppressionTestStore(null);
    setKanzleiWithdrawTestDeps(null);
    setMembershipStoreTestHooks(null);
  });
