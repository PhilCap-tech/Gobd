/**
 * Session privacy: owner email stays off the login page, logout revokes the
 * cookie on the server, and a checkout id is not a bearer for address,
 * customer id, delivery or PDF download (R136-F01…F04).
 *
 *   npx tsx scripts/check-session-privacy.ts
 *
 * Synthetic @example.com only. No mail, no Stripe, no prod data.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POST as logout } from "../app/api/auth/logout/route";
import { completeMagicLinkRequest } from "../app/api/auth/magic-link/route";
import { postDelivery } from "../app/api/delivery/route";
import { downloadPdf } from "../app/api/docs/[id]/download/route";
import { putIntakeDraft, readIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { readCheckoutSession } from "../app/api/session/route";
import { CHECKOUT_GRANT_COOKIE, SESSION_COOKIE, createSessionToken, sessionEmailFromRequest } from "../lib/auth";
import { sessionOwnerDenial } from "../lib/checkout-access";
import {
  emailShownToViewer,
  loginClientFields,
  loginLinkButtonLabel,
  maskCheckoutEmail,
} from "../lib/checkout-session";
import { forgetSessionRevocation } from "../lib/session-revocation";
import {
  forgetCheckoutSessionGrant,
  recordCheckoutSessionGrant,
} from "../lib/checkout-session-grant";
import { normalizeDraftKey } from "../lib/intake-draft";
import { emptyAnswers, emptySheetRow, type IntakeAnswers, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer@example.com";
const OTHER = "other@example.com";
const LEGACY = "cs_test_legacy_no_grant";

function answers(): IntakeAnswers {
  return { ...emptyAnswers(), gf: "Ada Beispiel" };
}

function sessionCookie(email: string): string {
  return `${SESSION_COOKIE}=${createSessionToken(email)}`;
}

function draftIo(saved: { n: number }): DraftWriteIo {
  const draftKey = normalizeDraftKey({ sessionId: LEGACY, modus: "gesamt" });
  return {
    loadIntakeDraft: async () => ({
      draftKey,
      email: BUYER,
      stripeSessionId: LEGACY,
      documentId: "",
      entityId: "",
      step: 2,
      answers: answers(),
      revision: 1,
      updatedAt: "2026-10-12T12:00:00.000Z",
    }),
    saveIntakeDraft: async () => {
      saved.n += 1;
      return { backend: "file" };
    },
    clearIntakeDraft: async () => undefined,
    lookup: {
      findDocumentById: async () => null,
      listDocumentFamily: async () => [],
      findLatestDocumentByStripeSessionId: async () => null,
    },
    resolveCheckout: async () => ({ error: "lookup_failed" }),
  };
}

function draftUrl(): string {
  const draftKey = normalizeDraftKey({ sessionId: LEGACY, modus: "gesamt" });
  return `http://localhost/api/intake/draft?draftKey=${encodeURIComponent(draftKey)}&sessionId=${encodeURIComponent(LEGACY)}`;
}

async function checkLegacyDraft(label: string) {
  const saved = { n: 0 };
  const io = draftIo(saved);
  const bare = await readIntakeDraft(new Request(draftUrl()), io);
  const bareText = await bare.text();
  ok(bare.status === 401, `${label}: no session is 401 (got ${bare.status})`);
  ok(!bareText.includes(BUYER), `${label}: 401 does not contain the owner email`);
  ok(!bareText.includes("Ada Beispiel"), `${label}: 401 does not contain the answers`);

  const foreign = await readIntakeDraft(
    new Request(draftUrl(), { headers: { cookie: sessionCookie(OTHER) } }),
    io,
  );
  const foreignText = await foreign.text();
  ok(foreign.status === 403, `${label}: foreign session is 403 (got ${foreign.status})`);
  ok(!foreignText.includes(BUYER) && !foreignText.includes("Ada Beispiel"), `${label}: 403 does not contain the draft`);

  const owner = await readIntakeDraft(
    new Request(draftUrl(), { headers: { cookie: sessionCookie(BUYER) } }),
    io,
  );
  const ownerJson = (await owner.json()) as { draft?: { answers?: { gf?: string } } };
  ok(owner.status === 200 && ownerJson.draft?.answers?.gf === "Ada Beispiel", `${label}: owner session reads the draft`);

  const write = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: LEGACY,
        email: BUYER,
        modus: "gesamt",
        step: 2,
        answers: answers(),
        revision: 2,
      }),
    }),
    io,
  );
  ok(write.status === 401, `${label}: put without a session is 401`);
  ok(saved.n === 0, `${label}: put without a session stores nothing`);
}

async function checkLoginDoesNotLeak() {
  const next = `/intake?session_id=${encodeURIComponent(LEGACY)}`;
  const fields = loginClientFields({
    next,
    checkoutEmail: BUYER,
    sessionEmail: null,
  });
  const packed = JSON.stringify(fields);
  ok(fields.resolveOwner, "session login resolves the owner on the server");
  ok(fields.masked === "bu•••r@example.com", "the hint stays masked");
  ok(!packed.includes(BUYER), "client login props omit the owner email");
  ok(
    loginLinkButtonLabel(fields.masked) === "Link an bu•••r@example.com senden",
    "the button names only the mask",
  );

  const loginPage = readFileSync("app/login/page.tsx", "utf8");
  const loginForm = readFileSync("app/login/login-form.tsx", "utf8");
  ok(!loginPage.includes("prefillEmail"), "login page has no prefill prop");
  ok(
    !loginForm.includes('type="hidden" name="email"') &&
      !loginForm.includes('name="email" type="hidden"'),
    "login form has no hidden email",
  );
  ok(loginForm.includes('name="next"'), "no-js submit posts the return path, not the address");
  ok(loginForm.includes("resolveOwner"), "login form posts without the address");

  let sentTo = "";
  const response = await completeMagicLinkRequest(
    { next },
    {
      resolveOwner: async () => BUYER,
      deliver: async (email) => {
        sentTo = email;
        return "stub";
      },
    },
  );
  const body = await response.text();
  ok(response.status === 200, "magic link without a typed address still sends");
  ok(sentTo === BUYER, "the link goes to the owner resolved on the server");
  ok(!body.includes(BUYER), "the magic-link response does not contain the owner email");
}

async function checkLogout() {
  const response = await logout(
    new Request("https://www.gobd-doku-erstellen.de/api/auth/logout", { method: "POST" }),
  );
  const lines = response.headers.getSetCookie();
  ok(response.status === 303, "logout redirects");
  ok((response.headers.get("location") ?? "").endsWith("/login"), "logout lands on /login");
  ok(
    (response.headers.get("cache-control") ?? "").includes("no-store"),
    "logout response is no-store",
  );
  ok(lines.length <= 8, `logout sends few Set-Cookie lines (got ${lines.length})`);
  ok(
    lines.every((line) => !/domain=/i.test(line)),
    "logout stays host-only, matching the cookie that was set",
  );
  ok(
    lines.some(
      (line) =>
        line.startsWith(`${SESSION_COOKIE}=`) &&
        line.includes("Path=/;") &&
        line.includes("Max-Age=0") &&
        line.includes("Secure"),
    ),
    "logout expires the host-only Secure gobd_session on Path=/",
  );
  ok(
    lines.some(
      (line) =>
        line.startsWith(`${CHECKOUT_GRANT_COOKIE}=`) &&
        line.includes("Path=/;") &&
        line.includes("Max-Age=0") &&
        line.includes("Secure"),
    ),
    "logout expires gobd_checkout the same way",
  );
  ok(
    !lines.some((line) => line.includes("Path=/account")),
    "logout does not emit a path variant",
  );

  const account = readFileSync("app/account/page.tsx", "utf8");
  const checkout = readFileSync("app/checkout/page.tsx", "utf8");
  const config = readFileSync("next.config.ts", "utf8");
  const button = readFileSync("components/logout-button.tsx", "utf8");
  ok(account.includes("LogoutButton") && account.includes("RefreshStoredView"), "account refreshes after logout");
  ok(checkout.includes("RefreshStoredView"), "checkout refreshes after logout");
  ok(button.includes("router.refresh()"), "logout refreshes the router cache");
  ok(button.includes("Die Abmeldung ist fehlgeschlagen"), "a failed logout tells the user");
  ok(button.includes('redirect: "manual"'), "logout does not hide a 500 behind a followed redirect");
  ok(config.includes('source: "/account"') && config.includes('source: "/checkout"'), "account and checkout are no-store");
  ok(sessionOwnerDenial(null, BUYER) === 401, "pdf/draft helper is 401 without a session");
  ok(sessionOwnerDenial(OTHER, BUYER) === 403, "pdf/draft helper is 403 for someone else");
  ok(sessionOwnerDenial(BUYER, BUYER) === null, "pdf/draft helper allows the owner");
  ok(sessionOwnerDenial(BUYER, "") === 403, "a missing owner is not open access");
  const download = readFileSync("app/api/docs/[id]/download/route.ts", "utf8");
  ok(download.includes("sessionOwnerDenial"), "PDF download uses the owner-session gate");
  ok(!download.includes("session_id"), "PDF download does not authorize session_id");
}

const PAID = "cs_test_paid_privacy";
const GUIDO = "guido@maxxspace.com";
const GERD = "gerd@maxxspace.com";
const COPIED = "copied-cookie@example.com";

function paidIdentity() {
  return {
    email: BUYER,
    company: "Maxx GmbH",
    stripeSessionId: PAID,
    stripeCustomerId: "cus_privacy_secret",
    stub: false,
    billingAddress: { line1: "Geheimstraße 1", postalCode: "50667", city: "Köln" },
    customerName: "Guido Beispiel",
    ustId: "DE136695976",
  };
}

function deliveryIo(rows: SheetRow[]) {
  return {
    lookup: {
      findDocumentById: async () => rows[0] ?? null,
      listDocumentFamily: async () => rows,
      findLatestDocumentByStripeSessionId: async () => rows[0] ?? null,
    },
    resolveCheckout: async () => paidIdentity(),
  };
}

function paidRow(): SheetRow {
  return {
    ...emptySheetRow(),
    email: BUYER,
    company: "Maxx GmbH",
    stripeSessionId: PAID,
    stripeCustomerId: "cus_privacy_secret",
    documentId: "doc_privacy",
    status: "intake_submitted",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkCheckoutSessionView() {
  const identity = {
    ...paidIdentity(),
    email: GUIDO,
    stripeSessionId: "cs_test_guido",
  };
  const resolve = async () => identity;
  const anon = await readCheckoutSession(
    new Request("http://localhost/api/session?session_id=cs_test_guido"),
    resolve,
  );
  const anonBody = await anon.json();
  const anonText = JSON.stringify(anonBody);
  ok(anon.status === 200, `session without a cookie is the public view (got ${anon.status})`);
  ok(anonBody.emailMasked === "gu•••o@maxxspace.com", "public session email is masked");
  ok(anonBody.paid === true && anonBody.stripeSessionId === "cs_test_guido", "public session says paid");
  ok(!anonText.includes(GUIDO), "public session omits the full email");
  ok(!anonText.includes("cus_"), "public session omits the customer id");
  ok(!anonText.includes("Geheim"), "public session omits the address");
  ok(!anonText.includes("Maxx"), "public session omits the company");
  ok(!("email" in anonBody) && !("billingAddress" in anonBody), "public session has no raw fields");

  const foreign = await readCheckoutSession(
    new Request("http://localhost/api/session?session_id=cs_test_guido", {
      headers: { cookie: sessionCookie(GERD) },
    }),
    resolve,
  );
  const foreignText = JSON.stringify(await foreign.json());
  ok(foreign.status === 200, "a foreign login still gets only the public view");
  ok(!foreignText.includes(GUIDO) && !foreignText.includes("cus_"), "foreign login does not receive the checkout record");

  const owner = await readCheckoutSession(
    new Request("http://localhost/api/session?session_id=cs_test_guido", {
      headers: { cookie: sessionCookie(GUIDO) },
    }),
    resolve,
  );
  const ownerBody = await owner.json();
  ok(owner.status === 200 && ownerBody.email === GUIDO, "the owner session still receives the checkout email");
  ok(ownerBody.stripeCustomerId === "cus_privacy_secret", "the owner session still receives the customer id");
  ok(ownerBody.billingAddress?.line1 === "Geheimstraße 1", "the owner session still receives the address");
  ok(
    emailShownToViewer(GUIDO, null) === "gu•••o@maxxspace.com" &&
      emailShownToViewer(GUIDO, GUIDO) === GUIDO,
    "success copy is masked unless the viewer is the owner",
  );
  ok(
    maskCheckoutEmail(GUIDO) !== maskCheckoutEmail(GERD) &&
      !maskCheckoutEmail(GUIDO).includes("guido") &&
      !maskCheckoutEmail(GERD).includes("gerd"),
    "masks that share a first letter stay apart and incomplete",
  );
}

async function checkDeliveryAuth() {
  const open = deliveryIo([]);
  const anon = await postDelivery(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: PAID }),
    }),
    open,
  );
  const anonText = await anon.text();
  ok(anon.status === 401, `paid session without login is 401 (got ${anon.status})`);
  ok(!anonText.includes(BUYER) && !anonText.includes("cus_"), "401 delivery does not echo the checkout");

  const foreign = await postDelivery(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie(OTHER),
      },
      body: JSON.stringify({ sessionId: PAID }),
    }),
    open,
  );
  const foreignBody = (await foreign.json()) as { error?: string; delivery?: unknown };
  ok(foreign.status === 403, `foreign login without a document is 403 (got ${foreign.status})`);
  ok(!foreignBody.delivery, "foreign delivery has no plan");
  ok(foreignBody.error === "Kein Zugriff.", "foreign delivery uses the forbidden copy");

  const documented = deliveryIo([paidRow()]);
  const foreignDoc = await postDelivery(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie(OTHER),
      },
      body: JSON.stringify({ sessionId: PAID }),
    }),
    documented,
  );
  ok(foreignDoc.status === 403, `foreign login with a document is 403 (got ${foreignDoc.status})`);

  const owner = await postDelivery(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie(BUYER),
      },
      body: JSON.stringify({ sessionId: PAID }),
    }),
    open,
  );
  ok(owner.status === 200, `owner of a paid session without a document is 200 (got ${owner.status})`);
}

async function checkPdfDownload() {
  let lookups = 0;
  const find = async () => {
    lookups += 1;
    return paidRow();
  };
  const bare = await downloadPdf(
    new Request("http://localhost/api/docs/doc_privacy/download"),
    "doc_privacy",
    find,
  );
  const queried = await downloadPdf(
    new Request("http://localhost/api/docs/doc_privacy/download?session_id=cs_test_paid_privacy"),
    "doc_privacy",
    find,
  );
  ok(bare.status === 401 && queried.status === 401, "anonymous PDF download is 401 with or without a checkout id");
  ok(lookups === 0, "anonymous PDF download does not look the row up");
  const bareBody = (await bare.json()) as { error?: string };
  const queriedBody = (await queried.json()) as { error?: string };
  ok(bareBody.error === queriedBody.error, "both anonymous downloads use the same error");

  const foreign = await downloadPdf(
    new Request("http://localhost/api/docs/doc_privacy/download", {
      headers: { cookie: sessionCookie(OTHER) },
    }),
    "doc_privacy",
    async () => paidRow(),
  );
  const missing = await downloadPdf(
    new Request("http://localhost/api/docs/doc_privacy/download", {
      headers: { cookie: sessionCookie(OTHER) },
    }),
    "doc_privacy",
    async () => null,
  );
  const foreignBody = (await foreign.json()) as { error?: string };
  const missingBody = (await missing.json()) as { error?: string };
  ok(foreign.status === 403 && missing.status === 403, "a foreign download is 403 whether the row is found or not");
  ok(
    foreignBody.error === "Kein Zugriff." && missingBody.error === "Kein Zugriff.",
    "a foreign download does not alternate with nicht gefunden",
  );

  const download = readFileSync("app/api/docs/[id]/download/route.ts", "utf8");
  ok(!download.includes("nicht gefunden"), "PDF download has no not-found copy");
  ok(!download.includes("session_id"), "PDF download does not read the checkout id");
}

async function checkLogoutRevokes() {
  await forgetSessionRevocation(COPIED);
  const token = createSessionToken(COPIED);
  const cookie = `${SESSION_COOKIE}=${token}`;
  await sleep(15);
  const response = await logout(
    new Request("https://www.gobd-doku-erstellen.de/api/auth/logout", {
      method: "POST",
      headers: { cookie },
    }),
  );
  ok(response.status === 303, "logout with a cookie still redirects");
  const copied = await sessionEmailFromRequest(
    new Request("http://localhost/account", { headers: { cookie } }),
  );
  ok(copied === null, "a copied cookie is rejected after logout");
  const fresh = createSessionToken(COPIED);
  const again = await sessionEmailFromRequest(
    new Request("http://localhost/account", {
      headers: { cookie: `${SESSION_COOKIE}=${fresh}` },
    }),
  );
  ok(again === COPIED, "a session issued after logout is accepted");
  const other = await sessionEmailFromRequest(
    new Request("http://localhost/account", { headers: { cookie: sessionCookie(OTHER) } }),
  );
  ok(other === OTHER, "logout does not revoke a different mailbox");
}

function checkSmallItems() {
  const checkoutPage = readFileSync("app/checkout/page.tsx", "utf8");
  const checkoutForm = readFileSync("app/checkout/checkout-form.tsx", "utf8");
  ok(checkoutPage.includes("initialEmail={email"), "signed-in checkout prefills that mailbox");
  ok(checkoutPage.includes("initialCompany={boundEntity"), "signed-in checkout prefills that firm");
  ok(checkoutForm.includes("checkoutEntityIdForEmail"), "a different typed email does not keep the firm");
  const profile = readFileSync("components/account-profile-form.tsx", "utf8");
  ok(profile.includes("editedName ?? initialName"), "profile name follows the loaded value");
  ok(readFileSync("app/account/page.tsx", "utf8").includes("initialName={profile?.name"), "account passes the stored profile name");
}

async function main() {
  const savedBlob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  if (!process.env.MAGIC_LINK_SECRET?.trim()) {
    process.env.MAGIC_LINK_SECRET = "check-session-privacy-offline-secret";
  }
  try {
    await forgetCheckoutSessionGrant(LEGACY);
    await checkLegacyDraft("legacy without grant");
    await recordCheckoutSessionGrant({ sessionId: LEGACY, email: BUYER });
    await checkLegacyDraft("with grant");
    await checkLoginDoesNotLeak();
    await checkLogout();
    await checkCheckoutSessionView();
    await checkDeliveryAuth();
    await checkPdfDownload();
    await checkLogoutRevokes();
    checkSmallItems();
    console.log("check-session-privacy: green");
  } finally {
    await forgetCheckoutSessionGrant(LEGACY).catch(() => undefined);
    await forgetSessionRevocation(COPIED).catch(() => undefined);
    if (savedBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = savedBlob;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
