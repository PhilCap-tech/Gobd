/**
 * Offline: a verified checkout of the owner sets gobd_session (same signer as
 * /auth/verify). Without that proof the #107 statuses stay: no login 401,
 * foreign login 403. Mismatched or expired checkout sets no session.
 *
 *   npx tsx scripts/check-checkout-session.ts
 *
 * Synthetic @example.com only. No mail, no Stripe, no prod data.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { submitIntake, type IntakeIo } from "../app/api/intake/route";
import { GET as verifyMagicLink } from "../app/auth/verify/route";
import {
  CHECKOUT_GRANT_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createCheckoutGrantToken,
  createMagicToken,
  createSessionToken,
  safeNextPath,
  verifyCheckoutGrantToken,
  verifySessionToken,
} from "../lib/auth";
import {
  LOGIN_FOR_ANSWERS_COPY,
  answersLoginOffer,
  attachVerifiedCheckoutCookies,
  emailForAnswersLogin,
  intakeTargetFromNext,
  maskCheckoutEmail,
  ownerEmailForCheckoutReturn,
} from "../lib/checkout-session";
import { intakeEditPath } from "../lib/documents";
import { getMagicLinkSecret } from "../lib/env";
import { LOGIN_TO_CHANGE_COPY } from "../lib/session-write";
import { emptyAnswers, emptySheetRow, type IntakeAnswers, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer@example.com";
const OTHER = "other@example.com";
const SESSION = "cs_test_buyer_session";
const COMPANY = "Käufer GmbH";

function answers(): IntakeAnswers {
  return {
    ...emptyAnswers(),
    branchen: ["Handel"],
    rechtsform: "GmbH",
    mitarbeitende: "3",
    fibu: ["lexoffice"],
    eingangsbelege: ["mail"],
    ausgangsrechnungen: ["tool"],
    archiv: "cloud",
    hosting: "vercel",
    backup: ["taeglich"],
    zugriff: "gf",
    gf: "Ada Beispiel",
    buchhaltung: "intern",
    it: "extern",
    steuerberater: "Kanzlei Nord",
  };
}

function familyOf(rows: SheetRow[], id: string): SheetRow[] {
  const seed = rows.find((row) => row.documentId === id);
  if (!seed) return [];
  const familyId = (seed.parentDocumentId || seed.documentId).trim();
  return rows.filter((row) => {
    const parent = (row.parentDocumentId || row.documentId).trim();
    return row.documentId === familyId || parent === familyId;
  });
}

function memoryStore() {
  const rows: SheetRow[] = [];
  return {
    rows,
    async findDocumentById(id: string) {
      return rows.find((row) => row.documentId === id) ?? null;
    },
    async listDocumentFamily(id: string) {
      return familyOf(rows, id);
    },
    async findLatestDocumentByStripeSessionId(sessionId: string) {
      return rows.filter((row) => row.documentId && row.stripeSessionId === sessionId).at(-1) ?? null;
    },
    async appendRecord(row: SheetRow) {
      const stored = { ...emptySheetRow(), ...row };
      rows.push(stored);
      return { backend: "file" as const, row: stored };
    },
  };
}

type Memory = ReturnType<typeof memoryStore>;

function intakeIo(store: Memory): IntakeIo {
  return {
    findDocumentById: store.findDocumentById,
    listDocumentFamily: store.listDocumentFamily,
    findLatestDocumentByStripeSessionId: store.findLatestDocumentByStripeSessionId,
    listEntitiesByEmail: async () => [],
    getOwnedEntity: async () => null,
    findLatestStripeCustomerIdByEmail: async () => null,
    resolveCheckoutSession: async (sessionId) => {
      if (sessionId === SESSION) {
        return {
          email: BUYER,
          company: COMPANY,
          stripeSessionId: SESSION,
          stripeCustomerId: "cus_test_buyer",
          stub: false,
        };
      }
      if (!sessionId) return { error: "missing" as const };
      return { error: "invalid" as const };
    },
    prepareDurableIntakeRow: async (row) => row,
    appendRecord: store.appendRecord,
    generatePdf: async (input) => ({
      buffer: Buffer.from("%PDF-1.4\n"),
      documentId: input.documentId || "pdf",
      plan: { status: "ready", chapters: [], openItems: [], pdf: null },
    }),
    storePdf: async () => ({ url: "", pathname: "memory/a.pdf", backend: "file" as const }),
    sendDeliveryMail: async () => ({ stub: true, sent: false, action: "delivery" }),
    sendReferralAfterDeliveryMail: async () => ({
      stub: true,
      sent: false,
      action: "referral_after_delivery",
    }),
    deliverLoginLink: async () => "stub",
  };
}

function postIntake(body: unknown, cookie = ""): Request {
  return new Request("http://localhost/api/intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function grantCookie(email: string, sessionId = SESSION): string {
  return `${CHECKOUT_GRANT_COOKIE}=${createCheckoutGrantToken({ sessionId, email })}`;
}

function sessionLine(response: Response): string {
  return response.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`)) ?? "";
}

function cookieFlags(line: string): string[] {
  return line
    .split(";")
    .slice(1)
    .map((part) => part.trim())
    .filter((part) => part && !part.toLowerCase().startsWith("expires="))
    .map((part) => part.toLowerCase())
    .sort();
}

function signRaw(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getMagicLinkSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

const firstBody = {
  sessionId: SESSION,
  email: OTHER,
  company: "Fremd GmbH",
  changedBy: OTHER,
  answers: answers(),
};

async function checkMatchingCheckout() {
  const store = memoryStore();
  const io = intakeIo(store);
  const first = await submitIntake(postIntake(firstBody, grantCookie(BUYER)), io);
  const firstJson = (await first.json()) as { documentId?: string; error?: string };
  ok(first.status === 200, `matching checkout first delivery is 200 (got ${first.status} ${firstJson.error ?? ""})`);
  const line = sessionLine(first);
  ok(Boolean(line), "matching checkout sets gobd_session");
  const token = first.cookies.get(SESSION_COOKIE)?.value ?? "";
  ok(verifySessionToken(token) === BUYER, "session email is the document owner");
  ok(/httponly/i.test(line), "session cookie is httpOnly");
  ok(/samesite=lax/i.test(line), "session cookie is sameSite=lax");
  ok(line.includes("Path=/"), "session cookie path is /");
  ok(line.includes(`Max-Age=${SESSION_MAX_AGE_SECONDS}`), "session cookie uses the 30-day max age");

  const verify = await verifyMagicLink(
    new Request(
      `http://localhost/auth/verify?token=${encodeURIComponent(createMagicToken(BUYER))}&next=${encodeURIComponent("/account")}`,
    ),
  );
  const verifyLine = sessionLine(verify);
  ok(cookieFlags(line).join("|") === cookieFlags(verifyLine).join("|"), "session cookie attributes match /auth/verify");

  const documentId = store.rows[0]?.documentId ?? "";
  const revisionBody = {
    ...firstBody,
    documentId,
    validFrom: "2026-10-08",
    changeSummary: "Korrektur der Ablage",
    changedBy: BUYER,
  };
  const edited = await submitIntake(postIntake(revisionBody, `${SESSION_COOKIE}=${token}`), io);
  const editedJson = (await edited.json()) as { version?: number; error?: string };
  ok(edited.status === 200 && editedJson.version === 2, `owner session may edit (got ${edited.status} ${editedJson.error ?? ""})`);
  ok(store.rows.length === 2, "edit appends the next version");

  const noCheckout = await submitIntake(
    postIntake({ ...revisionBody, changeSummary: "Ohne Nachweis" }),
    io,
  );
  const noCheckoutJson = (await noCheckout.json()) as { error?: string };
  ok(noCheckout.status === 401, `no checkout and no login is 401 (got ${noCheckout.status})`);
  ok(noCheckoutJson.error === LOGIN_TO_CHANGE_COPY, "401 keeps the Sie login copy");
  ok(!sessionLine(noCheckout), "401 does not set a session");
  ok(store.rows.length === 2, "401 writes nothing");

  const foreign = await submitIntake(
    postIntake(revisionBody, `${SESSION_COOKIE}=${createSessionToken(OTHER)}`),
    io,
  );
  const foreignJson = (await foreign.json()) as { error?: string };
  ok(foreign.status === 403, `foreign session is 403 (got ${foreign.status})`);
  ok(foreignJson.error === "Kein Zugriff.", "403 keeps the forbidden copy");
  ok(!sessionLine(foreign), "foreign session does not receive the owner cookie");
  ok(store.rows.length === 2, "403 writes nothing");
}

async function checkMismatchAndExpiry() {
  const mismatched = memoryStore();
  const mismatch = await submitIntake(
    postIntake(firstBody, grantCookie(OTHER)),
    intakeIo(mismatched),
  );
  ok(mismatch.status === 200, `mismatched checkout email still delivers the first version (got ${mismatch.status})`);
  ok(mismatched.rows[0]?.email === BUYER, "stripe email stays the owner when the cookie email differs");
  ok(!sessionLine(mismatch), "mismatched email sets no session");
  ok(verifySessionToken(mismatch.cookies.get(SESSION_COOKIE)?.value) === null, "mismatched response has no session token");

  const expiredToken = signRaw({
    typ: "checkout",
    email: BUYER,
    sid: SESSION,
    iat: Date.now() - 60_000,
    exp: Date.now() - 1_000,
  });
  ok(verifyCheckoutGrantToken(expiredToken) === null, "expired checkout cookie is not proof");
  const expiredStore = memoryStore();
  const expired = await submitIntake(
    postIntake(firstBody, `${CHECKOUT_GRANT_COOKIE}=${expiredToken}`),
    intakeIo(expiredStore),
  );
  ok(expired.status === 200, "expired checkout still allows the first paid delivery via Stripe");
  ok(!sessionLine(expired), "expired checkout sets no session");
  const row = expiredStore.rows[0];
  ok(Boolean(row?.documentId), "expired checkout still stored the document");
  const next = safeNextPath(intakeEditPath(row!, SESSION));
  const target = intakeTargetFromNext(next);
  ok(Boolean(target), "edit path is an intake login target");
  const checkoutEmail = emailForAnswersLogin(row, target!);
  const offer = answersLoginOffer({ next, checkoutEmail });
  ok(offer.explain, "expired checkout sends the user to an explaining login");
  ok(offer.email === BUYER, "login offer uses the checkout email");
  ok(offer.masked === maskCheckoutEmail(BUYER), "login offer masks the checkout email");
  ok(offer.masked === "b•••@example.com", "buyer address is masked");
  ok(LOGIN_FOR_ANSWERS_COPY.includes("Sie"), "login explanation uses Sie");

  const loginPage = readFileSync("app/login/page.tsx", "utf8");
  const loginForm = readFileSync("app/login/login-form.tsx", "utf8");
  ok(loginPage.includes("LOGIN_FOR_ANSWERS_COPY"), "login page shows the protection sentence");
  ok(loginForm.includes("prefillEmail"), "login form prefills the checkout email");
  ok(loginForm.includes("maskedEmail"), "login form offers the masked checkout email");
}

async function checkCheckoutReturn() {
  const matched = NextResponse.redirect("http://localhost/intake");
  await attachVerifiedCheckoutCookies(
    matched,
    { stub: false, customerEmail: BUYER, stripeSessionId: SESSION },
    async () => null,
  );
  ok(verifySessionToken(matched.cookies.get(SESSION_COOKIE)?.value) === BUYER, "paid checkout return sets the owner session");
  ok(
    verifyCheckoutGrantToken(matched.cookies.get(CHECKOUT_GRANT_COOKIE)?.value)?.sessionId === SESSION,
    "checkout return still sets the 6h grant",
  );
  const returnLine = sessionLine(matched);
  ok(/httponly/i.test(returnLine) && /samesite=lax/i.test(returnLine), "return session uses httpOnly and sameSite");

  const owned = NextResponse.redirect("http://localhost/intake");
  await attachVerifiedCheckoutCookies(
    owned,
    { stub: false, customerEmail: ` ${BUYER.toUpperCase()} `, stripeSessionId: SESSION },
    async () => BUYER,
  );
  ok(verifySessionToken(owned.cookies.get(SESSION_COOKIE)?.value) === BUYER, "document owner matching the payer gets a session");

  const mismatch = NextResponse.redirect("http://localhost/intake");
  await attachVerifiedCheckoutCookies(
    mismatch,
    { stub: false, customerEmail: BUYER, stripeSessionId: SESSION },
    async () => OTHER,
  );
  ok(!mismatch.cookies.get(SESSION_COOKIE)?.value, "checkout return sets no session when the document owner differs");
  ok(
    verifyCheckoutGrantToken(mismatch.cookies.get(CHECKOUT_GRANT_COOKIE)?.value)?.email === BUYER,
    "the checkout grant still records the paying customer",
  );

  const stubbed = NextResponse.redirect("http://localhost/intake");
  await attachVerifiedCheckoutCookies(
    stubbed,
    { stub: true, customerEmail: BUYER, stripeSessionId: "mock_local" },
    async () => null,
  );
  ok(!stubbed.cookies.get(SESSION_COOKIE)?.value, "stub checkout return sets no session");

  const failed = NextResponse.redirect("http://localhost/intake");
  await attachVerifiedCheckoutCookies(
    failed,
    { stub: false, customerEmail: BUYER, stripeSessionId: SESSION },
    async () => {
      throw new Error("store down");
    },
  );
  ok(!failed.cookies.get(SESSION_COOKIE)?.value, "owner lookup failure sets no session");

  ok(
    ownerEmailForCheckoutReturn({
      paid: false,
      stub: false,
      customerEmail: BUYER,
      documentOwnerEmail: null,
    }) === null,
    "unpaid checkout sets no session",
  );

  const grantRoute = readFileSync("app/api/checkout/grant/route.ts", "utf8");
  ok(grantRoute.includes("attachVerifiedCheckoutCookies"), "grant route uses the shared checkout session helper");
  ok(!grantRoute.includes("applySessionCookie"), "grant route does not sign a session itself");
  const intake = readFileSync("app/api/intake/route.ts", "utf8");
  ok(intake.includes("applyCheckoutOwnerSession"), "first completion uses the shared owner session");
  ok(!intake.includes("applySessionCookie"), "intake does not sign a session itself");
  ok(intake.includes("authorizeDeliveredWrite"), "delivered writes stay behind the login gate");
}

async function main() {
  if (!process.env.MAGIC_LINK_SECRET?.trim()) {
    process.env.MAGIC_LINK_SECRET = "check-checkout-session-offline-secret";
  }
  await checkMatchingCheckout();
  await checkMismatchAndExpiry();
  await checkCheckoutReturn();
  console.log("check-checkout-session: green");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
