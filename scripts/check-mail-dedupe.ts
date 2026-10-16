/**
 * Every Resend send goes through the dedupe helper, and the claim is
 * exclusive. Synthetic only: no Stripe, no Resend, no Blob.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutWelcomeHttpStatus } from "@/app/api/stripe/webhook/route";
import {
  buyerOnboardingMarkerFileForTests,
  deliverBuyerOnboarding,
  forgetBuyerOnboarding,
  ONBOARDING_CLAIM_FRESH_MS,
  plantBuyerOnboardingMarker,
  setBuyerOnboardingTestHooks,
} from "@/lib/buyer-onboarding";
import {
  MAGIC_LINK_WINDOW_MS,
  onboardingMailKey,
  PENDING_FRESH_MS,
  resendIdempotencyKey,
  sendDedupedEmail,
  setMailDedupeTestHooks,
  tryClaimMailDedupeSlot,
} from "@/lib/mail-dedupe";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message: string): never {
  console.error(`check-mail-dedupe: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

const SKIP_DIRS = new Set(["node_modules", ".next", ".data", ".git"]);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) found.push(full);
  }
  return found;
}

function rel(file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const sendCall = /(?<![A-Za-z0-9_])sendEmail\s*\(/;
const resendClient = /new Resend\s*\(/;
const resendSend = /\.emails\.send\b/;
const resendImport = /from\s+["']resend["']/;
const sendImport = /import\s*\{[^}]*\bsendEmail\b/;

function assertCallSites() {
  const allowedSend = new Set(["lib/mail.ts", "lib/mail-dedupe.ts"]);
  for (const file of sourceFiles(root)) {
    const relativePath = rel(file);
    const source = readFileSync(file, "utf8");
    if (sendCall.test(source) && !allowedSend.has(relativePath)) {
      fail(`${relativePath} calls sendEmail outside the dedupe helper`);
    }
    if ((resendClient.test(source) || resendSend.test(source) || resendImport.test(source)) && relativePath !== "lib/mail.ts") {
      fail(`${relativePath} talks to Resend outside lib/mail.ts`);
    }
    if (sendImport.test(source) && relativePath !== "lib/mail-dedupe.ts") {
      fail(`${relativePath} imports sendEmail`);
    }
  }

  const helper = read("lib/mail-dedupe.ts");
  assert(
    helper.includes("idempotencyKey: resendIdempotencyKey("),
    "the helper must pass the logical key as the Resend Idempotency-Key",
  );
  assert(helper.includes("allowOverwrite: false"), "blob claims are exclusive");
  assert(helper.includes('"wx"'), "file claims are exclusive");
  assert(helper.includes("MAGIC_LINK_WINDOW_MS = 60_000"), "magic links wait 60 seconds");

  const ops = read("lib/ops.ts");
  const sends = ops.match(/sendDedupedEmail\(/g) ?? [];
  assert(sends.length >= 7, `ops routes ${sends.length} sends through the helper`);
  assert(!sendCall.test(ops), "ops still calls sendEmail");
  assert(ops.includes("onboardingMailKey("), "welcome mail is keyed by checkout session");
  assert(ops.includes("failedPaymentMailKey("), "failed payment is keyed");
  assert(ops.includes("deliveryMailKey("), "delivery mail is keyed by document and version");
  assert(ops.includes("magicLinkMailKey("), "magic link is keyed by email");
  assert(ops.includes("windowMs: MAGIC_LINK_WINDOW_MS"), "magic link uses the 60s window");

  const cancellation = read("lib/kuendigung-apply.ts");
  assert(cancellation.includes("sendDedupedEmail("), "cancellation mail uses the helper");
  assert(!sendCall.test(cancellation), "cancellation still calls sendEmail");

  const webhook = read("app/api/stripe/webhook/route.ts");
  assert(webhook.includes("deliverBuyerOnboarding"), "checkout completion sends the welcome mail");
  assert(webhook.includes("checkoutWelcomeHttpStatus"), "webhook status follows the welcome claim");
  assert(webhook.includes('mailed === "inflight"'), "a fresh welcome claim is not a successful skip");
  const post = webhook.slice(webhook.indexOf("export async function POST"));
  assert(
    post.includes("checkoutWelcomeHttpStatus(mailed) !== 200"),
    "POST answers non-2xx when the welcome claim is still in flight",
  );
  assert(post.includes("{ status: 500 }"), "POST can answer 500 so Stripe retries");
  assert(webhook.includes("eventId: event.id"), "payment failure keeps the Stripe event id");
  assert(webhook.includes("recordSubscriptionEvent"), "subscription events reach the cancellation mail");
  assert(!webhook.includes("invoice.paid"), "invoice.paid does not send a second order mail");

  assert(!existsSync(path.join(root, "app/api/cron/lifecycle/route.ts")), "the deletion cron is gone");
  assert(!cancellation.includes("runLifecycleJob"), "cancellation does not run a deletion job");
  assert(!cancellation.includes("buildCancellationReminderMail"), "cancellation does not send a deletion reminder");
  assert(read("app/api/checkout/grant/route.ts").includes("notifyBuyerOfCheckout"), "grant sends the same welcome mail");
  assert(read("app/api/auth/checkout-handoff/route.ts").includes("deliverLoginLink"), "handoff uses the login link");
  assert(read("app/api/intake/route.ts").includes("documentId,"), "intake delivery mail carries the document id");
  assert(read("app/api/document/route.ts").includes("documentId,"), "revision delivery mail carries the document id");
  assert(read("app/api/readiness/route.ts").includes("readinessDedupeKey("), "readiness mail is keyed by the submission");

  const buyer = read("lib/buyer-onboarding.ts");
  assert(buyer.includes("ONBOARDING_CLAIM_FRESH_MS = 4 * 60 * 1000"), "an orphaned claim waits 4 minutes");
  assert(buyer.includes('status: "claiming"'), "the welcome claim marker says claiming");
  assert(buyer.includes('flag: "wx"'), "file claims stay exclusive");
  assert(buyer.includes("writeOptions(loc.token, !exclusive)"), "blob claims stay exclusive");
  assert(
    buyer.includes("idempotencyKey: `checkout-onboarding/${sessionHash(sessionId)}`"),
    "the checkout idempotency key stays on the welcome mail",
  );
  assert(buyer.includes("[ops] Onboarding-Nachweis nicht gelöscht"), "a failed marker delete is logged");
  assert(!buyer.includes("// already gone"), "marker delete errors are not ignored without a log");
  assert(helper.includes("export const PENDING_FRESH_MS = 2 * 60 * 1000"), "pending claims stay fresh for 2 minutes");

  const login = read("app/login/login-form.tsx");
  const renew = read("app/auth/abgelaufen/renew-link-button.tsx");
  const handoff = read("app/intake/page.tsx");
  const pending = read("components/pending-submit-button.tsx");
  assert(login.includes("disabled={pending}"), "login button disables while pending");
  assert(login.includes("button.disabled = true"), "login button disables on the first click");
  assert(renew.includes("disabled={pending}"), "renew button disables while pending");
  assert(renew.includes("button.disabled = true"), "renew button disables on the first click");
  assert(handoff.includes("PendingSubmitButton"), "handoff button disables while pending");
  assert(pending.includes("disabled={pending}"), "pending submit button disables itself");
}

const mail = {
  to: "buyer.dedupe@example.com",
  subject: "Test",
  text: "Text",
  html: "<p>Text</p>",
};

async function assertRuntime() {
  const dir = mkdtempSync(path.join(tmpdir(), "mail-dedupe-"));
  const env = process.env as Record<string, string | undefined>;
  const savedNode = env.NODE_ENV;
  const savedVercel = env.VERCEL_ENV;
  const counter = { sends: 0 };
  const keys: string[] = [];
  let now = Date.parse("2026-10-12T12:00:00.000Z");
  let failFirst = false;

  const restore = () => {
    setMailDedupeTestHooks(null);
    if (savedNode === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = savedNode;
    if (savedVercel === undefined) delete env.VERCEL_ENV;
    else env.VERCEL_ENV = savedVercel;
  };

  setMailDedupeTestHooks({
    dir,
    now: () => now,
    send: async (input) => {
      counter.sends += 1;
      keys.push(input.idempotencyKey ?? "");
      if (failFirst && counter.sends === 1) return { stub: false, sent: false };
      return { stub: false, sent: true, id: "email_test" };
    },
  });

  try {
    delete env.VERCEL_ENV;
    env.NODE_ENV = "development";

    const key = onboardingMailKey("cs_test_dedupe");
    const first = await sendDedupedEmail({ ...mail, dedupeKey: key });
    const second = await sendDedupedEmail({ ...mail, dedupeKey: key });
    assert(first.sent && !first.duplicate, "the first welcome mail sends");
    assert(second.duplicate && !second.sent, "the same session does not send again");
    assert(counter.sends === 1, "Resend is called once for one session");
    assert(keys[0] === resendIdempotencyKey(key), "the header is the same logical key");
    assert(keys[0] === "onboarding-cs_test_dedupe", "colons are safe for Resend");

    counter.sends = 0;
    const [left, right] = await Promise.all([
      sendDedupedEmail({ ...mail, dedupeKey: onboardingMailKey("cs_parallel") }),
      sendDedupedEmail({ ...mail, dedupeKey: onboardingMailKey("cs_parallel") }),
    ]);
    const sentCount = [left, right].filter((item) => item.sent).length;
    const duplicateCount = [left, right].filter((item) => item.duplicate).length;
    assert(counter.sends === 1 && sentCount === 1 && duplicateCount === 1, "parallel welcome sends one mail");

    const raced = await Promise.all([
      tryClaimMailDedupeSlot("race-slot"),
      tryClaimMailDedupeSlot("race-slot"),
    ]);
    assert(
      raced.filter((item) => item === "created").length === 1 &&
        raced.filter((item) => item === "exists").length === 1,
      "two claims cannot both create the slot",
    );

    failFirst = true;
    counter.sends = 0;
    const failed = await sendDedupedEmail({ ...mail, dedupeKey: onboardingMailKey("cs_retry") });
    failFirst = false;
    const retried = await sendDedupedEmail({ ...mail, dedupeKey: onboardingMailKey("cs_retry") });
    assert(!failed.sent && !failed.duplicate, "a failed send releases the claim");
    assert(retried.sent === true, "a retry after failure sends");

    counter.sends = 0;
    keys.length = 0;
    const magicKey = "magic-link:buyer.dedupe@example.com";
    const magicFirst = await sendDedupedEmail({
      ...mail,
      dedupeKey: magicKey,
      windowMs: MAGIC_LINK_WINDOW_MS,
    });
    const magicSecond = await sendDedupedEmail({
      ...mail,
      dedupeKey: magicKey,
      windowMs: MAGIC_LINK_WINDOW_MS,
    });
    assert(magicFirst.sent && magicSecond.duplicate, "a second login link inside 60s is held");
    assert(counter.sends === 1, "the held login link does not call Resend");
    now += MAGIC_LINK_WINDOW_MS + 1_000;
    const magicThird = await sendDedupedEmail({
      ...mail,
      dedupeKey: magicKey,
      windowMs: MAGIC_LINK_WINDOW_MS,
    });
    assert(magicThird.sent === true && counter.sends === 2, "a login link can be sent again after 60s");
    assert(keys[0] !== keys[1], "the later login link gets its own Resend key");

    env.NODE_ENV = "production";
    counter.sends = 0;
    setMailDedupeTestHooks({
      dir,
      now: () => now,
      send: async () => {
        counter.sends += 1;
        return { stub: true, sent: false };
      },
    });
    const prodFirst = await sendDedupedEmail({ ...mail, dedupeKey: onboardingMailKey("cs_prod_stub") });
    const prodSecond = await sendDedupedEmail({ ...mail, dedupeKey: onboardingMailKey("cs_prod_stub") });
    assert(prodFirst.stub && prodSecond.stub && counter.sends === 2, "a production stub does not stick");

    env.NODE_ENV = "development";
    counter.sends = 0;
    setMailDedupeTestHooks({
      dir,
      now: () => now,
      send: async () => {
        counter.sends += 1;
        return { stub: true, sent: false };
      },
    });
    const devFirst = await sendDedupedEmail({ ...mail, dedupeKey: onboardingMailKey("cs_dev_stub") });
    const devSecond = await sendDedupedEmail({ ...mail, dedupeKey: onboardingMailKey("cs_dev_stub") });
    assert(devFirst.stub && devSecond.duplicate && counter.sends === 1, "a dev stub is still claimed once");
  } finally {
    restore();
  }
}

async function assertOnboardingClaimRace() {
  const dir = mkdtempSync(path.join(tmpdir(), "onboarding-claim-"));
  const dedupeDir = mkdtempSync(path.join(tmpdir(), "onboarding-dedupe-"));
  const env = process.env as Record<string, string | undefined>;
  const saved = {
    NODE_ENV: env.NODE_ENV,
    VERCEL_ENV: env.VERCEL_ENV,
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
    BLOB_READ_WRITE_TOKEN: env.BLOB_READ_WRITE_TOKEN,
  };
  const sends = { n: 0, keys: [] as string[] };

  const restore = () => {
    setBuyerOnboardingTestHooks(null);
    setMailDedupeTestHooks(null);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
    rmSync(dedupeDir, { recursive: true, force: true });
  };

  delete env.VERCEL_ENV;
  delete env.BLOB_READ_WRITE_TOKEN;
  env.NODE_ENV = "development";
  env.RESEND_API_KEY = "re_test_onboarding_claim";
  env.EMAIL_FROM = "onboarding-claim@example.com";
  setBuyerOnboardingTestHooks({ dir });
  setMailDedupeTestHooks({
    dir: dedupeDir,
    send: async (input) => {
      sends.n += 1;
      sends.keys.push(input.idempotencyKey ?? "");
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { stub: false, sent: true, id: "email_test" };
    },
  });

  const buyer = "buyer.claim@example.com";
  const welcome = (sessionId: string) => ({
    email: buyer,
    company: "Claim GmbH",
    sessionId,
    audience: "steuerberater" as const,
  });

  try {
    assert(
      ONBOARDING_CLAIM_FRESH_MS > PENDING_FRESH_MS &&
        ONBOARDING_CLAIM_FRESH_MS >= 3 * 60 * 1000 &&
        ONBOARDING_CLAIM_FRESH_MS <= 5 * 60 * 1000,
      "an orphaned onboarding claim waits 3–5 minutes, past the 2-minute pending window",
    );

    const freshId = "cs_claim_fresh";
    await plantBuyerOnboardingMarker(freshId, {
      email: buyer,
      status: "claiming",
      at: new Date().toISOString(),
    });
    const fresh = await deliverBuyerOnboarding(welcome(freshId));
    assert(fresh === "inflight" && sends.n === 0, `fresh claim does not send (got ${fresh})`);
    assert(checkoutWelcomeHttpStatus(fresh) === 500, "fresh claim -> webhook 500 no send");
    const freshAgain = await deliverBuyerOnboarding(welcome(freshId));
    assert(
      freshAgain === "inflight" && checkoutWelcomeHttpStatus(freshAgain) === 500 && sends.n === 0,
      "a fresh claim is not taken over",
    );

    const orphanId = "cs_claim_orphan";
    await plantBuyerOnboardingMarker(orphanId, {
      email: buyer,
      status: "claiming",
      at: new Date(Date.now() - ONBOARDING_CLAIM_FRESH_MS - 1_000).toISOString(),
    });
    const orphan = await deliverBuyerOnboarding(welcome(orphanId));
    assert(
      (orphan === "sent" || orphan === "stub") &&
        checkoutWelcomeHttpStatus(orphan) === 200 &&
        sends.n === 1,
      `orphaned claim -> taken over, exactly one send (got ${orphan}, sends ${sends.n})`,
    );
    assert(
      sends.keys[0] === resendIdempotencyKey(onboardingMailKey(orphanId)),
      "the takeover keeps the onboarding Resend Idempotency-Key",
    );
    const orphanAgain = await deliverBuyerOnboarding(welcome(orphanId));
    assert(
      orphanAgain === "skipped" && checkoutWelcomeHttpStatus(orphanAgain) === 200 && sends.n === 1,
      "a settled takeover does not send again",
    );

    const raceId = "cs_claim_orphan_race";
    sends.n = 0;
    sends.keys.length = 0;
    await plantBuyerOnboardingMarker(raceId, {
      email: buyer,
      status: "claiming",
      at: new Date(Date.now() - ONBOARDING_CLAIM_FRESH_MS - 5_000).toISOString(),
    });
    const raced = await Promise.all([
      deliverBuyerOnboarding(welcome(raceId)),
      deliverBuyerOnboarding(welcome(raceId)),
    ]);
    assert(
      sends.n === 1 && raced.some((status) => status === "sent" || status === "stub"),
      `parallel orphan takeover sends once (got ${raced.join(",")}, sends ${sends.n})`,
    );
    assert(
      sends.keys.length === 1 && sends.keys[0] === resendIdempotencyKey(onboardingMailKey(raceId)),
      "parallel takeover uses one Resend key",
    );
    const raceFollow = await deliverBuyerOnboarding(welcome(raceId));
    assert(
      raceFollow === "skipped" && checkoutWelcomeHttpStatus(raceFollow) === 200 && sends.n === 1,
      "parallel takeover settles to one sent marker",
    );

    const sentId = "cs_claim_sent";
    sends.n = 0;
    sends.keys.length = 0;
    await plantBuyerOnboardingMarker(sentId, {
      email: buyer,
      status: "sent",
      at: new Date(Date.now() - 60_000).toISOString(),
    });
    const sent = await deliverBuyerOnboarding(welcome(sentId));
    assert(
      sent === "skipped" && checkoutWelcomeHttpStatus(sent) === 200 && sends.n === 0,
      "sent marker -> 200 no send",
    );

    const legacyId = "cs_claim_legacy_sent";
    await writeFile(
      buyerOnboardingMarkerFileForTests(legacyId),
      JSON.stringify({ email: buyer, sentAt: new Date().toISOString() }),
      "utf8",
    );
    const legacy = await deliverBuyerOnboarding(welcome(legacyId));
    assert(
      legacy === "skipped" && checkoutWelcomeHttpStatus(legacy) === 200 && sends.n === 0,
      "a legacy sent marker does not send",
    );

    const freshGarbageId = "cs_claim_garbage_fresh";
    await writeFile(buyerOnboardingMarkerFileForTests(freshGarbageId), "{", "utf8");
    const freshGarbage = await deliverBuyerOnboarding(welcome(freshGarbageId));
    assert(
      freshGarbage === "inflight" && checkoutWelcomeHttpStatus(freshGarbage) === 500 && sends.n === 0,
      "a young unreadable marker stays in flight",
    );

    const oldGarbageId = "cs_claim_garbage_old";
    const oldGarbageFile = buyerOnboardingMarkerFileForTests(oldGarbageId);
    await writeFile(oldGarbageFile, "{", "utf8");
    const aged = new Date(Date.now() - ONBOARDING_CLAIM_FRESH_MS - 5_000);
    utimesSync(oldGarbageFile, aged, aged);
    sends.n = 0;
    sends.keys.length = 0;
    const oldGarbage = await deliverBuyerOnboarding(welcome(oldGarbageId));
    assert(
      (oldGarbage === "sent" || oldGarbage === "stub") && sends.n === 1,
      `an old unreadable marker is taken over once (got ${oldGarbage}, sends ${sends.n})`,
    );
    assert(
      sends.keys[0] === resendIdempotencyKey(onboardingMailKey(oldGarbageId)),
      "the unreadable takeover keeps the Resend Idempotency-Key",
    );

    const forgetId = "cs_claim_forget_log";
    mkdirSync(buyerOnboardingMarkerFileForTests(forgetId));
    const errors: string[] = [];
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map((part) => String(part)).join(" "));
    };
    try {
      await forgetBuyerOnboarding(forgetId);
      await forgetBuyerOnboarding("cs_claim_forget_missing");
    } finally {
      console.error = orig;
    }
    assert(
      errors.some((line) => line.includes("Onboarding-Nachweis nicht gelöscht")),
      "forgetBuyerOnboarding logs a failed delete",
    );
    assert(errors.length === 1, "a missing marker does not log a delete error");
  } finally {
    restore();
  }
}

assertCallSites();
assertRuntime()
  .then(() => assertOnboardingClaimRace())
  .then(() => {
    console.log("check-mail-dedupe: ok");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
