/**
 * Every Resend send goes through the dedupe helper, and the claim is
 * exclusive. Synthetic only: no Stripe, no Resend, no Blob.
 */
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAGIC_LINK_WINDOW_MS,
  onboardingMailKey,
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
  assert(webhook.includes("eventId: event.id"), "payment failure keeps the Stripe event id");
  assert(webhook.includes("recordSubscriptionEvent"), "subscription events reach the cancellation mail");
  assert(!webhook.includes("invoice.paid"), "invoice.paid does not send a second order mail");

  assert(read("app/api/cron/lifecycle/route.ts").includes("runLifecycleJob"), "the lifecycle cron sends through the helper");
  assert(read("app/api/checkout/grant/route.ts").includes("notifyBuyerOfCheckout"), "grant sends the same welcome mail");
  assert(read("app/api/auth/checkout-handoff/route.ts").includes("deliverLoginLink"), "handoff uses the login link");
  assert(read("app/api/intake/route.ts").includes("documentId,"), "intake delivery mail carries the document id");
  assert(read("app/api/document/route.ts").includes("documentId,"), "revision delivery mail carries the document id");
  assert(read("app/api/readiness/route.ts").includes("readinessDedupeKey("), "readiness mail is keyed by the submission");

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

assertCallSites();
assertRuntime()
  .then(() => {
    console.log("check-mail-dedupe: ok");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
