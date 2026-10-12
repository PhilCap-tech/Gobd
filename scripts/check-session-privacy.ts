/**
 * R127 follow-up: owner email stays off the login page, one logout clears
 * gobd_session and gobd_checkout, and a legacy checkout without a grant blob
 * does not open the draft (R127-F01).
 *
 *   npx tsx scripts/check-session-privacy.ts
 *
 * Synthetic @example.com only. No mail, no Stripe, no prod data.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POST as logout } from "../app/api/auth/logout/route";
import { completeMagicLinkRequest } from "../app/api/auth/magic-link/route";
import { putIntakeDraft, readIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { CHECKOUT_GRANT_COOKIE, SESSION_COOKIE, createSessionToken } from "../lib/auth";
import { sessionOwnerDenial } from "../lib/checkout-access";
import {
  loginClientFields,
  loginLinkButtonLabel,
} from "../lib/checkout-session";
import {
  forgetCheckoutSessionGrant,
  recordCheckoutSessionGrant,
} from "../lib/checkout-session-grant";
import { normalizeDraftKey } from "../lib/intake-draft";
import { emptyAnswers, type IntakeAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer@example.com";
const OTHER = "other@example.com";
const LEGACY = "cs_test_legacy_no_grant";

function answers(): IntakeAnswers {
  return { ...emptyAnswers(), gf: "Ada Beispiel" };
}

function sessionCookie(email: string): string {
  return `${SESSION_COOKIE}=${createSessionToken(email)}`;
}

function draftIo(saved: { n: number }): DraftWriteIo {
  const draftKey = normalizeDraftKey({ sessionId: LEGACY, modus: "gesamt" });
  return {
    loadIntakeDraft: async () => ({
      draftKey,
      email: BUYER,
      stripeSessionId: LEGACY,
      documentId: "",
      entityId: "",
      step: 2,
      answers: answers(),
      revision: 1,
      updatedAt: "2026-10-12T12:00:00.000Z",
    }),
    saveIntakeDraft: async () => {
      saved.n += 1;
      return { backend: "file" };
    },
    clearIntakeDraft: async () => undefined,
    lookup: {
      findDocumentById: async () => null,
      listDocumentFamily: async () => [],
      findLatestDocumentByStripeSessionId: async () => null,
    },
    resolveCheckout: async () => ({ error: "lookup_failed" }),
  };
}

function draftUrl(): string {
  const draftKey = normalizeDraftKey({ sessionId: LEGACY, modus: "gesamt" });
  return `http://localhost/api/intake/draft?draftKey=${encodeURIComponent(draftKey)}&sessionId=${encodeURIComponent(LEGACY)}`;
}

async function checkLegacyDraft(label: string) {
  const saved = { n: 0 };
  const io = draftIo(saved);
  const bare = await readIntakeDraft(new Request(draftUrl()), io);
  const bareText = await bare.text();
  ok(bare.status === 401, `${label}: no session is 401 (got ${bare.status})`);
  ok(!bareText.includes(BUYER), `${label}: 401 does not contain the owner email`);
  ok(!bareText.includes("Ada Beispiel"), `${label}: 401 does not contain the answers`);

  const foreign = await readIntakeDraft(
    new Request(draftUrl(), { headers: { cookie: sessionCookie(OTHER) } }),
    io,
  );
  const foreignText = await foreign.text();
  ok(foreign.status === 403, `${label}: foreign session is 403 (got ${foreign.status})`);
  ok(!foreignText.includes(BUYER) && !foreignText.includes("Ada Beispiel"), `${label}: 403 does not contain the draft`);

  const owner = await readIntakeDraft(
    new Request(draftUrl(), { headers: { cookie: sessionCookie(BUYER) } }),
    io,
  );
  const ownerJson = (await owner.json()) as { draft?: { answers?: { gf?: string } } };
  ok(owner.status === 200 && ownerJson.draft?.answers?.gf === "Ada Beispiel", `${label}: owner session reads the draft`);

  const write = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: LEGACY,
        email: BUYER,
        modus: "gesamt",
        step: 2,
        answers: answers(),
        revision: 2,
      }),
    }),
    io,
  );
  ok(write.status === 401, `${label}: put without a session is 401`);
  ok(saved.n === 0, `${label}: put without a session stores nothing`);
}

async function checkLoginDoesNotLeak() {
  const next = `/intake?session_id=${encodeURIComponent(LEGACY)}`;
  const fields = loginClientFields({
    next,
    checkoutEmail: BUYER,
    sessionEmail: null,
  });
  const packed = JSON.stringify(fields);
  ok(fields.resolveOwner, "session login resolves the owner on the server");
  ok(fields.masked === "b•••@example.com", "the hint stays masked");
  ok(!packed.includes(BUYER), "client login props omit the owner email");
  ok(
    loginLinkButtonLabel(fields.masked) === "Link an b•••@example.com senden",
    "the button names only the mask",
  );

  const loginPage = readFileSync("app/login/page.tsx", "utf8");
  const loginForm = readFileSync("app/login/login-form.tsx", "utf8");
  ok(!loginPage.includes("prefillEmail"), "login page has no prefill prop");
  ok(
    !loginForm.includes('type="hidden" name="email"') &&
      !loginForm.includes('name="email" type="hidden"'),
    "login form has no hidden email",
  );
  ok(loginForm.includes('name="next"'), "no-js submit posts the return path, not the address");
  ok(loginForm.includes("resolveOwner"), "login form posts without the address");

  let sentTo = "";
  const response = await completeMagicLinkRequest(
    { next },
    {
      resolveOwner: async () => BUYER,
      deliver: async (email) => {
        sentTo = email;
        return "stub";
      },
    },
  );
  const body = await response.text();
  ok(response.status === 200, "magic link without a typed address still sends");
  ok(sentTo === BUYER, "the link goes to the owner resolved on the server");
  ok(!body.includes(BUYER), "the magic-link response does not contain the owner email");
}

async function checkLogout() {
  const response = await logout(
    new Request("https://www.gobd-doku-erstellen.de/api/auth/logout", { method: "POST" }),
  );
  const lines = response.headers.getSetCookie();
  ok(response.status === 303, "logout redirects");
  ok((response.headers.get("location") ?? "").endsWith("/login"), "logout lands on /login");
  ok(
    (response.headers.get("cache-control") ?? "").includes("no-store"),
    "logout response is no-store",
  );
  ok(
    lines.some((line) => line.startsWith(`${SESSION_COOKIE}=`) && line.includes("Max-Age=0") && !/domain=/i.test(line)),
    "logout expires the host-only gobd_session",
  );
  ok(
    lines.some((line) => line.startsWith(`${CHECKOUT_GRANT_COOKIE}=`) && line.includes("Max-Age=0")),
    "logout expires gobd_checkout",
  );
  ok(
    lines.some(
      (line) =>
        line.startsWith(`${SESSION_COOKIE}=`) &&
        line.includes("Domain=gobd-doku-erstellen.de") &&
        line.includes("Max-Age=0"),
    ),
    "logout expires gobd_session on the apex domain",
  );
  ok(
    lines.some((line) => line.startsWith(`${SESSION_COOKIE}=`) && line.includes("Path=/account")),
    "logout expires a cookie scoped to /account",
  );

  const account = readFileSync("app/account/page.tsx", "utf8");
  const checkout = readFileSync("app/checkout/page.tsx", "utf8");
  const config = readFileSync("next.config.ts", "utf8");
  const button = readFileSync("components/logout-button.tsx", "utf8");
  ok(account.includes("LogoutButton") && account.includes("RefreshStoredView"), "account refreshes after logout");
  ok(checkout.includes("RefreshStoredView"), "checkout refreshes after logout");
  ok(button.includes("router.refresh()"), "logout refreshes the router cache");
  ok(config.includes('source: "/account"') && config.includes('source: "/checkout"'), "account and checkout are no-store");
  ok(sessionOwnerDenial(null, BUYER) === 401, "pdf/draft helper is 401 without a session");
  ok(sessionOwnerDenial(OTHER, BUYER) === 403, "pdf/draft helper is 403 for someone else");
  ok(sessionOwnerDenial(BUYER, BUYER) === null, "pdf/draft helper allows the owner");
  ok(sessionOwnerDenial(BUYER, "") === 403, "a missing owner is not open access");
  const download = readFileSync("app/api/docs/[id]/download/route.ts", "utf8");
  ok(download.includes("sessionOwnerDenial"), "PDF download uses the owner-session gate");
  ok(!download.includes("session_id"), "PDF download does not authorize session_id");
}

async function main() {
  const savedBlob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  if (!process.env.MAGIC_LINK_SECRET?.trim()) {
    process.env.MAGIC_LINK_SECRET = "check-session-privacy-offline-secret";
  }
  try {
    await forgetCheckoutSessionGrant(LEGACY);
    await checkLegacyDraft("legacy without grant");
    await recordCheckoutSessionGrant({ sessionId: LEGACY, email: BUYER });
    await checkLegacyDraft("with grant");
    await checkLoginDoesNotLeak();
    await checkLogout();
    console.log("check-session-privacy: green");
  } finally {
    await forgetCheckoutSessionGrant(LEGACY).catch(() => undefined);
    if (savedBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = savedBlob;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
