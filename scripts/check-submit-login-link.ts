/**
 * Login link on POST /api/intake and the „Anmeldelink gesendet" banner.
 *
 * Every stored submit carries the owner's session (sessionOwnerDenial), so
 * "not logged in" is the first delivery after a Stripe checkout, whose
 * session comes from the checkout grant, not from a login.
 * - Signed-in owner, new version (r276 path): no login-link mail, no
 *   `anmeldung` parameter.
 * - First submit after the Stripe checkout: one login-link mail,
 *   `anmeldung=gesendet`, banner (unchanged).
 * - A login link already sent inside the dedupe window: no new mail, no
 *   parameter, no banner. Other deliverLoginLink callers still read "sent".
 * - /success without `anmeldung`: no banner.
 * Real lib/login-mail + lib/mail-dedupe with a temp ledger and a stubbed
 * provider. No network, no Sheets, no Blob, no Stripe.
 *
 *   npx tsx scripts/check-submit-login-link.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const key of [
  "BLOB_READ_WRITE_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]) {
  delete process.env[key];
}
// Mail counts as configured; the provider itself is replaced below.
process.env.RESEND_API_KEY = "re_check_placeholder";
process.env.EMAIL_FROM = "check@example.com";
if (!process.env.MAGIC_LINK_SECRET) process.env.MAGIC_LINK_SECRET = "check-submit-login-link";
const lifecycle = process.env.npm_lifecycle_event ?? "";
if (!lifecycle.startsWith("check:") && lifecycle !== "prebuild" && lifecycle !== "build") {
  process.env.npm_lifecycle_event = "check:submit-login-link";
}

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "kundin-login@firma.example";
const SESSION = "cs_test_submit_login_link";
const COMPANY = "Login Beispiel GmbH";
const ENTITY = "ent_login";

async function main(): Promise<void> {
  const { submitIntake } = await import("../app/api/intake/route");
  type IntakeIo = import("../app/api/intake/route").IntakeIo;
  const { SESSION_COOKIE, CHECKOUT_GRANT_COOKIE, createSessionToken, createCheckoutGrantToken } =
    await import("../lib/auth");
  const { setBlobMarkerTestDir } = await import("../lib/blob-marker");
  const { setMailDedupeTestHooks, MAGIC_LINK_WINDOW_MS, mailDedupeSendIsStubbed } = await import("../lib/mail-dedupe");
  const { deliverLoginLink, deliverLoginLinkReportingDuplicate } = await import("../lib/login-mail");
  const { anmeldungParam, showsLoginLinkSent } = await import("../lib/login-mail-shared");
  const { flushLeadNoticesForTests } = await import("../lib/lead-notice");
  const notice = await import("../lib/owner-notice");
  const { emptyAnswers, emptySheetRow } = await import("../lib/types");
  type SheetRow = import("../lib/types").SheetRow;

  setBlobMarkerTestDir(mkdtempSync(path.join(tmpdir(), "submit-login-markers-")));
  let clock = Date.parse("2026-10-26T10:00:00.000Z");
  const sent: { to: string; subject: string }[] = [];
  setMailDedupeTestHooks({
    dir: mkdtempSync(path.join(tmpdir(), "submit-login-mail-")),
    now: () => clock,
    send: async (input) => {
      sent.push({ to: input.to, subject: input.subject });
      return { stub: false, sent: true, id: `stub-${sent.length}` };
    },
  });
  ok(mailDedupeSendIsStubbed(), "the mail provider is stubbed");
  notice.setOwnerNoticeTestMode(true);
  const loginMails = () => sent.filter((mail) => /Anmeldelink/i.test(mail.subject)).length;

  const answers = { ...emptyAnswers(), branchen: ["Handel"], rechtsform: "GmbH", gf: "Ada Beispiel" };

  function io(rows: SheetRow[], counter: { delivery: number; login: number }): IntakeIo {
    return {
      findDocumentById: async (id) => rows.find((row) => row.documentId === id) ?? null,
      findLatestDocumentByStripeSessionId: async (sessionId) =>
        rows.filter((row) => row.stripeSessionId === sessionId).at(-1) ?? null,
      listDocumentFamily: async (familyId) =>
        rows.filter((row) => (row.parentDocumentId || row.documentId) === familyId),
      listEntitiesByEmail: async () => [],
      getOwnedEntity: async () => null,
      findLatestStripeCustomerIdByEmail: async () => null,
      resolveCheckoutSession: async (sessionId) =>
        sessionId === SESSION
          ? { email: BUYER, company: COMPANY, stripeSessionId: SESSION, stripeCustomerId: "cus_test_login", stub: false, entityId: ENTITY }
          : { error: "invalid" as const },
      prepareDurableIntakeRow: async (row) => row,
      appendRecord: async (row) => {
        const stored = { ...emptySheetRow(), ...row };
        rows.push(stored);
        return { backend: "file", row: stored };
      },
      generatePdf: async (input) => ({
        buffer: Buffer.from("%PDF-1.4\n"),
        documentId: input.documentId || "pdf",
        plan: { status: "ready", chapters: [], openItems: [], pdf: null },
      }),
      storePdf: async (input) => ({ url: "", pathname: `memory/${input.documentId}.pdf`, backend: "file" as const }),
      sendDeliveryMail: async () => {
        counter.delivery += 1;
        return { stub: false, sent: true, action: "delivery" as const };
      },
      // The production login mailer, through the stubbed provider and ledger.
      deliverLoginLink: async (email, next) => {
        counter.login += 1;
        return deliverLoginLinkReportingDuplicate(email, next);
      },
    };
  }

  async function submit(cookie: string, submitId: string, seed: SheetRow[] = [], extra: Record<string, string> = {}) {
    const rows: SheetRow[] = [...seed];
    const counter = { delivery: 0, login: 0 };
    const response = await submitIntake(
      new Request("http://localhost/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ sessionId: SESSION, email: BUYER, company: COMPANY, entityId: ENTITY, answers, submitId, ...extra }),
      }),
      io(rows, counter),
    );
    const body = (await response.json()) as { error?: string; documentId?: string; loginMail?: string };
    await flushLeadNoticesForTests();
    return { status: response.status, body, counter, rows };
  }

  const login = `${SESSION_COOKIE}=${createSessionToken(BUYER)}`;
  // Checkout return: /api/checkout/grant sets the session and the grant cookie.
  const afterCheckout = `${login}; ${CHECKOUT_GRANT_COOKIE}=${createCheckoutGrantToken({ sessionId: SESSION, email: BUYER })}`;
  const delivered: SheetRow = {
    ...emptySheetRow(),
    documentId: "doc-login-v1",
    parentDocumentId: "doc-login-v1",
    email: BUYER,
    company: COMPANY,
    entityId: ENTITY,
    stripeSessionId: SESSION,
    status: "intake_submitted",
    deliveryStatus: "ready",
    version: "1",
    timestamp: "2026-10-12T12:00:00.000Z",
  };
  const revision = {
    documentId: delivered.documentId,
    validFrom: "2026-10-26",
    changeSummary: "Login-Link-Check",
    changedBy: BUYER,
  };

  try {
    // 1) Signed-in owner creates a new version: delivery mail yes, login link no.
    const before1 = loginMails();
    const owner = await submit(login, "6a0b1c3e-2222-4a2b-8c3d-000000000001", [delivered], revision);
    ok(owner.status === 200 && Boolean(owner.body.documentId), `owner revision submit is 200 (got ${owner.status} ${owner.body.error ?? ""})`);
    ok(owner.rows.at(-1)?.version === "2", "the owner submit stored version 2");
    ok(owner.counter.delivery === 1, "the signed-in owner still gets the delivery mail");
    ok(owner.counter.login === 0, "the signed-in owner submit does not call the login mailer");
    ok(loginMails() === before1, "the signed-in owner gets 0 login-link mails");
    ok(owner.body.loginMail === "loggedIn", `loginMail is loggedIn (got ${owner.body.loginMail})`);
    ok(anmeldungParam(owner.body.loginMail) === null, "no anmeldung parameter for the signed-in owner");

    // 2) First submit after the Stripe checkout: one login-link mail and the banner.
    clock += MAGIC_LINK_WINDOW_MS + 1_000;
    const before2 = loginMails();
    const anon = await submit(afterCheckout, "6a0b1c3e-2222-4a2b-8c3d-000000000002");
    ok(anon.status === 200 && Boolean(anon.body.documentId), `first submit after checkout is 200 (got ${anon.status} ${anon.body.error ?? ""})`);
    ok(anon.rows.at(-1)?.version === "1", "the first submit stored version 1");
    ok(anon.rows[0]?.email === BUYER, "the row belongs to the checkout email");
    ok(anon.counter.delivery === 1, "the Stripe buyer gets the delivery mail");
    ok(anon.counter.login === 1 && loginMails() === before2 + 1, "the Stripe buyer gets exactly 1 login-link mail (unchanged)");
    ok(anon.body.loginMail === "sent", `loginMail is sent (got ${anon.body.loginMail})`);
    const anonParam = anmeldungParam(anon.body.loginMail);
    ok(anonParam === "gesendet" && showsLoginLinkSent(anonParam), "anmeldung=gesendet shows the banner");

    // 3) Login link already sent inside the dedupe window (r276): no new mail, no banner.
    clock += MAGIC_LINK_WINDOW_MS + 1_000;
    ok((await deliverLoginLink(BUYER, "/account")) === "sent", "a login request sends the link");
    const before3 = loginMails();
    clock += 30_000;
    const dup = await submit(afterCheckout, "6a0b1c3e-2222-4a2b-8c3d-000000000003");
    ok(dup.status === 200, `submit inside the window is 200 (got ${dup.status} ${dup.body.error ?? ""})`);
    ok(loginMails() === before3, "inside the window no second login-link mail goes out");
    ok(dup.body.loginMail === "duplicate", `loginMail is duplicate (got ${dup.body.loginMail})`);
    ok(anmeldungParam(dup.body.loginMail) === null, "a duplicate sets no anmeldung parameter, so no banner");
    ok(
      (await deliverLoginLink(BUYER, "/account")) === "sent",
      "other deliverLoginLink callers still read a duplicate as sent (generic login answer unchanged)",
    );
    ok(
      (await deliverLoginLinkReportingDuplicate(BUYER, "/account")) === "duplicate",
      "the intake mailer reports the duplicate",
    );

    // 4) The banner itself.
    ok(!showsLoginLinkSent(""), "/success without anmeldung shows no banner");
    for (const value of ["keine", "fehler", "stub", "duplicate", "loggedIn"]) {
      ok(!showsLoginLinkSent(value), `anmeldung=${value} shows no banner`);
    }
    ok(anmeldungParam("failed") === "fehler" && anmeldungParam("stub") === "stub" && anmeldungParam("skipped") === "keine", "the other parameters are unchanged");
    const page = readFileSync("app/success/page.tsx", "utf8");
    ok(page.includes("showsLoginLinkSent(anmeldung)"), "/success gates the banner on showsLoginLinkSent");
    ok(!/mailReady\s*&&\s*anmeldung/.test(page), "/success has no banner fallback without the parameter");
    const form = readFileSync("app/intake/intake-form.tsx", "utf8");
    ok(form.includes("anmeldungParam(data.loginMail)"), "the intake form maps loginMail through anmeldungParam");
    const route = readFileSync("app/api/intake/route.ts", "utf8");
    ok(/ownerLoggedIn:\s*!plan\.firstDelivery/.test(route), "only a submit after the first delivery counts as signed in");
    ok(/sendLoginLink: false,/.test(route), "a replay still sends no login link");
  } finally {
    setMailDedupeTestHooks(null);
    setBlobMarkerTestDir(null);
    notice.setOwnerNoticeTestMode(false);
  }
  console.log("submit login link checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
