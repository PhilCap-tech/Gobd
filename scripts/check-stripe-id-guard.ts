/**
 * Stripe calls that can only fail are not made:
 * - a made-up or short Checkout Session id never reaches Stripe,
 * - a `cs_test_` id under a live key (and the reverse) never reaches Stripe,
 * - a real-looking id in the key's mode still does (one call),
 * - /success remembers a missing purchase session in memory,
 * - subscription coverage skips a customer Stripe already reported missing,
 * - the subscriptions.list failure log carries the error code, never the id.
 *
 *   npx tsx scripts/check-stripe-id-guard.ts
 *
 * Stripe is a stub. No network, no Sheet, no mail.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type Stripe from "stripe";
import { reopenIfActiveCheckout } from "../lib/kuendigung-stripe";
import {
  checkoutSessionIdVerdict,
  clearStripeLookupCache,
  installStripeClientForChecks,
  isCustomerKnownInvalid,
  listCustomerSubscriptionStatuses,
  resolveCheckoutSession,
  stripeKeyMode,
  verifyStripeCustomerId,
} from "../lib/stripe";
import { loadIncludedFirmCoverage } from "../lib/subscription-coverage";
import { clearSuccessCheckoutProbes, lookupSuccessPurchase } from "../lib/success-session";
import { emptySheetRow, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

// Built from parts so no key-shaped literal sits in the repo.
const LIVE_KEY = ["sk", "live", "offline", "check"].join("_");
const TEST_KEY = ["sk", "test", "offline", "check"].join("_");
const RESTRICTED_LIVE_KEY = ["rk", "live", "offline", "check"].join("_");

const BODY_A = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a7B8c9D0e1"; // 62
const BODY_B = "Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0F9e8D7c6B5a4Z3y2X1w0V9"; // 62
const LIVE_SESSION = `cs_live_${BODY_A}`;
const LIVE_SESSION_MISSING = `cs_live_${BODY_B}`;
const TEST_SESSION = `cs_test_${BODY_A}`;
const FANTASY_SHORT = "cs_test_invalid123";
const FANTASY_LIVE_SHORT = "cs_live_123";
const CUSTOMER_STALE = "cus_stale_testmode_check";
const CUSTOMER_LOG = "cus_log_probe_check";
const OWNER = "stripe.guard.owner@example.invalid";

type Calls = {
  sessionsRetrieve: string[];
  customersRetrieve: string[];
  subscriptionsList: string[];
};

function missing(kind: string, id: string): Error {
  return Object.assign(new Error(`No such ${kind}: '${id}'`), {
    type: "StripeInvalidRequestError",
    code: "resource_missing",
    statusCode: 404,
    param: kind === "customer" ? "customer" : "id",
  });
}

function stubStripe(calls: Calls, paid: Set<string>): Stripe {
  const client = {
    checkout: {
      sessions: {
        retrieve: async (id: string) => {
          calls.sessionsRetrieve.push(id);
          if (!paid.has(id)) throw missing("checkout.session", id);
          return {
            id,
            status: "complete",
            payment_status: "paid",
            customer: "cus_paid_check",
            customer_details: { email: OWNER, name: "Prüfer" },
            customer_email: OWNER,
            metadata: { company: "Prüf GmbH" },
            subscription: null,
          };
        },
      },
    },
    customers: {
      retrieve: async (id: string) => {
        calls.customersRetrieve.push(id);
        throw missing("customer", id);
      },
      list: async () => ({ data: [] }),
    },
    subscriptions: {
      list: async (params: { customer: string }) => {
        calls.subscriptionsList.push(params.customer);
        throw missing("customer", params.customer);
      },
    },
  };
  return client as unknown as Stripe;
}

function freshCalls(): Calls {
  return { sessionsRetrieve: [], customersRetrieve: [], subscriptionsList: [] };
}

async function captureConsole<T>(run: () => Promise<T>): Promise<{ value: T; lines: string[] }> {
  const lines: string[] = [];
  const original = { warn: console.warn, error: console.error };
  const grab = (...args: unknown[]) => {
    lines.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg))).join(" "));
  };
  console.warn = grab;
  console.error = grab;
  try {
    return { value: await run(), lines };
  } finally {
    console.warn = original.warn;
    console.error = original.error;
  }
}

function checkVerdicts() {
  ok(checkoutSessionIdVerdict(LIVE_SESSION, "live") === "ok", "cs_live_ with 62 characters is a session id under a live key");
  ok(checkoutSessionIdVerdict(TEST_SESSION, "test") === "ok", "cs_test_ with 62 characters is a session id under a test key");
  ok(checkoutSessionIdVerdict(TEST_SESSION, "live") === "mode", "cs_test_ under a live key is the wrong mode");
  ok(checkoutSessionIdVerdict(LIVE_SESSION, "test") === "mode", "cs_live_ under a test key is the wrong mode");
  ok(checkoutSessionIdVerdict(LIVE_SESSION, "unknown") === "mode", "an unknown key prefix allows no session id");
  ok(checkoutSessionIdVerdict(FANTASY_SHORT, "test") === "format", "an 18-character fantasy id fails on format");
  ok(checkoutSessionIdVerdict(`cs_live_${BODY_A.slice(0, 49)}`, "live") === "format", "49 characters after the prefix are too short");
  ok(checkoutSessionIdVerdict(`cs_live_${BODY_A.slice(0, 50)}`, "live") === "ok", "50 characters after the prefix are enough");
  ok(checkoutSessionIdVerdict(`${LIVE_SESSION}-x`, "live") === "format", "a non-alphanumeric suffix fails on format");
  ok(checkoutSessionIdVerdict(` ${LIVE_SESSION}`, "live") === "format", "leading whitespace fails on format");
  ok(checkoutSessionIdVerdict(`mock_${BODY_A}`, "live") === "format", "a mock_ id fails on format");

  process.env.STRIPE_SECRET_KEY = LIVE_KEY;
  ok(stripeKeyMode() === "live", "sk_live_ reads as live");
  process.env.STRIPE_SECRET_KEY = RESTRICTED_LIVE_KEY;
  ok(stripeKeyMode() === "live", "rk_live_ reads as live");
  process.env.STRIPE_SECRET_KEY = TEST_KEY;
  ok(stripeKeyMode() === "test", "sk_test_ reads as test");
  process.env.STRIPE_SECRET_KEY = "whsec_not_a_secret_key";
  ok(stripeKeyMode() === "unknown", "another prefix reads as unknown");
}

async function checkCheckoutGuard() {
  const calls = freshCalls();
  installStripeClientForChecks(stubStripe(calls, new Set([LIVE_SESSION, TEST_SESSION])));

  process.env.STRIPE_SECRET_KEY = LIVE_KEY;
  const fantasy = await captureConsole(() => resolveCheckoutSession(FANTASY_SHORT));
  ok("error" in fantasy.value && fantasy.value.error === "invalid", "fantasy id resolves to invalid");
  const shortLive = await resolveCheckoutSession(FANTASY_LIVE_SHORT);
  ok("error" in shortLive && shortLive.error === "invalid", "short cs_live_ id resolves to invalid");
  ok(calls.sessionsRetrieve.length === 0, "fantasy and short ids: 0 Stripe calls");
  ok(
    fantasy.lines.length > 0 && fantasy.lines.every((line) => !line.includes(FANTASY_SHORT)),
    "the rejection log names the reason, not the id",
  );

  const wrongMode = await resolveCheckoutSession(TEST_SESSION);
  ok("error" in wrongMode && wrongMode.error === "invalid", "cs_test_ under a live key resolves to invalid");
  ok(calls.sessionsRetrieve.length === 0, "cs_test_ under a live key: 0 Stripe calls");

  const live = await resolveCheckoutSession(LIVE_SESSION);
  ok(!("error" in live) && live.email === OWNER, "a paid cs_live_ session under a live key still resolves");
  ok(calls.sessionsRetrieve.length === 1, "valid-looking cs_live_ under a live key: exactly 1 Stripe call");

  process.env.STRIPE_SECRET_KEY = RESTRICTED_LIVE_KEY;
  await resolveCheckoutSession(LIVE_SESSION);
  ok(calls.sessionsRetrieve.length === 2, "a restricted live key reaches Stripe for cs_live_ too");

  process.env.STRIPE_SECRET_KEY = TEST_KEY;
  const preview = await resolveCheckoutSession(TEST_SESSION);
  ok(!("error" in preview), "a cs_test_ session under a test key (preview) still resolves");
  ok(calls.sessionsRetrieve.length === 3, "cs_test_ under a test key: 1 Stripe call");
  const liveUnderTest = await resolveCheckoutSession(LIVE_SESSION);
  ok("error" in liveUnderTest && liveUnderTest.error === "invalid", "cs_live_ under a test key resolves to invalid");
  ok(calls.sessionsRetrieve.length === 3, "cs_live_ under a test key: 0 Stripe calls");

  let injected = 0;
  const viaStub = await resolveCheckoutSession("cs_test_short_stub", async (id) => {
    injected += 1;
    return {
      id,
      status: "complete",
      payment_status: "paid",
      customer: null,
      customer_details: { email: OWNER },
      customer_email: OWNER,
      metadata: {},
    } as unknown as Stripe.Checkout.Session;
  });
  ok(injected === 1 && !("error" in viaStub), "an injected retriever (checks) is not guarded");

  process.env.STRIPE_SECRET_KEY = LIVE_KEY;
  await reopenIfActiveCheckout(OWNER, FANTASY_SHORT);
  await reopenIfActiveCheckout(OWNER, TEST_SESSION);
  ok(calls.sessionsRetrieve.length === 3, "Kündigung reopen: fantasy and wrong-mode ids make 0 Stripe calls");
}

async function checkPurchaseCache() {
  clearSuccessCheckoutProbes();
  const calls = freshCalls();
  installStripeClientForChecks(stubStripe(calls, new Set([LIVE_SESSION])));
  process.env.STRIPE_SECRET_KEY = LIVE_KEY;

  const first = await captureConsole(() => lookupSuccessPurchase(LIVE_SESSION_MISSING, resolveCheckoutSession));
  ok("error" in first.value && first.value.error === "invalid", "a missing purchase session is invalid");
  ok(calls.sessionsRetrieve.length === 1, "first /success purchase lookup: 1 Stripe call");
  const second = await lookupSuccessPurchase(LIVE_SESSION_MISSING, resolveCheckoutSession);
  ok("error" in second && second.error === "invalid", "the cached answer is still invalid");
  ok(calls.sessionsRetrieve.length === 1, "second /success purchase lookup: 0 Stripe calls");

  const later = await captureConsole(() =>
    lookupSuccessPurchase(LIVE_SESSION_MISSING, resolveCheckoutSession, Date.now() + 11 * 60_000),
  );
  ok("error" in later.value, "after the window the session is asked again");
  ok(calls.sessionsRetrieve.length === 2, "the negative cache expires");

  await lookupSuccessPurchase(LIVE_SESSION, resolveCheckoutSession);
  await lookupSuccessPurchase(LIVE_SESSION, resolveCheckoutSession);
  ok(calls.sessionsRetrieve.length === 4, "a paid purchase session is not cached");

  let outages = 0;
  const outage = async () => {
    outages += 1;
    return { error: "lookup_failed" as const };
  };
  await lookupSuccessPurchase(LIVE_SESSION, outage);
  await lookupSuccessPurchase(LIVE_SESSION, outage);
  ok(outages === 2, "lookup_failed is not cached");

  const page = (await import("node:fs")).readFileSync("app/success/page.tsx", "utf8");
  ok(
    /lookupSuccessPurchase\(sessionId, resolveCheckoutSession\)/.test(page),
    "/success purchase lookup goes through the negative cache",
  );
}

async function checkSubscriptionCoverage() {
  clearStripeLookupCache();
  const calls = freshCalls();
  installStripeClientForChecks(stubStripe(calls, new Set()));
  process.env.STRIPE_SECRET_KEY = LIVE_KEY;

  const verify = await captureConsole(() => verifyStripeCustomerId(CUSTOMER_STALE));
  ok(verify.value === "invalid", "a test-mode customer under a live key verifies as invalid");
  ok(isCustomerKnownInvalid(CUSTOMER_STALE), "the invalid answer is cached");
  const listed = await listCustomerSubscriptionStatuses(CUSTOMER_STALE);
  ok(!listed.ok, "an invalid customer has no readable subscriptions");
  ok(calls.subscriptionsList.length === 0, "invalid cached customer: 0 subscriptions.list calls");

  // Coverage end to end on the local file store: the paid row carries the stale id.
  const dir = mkdtempSync(path.join(tmpdir(), "gobd-stripe-guard-"));
  const saved = { cwd: process.cwd(), tmp: process.env.TMPDIR };
  process.env.TMPDIR = dir;
  process.chdir(dir);
  try {
    mkdirSync(path.join(dir, ".data"), { recursive: true });
    const row: SheetRow = {
      ...emptySheetRow(),
      timestamp: "2026-10-26T09:00:00.000Z",
      stripeSessionId: TEST_SESSION,
      stripeCustomerId: CUSTOMER_STALE,
      email: OWNER,
      company: "Prüf GmbH",
      status: "paid",
      documentId: "doc-stripe-guard",
      entityId: "ent-stripe-guard",
    };
    writeFileSync(path.join(dir, ".data", "intakes.json"), JSON.stringify([row]), "utf8");
    clearStripeLookupCache();
    const before = calls.customersRetrieve.length;
    const run = await captureConsole(() => loadIncludedFirmCoverage(OWNER));
    ok(run.value.hasStoredPaidEntitlement, "the paid row still counts as a stored entitlement");
    ok(run.value.lookupFailed && run.value.stripeCustomerId === "", "the stale id is not used as the coverage customer");
    ok(calls.customersRetrieve.length === before + 1, "coverage verifies the stored id once");
    ok(calls.subscriptionsList.length === 0, "coverage with a stale customer: 0 subscriptions.list calls");
    const again = await captureConsole(() => loadIncludedFirmCoverage(OWNER));
    ok(again.value.lookupFailed, "a second coverage read stays fail-closed");
    ok(calls.customersRetrieve.length === before + 1, "the cached invalid answer saves the second customers.retrieve");
    ok(calls.subscriptionsList.length === 0, "still 0 subscriptions.list calls");
  } finally {
    process.chdir(saved.cwd);
    if (saved.tmp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = saved.tmp;
  }

  const logged = await captureConsole(() => listCustomerSubscriptionStatuses(CUSTOMER_LOG));
  ok(!logged.value.ok, "a failing subscriptions.list is not „kein Abo“");
  ok(calls.subscriptionsList.length === 1, "an unknown customer id is still asked once");
  const line = logged.lines.find((entry) => entry.includes("subscriptions.list")) ?? "";
  ok(line.includes("resource_missing") && line.includes("404"), "the log line carries code and status");
  ok(!line.includes(CUSTOMER_LOG) && !line.includes("No such"), "the log line carries no id and no message");
  ok(isCustomerKnownInvalid(CUSTOMER_LOG), "a missing customer from subscriptions.list is remembered");
  await listCustomerSubscriptionStatuses(CUSTOMER_LOG);
  ok(calls.subscriptionsList.length === 1, "the next list for that id makes 0 calls");
}

async function main() {
  const keys = [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_SETUP_ID",
    "STRIPE_PRICE_MONTHLY_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEETS_SPREADSHEET_ID",
    "BLOB_READ_WRITE_TOKEN",
    "VERCEL",
  ] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  process.env.STRIPE_PRICE_SETUP_ID = "price_setup_check";
  process.env.STRIPE_PRICE_MONTHLY_ID = "price_monthly_check";
  try {
    checkVerdicts();
    await checkCheckoutGuard();
    await checkPurchaseCache();
    await checkSubscriptionCoverage();
  } finally {
    installStripeClientForChecks(null);
    clearStripeLookupCache();
    clearSuccessCheckoutProbes();
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
  console.log("check-stripe-id-guard: all ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
