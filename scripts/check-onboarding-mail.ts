/**
 * Kunden-Onboarding nach dem Kauf (24 Module).
 * Signatur exakt „Ihr Team von gobd-doku-erstellen.de“, kein „GoBD Ops“.
 * Der Plaintext mit Namen liegt als Snapshot unter scripts/fixtures/.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POST as postMagicLink } from "@/app/api/auth/magic-link/route";
import { GET as verifyMagicLink } from "@/app/auth/verify/route";
import {
  MAGIC_TTL_MS,
  SESSION_COOKIE,
  createMagicToken,
  magicLinkUrl,
  readExpiredMagicToken,
  safeNextPath,
  verifyMagicToken,
} from "@/lib/auth";
import { getMagicLinkSecret } from "@/lib/env";
import {
  EXPIRED_LINK_HEADING,
  isOnboardingIntakeNext,
  maskEmailAddress,
  renewExpiredLinkLabel,
} from "@/lib/expired-onboarding-link";
import { MAIL_ACCOUNT_URL, MAIL_SUPPORT_EMAIL } from "@/lib/mail-layout";
import {
  buildOnboardingMail,
  CUSTOMER_ONBOARDING_CONTINUE_CTA,
  CUSTOMER_ONBOARDING_SIGNATURE,
  customerOnboardingDraftPath,
} from "@/lib/ops";

const SIGNATURE = "Ihr Team von gobd-doku-erstellen.de";
const REPLY = "info@gobd-doku-erstellen.de";
const ACCOUNT = "https://www.gobd-doku-erstellen.de/account";
const START =
  "https://www.gobd-doku-erstellen.de/auth/verify?token=preview-onboarding&next=%2Fintake";
const DRAFT_SESSION = "cs_owner_draft";
const DRAFT_NEXT = `/intake?session_id=${DRAFT_SESSION}`;
const CONTINUE =
  "https://www.gobd-doku-erstellen.de/auth/verify?token=preview-continue&next=%2Fintake%3Fsession_id%3Dcs_owner_draft";
const CONTINUE_LABEL = "Verfahrensdokumentation weiter ausfüllen";

const snapshotPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "customer-onboarding.txt",
);

function fail(message: string): never {
  console.error(`check-onboarding-mail: ${message}`);
  process.exit(1);
}

function assertMail(label: string, mail: { text: string; html: string }): void {
  if (!mail.html.includes(`<p>${SIGNATURE}</p>`)) {
    fail(`${label}: HTML signature paragraph missing`);
  }
  if (!mail.text.includes(SIGNATURE)) {
    fail(`${label}: plaintext signature missing`);
  }
  if (/GoBD Ops/i.test(mail.html) || /GoBD Ops/i.test(mail.text)) {
    fail(`${label}: contains GoBD Ops`);
  }
  if (!mail.text.includes("Betriebs-Check") || !mail.html.includes("Betriebs-Check")) {
    fail(`${label}: Betriebs-Check missing`);
  }
  if (!mail.text.includes("Später ausfüllen") || !mail.html.includes("Später ausfüllen")) {
    fail(`${label}: Später ausfüllen missing`);
  }
  if (
    !mail.text.includes("Entwurf wird gespeichert") ||
    !mail.html.includes("Entwurf wird gespeichert")
  ) {
    fail(`${label}: Entwurf wird gespeichert missing`);
  }
  if (!mail.text.includes(`Ihr Konto: ${ACCOUNT}`)) {
    fail(`${label}: Konto line missing`);
  }
  if (!mail.html.includes(`href="${ACCOUNT}"`)) {
    fail(`${label}: Konto href missing`);
  }
  if (
    !mail.text.includes(
      `Ihr Ansprechpartner: ${REPLY}. Antworten auf diese E-Mail erreichen uns unter dieser Adresse.`,
    )
  ) {
    fail(`${label}: Ansprechpartner line missing`);
  }
  if (!mail.html.includes("Ihr Ansprechpartner:") || !mail.html.includes(`href="mailto:${REPLY}"`)) {
    fail(`${label}: Ansprechpartner mailto missing`);
  }
  if (
    !mail.text.includes(CONTINUE_LABEL) ||
    !mail.text.includes(CONTINUE) ||
    !mail.html.includes(`>${CONTINUE_LABEL}</a>`) ||
    !mail.html.includes(`href="${CONTINUE.replaceAll("&", "&amp;")}"`)
  ) {
    fail(`${label}: continue button or plaintext draft link missing`);
  }
  const continueUrl = new URL(CONTINUE);
  if (!continueUrl.pathname.endsWith("/auth/verify")) {
    fail(`${label}: continue link is not the verify route`);
  }
  if (safeNextPath(continueUrl.searchParams.get("next")) !== DRAFT_NEXT) {
    fail(`${label}: continue link does not redirect to the intake draft`);
  }
  if (/\b(du|dich|dir|dein|deine|deinem|deinen|deiner|deines)\b/i.test(`${mail.text}\n${mail.html}`)) {
    fail(`${label}: du-form`);
  }
}

if (CUSTOMER_ONBOARDING_SIGNATURE !== SIGNATURE) {
  fail(`signature constant is ${JSON.stringify(CUSTOMER_ONBOARDING_SIGNATURE)}`);
}
if (MAIL_SUPPORT_EMAIL !== REPLY) fail(`reply address is ${MAIL_SUPPORT_EMAIL}`);
if (MAIL_ACCOUNT_URL !== ACCOUNT) fail(`account url is ${MAIL_ACCOUNT_URL}`);

const named = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "Philip Cappelletti",
  magicLinkUrl: START,
  continueUrl: CONTINUE,
});
const companyOnly = buildOnboardingMail({
  company: "IKAT GmbH",
  contactName: "IKAT GmbH",
  magicLinkUrl: START,
  continueUrl: CONTINUE,
});
const blankName = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "   \n  ",
  magicLinkUrl: START,
  continueUrl: CONTINUE,
});

assertMail("named", named);
assertMail("company-only", companyOnly);
assertMail("blank-name", blankName);

if (!named.text.startsWith("Guten Tag Philip Cappelletti,")) {
  fail("named greeting drifted");
}
if (!companyOnly.text.startsWith("Guten Tag,")) fail("company-only greeting drifted");
if (!blankName.text.startsWith("Guten Tag,")) fail("blank-name greeting drifted");

if (CUSTOMER_ONBOARDING_CONTINUE_CTA !== CONTINUE_LABEL) {
  fail(`continue label is ${JSON.stringify(CUSTOMER_ONBOARDING_CONTINUE_CTA)}`);
}
if (customerOnboardingDraftPath(DRAFT_SESSION) !== DRAFT_NEXT) {
  fail(`draft path is ${customerOnboardingDraftPath(DRAFT_SESSION)}`);
}
if (customerOnboardingDraftPath("  ") !== "/intake") {
  fail("blank session must stay on /intake");
}
if (customerOnboardingDraftPath("https://evil.example") !== "/intake") {
  fail("unsafe session must not enter the draft path");
}

const purchaser = "kauf@example.com";
const issuedContinue = magicLinkUrl(purchaser, customerOnboardingDraftPath(DRAFT_SESSION));
const issued = new URL(issuedContinue);
if (!issued.pathname.endsWith("/auth/verify")) fail("issued continue link is not /auth/verify");
const issuedToken = issued.searchParams.get("token") ?? "";
if (verifyMagicToken(issuedToken) !== purchaser) {
  fail("issued continue token does not verify as the purchaser");
}
if (safeNextPath(issued.searchParams.get("next")) !== DRAFT_NEXT) {
  fail("issued continue link does not redirect to the intake draft");
}
const tokenBody = issuedToken.split(".")[0] ?? "";
const tokenPayload = JSON.parse(Buffer.from(tokenBody, "base64url").toString("utf8")) as {
  typ?: string;
  email?: string;
  exp?: number;
};
if (tokenPayload.typ !== "magic" || tokenPayload.email !== purchaser) {
  fail("issued continue token is not a magic token for the purchaser");
}
if (
  typeof tokenPayload.exp !== "number" ||
  Math.abs(tokenPayload.exp - (Date.now() + MAGIC_TTL_MS)) > 5000
) {
  fail("issued continue token does not use the verify expiry");
}
const issuedMail = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "Käufer",
  magicLinkUrl: START,
  continueUrl: issuedContinue,
});
const issuedHref = issuedContinue.replaceAll("&", "&amp;");
if (
  !issuedMail.html.includes(`>${CONTINUE_LABEL}</a>`) ||
  !issuedMail.html.includes(`href="${issuedHref}"`) ||
  !issuedMail.text.includes(CONTINUE_LABEL) ||
  !issuedMail.text.includes(issuedContinue)
) {
  fail("issued magic link is missing from the button or the plaintext fallback");
}

const expected = readFileSync(snapshotPath, "utf8");
if (named.text !== expected) {
  fail(
    `snapshot mismatch (${snapshotPath}). Rendered text does not match scripts/fixtures/customer-onboarding.txt`,
  );
}

function signMagic(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getMagicLinkSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function cookieNames(response: Response): string[] {
  return response.headers.getSetCookie().map((line) => line.split("=")[0] ?? "");
}

const ENV_KEYS = ["NODE_ENV", "VERCEL_ENV", "VERCEL", "RESEND_API_KEY", "EMAIL_FROM"] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) savedEnv[key] = process.env[key];

function setEnv(patch: Record<string, string | undefined>) {
  const env = process.env as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
}

function restoreEnv() {
  const env = process.env as Record<string, string | undefined>;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete env[key];
    else env[key] = savedEnv[key];
  }
}

async function capture(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const orig = { info: console.info, error: console.error, warn: console.warn };
  const sink = (...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(" "));
  };
  console.info = sink;
  console.error = sink;
  console.warn = sink;
  try {
    await fn();
  } finally {
    console.info = orig.info;
    console.error = orig.error;
    console.warn = orig.warn;
  }
  return lines.join("\n");
}

async function checkExpiredOnboardingLink(): Promise<void> {
  const email = "kauf@example.com";
  const expired = signMagic({ typ: "magic", email, exp: Date.now() - 60_000 });
  if (verifyMagicToken(expired) !== null) fail("expired token must not verify as a login");
  if (readExpiredMagicToken(expired) !== email) fail("expired token must still name the purchaser");
  const masked = maskEmailAddress(email);
  if (renewExpiredLinkLabel(masked) !== "Neuen Link an k***@example.com senden") {
    fail(`renew label is ${renewExpiredLinkLabel(masked)}`);
  }
  if (!isOnboardingIntakeNext(DRAFT_NEXT)) fail("draft next must use the expired-link page");

  const expiredResponse = await verifyMagicLink(
    new Request(
      `http://localhost/auth/verify?token=${encodeURIComponent(expired)}&next=${encodeURIComponent(DRAFT_NEXT)}`,
    ),
  );
  const expiredLocation = expiredResponse.headers.get("location") ?? "";
  if (expiredResponse.status < 300 || expiredResponse.status >= 400) {
    fail(`expired verify status is ${expiredResponse.status}`);
  }
  if (!expiredLocation.includes("/auth/abgelaufen")) {
    fail(`expired verify location is ${expiredLocation}`);
  }
  const expiredUrl = new URL(expiredLocation, "http://localhost");
  if (expiredUrl.searchParams.get("token") !== expired) fail("expired page dropped the token");
  if (safeNextPath(expiredUrl.searchParams.get("next")) !== DRAFT_NEXT) {
    fail("expired page dropped the intake draft redirect");
  }
  if (cookieNames(expiredResponse).includes(SESSION_COOKIE)) {
    fail("expired token set a session cookie");
  }

  const fresh = createMagicToken(email);
  if (readExpiredMagicToken(fresh) !== null) fail("fresh token must not use the expired page");
  const freshResponse = await verifyMagicLink(
    new Request(
      `http://localhost/auth/verify?token=${encodeURIComponent(fresh)}&next=${encodeURIComponent(DRAFT_NEXT)}`,
    ),
  );
  const freshLocation = new URL(freshResponse.headers.get("location") ?? "", "http://localhost");
  if (freshLocation.pathname !== "/intake" || freshLocation.searchParams.get("session_id") !== DRAFT_SESSION) {
    fail(`fresh verify location is ${freshLocation.pathname}${freshLocation.search}`);
  }
  if (!cookieNames(freshResponse).includes(SESSION_COOKIE)) {
    fail("fresh token did not set a session cookie");
  }

  const tampered = `${expired.slice(0, -1)}${expired.endsWith("a") ? "b" : "a"}`;
  const tamperedResponse = await verifyMagicLink(
    new Request(
      `http://localhost/auth/verify?token=${encodeURIComponent(tampered)}&next=${encodeURIComponent(DRAFT_NEXT)}`,
    ),
  );
  const tamperedLocation = tamperedResponse.headers.get("location") ?? "";
  if (tamperedLocation.includes("/auth/abgelaufen") || tamperedLocation.includes(email)) {
    fail("tampered token reached the expired page");
  }
  if (cookieNames(tamperedResponse).includes(SESSION_COOKIE)) {
    fail("tampered token set a session cookie");
  }

  const otherNext = await verifyMagicLink(
    new Request(
      `http://localhost/auth/verify?token=${encodeURIComponent(expired)}&next=${encodeURIComponent("/account")}`,
    ),
  );
  const otherLocation = otherNext.headers.get("location") ?? "";
  if (otherLocation.includes("/auth/abgelaufen")) {
    fail("non-onboarding next used the onboarding expired page");
  }
  if (cookieNames(otherNext).includes(SESSION_COOKIE)) {
    fail("expired account link set a session cookie");
  }

  const page = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/auth/abgelaufen/page.tsx"),
    "utf8",
  );
  const button = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/auth/abgelaufen/renew-link-button.tsx"),
    "utf8",
  );
  if (EXPIRED_LINK_HEADING !== "Dieser Anmeldelink ist abgelaufen") {
    fail(`expired heading is ${JSON.stringify(EXPIRED_LINK_HEADING)}`);
  }
  if (!page.includes("EXPIRED_LINK_HEADING") || page.includes("applySessionCookie")) {
    fail("expired page heading missing or page sets a session");
  }
  if (!button.includes("/api/auth/magic-link") || !button.includes("renewExpiredLinkLabel")) {
    fail("renew button does not use the existing magic-link route");
  }

  setEnv({
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined,
    NODE_ENV: "development",
    VERCEL_ENV: undefined,
    VERCEL: undefined,
  });
  try {
    let resendBody = "";
    const logs = await capture(async () => {
      const response = await postMagicLink(
        new Request("http://localhost/api/auth/magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, next: DRAFT_NEXT }),
        }),
      );
      resendBody = JSON.stringify(await response.json());
      if (!response.ok) fail(`renew route status is ${response.status}`);
      if (cookieNames(response).includes(SESSION_COOKIE)) {
        fail("renew route set a session cookie");
      }
    });
    if (resendBody.includes("/auth/verify") || resendBody.includes("token=")) {
      fail("renew route returned a magic link");
    }
    if (!logs.includes("/auth/verify?") || !logs.includes("session_id%3Dcs_owner_draft") && !logs.includes("session_id=cs_owner_draft")) {
      fail("renew route did not keep the intake draft redirect in the server log");
    }
  } finally {
    restoreEnv();
  }
}

checkExpiredOnboardingLink()
  .then(() => {
    console.log("check-onboarding-mail: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
