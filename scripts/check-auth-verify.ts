/**
 * Anmeldelink: Scanner bleibt ohne Sitzung, erste Person einmal, Protokoll ohne Geheimnisse.
 * Maillinks ohne Checkout-Session und ohne fest eingetragene www-Schaltfläche.
 *
 *   npx tsx scripts/check-auth-verify.ts
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { authCallIsScanner, classifyAuthUserAgent } from "@/lib/auth-ua-class";
import { createInviteToken, createMagicToken, SESSION_COOKIE, verifyMagicToken, withoutMailedCheckoutSession } from "@/lib/auth";
import { customerMailOrigin, getAppUrl } from "@/lib/env";
import { flushLeadNoticesForTests } from "@/lib/lead-notice";
import { setMailDedupeTestHooks } from "@/lib/mail-dedupe";
import { mailDedupeLogKind } from "@/lib/mail-dedupe";
import {
  loadMailLinkToken,
  newOpaqueMailLinkToken,
  readMailLinkResendId,
  rememberMailLinkResendId,
  saveMailLinkToken,
} from "@/lib/mail-link-token-store";
import { setMeasureClaimRootForTest } from "@/lib/measure-claim";
import { recordAuthDailyCount } from "@/lib/measure-record";
import { installMeasureSheetClientForTest, type MeasureSheetClient } from "@/lib/measure-store";
import { setMeasureVercelEnvForTest } from "@/lib/measure-test";
import {
  buildDeliveryMail,
  buildMagicLinkMail,
  buildOnboardingMail,
  deliveryDocumentLinks,
  deliveryFaqUrl,
  referralAfterDeliveryUrl,
} from "@/lib/ops";
import { ownerNoticesQueuedForTest, resetOwnerNoticeQueueForTest, setOwnerNoticeTestMode } from "@/lib/owner-notice";
import { purchaseMail } from "@/lib/schnellversion-purchase-mail";
import { GET, HEAD, POST } from "@/app/auth/verify/route";

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const OUTLOOK = "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0; Microsoft Outlook 16.0)";
const EMAIL = "person.verify@firma.example";
const LOGIN_RESEND_ID = "re_login_customer_1";
const NOTICE_RESEND_ID = "re_notice_own_id";
const IP = "203.0.113.44";
const CHECKOUT = "cs_live_should_not_appear";

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
}

type LogFns = {
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
  log: typeof console.log;
};

function capture(work: () => Promise<Response>): Promise<{ response: Response; lines: string[] }> {
  const lines: string[] = [];
  const saved: LogFns = {
    info: console.info,
    warn: console.warn,
    error: console.error,
    log: console.log,
  };
  const push = (...args: unknown[]) => {
    lines.push(args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" "));
  };
  console.info = push;
  console.warn = push;
  console.error = push;
  console.log = push;
  return work()
    .then((response) => ({ response, lines }))
    .finally(() => {
      console.info = saved.info;
      console.warn = saved.warn;
      console.error = saved.error;
      console.log = saved.log;
    });
}

function verifyLine(lines: string[]): string {
  const found = lines.filter((line) => line.includes("[auth] verify"));
  assert.equal(found.length, 1, found.join("\n"));
  return found[0] ?? "";
}

function cookies(response: Response): string {
  return response.headers.getSetCookie().join("\n");
}

function assertClean(line: string, token: string): void {
  assert.equal(line.includes(EMAIL), false, line);
  assert.equal(line.includes(token), false, line);
  assert.equal(line.includes(IP), false, line);
  assert.equal(line.includes(LOGIN_RESEND_ID), false, line);
  assert.equal(line.includes(BROWSER), false, line);
  assert.equal(line.includes(OUTLOOK), false, line);
  assert.equal(/[0-9a-f]{64}/.test(line), false, line);
}

async function call(
  method: "GET" | "HEAD",
  token: string,
  ua: string,
  extra?: { next?: string; region?: string },
): Promise<{ response: Response; line: string; body: Record<string, unknown> }> {
  if (extra?.region === undefined) delete process.env.VERCEL_REGION;
  else process.env.VERCEL_REGION = extra.region;
  const url = new URL("https://preview.example.test/auth/verify");
  if (token) url.searchParams.set("token", token);
  if (extra?.next) url.searchParams.set("next", extra.next);
  const request = new Request(url, {
    method,
    headers: { "user-agent": ua, "x-forwarded-for": IP, referer: "https://mail.example.test/inbox" },
  });
  const ran = await capture(() => (method === "HEAD" ? HEAD(request) : GET(request)));
  const line = verifyLine(ran.lines);
  assertClean(line, token);
  const body = JSON.parse(line.slice(line.indexOf("{"))) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body), ["result", "method", "uaClass", "target", "region"]);
  return { response: ran.response, line, body };
}

async function postVerify(
  token: string,
  ua: string,
  origin: string | null,
  secFetchSite?: string,
): Promise<{ response: Response; line: string; body: Record<string, unknown> }> {
  delete process.env.VERCEL_REGION;
  const url = new URL("https://preview.example.test/auth/verify");
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "user-agent": ua,
    "x-forwarded-for": IP,
  };
  if (origin !== null) headers.origin = origin;
  if (secFetchSite) headers["sec-fetch-site"] = secFetchSite;
  const request = new Request(url, {
    method: "POST",
    headers,
    body: new URLSearchParams({ token, next: "/fragebogen" }),
  });
  const ran = await capture(() => POST(request));
  const line = verifyLine(ran.lines);
  assertClean(line, token);
  const body = JSON.parse(line.slice(line.indexOf("{"))) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body), ["result", "method", "uaClass", "target", "region"]);
  return { response: ran.response, line, body };
}

async function main(): Promise<void> {
  process.env.MAGIC_LINK_SECRET = "check-auth-verify-magic";
  process.env.MEASURE_HMAC_SECRET = "check-auth-verify-hmac";
  process.env.npm_lifecycle_event = "check:auth-verify";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.RESEND_API_KEY;
  delete process.env.VERCEL_REGION;

  ok(classifyAuthUserAgent(BROWSER) === "browser", "chrome is a browser");
  ok(classifyAuthUserAgent(OUTLOOK) === "outlook-safelinks", "outlook preview");
  ok(classifyAuthUserAgent("BingPreview/1.0b") === "outlook-safelinks", "bing preview");
  ok(classifyAuthUserAgent("Proofpoint/1.0") === "proofpoint", "proofpoint");
  ok(classifyAuthUserAgent("Mimecast/1.0") === "mimecast", "mimecast");
  ok(classifyAuthUserAgent("Sophos Agent") === "sophos", "sophos");
  ok(classifyAuthUserAgent("Barracuda Sentinel") === "other-bot", "barracuda");
  ok(classifyAuthUserAgent("GoogleImageProxy") === "other-bot", "google image proxy");
  ok(classifyAuthUserAgent("HeadlessChrome/120.0") === "other-bot", "headless chrome");
  ok(classifyAuthUserAgent("curl/8.4.0") === "other-bot", "curl");
  ok(classifyAuthUserAgent("python-requests/2.31") === "other-bot", "python");
  ok(classifyAuthUserAgent("Wget/1.21") === "other-bot", "wget");
  ok(classifyAuthUserAgent("") === "unknown", "empty ua");
  ok(classifyAuthUserAgent("Appliance/1.0") === "unknown", "unknown ua");
  ok(authCallIsScanner({ method: "HEAD", uaClass: "browser" }), "head is a scanner");
  ok(!authCallIsScanner({ method: "GET", uaClass: "browser" }), "browser get is a person");
  ok(!authCallIsScanner({ method: "GET", uaClass: "unknown" }), "unknown get is a person");
  ok(authCallIsScanner({ method: "GET", uaClass: "other-bot" }), "other bot is a scanner");

  const root = mkdtempSync(path.join(tmpdir(), "auth-verify-"));
  const claimRoot = path.join(root, "claims");
  mkdirSync(claimRoot, { recursive: true });
  setMeasureClaimRootForTest(claimRoot);
  setMeasureVercelEnvForTest("production");
  setOwnerNoticeTestMode(true);
  const sent: { to: string; subject: string; text: string }[] = [];
  setMailDedupeTestHooks({
    dir: path.join(root, "mail"),
    send: async (input) => {
      sent.push({ to: input.to, subject: input.subject, text: input.text });
      return { stub: true, sent: true, id: NOTICE_RESEND_ID };
    },
  });

  const sheetRows: string[][] = [];
  const client: MeasureSheetClient = {
    async get() {
      return { data: { sheets: [{ properties: { title: "messluecken", sheetId: 1 } }] } };
    },
    async batchUpdate() {
      return { data: { replies: [{ addSheet: { properties: { sheetId: 1 } } }] } };
    },
    async valuesGet() {
      return { data: { values: [["date", "metric", "n", "channel", "cohort"]] } };
    },
    async valuesAppend(args) {
      sheetRows.push(...(args.requestBody.values ?? []));
      return { data: {} };
    },
  };
  installMeasureSheetClientForTest({ client, configured: true });
  const beforeCounts = sheetRows.length;
  await recordAuthDailyCount({ metric: "link_requested" });
  await recordAuthDailyCount({ metric: "verify_human" });
  await recordAuthDailyCount({ metric: "verify_scanner" });
  ok(sheetRows.length === beforeCounts + 3, "day counts append three rows");
  ok(
    sheetRows.slice(beforeCounts).every((row) => row[2] === "" && !row.join(" ").includes("@") && !row.join(" ").includes(IP)),
    "day count rows have no person and no ip",
  );
  ok(readdirSync(claimRoot, { recursive: true }).length === 0, "day counts write no marker");

  const token = (await createMagicToken(EMAIL)) ?? "";
  ok(token.length > 20, "opaque token");
  ok(await rememberMailLinkResendId(token, LOGIN_RESEND_ID), "login resend id stored on the token");
  resetOwnerNoticeQueueForTest();

  const scanner = await call("GET", token, OUTLOOK);
  ok(scanner.body.result === "scanner_skip" && scanner.body.method === "GET" && scanner.body.uaClass === "outlook-safelinks", "outlook is scanner_skip");
  ok(scanner.body.target === "/auth/verify" && scanner.body.region === null, "interstitial target has no query");
  ok(scanner.response.status === 200, "outlook get is the confirm page");
  ok(scanner.response.headers.get("referrer-policy") === "same-origin", "interstitial referrer policy is same-origin");
  ok(scanner.response.headers.get("cache-control")?.includes("no-store") === true, "interstitial is not stored");
  ok(scanner.response.headers.getSetCookie().length === 0, "confirm page sets no cookie at all");
  const page = await scanner.response.text();
  ok(page.includes("Bitte bestätigen Sie die Anmeldung."), "confirm sentence");
  ok(page.includes(">Anmelden<"), "confirm button");
  ok(page.includes('name="robots" content="noindex"'), "confirm page is noindex");
  ok(!/<script/i.test(page), "confirm page has no script");
  ok(!/localStorage|sessionStorage|document\.cookie/i.test(page), "confirm page stores nothing in the browser");
  ok(!/src="https?:|href="https?:/i.test(page), "confirm page has no external asset");
  ok(page.split(token).length - 1 === 1, "token appears only once");
  ok(page.includes(`name="token" value="${token}"`), "token is only the hidden field");
  ok(!cookies(scanner.response).includes(SESSION_COOKIE), "scanner sets no session cookie");
  ok(ownerNoticesQueuedForTest() === 0 && sent.length === 0, "scanner queues no notice");
  ok((await verifyMagicToken(token)) === EMAIL, "scanner leaves the token valid");
  ok(readdirSync(claimRoot, { recursive: true }).length === 0, "scanner writes no marker");

  const head = await call("HEAD", token, BROWSER, { region: "fra1" });
  ok(head.body.result === "scanner_skip" && head.body.method === "HEAD" && head.body.uaClass === "browser", "head is scanner_skip");
  ok(head.body.region === "fra1" && head.body.target === "/login", "head log region");
  ok(!cookies(head.response).includes(SESSION_COOKIE), "head sets no session cookie");
  ok((await verifyMagicToken(token)) === EMAIL, "head leaves the token valid");
  ok(ownerNoticesQueuedForTest() === 0, "head queues no notice");

  const first = await call("GET", token, BROWSER, { next: "/fragebogen" });
  await flushLeadNoticesForTests();
  ok(first.body.result === "ok_first" && first.body.uaClass === "browser" && first.body.target === "/fragebogen", "first human");
  ok(cookies(first.response).includes(`${SESSION_COOKIE}=`), "first human sets the session cookie");
  ok(ownerNoticesQueuedForTest() === 1 && sent.length === 1, "first human queues one notice");
  ok(sent[0]?.subject.includes(EMAIL), "notice subject contains the customer email");
  ok(sent[0]?.text.includes("Ereignis:") && sent[0]?.text.includes(EMAIL) && sent[0]?.text.includes("Zeit"), "notice has event, email and time");
  ok(sent[0]?.text.includes(`Versandkennung: ${LOGIN_RESEND_ID}`), "notice has the login mail resend id");
  ok(!sent[0]?.text.includes(NOTICE_RESEND_ID), "notice does not use its own resend id");
  ok(!sent[0]?.text.includes("Firmen-ID") && !sent[0]?.text.includes("Modus"), "notice has no extra fields");
  ok((await readMailLinkResendId(token)) === LOGIN_RESEND_ID, "token still holds the login mail id");
  ok((await verifyMagicToken(token)) === EMAIL, "human click keeps the token valid");

  const queued = ownerNoticesQueuedForTest();
  const repeat = await call("GET", token, BROWSER);
  await flushLeadNoticesForTests();
  ok(repeat.body.result === "ok_repeat" && repeat.body.target === "/account", "repeat human");
  ok(cookies(repeat.response).includes(`${SESSION_COOKIE}=`), "repeat still signs in");
  ok(ownerNoticesQueuedForTest() === queued && sent.length === 1, "repeat queues no notice");

  const unknownEmail = "unknown.verify@firma.example";
  const unknownToken = (await createMagicToken(unknownEmail)) ?? "";
  const unknown = await call("GET", unknownToken, "Appliance/1.0");
  await flushLeadNoticesForTests();
  ok(unknown.body.result === "ok_first" && unknown.body.uaClass === "unknown", "unknown ua is a person");

  const expiredToken = (await createMagicToken("expired.verify@firma.example", Date.now() - 25 * 60 * 1000)) ?? "";
  const expired = await call("GET", expiredToken, BROWSER);
  ok(expired.body.result === "expired" && expired.body.target === "/auth/abgelaufen", "expired");
  ok(!cookies(expired.response).includes(SESSION_COOKIE), "expired sets no cookie");

  const invalid = await call("GET", "not-a-token", BROWSER);
  ok(invalid.body.result === "invalid" && invalid.body.target === "/login", "invalid");
  ok(!cookies(invalid.response).includes(SESSION_COOKIE), "invalid sets no cookie");

  const outlookEmail = "outlook.verify@firma.example";
  const outlookToken = (await createMagicToken(outlookEmail)) ?? "";
  ok(await rememberMailLinkResendId(outlookToken, LOGIN_RESEND_ID), "outlook login mail id stored");
  const beforeOutlook = ownerNoticesQueuedForTest();
  const beforeSent = sent.length;
  const firstScan = await call("GET", outlookToken, "Outlook-iOS/1.0");
  const secondScan = await call("GET", outlookToken, "Outlook-Android/1.0");
  ok(firstScan.body.result === "scanner_skip" && secondScan.body.result === "scanner_skip", "two outlook gets stay scanner_skip");
  ok(!cookies(firstScan.response).includes(SESSION_COOKIE) && !cookies(secondScan.response).includes(SESSION_COOKIE), "outlook gets set no cookie");
  ok((await verifyMagicToken(outlookToken)) === outlookEmail, "outlook gets leave the token valid");
  ok(ownerNoticesQueuedForTest() === beforeOutlook, "outlook gets queue no notice");
  const confirmed = await postVerify(outlookToken, OUTLOOK, "https://preview.example.test");
  await flushLeadNoticesForTests();
  ok(confirmed.body.result === "ok_first" && confirmed.body.method === "POST", "outlook post logs in");
  ok(cookies(confirmed.response).includes(`${SESSION_COOKIE}=`), "outlook post sets the session cookie");
  ok(ownerNoticesQueuedForTest() === beforeOutlook + 1 && sent.length === beforeSent + 1, "two scans then one post send one notice");
  const again = await postVerify(outlookToken, OUTLOOK, "https://preview.example.test");
  await flushLeadNoticesForTests();
  ok(again.body.result === "ok_repeat" && sent.length === beforeSent + 1, "second post sends no second notice");

  const csrfEmail = "csrf.verify@firma.example";
  const csrfToken = (await createMagicToken(csrfEmail)) ?? "";
  const blocked = await postVerify(csrfToken, OUTLOOK, "https://evil.example");
  ok(blocked.body.result === "invalid" && blocked.body.method === "POST", "foreign origin is refused");
  ok(!cookies(blocked.response).includes(SESSION_COOKIE), "foreign origin sets no cookie");
  ok((await verifyMagicToken(csrfToken)) === csrfEmail, "foreign origin leaves the token valid");
  const nullCross = await postVerify(csrfToken, OUTLOOK, "null", "cross-site");
  ok(nullCross.body.result === "invalid", "origin null and cross-site is refused");
  ok(!cookies(nullCross.response).includes(SESSION_COOKIE), "origin null and cross-site sets no cookie");
  const nullMissing = await postVerify(csrfToken, OUTLOOK, "null");
  ok(nullMissing.body.result === "invalid", "origin null without sec-fetch-site is refused");
  const nullSameSite = await postVerify(csrfToken, OUTLOOK, "null", "same-site");
  const nullNone = await postVerify(csrfToken, OUTLOOK, "null", "none");
  ok(nullSameSite.body.result === "invalid" && nullNone.body.result === "invalid", "origin null is refused for same-site and none");
  ok((await verifyMagicToken(csrfToken)) === csrfEmail, "rejected null origins leave the token valid");

  const nullEmail = "null-origin.verify@firma.example";
  const nullToken = (await createMagicToken(nullEmail)) ?? "";
  const nullOk = await postVerify(nullToken, OUTLOOK, "null", "same-origin");
  await flushLeadNoticesForTests();
  ok(nullOk.body.result === "ok_first" && nullOk.body.method === "POST", "origin null and same-origin signs in");
  ok(cookies(nullOk.response).includes(`${SESSION_COOKIE}=`), "origin null and same-origin sets the session cookie");

  const magicRecord = await loadMailLinkToken(token);
  ok(typeof magicRecord?.exp === "number" && Number.isFinite(magicRecord.exp), "magic records store exp");
  const invite = await createInviteToken({ membershipId: "mem-verify", email: "invite.verify@firma.example" });
  const inviteRecord = invite ? await loadMailLinkToken(invite) : null;
  ok(inviteRecord?.purpose === "invite" && typeof inviteRecord.exp === "number", "invite records store exp");
  const bare = newOpaqueMailLinkToken();
  ok((await saveMailLinkToken(bare, { purpose: "magic", email: "bare.verify@firma.example" })) === false, "magic without exp is refused");
  ok((await loadMailLinkToken(bare)) === null, "refused magic write stores nothing");
  const bareInvite = newOpaqueMailLinkToken();
  ok(
    (await saveMailLinkToken(bareInvite, { purpose: "invite", email: "bare.verify@firma.example", membershipId: "m" })) === false,
    "invite without exp is refused",
  );
  ok(mailDedupeLogKind(`owner-notice:account:${"ab".repeat(32)}`) === "owner-notice:account", "dedupe log kind drops the hash");
  ok(mailDedupeLogKind(`readiness:h1:${"cd".repeat(32)}`) === "readiness", "dedupe log kind drops h1 and the digest");
  ok(!mailDedupeLogKind("person@firma.example").includes("@"), "dedupe log kind drops an address");

  const keys = ["VERCEL_ENV", "VERCEL_URL", "VERCEL_BRANCH_URL", "NEXT_PUBLIC_APP_URL"] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]])) as Record<(typeof keys)[number], string | undefined>;
  try {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://preview.example.test";
    const origin = getAppUrl();
    ok(origin === "https://preview.example.test" && customerMailOrigin() === origin, "mail origin follows getAppUrl");
    const issued = (await createMagicToken("mail.verify@firma.example")) ?? "";
    const magic = (await import("@/lib/auth")).magicLinkUrl;
    const href = (await magic("mail.verify@firma.example", `/intake?session_id=${CHECKOUT}`)) ?? "";
    ok(href.startsWith(`${origin}/auth/verify`), href);
    ok(!href.includes("session_id") && !href.includes(CHECKOUT), href);
    ok(withoutMailedCheckoutSession(`/intake?session_id=${CHECKOUT}`) === "/intake", "path drops the checkout id");
    const loginMail = buildMagicLinkMail({
      magicLinkUrl: `${origin}/auth/verify?token=${issued}&next=${encodeURIComponent(`/intake?session_id=${CHECKOUT}`)}`,
    });
    ok(!loginMail.text.includes("session_id=cs_") && !loginMail.html.includes("session_id%3Dcs_"), "login mail drops the checkout id");
    ok(loginMail.text.includes(`${origin}/auth/verify`), "login mail uses the app origin");
    const docs = deliveryDocumentLinks({ documentId: "doc-1", stripeSessionId: CHECKOUT });
    ok(!docs.downloadUrl.includes("session_id") && !docs.successUrl.includes("session_id"), JSON.stringify(docs));
    ok(!docs.downloadUrl.includes(CHECKOUT) && !docs.successUrl.includes(CHECKOUT), "delivery links drop the checkout id");
    const delivery = buildDeliveryMail({
      contactName: "Anna Berg",
      downloadUrl: docs.downloadUrl,
      successUrl: docs.successUrl,
      version: 1,
    });
    ok(delivery.text.includes(deliveryFaqUrl()) && delivery.text.includes(referralAfterDeliveryUrl()), "delivery faq and share use the app origin");
    ok(deliveryFaqUrl() === `${origin}/faq`, deliveryFaqUrl());
    ok(referralAfterDeliveryUrl().startsWith(`${origin}/?utm_source=referral`), referralAfterDeliveryUrl());
    ok(!delivery.text.includes("session_id=cs_") && !delivery.html.includes(CHECKOUT), "delivery mail has no checkout id");
    const bought = purchaseMail({
      company: "Beispiel GmbH",
      purchasedAt: "2026-11-23T12:00:00.000Z",
      sessionId: CHECKOUT,
    });
    ok(!bought.text.includes("session_id=") && !bought.text.includes(CHECKOUT) && !bought.html.includes(CHECKOUT), "purchase mail has no checkout id");
    const welcome = buildOnboardingMail({
      contactName: "Anna Berg",
      magicLinkUrl: href,
      continueUrl: `${origin}/auth/verify?token=${issued}&next=${encodeURIComponent(`/intake?session_id=${CHECKOUT}`)}`,
    });
    ok(!welcome.text.includes("session_id=cs_") && !welcome.html.includes(CHECKOUT), "onboarding mail has no checkout id");
    const hard = "https://www.gobd-doku-erstellen.de";
    ok(!href.startsWith(hard) && !deliveryFaqUrl().startsWith(hard) && !referralAfterDeliveryUrl().startsWith(hard), "cta links are not the hard-coded www host");
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }

  setOwnerNoticeTestMode(false);
  setMailDedupeTestHooks(null);
  setMeasureClaimRootForTest(null);
  setMeasureVercelEnvForTest(null);
  installMeasureSheetClientForTest(null);
  rmSync(root, { recursive: true, force: true });
  console.log("check-auth-verify: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
