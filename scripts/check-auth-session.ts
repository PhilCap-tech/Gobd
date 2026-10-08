/**
 * Offline: Login-Cookies entstehen nur nach einem Magic-Link.
 * Readiness, Intake und ein fehlgeschlagener Mailversand setzen keines.
 *
 *   npx tsx scripts/check-auth-session.ts
 *
 * Keine Prod-Zugangsdaten, keine echten Mails. Nur @example.com.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { POST as postMagicLink } from "../app/api/auth/magic-link/route";
import {
  CHECKOUT_GRANT_COOKIE,
  SESSION_COOKIE,
  createCheckoutGrantToken,
  createSessionToken,
  mayIssueSessionCookie,
  sessionMinIssuedAt,
  verifyCheckoutGrantToken,
  verifyMagicToken,
  verifySessionToken,
  withoutSessionCookie,
} from "../lib/auth";
import { canAccessDocument } from "../lib/documents";
import { getMagicLinkSecret } from "../lib/env";
import {
  LOGIN_LINK_FAILED_NOTICE,
  LOGIN_LINK_GENERIC_OK,
} from "../lib/login-mail";
import { intakeEntityBinding } from "../lib/session-issue";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "VERCEL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "SESSION_MIN_ISSUED_AT",
  "MAGIC_LINK_SECRET",
] as const;

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

function signRaw(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getMagicLinkSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function cookieNames(response: NextResponse): string[] {
  return response.headers.getSetCookie().map((line) => line.split("=")[0] ?? "");
}

function assertNoToken(raw: string, label: string) {
  ok(!raw.includes("verifyUrl"), `${label} has no verifyUrl`);
  ok(!raw.includes("/auth/verify"), `${label} has no magic-link URL`);
  ok(!/token=/.test(raw), `${label} has no token query`);
  ok(!raw.includes(SESSION_COOKIE), `${label} has no session cookie name`);
}

async function capture(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const orig = {
    info: console.info,
    error: console.error,
    warn: console.warn,
  };
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

function checkIssuedAt() {
  const email = "buyer@example.com";
  const current = createSessionToken(email);
  ok(verifySessionToken(current) === email, "session token with iat verifies");
  const payload = JSON.parse(
    Buffer.from(current.split(".")[0] ?? "", "base64url").toString("utf8"),
  ) as { iat?: number };
  ok(typeof payload.iat === "number", "new session token carries iat");

  const legacy = signRaw({
    typ: "session",
    email,
    exp: Date.now() + 60_000,
  });
  ok(verifySessionToken(legacy) === null, "session token without iat is rejected");

  const magic = signRaw({
    typ: "magic",
    email,
    exp: Date.now() + 60_000,
  });
  ok(verifyMagicToken(magic) === email, "magic token without iat still verifies");
  ok(verifySessionToken(magic) === null, "magic token is not a session");

  setEnv({ SESSION_MIN_ISSUED_AT: String(Date.now()) });
  ok(sessionMinIssuedAt() > 0, "SESSION_MIN_ISSUED_AT parses as unix ms");
  const stale = signRaw({
    typ: "session",
    email,
    iat: Date.now() - 60_000,
    exp: Date.now() + 60_000,
  });
  ok(verifySessionToken(stale) === null, "iat older than SESSION_MIN_ISSUED_AT is rejected");
  ok(
    verifySessionToken(createSessionToken(email)) === email,
    "fresh iat passes the cutoff",
  );
  setEnv({ SESSION_MIN_ISSUED_AT: undefined });
}

function checkChannelsDoNotIssue() {
  const footprint = {
    sessionEmail: null,
    targetEmail: "owner@example.com",
    hasProfile: true,
    hasCompanies: true,
    hasDocuments: true,
  };
  for (const channel of ["readiness", "intake"] as const) {
    ok(
      mayIssueSessionCookie({ channel, ...footprint }) === false,
      `${channel} does not issue a session for an existing account`,
    );
    ok(
      mayIssueSessionCookie({
        channel,
        sessionEmail: null,
        targetEmail: "new@example.com",
        hasProfile: false,
        hasCompanies: false,
        hasDocuments: false,
      }) === false,
      `${channel} does not issue a session for a new address`,
    );
    ok(
      mayIssueSessionCookie({
        channel,
        sessionEmail: "owner@example.com",
        targetEmail: "owner@example.com",
        hasProfile: true,
        hasCompanies: true,
        hasDocuments: true,
      }) === false,
      `${channel} does not re-issue a session`,
    );
  }
  ok(
    mayIssueSessionCookie({ channel: "magic", targetEmail: "owner@example.com" }),
    "magic link may issue a session",
  );

  const readiness = NextResponse.json({ ok: true, leadId: "lead-example" });
  withoutSessionCookie(readiness);
  ok(
    !cookieNames(readiness).includes(SESSION_COOKIE),
    "readiness response sets no session cookie",
  );

  const intake = NextResponse.json({ ok: true, documentId: "doc-example" });
  withoutSessionCookie(intake, {
    sessionId: "cs_test_new",
    email: "buyer@example.com",
  });
  const names = cookieNames(intake);
  ok(names.includes(CHECKOUT_GRANT_COOKIE), "intake may set the checkout grant");
  ok(!names.includes(SESSION_COOKIE), "intake response sets no session cookie");
  const grant = verifyCheckoutGrantToken(
    intake.cookies.get(CHECKOUT_GRANT_COOKIE)?.value,
  );
  ok(grant?.sessionId === "cs_test_new", "checkout grant is bound to that session");
  ok(verifySessionToken(intake.cookies.get(CHECKOUT_GRANT_COOKIE)?.value) === null, "checkout grant is not a login");
  ok(
    canAccessDocument(
      { email: "buyer@example.com", stripeSessionId: "cs_test_old" },
      { sessionId: grant?.sessionId },
    ) === false,
    "checkout grant does not open an older document",
  );
  ok(
    canAccessDocument(
      { email: "buyer@example.com", stripeSessionId: "cs_test_new" },
      { sessionId: grant?.sessionId },
    ) === true,
    "checkout grant opens only the purchased document",
  );

  const unbound = intakeEntityBinding({
    loggedInAsBuyer: false,
    requestedEntityId: "firm-victim",
    resolvedEntityId: "",
    revising: false,
    ownedEntityIds: ["firm-victim", "firm-other"],
  });
  ok(unbound.entityId === "" && !unbound.needsFirmChoice, "new checkout does not bind an existing firm");
  const revision = intakeEntityBinding({
    loggedInAsBuyer: false,
    requestedEntityId: "firm-other",
    resolvedEntityId: "firm-this-doc",
    revising: true,
    ownedEntityIds: ["firm-victim"],
  });
  ok(revision.entityId === "firm-this-doc", "revision keeps only the entity on this document");
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (full.endsWith(".ts") || full.endsWith(".tsx")) found.push(full);
  }
  return found;
}

function checkSources() {
  const files = [...sourceFiles("app"), ...sourceFiles("lib")];
  const setters: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    const calls = lines.filter(
      (line) =>
        line.includes("applySessionCookie(") &&
        !line.includes("function applySessionCookie"),
    );
    if (calls.length > 0) setters.push(file);
  }
  ok(
    setters.length === 1 && setters[0] === "app/auth/verify/route.ts",
    "only /auth/verify sets the login cookie",
  );
  console.log("session setters:", setters.join(", "));

  const readiness = readFileSync("app/api/readiness/route.ts", "utf8");
  ok(readiness.includes("withoutSessionCookie"), "readiness uses withoutSessionCookie");
  ok(!readiness.includes("applySessionCookie"), "readiness source has no session cookie");
  ok(!readiness.includes("verifyUrl"), "readiness source does not return a login URL");

  const intake = readFileSync("app/api/intake/route.ts", "utf8");
  ok(intake.includes("withoutSessionCookie"), "intake uses withoutSessionCookie");
  ok(!intake.includes("applySessionCookie"), "intake source has no session cookie");
  ok(intake.includes("intakeEntityBinding"), "intake binds firms only through the guard");

  const magic = readFileSync("app/api/auth/magic-link/route.ts", "utf8");
  ok(!magic.includes("verifyUrl"), "magic-link route has no verifyUrl field");
  ok(magic.includes(LOGIN_LINK_GENERIC_OK) || magic.includes("LOGIN_LINK_GENERIC_OK"), "magic-link route uses the generic ok copy");

  const form = readFileSync("app/login/login-form.tsx", "utf8");
  ok(!form.includes("verifyUrl") && !form.includes("stubUrl"), "login form has no link slot");
  ok(form.includes(LOGIN_LINK_GENERIC_OK), "login form shows the generic sentence");
  ok(!form.includes("Hier anmelden"), "login form does not offer a browser login link");

  const grantRoute = readFileSync("app/api/checkout/grant/route.ts", "utf8");
  ok(!grantRoute.includes("applySessionCookie"), "checkout grant route does not set a session");
  ok(grantRoute.includes("resolveCheckoutSession"), "checkout grant is checked against Stripe");

  const smoke = readFileSync("scripts/run-preview-draft-smoke.mjs", "utf8");
  ok(smoke.includes("iat:"), "preview smoke session token includes iat");
}

async function checkMagicLinkHttp() {
  setEnv({
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined,
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  });
  const failedLogs = await capture(async () => {
    const response = await postMagicLink(
      new Request("http://localhost/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "buyer@example.com",
          next: "/account",
        }),
      }),
    );
    const body = (await response.json()) as { ok?: boolean; error?: string; message?: string };
    ok(response.status === 503, "mail failure without Resend in production is 503");
    ok(body.ok === false, "mail failure is not a success");
    ok(body.error === LOGIN_LINK_FAILED_NOTICE, "mail failure uses the generic Sie error");
    const raw = JSON.stringify(body);
    assertNoToken(raw, "magic-link error body");
    ok(
      !cookieNames(response).includes(SESSION_COOKIE),
      "magic-link error sets no session cookie",
    );
  });
  assertNoToken(failedLogs, "magic-link error log");
  ok(true, "production mail failure log has no token");

  setEnv({
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined,
    NODE_ENV: "development",
    VERCEL_ENV: undefined,
  });
  let devBody = "";
  const devLogs = await capture(async () => {
    const response = await postMagicLink(
      new Request("http://localhost/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "dev-buyer@example.com" }),
      }),
    );
    const body = (await response.json()) as { ok?: boolean; message?: string };
    ok(response.status === 200 && body.ok === true, "dev fallback without Resend still answers generically");
    ok(body.message === LOGIN_LINK_GENERIC_OK, "dev fallback uses the generic sentence");
    devBody = JSON.stringify(body);
    ok(
      !cookieNames(response).includes(SESSION_COOKIE),
      "dev fallback sets no session cookie",
    );
  });
  assertNoToken(devBody, "dev fallback body");
  ok(devLogs.includes("/auth/verify?"), "dev fallback keeps the link in the server log only");
  ok(!devBody.includes("/auth/verify"), "dev fallback body still has no link");
}

async function main() {
  try {
    if (!process.env.MAGIC_LINK_SECRET?.trim()) {
      setEnv({ MAGIC_LINK_SECRET: "check-auth-session-offline-secret" });
    }
    checkIssuedAt();
    checkChannelsDoNotIssue();
    checkSources();
    await checkMagicLinkHttp();
    const grant = createCheckoutGrantToken({
      sessionId: "cs_test_only",
      email: "buyer@example.com",
    });
    ok(verifySessionToken(grant) === null, "crafted checkout token is not a session");
    console.log("check-auth-session: green");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
