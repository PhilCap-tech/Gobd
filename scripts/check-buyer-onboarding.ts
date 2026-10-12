/**
 * Order confirmation and magic link go to the buyer, even when another
 * browser session is signed in. Synthetic @example.com only. No Stripe, no Resend.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completeCheckoutHandoff } from "../app/api/auth/checkout-handoff/route";
import { completeCheckoutGrant } from "../app/api/checkout/grant/route";
import {
  CHECKOUT_GRANT_COOKIE,
  SESSION_COOKIE,
  createCheckoutGrantToken,
  createSessionToken,
  verifyCheckoutGrantToken,
  verifySessionToken,
} from "../lib/auth";
import {
  buyerOnboardingStillDue,
  deliverBuyerOnboarding,
  forgetBuyerOnboarding,
} from "../lib/buyer-onboarding";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer.c@example.com";
const OTHER = "session.other@example.com";
const SESSION = "cs_test_buyer_c_4242";

async function capture(run: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const info = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join(" "));
  };
  try {
    await run();
  } finally {
    console.info = info;
  }
  return lines.join("\n");
}

async function checkMailIgnoresSession() {
  ok(buyerOnboardingStillDue(null), "a checkout without a paid row is still due");
  ok(buyerOnboardingStillDue(new Date().toISOString()), "a fresh paid row is still due");
  ok(!buyerOnboardingStillDue("2020-01-01T00:00:00.000Z"), "an old paid row is outside the return window");

  await forgetBuyerOnboarding(SESSION);
  await forgetBuyerOnboarding("cs_test_old_window");

  const logs = await capture(async () => {
    const first = await deliverBuyerOnboarding({
      email: BUYER,
      company: "Käufer GmbH",
      sessionId: SESSION,
    });
    ok(first === "stub" || first === "sent", `first onboarding is ${first}`);
    const again = await deliverBuyerOnboarding({
      email: OTHER,
      sessionId: SESSION,
    });
    ok(again === "skipped", "a second call does not send another mail");
  });
  ok(logs.includes(BUYER), "the order mail names the buyer");
  ok(!logs.includes(OTHER), "the signed-in address is not the recipient");

  const stale = await deliverBuyerOnboarding({
    email: BUYER,
    sessionId: "cs_test_old_window",
    enforceWindow: true,
    paidAt: "2020-01-01T00:00:00.000Z",
  });
  ok(stale === "skipped", "an old return does not send a late welcome mail");

  const buyerFile = readFileSync("lib/buyer-onboarding.ts", "utf8");
  ok(!buyerFile.includes("getSessionEmail") && !buyerFile.includes("cookies("), "buyer mail does not read cookies");

  const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  const processed = webhook.indexOf("bereits verarbeitet");
  const mailed = webhook.indexOf("await deliverBuyerOnboarding");
  ok(processed > 0 && mailed > processed, "an existing paid row still reaches the buyer mail");
  ok(!webhook.includes("getSessionEmail") && !webhook.includes("cookies("), "webhook does not read the browser session");

  const intake = readFileSync("app/intake/page.tsx", "utf8");
  ok(intake.includes("notifyBuyerOfCheckout"), "the mismatch return can still mail the buyer");

  let notified = "";
  const granted = await completeCheckoutGrant(
    new Request(`http://localhost/api/checkout/grant?session_id=${encodeURIComponent(SESSION)}`, {
      headers: {
        cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}; ${CHECKOUT_GRANT_COOKIE}=${createCheckoutGrantToken({ sessionId: "cs_other", email: OTHER })}`,
      },
    }),
    {
      resolveCheckout: async () => ({
        email: BUYER,
        company: "Käufer GmbH",
        stripeSessionId: SESSION,
        stripeCustomerId: "cus_buyer_c",
        stub: false,
      }),
      lookupDocumentOwner: async () => null,
      notifyBuyer: async ({ email }) => {
        notified = email;
      },
    },
  );
  const location = granted.headers.get("location") ?? "";
  ok(notified === BUYER, "a foreign session still notifies the buyer");
  ok(location.includes("grant=skip"), "the foreign session still sees the mismatch return");
  ok(verifySessionToken(granted.cookies.get(SESSION_COOKIE)?.value) !== OTHER, "the grant mismatch does not adopt the buyer session");

  let sentTo = "";
  const handed = await completeCheckoutHandoff(
    new Request("http://localhost/api/auth/checkout-handoff", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}; ${CHECKOUT_GRANT_COOKIE}=${createCheckoutGrantToken({ sessionId: "cs_other", email: OTHER })}`,
      },
      body: new URLSearchParams({ session_id: SESSION, email: "attacker@example.com" }).toString(),
    }),
    {
      resolveOwner: async () => BUYER,
      deliver: async (email) => {
        sentTo = email;
        return "stub";
      },
    },
  );
  ok(sentTo === BUYER, "handoff mails the buyer, not the form and not the session");
  ok((handed.headers.get("location") ?? "").includes("/login"), "handoff continues at login");
  ok(verifySessionToken(handed.cookies.get(SESSION_COOKIE)?.value) === null, "handoff clears gobd_session");
  ok(
    verifyCheckoutGrantToken(handed.cookies.get(CHECKOUT_GRANT_COOKIE)?.value) === null,
    "handoff clears gobd_checkout",
  );

  let attempted = false;
  const unresolved = await completeCheckoutHandoff(
    new Request("http://localhost/api/auth/checkout-handoff", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}`,
      },
      body: new URLSearchParams({ session_id: SESSION }).toString(),
    }),
    {
      resolveOwner: async () => null,
      deliver: async () => {
        attempted = true;
        return "stub";
      },
    },
  );
  const unresolvedLocation = unresolved.headers.get("location") ?? "";
  ok(!attempted, "an unknown buyer is not mailed");
  ok(unresolvedLocation.includes("/login"), "an unresolved handoff leaves the account page");
  ok(!unresolvedLocation.includes("/account"), "an unresolved handoff does not bounce to /account");
  ok(
    verifySessionToken(unresolved.cookies.get(SESSION_COOKIE)?.value) === null,
    "an unresolved handoff still clears the foreign session",
  );

  await forgetBuyerOnboarding(SESSION);
}

checkMailIgnoresSession()
  .then(() => {
    console.log("check-buyer-onboarding: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
