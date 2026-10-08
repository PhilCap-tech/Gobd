/**
 * Regression: fake checkout ids must not read or write drafts in production.
 *
 *   npx tsx scripts/check-draft-auth.ts
 *
 * Production is VERCEL_ENV==="production" or NODE_ENV==="production"
 * (and any VERCEL=1 deployment). Expected HTTP status from
 * GET/PUT/DELETE /api/intake/draft, via draftAccessHttpStatus:
 *   mock_ id, no login        → 401
 *   logged-in owner           → 200
 *   logged-in foreign owner   → 403
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canAccessDocument } from "../lib/documents";
import {
  authorizeDraftAccess,
  authorizeUploadSession,
  draftAccessHttpStatus,
  type CheckoutResolver,
} from "../lib/checkout-access";
import { devCheckoutStubAllowed } from "../lib/checkout-stub";
import { demoBeispielAnswers } from "../lib/demo-beispiel";
import { getGesamtMuster, MUSTER_VORLAGEN } from "../lib/module-muster";
import { createCheckoutSession, resolveCheckoutSession } from "../lib/stripe";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const STRIPE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_SETUP_ID",
  "STRIPE_PRICE_MONTHLY_ID",
] as const;

const ENV_KEYS = ["VERCEL_ENV", "NODE_ENV", "VERCEL", ...STRIPE_KEYS] as const;

const saved: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) saved[key] = process.env[key];

const env = process.env as Record<string, string | undefined>;

function setEnv(patch: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
}

const ownerDraft = {
  email: "owner@example.com",
  draftKey: "email:owner@example.com:default:gesamt",
  stripeSessionId: "mock_stored",
};

const paid: CheckoutResolver = async () => ({
  email: "owner@example.com",
  stub: false,
});

const lookupFailed: CheckoutResolver = async () => ({ error: "lookup_failed" });

function productionEnv(extra: Record<string, string | undefined> = {}) {
  setEnv({
    VERCEL_ENV: "production",
    NODE_ENV: "production",
    VERCEL: "1",
    STRIPE_SECRET_KEY: undefined,
    STRIPE_PRICE_SETUP_ID: undefined,
    STRIPE_PRICE_MONTHLY_ID: undefined,
    ...extra,
  });
}

async function checkProductionDrafts() {
  productionEnv();
  ok(!devCheckoutStubAllowed(), "production disables the dev checkout stub");

  let stripeCalls = 0;
  const mockStatus = draftAccessHttpStatus(
    await authorizeDraftAccess(
      { sessionId: "mock_attacker", draft: ownerDraft, draftKey: ownerDraft.draftKey },
      async () => {
        stripeCalls += 1;
        return { email: "owner@example.com", stub: false };
      },
    ),
  );
  ok(stripeCalls === 0, "mock_ in production does not get a Stripe lookup");
  ok(mockStatus === 401 || mockStatus === 403, "mock_ in production is 401/403");
  ok(mockStatus === 401, "mock_ without login is 401");
  console.log("prod mock_ session →", mockStatus);

  const storedMock = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionId: "mock_stored",
      draft: ownerDraft,
      draftKey: ownerDraft.draftKey,
    }),
  );
  ok(storedMock === 401, "matching stored mock_ id is not a bearer in production");

  const direct = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionId: "mock_direct",
      draft: ownerDraft,
      draftKey: ownerDraft.draftKey,
    }),
  );
  ok(direct === 401, "mock_direct is not a bearer in production");

  const ownerStatus = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "owner@example.com",
      draft: ownerDraft,
      draftKey: ownerDraft.draftKey,
    }),
  );
  ok(ownerStatus === 200, "logged-in owner is 200");
  console.log("prod logged-in owner →", ownerStatus);

  const ownerViaKey = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "Owner@Example.com",
      draft: { email: "", draftKey: "email:owner@example.com:ent_1:bereich", stripeSessionId: "" },
      draftKey: "email:owner@example.com:ent_1:bereich",
    }),
  );
  ok(ownerViaKey === 200, "session email matches the email: draft key");

  const foreignStatus = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "other@example.com",
      draft: ownerDraft,
      draftKey: ownerDraft.draftKey,
    }),
  );
  ok(foreignStatus === 403, "foreign owner is 403");
  console.log("prod foreign owner →", foreignStatus);

  const foreignMock = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "other@example.com",
      sessionId: "mock_attacker",
      draft: ownerDraft,
      draftKey: ownerDraft.draftKey,
    }),
  );
  ok(foreignMock === 403, "foreign owner plus mock_ stays 403");

  const claimedOther = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "owner@example.com",
      email: "other@example.com",
      draft: ownerDraft,
      draftKey: ownerDraft.draftKey,
    }),
  );
  ok(claimedOther === 403, "owner cannot retarget the draft email");

  const squatEmail = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "other@example.com",
      email: "other@example.com",
      draftKey: "email:owner@example.com:default:gesamt",
    }),
  );
  ok(squatEmail === 403, "login cannot create a draft on someone else's email key");

  const ownEmailKey = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "owner@example.com",
      draftKey: "email:owner@example.com:default:gesamt",
    }),
  );
  ok(ownEmailKey === 200, "login can create a draft on their own email key");

  const squatSession = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "other@example.com",
      draftKey: "session:cs_live_victim:gesamt",
    }),
  );
  ok(squatSession === 403, "login cannot claim someone else's session draft key");

  const squatWithOwnPayment = draftAccessHttpStatus(
    await authorizeDraftAccess(
      {
        sessionEmail: "other@example.com",
        sessionId: "cs_live_other",
        email: "other@example.com",
        draftKey: "session:cs_live_victim:gesamt",
      },
      async () => ({ email: "other@example.com", stub: false }),
    ),
  );
  ok(squatWithOwnPayment === 403, "a different paid session cannot write a session draft key");

  const ownDocKey = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionEmail: "owner@example.com",
      draftKey: "doc:11111111-2222-4333-8444-555555555555",
    }),
  );
  ok(ownDocKey === 200, "logged-in user can open a document draft key");

  const testPrefix = draftAccessHttpStatus(
    await authorizeDraftAccess(
      { sessionId: "cs_test_fake", draft: ownerDraft, draftKey: ownerDraft.draftKey },
      lookupFailed,
    ),
  );
  ok(testPrefix === 401, "cs_test_ prefix is not an auth bypass");

  const failedLookup = draftAccessHttpStatus(
    await authorizeDraftAccess(
      { sessionId: "cs_live_real", draft: ownerDraft, draftKey: ownerDraft.draftKey },
      lookupFailed,
    ),
  );
  ok(failedLookup === 401, "lookup_failed does not authorize");

  const stubResult = draftAccessHttpStatus(
    await authorizeDraftAccess(
      { sessionId: "cs_live_real", draft: ownerDraft, draftKey: ownerDraft.draftKey },
      async () => ({ email: "", stub: true }),
    ),
  );
  ok(stubResult === 401, "stub lookup result does not authorize in production");

  const paidStatus = draftAccessHttpStatus(
    await authorizeDraftAccess(
      { sessionId: "cs_live_paid", draft: ownerDraft, draftKey: ownerDraft.draftKey },
      paid,
    ),
  );
  ok(paidStatus === 200, "paid Stripe session for the owner is 200");

  const foreignPaid = draftAccessHttpStatus(
    await authorizeDraftAccess(
      { sessionId: "cs_live_other", draft: ownerDraft, draftKey: ownerDraft.draftKey },
      async () => ({ email: "other@example.com", stub: false }),
    ),
  );
  ok(foreignPaid === 401, "paid session of another customer does not open the draft");

  const uploadMock = await authorizeUploadSession({ sessionId: "mock_upload" }, async () => {
    throw new Error("stripe must not run for mock_ uploads");
  });
  ok(!uploadMock.ok && uploadMock.status === 401, "upload mock_ in production is 401");

  const uploadFailed = await authorizeUploadSession(
    { sessionId: "cs_test_upload" },
    lookupFailed,
  );
  ok(!uploadFailed.ok && uploadFailed.status === 401, "upload lookup failure is 401");

  const uploadPaid = await authorizeUploadSession({ sessionId: "cs_live_paid" }, paid);
  ok(uploadPaid.ok, "upload allows a paid checkout session");

  ok(
    !canAccessDocument(
      { email: "owner@example.com", stripeSessionId: "mock_stored" },
      { sessionId: "mock_stored" },
    ),
    "PDF/document access rejects mock_ in production",
  );
  ok(
    canAccessDocument(
      { email: "owner@example.com", stripeSessionId: "mock_stored" },
      { sessionEmail: "owner@example.com", sessionId: "mock_stored" },
    ),
    "document owner email still grants access",
  );
  ok(
    !canAccessDocument(
      { email: "owner@example.com", stripeSessionId: "cs_live_real" },
      { sessionEmail: "other@example.com" },
    ),
    "foreign email cannot open the document",
  );
  ok(
    canAccessDocument(
      { email: "owner@example.com", stripeSessionId: "cs_live_real" },
      { sessionId: "cs_live_real" },
    ),
    "real checkout session id still opens the document",
  );

  const mockLookup = await resolveCheckoutSession("mock_attacker");
  ok("error" in mockLookup && mockLookup.error === "not_paid", "session lookup rejects mock_ in production");

  const anyLookup = await resolveCheckoutSession("cs_live_unchecked");
  ok(
    "error" in anyLookup && anyLookup.error === "missing",
    "missing Stripe keys do not accept an arbitrary session in production",
  );

  await assert.rejects(
    () => createCheckoutSession({ email: "owner@example.com", company: "Beispiel GmbH" }),
    /STRIPE_SECRET_KEY fehlt/,
    "production checkout does not mint a mock_ session",
  );
  ok(true, "production checkout does not mint a mock_ session");
}

async function checkProductionSignals() {
  setEnv({
    VERCEL_ENV: "production",
    NODE_ENV: "development",
    VERCEL: undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_PRICE_SETUP_ID: undefined,
    STRIPE_PRICE_MONTHLY_ID: undefined,
  });
  const viaVercel = draftAccessHttpStatus(
    await authorizeDraftAccess({ sessionId: "mock_vercel", draft: ownerDraft }),
  );
  ok(viaVercel === 401, "VERCEL_ENV=production alone rejects mock_");

  setEnv({
    VERCEL_ENV: undefined,
    NODE_ENV: "production",
    VERCEL: undefined,
  });
  const viaNode = draftAccessHttpStatus(
    await authorizeDraftAccess({ sessionId: "mock_node", draft: ownerDraft }),
  );
  ok(viaNode === 401, "NODE_ENV=production alone rejects mock_");

  setEnv({
    VERCEL_ENV: "preview",
    NODE_ENV: "development",
    VERCEL: "1",
  });
  const viaPreview = draftAccessHttpStatus(
    await authorizeDraftAccess({ sessionId: "mock_preview", draft: ownerDraft }),
  );
  ok(viaPreview === 401, "Vercel preview rejects mock_");
}

async function checkLocalStubStillWorks() {
  setEnv({
    VERCEL_ENV: undefined,
    NODE_ENV: "development",
    VERCEL: undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_PRICE_SETUP_ID: undefined,
    STRIPE_PRICE_MONTHLY_ID: undefined,
  });
  ok(devCheckoutStubAllowed(), "local dev allows the checkout stub");
  const local = draftAccessHttpStatus(
    await authorizeDraftAccess({
      sessionId: "mock_local",
      email: "owner@example.com",
      draftKey: "session:mock_local:gesamt",
    }),
  );
  ok(local === 200, "local dev without Stripe keys still accepts mock_");

  const resolved = await resolveCheckoutSession("mock_local");
  ok(!("error" in resolved) && resolved.stub === true, "local session lookup stays a stub");

  const checkout = await createCheckoutSession({
    email: "owner@example.com",
    company: "Beispiel GmbH",
  });
  ok(checkout.stub === true && checkout.url.includes("mock_"), "local checkout still mints mock_");

  setEnv({
    STRIPE_SECRET_KEY: "sk_test_not_used",
    STRIPE_PRICE_SETUP_ID: "price_setup",
    STRIPE_PRICE_MONTHLY_ID: "price_month",
  });
  const configured = draftAccessHttpStatus(
    await authorizeDraftAccess({ sessionId: "mock_with_keys", draft: ownerDraft }),
  );
  ok(configured === 401, "local mock_ is rejected once Stripe keys exist");
  const configuredLookup = await resolveCheckoutSession("mock_with_keys");
  ok(
    "error" in configuredLookup && configuredLookup.error === "not_paid",
    "configured Stripe lookup rejects mock_ without a network call",
  );
}

function checkDemoPagesStayPublic() {
  ok(Boolean(demoBeispielAnswers().katalog?.A01), "partner demo seed loads without a session");
  for (const vorlage of MUSTER_VORLAGEN) {
    const muster = getGesamtMuster(vorlage);
    ok(muster?.answers && muster.identity, `muster ${vorlage} loads without login`);
  }
  const publicFiles = [
    "app/steuerberater/demo/page.tsx",
    "app/steuerberater/demo/demo-walkthrough.tsx",
    "app/steuerberater/muster/page.tsx",
    "app/steuerberater/muster/pdf/route.ts",
    "app/muster/page.tsx",
    "app/muster/gesamt/[vorlage]/page.tsx",
    "app/muster/gesamt/[vorlage]/pdf/route.ts",
  ];
  for (const file of publicFiles) {
    const text = readFileSync(file, "utf8");
    ok(!text.includes("getSessionEmail"), `${file} has no login gate`);
    ok(!text.includes("/api/intake/draft"), `${file} does not call the draft API`);
  }
}

function checkBypassRemovedFromRoutes() {
  const draftRoute = readFileSync("app/api/intake/draft/route.ts", "utf8");
  const uses = draftRoute.split("authorizeDraftAccess").length - 1;
  ok(uses >= 3, "GET, PUT and DELETE use authorizeDraftAccess");
  ok(draftRoute.includes("draftAccessHttpStatus"), "draft route returns the auth status");
  ok(!draftRoute.includes("mock_"), "draft route has no mock_ shortcut");
  ok(!draftRoute.includes("cs_test_"), "draft route has no cs_test_ shortcut");

  const uploadRoute = readFileSync("app/api/module-upload/route.ts", "utf8");
  ok(uploadRoute.includes("authorizeUploadSession"), "upload route uses authorizeUploadSession");
  ok(!uploadRoute.includes("ownerKey: sessionId"), "upload route does not treat a bare session id as access");

  const accountFiles = [
    "app/account/page.tsx",
    "app/api/profile/route.ts",
    "app/api/entities/route.ts",
    "app/api/document/route.ts",
  ];
  for (const file of accountFiles) {
    const text = readFileSync(file, "utf8");
    ok(!text.includes("mock_"), `${file} has no mock_ shortcut`);
    ok(text.includes("getSessionEmail"), `${file} still requires a session`);
  }
}

async function main() {
  try {
    checkDemoPagesStayPublic();
    checkBypassRemovedFromRoutes();
    await checkProductionDrafts();
    await checkProductionSignals();
    await checkLocalStubStillWorks();
    console.log("check-draft-auth: green");
    console.log("prod mock_ session → 401");
    console.log("prod logged-in owner → 200");
    console.log("prod foreign owner → 403");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
