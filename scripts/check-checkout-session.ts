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
import { completeCheckoutHandoff } from "../app/api/auth/checkout-handoff/route";
import { completeCheckoutGrant } from "../app/api/checkout/grant/route";
import { putIntakeDraft, readIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
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
import { forgetCheckoutSessionGrant } from "../lib/checkout-session-grant";
import {
  CHECKOUT_BACK_TO_ACCOUNT,
  LOGIN_FOR_ANSWERS_COPY,
  answersLoginOffer,
  attachVerifiedCheckoutCookies,
  checkoutCustomerEmail,
  checkoutHandoffButtonCopy,
  checkoutOwnerMismatchCopy,
  decideCheckoutAttach,
  emailForAnswersLogin,
  checkoutAlreadyGranted,
  finishCheckoutReturn,
  intakeCheckoutGate,
  intakeEntryDecision,
  intakeTargetFromNext,
  loginCheckoutEmail,
  maskCheckoutEmail,
  ownerEmailForCheckoutReturn,
} from "../lib/checkout-session";
import { intakeEditPath } from "../lib/documents";
import { getMagicLinkSecret } from "../lib/env";
import { clearIntakeDraft, normalizeDraftKey, saveIntakeDraft } from "../lib/intake-draft";
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
  ok(grantRoute.includes("finishCheckoutReturn"), "grant route uses the shared checkout session helper");
  ok(grantRoute.includes('decision === "mismatch"'), "grant route does not continue into a foreign checkout");
  ok(grantRoute.includes('decision === "login"'), "grant route sends a bare session id to login after the first grant");
  ok(!grantRoute.includes("applySessionCookie"), "grant route does not sign a session itself");
  const intake = readFileSync("app/api/intake/route.ts", "utf8");
  ok(intake.includes("applyCheckoutOwnerSession"), "first completion uses the shared owner session");
  ok(!intake.includes("applySessionCookie"), "intake does not sign a session itself");
  ok(intake.includes("authorizeDeliveredWrite"), "delivered writes stay behind the login gate");
}

const GUARD = "cs_test_grant_guard";
const SAME = "cs_test_same_owner";

function guardDraftIo(sessionId: string): DraftWriteIo {
  const drafts = new Map<string, Awaited<ReturnType<DraftWriteIo["loadIntakeDraft"]>>>();
  return {
    loadIntakeDraft: async (key) => drafts.get(key) ?? null,
    saveIntakeDraft: async (draft) => {
      drafts.set(draft.draftKey, draft);
      return { backend: "file" };
    },
    clearIntakeDraft: async (key) => {
      drafts.delete(key);
    },
    rememberOpenDraft: async () => false,
    forgetOpenDraft: async () => undefined,
    lookup: {
      findDocumentById: async () => null,
      listDocumentFamily: async () => [],
      findLatestDocumentByStripeSessionId: async () => null,
    },
    resolveCheckout: async (id) => {
      if (id === sessionId) return { email: BUYER, stub: false };
      return { error: "invalid" };
    },
  };
}

async function checkSessionGuards() {
  ok(
    decideCheckoutAttach({
      existingSessionEmail: OTHER,
      customerEmail: BUYER,
      sessionOwnerEmail: BUYER,
      alreadyGranted: false,
    }) === "mismatch",
    "a different login is mismatch, not a new session",
  );
  ok(
    decideCheckoutAttach({
      existingSessionEmail: null,
      customerEmail: BUYER,
      sessionOwnerEmail: BUYER,
      alreadyGranted: false,
    }) === "session",
    "the first return still issues a session",
  );
  ok(
    decideCheckoutAttach({
      existingSessionEmail: null,
      customerEmail: BUYER,
      sessionOwnerEmail: BUYER,
      alreadyGranted: true,
    }) === "login",
    "after the first grant a bare session id goes to login",
  );
  ok(
    intakeCheckoutGate({ sessionEmail: OTHER, customerEmail: BUYER, grantRecorded: true }) === "mismatch",
    "intake does not open a foreign checkout",
  );
  ok(
    intakeCheckoutGate({ sessionEmail: null, customerEmail: BUYER, grantRecorded: true }) === "login",
    "a fresh browser after the grant is sent to login",
  );
  ok(
    intakeCheckoutGate({ sessionEmail: null, customerEmail: BUYER, grantRecorded: false }) === "proceed",
    "the immediate post-payment return still proceeds",
  );
  ok(
    checkoutOwnerMismatchCopy(OTHER, BUYER) ===
      "Sie sind als o•••@example.com angemeldet. Dieser Kauf gehört zu b•••@example.com.",
    "mismatch page names both masked addresses",
  );
  ok(
    checkoutHandoffButtonCopy(BUYER) === "Abmelden und Anmeldelink an b•••@example.com senden",
    "handoff button offers the magic link to the buyer",
  );
  ok(CHECKOUT_BACK_TO_ACCOUNT === "Zurück zum Konto", "the other option returns to the account");

  const clash = NextResponse.redirect("http://localhost/intake");
  const clashDecision = await finishCheckoutReturn(
    clash,
    { stub: false, customerEmail: BUYER, stripeSessionId: GUARD, existingSessionEmail: OTHER },
    async () => null,
  );
  ok(clashDecision === "mismatch", "finishCheckoutReturn refuses to switch the login");
  ok(!sessionLine(clash), "mismatch sets no gobd_session");
  ok(!clash.cookies.get(CHECKOUT_GRANT_COOKIE)?.value, "mismatch sets no checkout cookie");

  const first = NextResponse.redirect("http://localhost/intake");
  const firstDecision = await finishCheckoutReturn(
    first,
    { stub: false, customerEmail: BUYER, stripeSessionId: GUARD, existingSessionEmail: null },
    async () => null,
  );
  ok(firstDecision === "session", "first paid return still sets the owner session");
  ok(verifySessionToken(first.cookies.get(SESSION_COOKIE)?.value) === BUYER, "first return cookie is the buyer");

  const again = NextResponse.redirect("http://localhost/intake");
  const againDecision = await finishCheckoutReturn(
    again,
    { stub: false, customerEmail: BUYER, stripeSessionId: GUARD, existingSessionEmail: null },
    async () => null,
  );
  ok(againDecision === "login", "the same session id does not grant a second session");
  ok(!sessionLine(again), "the second bare return sets no gobd_session");

  const same = NextResponse.redirect("http://localhost/intake");
  const sameDecision = await finishCheckoutReturn(
    same,
    { stub: false, customerEmail: BUYER, stripeSessionId: SAME, existingSessionEmail: BUYER },
    async () => null,
  );
  ok(sameDecision === "same", "the owner's existing login stays");
  ok(!sessionLine(same), "an existing owner login is not rewritten");
  ok(
    verifyCheckoutGrantToken(same.cookies.get(CHECKOUT_GRANT_COOKIE)?.value)?.email === BUYER,
    "the owner still receives the checkout grant",
  );

  const held = memoryStore();
  const foreignFirst = await submitIntake(
    postIntake(firstBody, `${SESSION_COOKIE}=${createSessionToken(OTHER)}; ${grantCookie(BUYER)}`),
    intakeIo(held),
  );
  ok(foreignFirst.status === 200, "first delivery still stores the paid checkout");
  ok(held.rows[0]?.email === BUYER, "the document owner stays the buyer");
  ok(!sessionLine(foreignFirst), "first delivery does not replace a foreign login");

  const draftIo = guardDraftIo(GUARD);
  const denied = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: GUARD,
        modus: "gesamt",
        step: 1,
        revision: 1,
        answers: answers(),
      }),
    }),
    draftIo,
  );
  ok(denied.status === 401, `after the grant a bare session id cannot write the draft (got ${denied.status})`);

  const foreignWrite = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}`,
      },
      body: JSON.stringify({
        sessionId: GUARD,
        modus: "gesamt",
        step: 1,
        revision: 1,
        answers: answers(),
      }),
    }),
    draftIo,
  );
  ok(foreignWrite.status === 403, `a foreign login cannot write the granted draft (got ${foreignWrite.status})`);

  const saved = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${createSessionToken(BUYER)}`,
      },
      body: JSON.stringify({
        sessionId: GUARD,
        modus: "gesamt",
        step: 1,
        revision: 1,
        answers: answers(),
      }),
    }),
    draftIo,
  );
  const savedJson = (await saved.json()) as { draft?: { draftKey?: string; answers?: IntakeAnswers } };
  ok(saved.status === 200, `the owner session can still write the draft (got ${saved.status})`);
  const draftKey = savedJson.draft?.draftKey ?? "";
  ok(Boolean(draftKey), "owner write returns the draft key");

  const bareRead = await readIntakeDraft(
    new Request(
      `http://localhost/api/intake/draft?draftKey=${encodeURIComponent(draftKey)}&sessionId=${encodeURIComponent(GUARD)}`,
    ),
    draftIo,
  );
  ok(bareRead.status === 401, `a fresh browser cannot read the draft with only the session id (got ${bareRead.status})`);

  const ownerRead = await readIntakeDraft(
    new Request(
      `http://localhost/api/intake/draft?draftKey=${encodeURIComponent(draftKey)}&sessionId=${encodeURIComponent(GUARD)}`,
      { headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(BUYER)}` } },
    ),
    draftIo,
  );
  const ownerJson = (await ownerRead.json()) as { draft?: { answers?: IntakeAnswers } };
  ok(ownerRead.status === 200 && ownerJson.draft?.answers?.gf === "Ada Beispiel", "the owner session still reads the draft");

  let sentTo = "";
  const handed = await completeCheckoutHandoff(
    new Request("http://localhost/api/auth/checkout-handoff", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}`,
      },
      body: new URLSearchParams({ session_id: GUARD, email: "attacker@example.com" }).toString(),
    }),
    {
      resolveOwner: async () => BUYER,
      deliver: async (email) => {
        sentTo = email;
        return "stub";
      },
    },
  );
  ok(sentTo === BUYER, "the magic link goes to the checkout owner, not the form email");
  ok((handed.headers.get("location") ?? "").includes("/login"), "handoff continues at login");
  ok(verifySessionToken(handed.cookies.get(SESSION_COOKIE)?.value) === null, "handoff clears the previous login");

  const failed = await completeCheckoutHandoff(
    new Request("http://localhost/api/auth/checkout-handoff", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}`,
      },
      body: new URLSearchParams({ session_id: GUARD }).toString(),
    }),
    {
      resolveOwner: async () => BUYER,
      deliver: async () => "failed",
    },
  );
  const failedLocation = failed.headers.get("location") ?? "";
  ok(failedLocation.includes("handoff=failed"), "a failed magic link stays on the mismatch page");
  ok(!sessionLine(failed), "a failed magic link does not log the current user out");

  const noDocument = await checkoutCustomerEmail(GUARD, async () => ({ email: BUYER, stub: false }));
  ok(noDocument === BUYER, "checkout customer email is used when no document exists");
  ok(
    (await checkoutCustomerEmail("mock_empty", async () => ({ email: "  ", stub: true }))) === "",
    "an empty stub email does not become a mask",
  );
  ok(
    (await checkoutCustomerEmail(GUARD, async () => ({ error: "lookup_failed" }))) === "",
    "a failed checkout lookup does not invent an address",
  );
  const offer = answersLoginOffer({
    next: `/intake?session_id=${encodeURIComponent(GUARD)}`,
    checkoutEmail: loginCheckoutEmail({ documentEmail: "", checkoutCustomerEmail: noDocument }),
  });
  ok(offer.explain && offer.email === BUYER && offer.masked === "b•••@example.com", "login explains with the masked checkout email");

  const loginPage = readFileSync("app/login/page.tsx", "utf8");
  ok(loginPage.includes("loginCheckoutEmail"), "login page derives the address from the checkout");
  ok(loginPage.includes("checkoutCustomerEmail"), "login page reads the checkout customer email");
  ok(loginPage.includes("checkoutSessionGrant"), "login page falls back to the stored checkout customer email");
  const intakePage = readFileSync("app/intake/page.tsx", "utf8");
  ok(intakePage.includes("intakeCheckoutGate"), "intake applies the session guard before the form");
  ok(intakePage.includes("intakeEntryDecision"), "intake decides login before it follows a session id");
  ok(intakePage.includes("checkoutAlreadyGranted"), "intake treats a saved draft and a submitted document as already used");
  ok(intakePage.includes("checkoutOwnerMismatchCopy"), "intake shows the mismatch sentence");
  ok(intakePage.includes("checkoutHandoffButtonCopy"), "intake offers the handoff button");
  ok(intakePage.includes("CHECKOUT_BACK_TO_ACCOUNT"), "intake offers the way back to the account");
  ok(intakePage.includes("/api/auth/checkout-handoff"), "handoff is a post, not a silent cookie change");
  const handoff = readFileSync("app/api/auth/checkout-handoff/route.ts", "utf8");
  ok(handoff.includes("checkoutSessionGrant"), "handoff can use the stored checkout owner");
  ok(handoff.includes("deliverLoginLink"), "handoff uses the existing magic link");
  ok(handoff.includes("clearSessionCookie"), "handoff clears the login only through the session helper");
  ok(!handoff.includes('form.get("email")') && !handoff.includes("form.get('email')"), "handoff does not accept an email from the form");
}

const FRESH = "cs_test_incognito_repro";
const SUBMITTED = "cs_test_submitted_repro";

function paidGrantIo(sessionId: string, ownerEmail: string | null) {
  return {
    resolveCheckout: async (id: string) => {
      if (id !== sessionId) return { error: "invalid" as const };
      return {
        email: BUYER,
        company: COMPANY,
        stripeSessionId: id,
        stripeCustomerId: "cus_test_buyer",
        stub: false,
      };
    },
    lookupDocumentOwner: async () => ownerEmail,
  };
}

/** The prod repro: /intake?session_id= in a fresh window must not come back as grant=set. */
async function checkFreshWindow() {
  const draftKey = normalizeDraftKey({ sessionId: FRESH, modus: "gesamt" });
  await forgetCheckoutSessionGrant(FRESH).catch(() => undefined);
  await forgetCheckoutSessionGrant(SUBMITTED).catch(() => undefined);
  await clearIntakeDraft(draftKey).catch(() => undefined);

  const first = await completeCheckoutGrant(
    new Request(`http://localhost/api/checkout/grant?session_id=${encodeURIComponent(FRESH)}`),
    paidGrantIo(FRESH, null),
  );
  const firstLocation = first.headers.get("location") ?? "";
  ok(firstLocation.includes("grant=set"), "the immediate post-payment return still appends grant=set");
  ok(
    verifySessionToken(first.cookies.get(SESSION_COOKIE)?.value) === BUYER,
    "the immediate post-payment return still sets the owner session",
  );

  const again = await completeCheckoutGrant(
    new Request(`http://localhost/api/checkout/grant?session_id=${encodeURIComponent(FRESH)}`),
    paidGrantIo(FRESH, null),
  );
  const againLocation = again.headers.get("location") ?? "";
  ok(againLocation.includes("/login"), "a fresh window after the grant opens the login page");
  ok(!againLocation.includes("grant=set"), "a fresh window does not append grant=set");
  ok(!sessionLine(again), "a fresh window sets no gobd_session");
  ok(
    intakeEntryDecision({
      sessionEmail: null,
      ownerEmail: BUYER,
      alreadyUsed: true,
      checkoutCookieMatches: false,
      grantFlag: "set",
      hasSessionQuery: true,
    }) === "login",
    "/intake?session_id=&grant=set without cookies does not open the draft",
  );

  await forgetCheckoutSessionGrant(FRESH);
  await saveIntakeDraft({
    draftKey,
    email: BUYER,
    stripeSessionId: FRESH,
    documentId: "",
    entityId: "",
    step: 2,
    answers: answers(),
    revision: 1,
    updatedAt: new Date().toISOString(),
  });
  const withDraft = await completeCheckoutGrant(
    new Request(`http://localhost/api/checkout/grant?session_id=${encodeURIComponent(FRESH)}`),
    paidGrantIo(FRESH, null),
  );
  const draftLocation = withDraft.headers.get("location") ?? "";
  ok(draftLocation.includes("/login"), "a saved draft in a fresh window goes to the login page");
  ok(!draftLocation.includes("grant=set"), "a saved draft does not append grant=set");
  ok(!sessionLine(withDraft), "a saved draft sets no gobd_session");
  ok((await checkoutAlreadyGranted(FRESH)).granted, "the saved draft counts as already granted");

  const afterSubmit = await completeCheckoutGrant(
    new Request(`http://localhost/api/checkout/grant?session_id=${encodeURIComponent(SUBMITTED)}`),
    paidGrantIo(SUBMITTED, BUYER),
  );
  const submitLocation = afterSubmit.headers.get("location") ?? "";
  ok(submitLocation.includes("/login"), "after intake submission a bare session id goes to login");
  ok(!submitLocation.includes("grant=set"), "after intake submission the return does not append grant=set");
  ok(!sessionLine(afterSubmit), "after intake submission no session cookie is set");

  await clearIntakeDraft(draftKey).catch(() => undefined);
}

async function main() {
  const savedBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const savedSecret = process.env.MAGIC_LINK_SECRET;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  if (!process.env.MAGIC_LINK_SECRET?.trim()) {
    process.env.MAGIC_LINK_SECRET = "check-checkout-session-offline-secret";
  }
  try {
    await checkMatchingCheckout();
    await checkMismatchAndExpiry();
    await checkCheckoutReturn();
    await checkSessionGuards();
    await checkFreshWindow();
    console.log("check-checkout-session: green");
  } finally {
    await forgetCheckoutSessionGrant(SESSION).catch(() => undefined);
    await forgetCheckoutSessionGrant(GUARD).catch(() => undefined);
    await forgetCheckoutSessionGrant(SAME).catch(() => undefined);
    await forgetCheckoutSessionGrant(FRESH).catch(() => undefined);
    await forgetCheckoutSessionGrant(SUBMITTED).catch(() => undefined);
    await clearIntakeDraft(normalizeDraftKey({ sessionId: FRESH, modus: "gesamt" })).catch(() => undefined);
    if (savedBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = savedBlob;
    if (savedSecret === undefined) delete process.env.MAGIC_LINK_SECRET;
    else process.env.MAGIC_LINK_SECRET = savedSecret;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
