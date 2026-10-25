/**
 * Mail links use an opaque id. The address stays in the private store under
 * the SHA-256 of that id. Links already sent stay verifiable. No mail is sent.
 *
 *   npx tsx scripts/check-mail-link-tokens.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { POST as postAmpelAbmelden } from "@/app/api/ampel/abmelden/route";
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

  console.log("check-mail-link-tokens: ok");
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
  });
