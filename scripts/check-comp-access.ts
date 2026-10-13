/**
 * Comp allowlist: one mailbox has the paid product without Stripe.
 * A cs_test_ id is still not payment. Other mailboxes stay on the checkout gate.
 * No network, no Sheet write, no mail send.
 *
 *   npx tsx scripts/check-comp-access.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as postCheckout } from "../app/api/checkout/route";
import { postDelivery } from "../app/api/delivery/route";
import { submitIntake, type IntakeIo } from "../app/api/intake/route";
import { AccountAboCard } from "../components/account-abo";
import { AccountBillingStatus } from "../components/account-billing";
import { AccountCompanyCard } from "../components/account-company-card";
import { SuccessAccessNote } from "../app/success/page";
import { SESSION_COOKIE, createSessionToken } from "../lib/auth";
import { deliverBuyerOnboarding } from "../lib/buyer-onboarding";
import { sessionOwnerDenial } from "../lib/checkout-access";
import {
  isTestModeCheckoutSessionId,
  isStoredPaidEntitlementStatus,
  TEST_MODE_CHECKOUT_COPY,
} from "../lib/checkout-session";
import {
  COMP_ACCESS_EMAILS,
  compCheckoutRedirect,
  compIntakePath,
  firmaAnlegenAllowed,
  isCompAccessEmail,
} from "../lib/comp-access";
import { canAccessDocument } from "../lib/documents";
import {
  ENTITY_SHEET_COLUMNS,
  EntityLimitError,
  customerFacingSaveError,
  emptyEntity,
  entitySheetValues,
  firmaSaveError,
  toEntity,
} from "../lib/entities";
import { installSheetsHandler } from "../lib/sheets-client";
import { readCachedGrid } from "../lib/sheets-grid";
import { createTtlSingleflight } from "../lib/sheets-outage";
import { SheetsUnavailableError } from "../lib/sheets-unavailable";
import { clearAllSheetReadCaches, createEntity, listEntitiesByEmail } from "../lib/store";
import { handleFailedPayment, sendDeliveryMail, triggerOnboardingMail } from "../lib/ops";
import { isPilotPaymentFailedExempt } from "../lib/pilot-exemptions";
import { emptyAnswers, emptySheetRow, type IntakeAnswers, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const COMP = "winkler@winkler-segtrop.de";
const OTHER = "other-buyer@example.com";
const ENTITY = "ent_comp_winkler";
const COMPANY = "Winkler Segtrop GmbH";
const DOC = "doc-foreign-comp";
const TEST_SESSION = "cs_test_comp_not_payment";

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

function loginCookie(email: string): string {
  return `${SESSION_COOKIE}=${createSessionToken(email)}`;
}

function firm() {
  return {
    ...emptyEntity(),
    entityId: ENTITY,
    userEmail: COMP,
    name: COMPANY,
  };
}

function intakeIo(rows: SheetRow[], options?: {
  family?: SheetRow[];
  stripe?: IntakeIo["resolveCheckoutSession"];
}) {
  const stripeCalls = { n: 0 };
  const customerLookups = { n: 0 };
  const deliveryMails = { n: 0 };
  const loginMails = { n: 0 };
  const pdfs = { n: 0 };
  const io: IntakeIo = {
    findDocumentById: async (id) => options?.family?.find((row) => row.documentId === id) ?? null,
    listDocumentFamily: async () => options?.family ?? [],
    findLatestDocumentByStripeSessionId: async () => null,
    listEntitiesByEmail: async (email) => (email === COMP ? [firm()] : []),
    getOwnedEntity: async (entityId, email) =>
      entityId === ENTITY && email === COMP ? firm() : null,
    findLatestStripeCustomerIdByEmail: async () => {
      customerLookups.n += 1;
      return "cus_should_not_be_read";
    },
    findRowByStripeSessionId: async () => null,
    resolveCheckoutSession: async (sessionId) => {
      stripeCalls.n += 1;
      if (!sessionId?.trim()) return { error: "missing" as const };
      if (options?.stripe) return options.stripe(sessionId);
      return { error: "invalid" as const };
    },
    prepareDurableIntakeRow: async (row) => row,
    appendRecord: async (row) => {
      const stored = { ...emptySheetRow(), ...row };
      rows.push(stored);
      return { backend: "file", row: stored };
    },
    generatePdf: async (input) => {
      pdfs.n += 1;
      return {
        buffer: Buffer.from("%PDF-1.4\n"),
        documentId: input.documentId || "pdf",
        plan: { status: "ready", chapters: [], openItems: [], pdf: null },
      };
    },
    storePdf: async () => ({ url: "", pathname: "memory/comp.pdf", backend: "file" as const }),
    sendDeliveryMail: async () => {
      deliveryMails.n += 1;
      return { stub: true, sent: false, action: "delivery" as const };
    },
    deliverLoginLink: async () => {
      loginMails.n += 1;
      return "sent" as const;
    },
  };
  return { io, stripeCalls, customerLookups, deliveryMails, loginMails, pdfs };
}

function postIntake(cookie: string, body: Record<string, unknown>) {
  return new Request("http://localhost/api/intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function checkAllowlist() {
  ok(COMP_ACCESS_EMAILS.length === 1, "the allowlist is the approved mailbox");
  ok(COMP_ACCESS_EMAILS[0] === COMP, "the mailbox is winkler@winkler-segtrop.de");
  ok(
    !isCompAccessEmail("gobd-test@mail.grokbot.com") &&
      !isCompAccessEmail("GOBD-TEST@mail.grokbot.com"),
    "the temporary smoke address is not entitled",
  );
  ok(isCompAccessEmail(`  ${COMP.toUpperCase()}  `), "the match is case-insensitive and trimmed");
  ok(!isCompAccessEmail(OTHER), "a non-listed mailbox has no comp entitlement");
  ok(!isCompAccessEmail(""), "an empty address is not entitled");
  ok(!isCompAccessEmail("winkler@winkler-segtrop.de.example"), "a lookalike host is not entitled");
  ok(
    isCompAccessEmail("QA-Comp@example.com", ["qa-comp@example.com"]),
    "an optional extra test address uses the same comparison",
  );
  ok(!isCompAccessEmail("QA-Comp@example.com"), "the extra address is not in the production list");
  ok(
    !isCompAccessEmail(OTHER, ["qa-comp@example.com"]),
    "the extra address does not entitle a different mailbox",
  );
  ok(isTestModeCheckoutSessionId(TEST_SESSION), "cs_test_ is recognised as test mode");
  ok(!isStoredPaidEntitlementStatus(""), "an empty status is not an entitlement");
  ok(!isStoredPaidEntitlementStatus("paid_stub"), "a stub status is not an entitlement");
  ok(
    !isCompAccessEmail(OTHER) && !isStoredPaidEntitlementStatus(""),
    "a non-listed mailbox with no paid status is not entitled",
  );
  ok(firmaAnlegenAllowed(COMP), "the comp mailbox may create a company");
  ok(firmaAnlegenAllowed(OTHER), "other logged-in mailboxes may still create a company");
  ok(!firmaAnlegenAllowed(""), "Firma anlegen still requires a login");
  ok(compIntakePath(ENTITY).includes("entity_id=" + ENTITY), "the comp questionnaire names the company");
  ok(!compIntakePath(ENTITY).includes("session_id"), "the comp questionnaire has no checkout session");
  ok(
    compCheckoutRedirect(`  ${COMP.toUpperCase()}  `, ENTITY) === compIntakePath(ENTITY),
    "a comp session with a new company leaves checkout for the questionnaire",
  );
  ok(compCheckoutRedirect(COMP, "  ") === "/account", "a comp session without a company leaves checkout for the account");
  ok(compCheckoutRedirect(OTHER, ENTITY) === null, "another mailbox still reaches checkout");
  ok(sessionOwnerDenial(COMP, COMP) === null, "the comp mailbox owns its own document");
  ok(sessionOwnerDenial(OTHER, COMP) === 403, "another mailbox does not own the comp document");
  ok(sessionOwnerDenial(null, COMP) === 401, "a missing login does not own the comp document");
  ok(
    canAccessDocument(
      { email: COMP, stripeSessionId: "" },
      { sessionEmail: COMP, sessionId: TEST_SESSION },
    ),
    "download follows the owner mailbox, not a checkout id",
  );
  ok(
    !canAccessDocument(
      { email: COMP, stripeSessionId: TEST_SESSION },
      { sessionEmail: OTHER, sessionId: "" },
    ),
    "a foreign login cannot download the comp document",
  );
  const source = readFileSync("lib/comp-access.ts", "utf8");
  ok(source.includes("Philip, 2026-10-13"), "the allowlist names who approved it");
}

function checkAccountUi() {
  const compCard = renderToStaticMarkup(
    createElement(AccountAboCard, { stripeBound: false, compAccess: true }),
  );
  ok(compCard.includes("Kostenfreier Zugang"), "the hub names the free access");
  ok(compCard.includes("Sie können"), "the note uses Sie");
  ok(!compCard.includes('href="/checkout"'), "the comp hub has no checkout button");
  ok(!compCard.includes("/account/kuendigung"), "the comp hub has no cancel button");
  ok(!compCard.includes("/account/billing"), "the comp hub has no Stripe billing link");
  ok(!compCard.includes("Stripe-Portal"), "the comp hub has no portal button");

  const stripeBoundComp = renderToStaticMarkup(
    createElement(AccountAboCard, { stripeBound: true, compAccess: true }),
  );
  ok(stripeBoundComp.includes("Kostenfreier Zugang"), "a Stripe id on the mailbox does not restore the Abo block");
  ok(!stripeBoundComp.includes('href="/checkout"'), "a comp account has no price CTA");
  ok(!stripeBoundComp.includes("149"), "a comp account does not see the setup price");
  ok(!stripeBoundComp.includes("Ein Abo gilt"), "a comp account does not see the Abo copy");

  const paidCard = renderToStaticMarkup(
    createElement(AccountAboCard, { stripeBound: false, compAccess: false }),
  );
  ok(paidCard.includes('href="/checkout"'), "a non-comp account still sees checkout");
  ok(!paidCard.includes("Kostenfreier Zugang"), "a non-comp account does not see the comp note");

  const billing = renderToStaticMarkup(
    createElement(AccountBillingStatus, {
      status: "none",
      stripeReady: true,
      hasCustomer: false,
      lookupFailed: false,
      compAccess: true,
    }),
  );
  ok(billing.includes("Kostenfreier Zugang"), "billing names the free access");
  ok(!billing.includes("Stripe-Portal"), "billing hides the portal button");
  ok(!billing.includes("Kündigen"), "billing hides cancel");

  const unpaidBilling = renderToStaticMarkup(
    createElement(AccountBillingStatus, {
      status: "none",
      stripeReady: true,
      hasCustomer: false,
      lookupFailed: false,
    }),
  );
  ok(
    unpaidBilling.includes("Zahlungsmethode und Rechnungen im Stripe-Portal"),
    "a non-comp account keeps the existing billing control",
  );

  const company = renderToStaticMarkup(
    createElement(AccountCompanyCard, {
      email: COMP,
      compAccess: true,
      empty: true,
      group: {
        entity: { ...emptyEntity(), entityId: ENTITY, name: COMPANY },
        families: [],
      },
    }),
  );
  ok(company.includes("/intake?"), "Neues Dokument opens the questionnaire");
  ok(company.includes("entity_id="), "Neues Dokument keeps the company");
  ok(!company.includes("/checkout"), "Neues Dokument does not open checkout");
  ok(
    /<a\b[^>]*>Neues Dokument<\/a>/.test(company),
    "Neues Dokument is a native anchor in the markup",
  );
  ok(!/<button\b[^>]*>Neues Dokument<\/button>/.test(company), "Neues Dokument is not a nested button");

  const ignoredFlag = renderToStaticMarkup(
    createElement(AccountCompanyCard, {
      email: `  ${COMP.toUpperCase()}  `,
      compAccess: false,
      paidIntakeHref: "/intake?session_id=cs_live_should_not_win",
      empty: true,
      group: {
        entity: { ...emptyEntity(), entityId: ENTITY, name: COMPANY },
        families: [],
      },
    }),
  );
  ok(
    ignoredFlag.includes(`/intake?modus=gesamt&amp;entity_id=${ENTITY}`),
    "a new company for a comp login opens the questionnaire",
  );
  ok(!ignoredFlag.includes("/checkout"), "a new company for a comp login does not open checkout");
  ok(!ignoredFlag.includes("session_id="), "a stored payment does not replace the comp questionnaire");
  ok(ignoredFlag.includes("Neues Dokument"), "the empty company still offers Neues Dokument");

  const ordinary = renderToStaticMarkup(
    createElement(AccountCompanyCard, {
      email: OTHER,
      empty: true,
      group: {
        entity: { ...emptyEntity(), entityId: ENTITY, name: COMPANY },
        families: [],
      },
    }),
  );
  ok(ordinary.includes("/checkout?entity_id="), "other accounts still start at checkout");
  ok(
    /<a\b[^>]*>Neues Dokument<\/a>/.test(ordinary),
    "other accounts also get Neues Dokument as a native anchor",
  );

  const cardSource = readFileSync("components/account-company-card.tsx", "utf8");
  const neuesTag = cardSource.match(/<(a|Link|button)\b[^>]*>\s*Neues Dokument/);
  ok(neuesTag?.[1] === "a", "Neues Dokument is authored as a native anchor");
  const paidStartTag = cardSource.match(/<(a|Link|button)\b[^>]*>\s*\{PAID_INTAKE_LABEL\}/);
  ok(paidStartTag?.[1] === "a", "the empty-card paid intake start is a native anchor");

  const compNote = renderToStaticMarkup(
    createElement(SuccessAccessNote, { compAccess: true }),
  );
  ok(compNote.includes("Kostenfreier Zugang"), "the comp success page names the free access");
  ok(compNote.includes("Sie können"), "the comp success note uses Sie");
  ok(!compNote.includes("149"), "the comp success page hides the setup price");
  ok(!compNote.includes("Umsatzsteuer"), "the comp success page hides the invoice line");
  const paidNote = renderToStaticMarkup(
    createElement(SuccessAccessNote, { compAccess: false }),
  );
  ok(
    paidNote.includes("Die Rechnung weist die Nettopreise zuzüglich 19"),
    "a paid success page keeps the invoice line",
  );
  ok(paidNote.includes("149"), "a paid success page still names the setup price");
  ok(!paidNote.includes("Kostenfreier Zugang"), "a paid success page does not show the comp note");
  const successSource = readFileSync("app/success/page.tsx", "utf8");
  ok(successSource.includes("isCompAccessEmail(row?.email)"), "success uses the document owner");
  ok(successSource.includes("isCompAccessEmail(sessionEmail)"), "success uses the login mailbox");

  const account = readFileSync("app/account/page.tsx", "utf8");
  ok(account.includes("Firma anlegen"), "the hub still offers Firma anlegen");
  ok(account.includes("isCompAccessEmail"), "the hub checks the allowlist");
  const entities = readFileSync("app/api/entities/route.ts", "utf8");
  ok(entities.includes("firmaAnlegenAllowed"), "Firma anlegen uses the login gate");
  ok(!entities.includes("resolveCheckoutSession"), "Firma anlegen does not ask Stripe");
  const intake = readFileSync("app/intake/page.tsx", "utf8");
  ok(intake.includes("isCompAccessEmail"), "intake start checks the allowlist");
  ok(account.includes("paidIntakeHref && !compAccess"), "paid intake on the hub follows the session email");
  const checkoutPage = readFileSync("app/checkout/page.tsx", "utf8");
  const checkoutRedirect = checkoutPage.indexOf("compCheckoutRedirect");
  const checkoutForm = checkoutPage.indexOf("<CheckoutForm");
  ok(checkoutRedirect !== -1 && checkoutRedirect < checkoutForm, "checkout redirects a comp session before the price form");
  ok(checkoutPage.includes("if (compTarget) redirect(compTarget)"), "checkout uses a server redirect");
  const checkoutApi = readFileSync("app/api/checkout/route.ts", "utf8");
  ok(
    checkoutApi.indexOf("compCheckoutRedirect") < checkoutApi.indexOf("createCheckoutSession"),
    "the checkout API refuses a comp email before Stripe",
  );
}

async function checkCheckoutGuard() {
  const withCompany = await postCheckout(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `  ${COMP.toUpperCase()}  `,
        company: COMPANY,
        entityId: ENTITY,
        entrepreneur: true,
        acceptedDisclaimer: true,
      }),
    }),
  );
  const withCompanyBody = (await withCompany.json()) as { url?: string };
  ok(withCompany.status === 200, `comp checkout POST is 200 (got ${withCompany.status})`);
  ok(withCompanyBody.url === compIntakePath(ENTITY), "comp checkout POST returns the questionnaire");
  ok(!String(withCompanyBody.url).includes("cs_"), "comp checkout POST does not create a Checkout Session");

  const noCompany = await postCheckout(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: COMP, company: COMPANY, entrepreneur: true, acceptedDisclaimer: true }),
    }),
  );
  const noCompanyBody = (await noCompany.json()) as { url?: string };
  ok(noCompanyBody.url === "/account", "comp checkout POST without a company returns the account");

  const switchedEmail = await postCheckout(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${SESSION_COOKIE}=${createSessionToken(COMP)}`,
      },
      body: JSON.stringify({
        email: OTHER,
        company: COMPANY,
        entityId: ENTITY,
        entrepreneur: true,
        acceptedDisclaimer: true,
      }),
    }),
  );
  const switchedBody = (await switchedEmail.json()) as { url?: string };
  ok(switchedEmail.status === 200, "a comp login cannot start Stripe by typing another email");
  ok(switchedBody.url === compIntakePath(ENTITY), "the session email keeps the questionnaire");

  const ordinary = await postCheckout(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: OTHER }),
    }),
  );
  const ordinaryBody = (await ordinary.json()) as { url?: string; error?: string };
  ok(ordinary.status === 400, `a non-comp checkout POST still validates (got ${ordinary.status})`);
  ok(!ordinaryBody.url, "a non-comp checkout POST does not receive the comp questionnaire");
}

async function checkSubmit() {
  const owned = intakeIo([]);
  const created = await submitIntake(
    postIntake(loginCookie(`  ${COMP.toUpperCase()}  `.trim()), {
      email: OTHER,
      company: "Fremd GmbH",
      entityId: ENTITY,
      answers: answers(),
    }),
    owned.io,
  );
  const createdBody = (await created.json()) as { error?: string; documentId?: string; loginMail?: string };
  ok(created.status === 200, `comp submit is 200 (got ${created.status} ${createdBody.error ?? ""})`);
  ok(createdBody.loginMail === "skipped", "comp submit does not send a login mail");
  ok(owned.stripeCalls.n === 0, "comp submit does not call Stripe");
  ok(owned.customerLookups.n === 0, "comp submit does not look up a Stripe customer");
  ok(owned.deliveryMails.n === 0, "comp submit does not send the delivery mail");
  ok(owned.loginMails.n === 0, "comp submit does not call the login mailer");
  ok(owned.pdfs.n === 1, "comp submit generates the PDF");
  ok(
    (await Promise.resolve(createdBody.documentId)) && createdBody.documentId,
    "comp submit returns a document id",
  );

  const storedRows: SheetRow[] = [];
  const again = intakeIo(storedRows);
  const second = await submitIntake(
    postIntake(loginCookie(COMP), {
      email: OTHER,
      company: "Fremd GmbH",
      entityId: ENTITY,
      answers: answers(),
    }),
    again.io,
  );
  ok(second.status === 200, "a second comp submit is also allowed");
  ok(storedRows.length === 1, "the questionnaire stores one document row");
  ok(storedRows[0]?.email === COMP, "the row owner is the login, not body.email");
  ok(storedRows[0]?.company === COMPANY, "the row keeps the owned company");
  ok(storedRows[0]?.stripeSessionId === "", "the row has no Stripe session");
  ok(storedRows[0]?.stripeCustomerId === "", "the row has no Stripe customer");
  ok(storedRows[0]?.entityId === ENTITY, "the row is bound to the company");
  ok(again.stripeCalls.n === 0 && again.pdfs.n === 1, "the second submit still skips Stripe and writes a PDF");

  const blocked = intakeIo([]);
  const noPay = await submitIntake(
    postIntake(loginCookie(OTHER), {
      email: OTHER,
      company: COMPANY,
      entityId: ENTITY,
      answers: answers(),
    }),
    blocked.io,
  );
  const noPayBody = (await noPay.json()) as { error?: string };
  ok(noPay.status === 401, `a non-listed mailbox without payment stays 401 (got ${noPay.status})`);
  ok(noPayBody.error === "Checkout-Session fehlt.", "the existing missing-checkout copy stays");
  ok(blocked.stripeCalls.n === 1, "a non-listed mailbox still asks Stripe");
  ok(blocked.pdfs.n === 0, "a non-listed mailbox does not generate a PDF");

  const testMode = intakeIo([]);
  const testRes = await submitIntake(
    postIntake(loginCookie(COMP), {
      sessionId: TEST_SESSION,
      email: COMP,
      company: COMPANY,
      entityId: ENTITY,
      answers: answers(),
    }),
    testMode.io,
  );
  const testBody = (await testRes.json()) as { error?: string };
  ok(
    testRes.status === 401 && testBody.error === TEST_MODE_CHECKOUT_COPY,
    "cs_test_ alone is not payment, including for a comp mailbox",
  );
  ok(testMode.stripeCalls.n === 1, "cs_test_ without a paid row still asks Stripe");
  ok(testMode.pdfs.n === 0, "cs_test_ alone does not generate a PDF");

  const foreignRows: SheetRow[] = [];
  const foreign = intakeIo(foreignRows, {
    family: [
      {
        ...emptySheetRow(),
        documentId: DOC,
        parentDocumentId: DOC,
        email: OTHER,
        stripeSessionId: TEST_SESSION,
        status: "intake_submitted",
      },
    ],
  });
  const foreignRes = await submitIntake(
    postIntake(loginCookie(COMP), {
      documentId: DOC,
      email: COMP,
      company: COMPANY,
      entityId: ENTITY,
      answers: answers(),
    }),
    foreign.io,
  );
  const foreignBody = (await foreignRes.json()) as { error?: string };
  ok(
    foreignRes.status === 403 && foreignBody.error === "Kein Zugriff.",
    "a comp login cannot submit someone else's document",
  );
  ok(foreign.stripeCalls.n === 0 && foreign.pdfs.n === 0, "a foreign document does not use the comp entitlement");
  ok(foreignRows.length === 0, "a foreign document stores nothing");
}

async function checkMailsStaySilent() {
  const welcome = await deliverBuyerOnboarding({
    email: ` ${COMP.toUpperCase()} `,
    sessionId: "cs_live_comp_must_not_mail",
    company: COMPANY,
  });
  ok(welcome === "skipped", "buyer onboarding does not send for the comp mailbox");

  const triggered = await triggerOnboardingMail({
    email: COMP,
    sessionId: "cs_live_comp_must_not_mail",
    company: COMPANY,
  });
  ok(triggered.skipped === true && triggered.sent === false, "the onboarding mailer returns before a send");

  const delivery = await sendDeliveryMail({
    email: COMP,
    company: COMPANY,
    downloadUrl: "https://www.gobd-doku-erstellen.de/api/docs/example/download",
    documentId: "doc-comp-silent",
    version: 1,
  });
  ok(delivery.skipped === true && delivery.sent === false, "the delivery mailer returns before a send");

  ok(isPilotPaymentFailedExempt(COMP), "the payment-failed exemption still covers this mailbox");
  const failed = await handleFailedPayment({
    email: COMP,
    invoiceId: "in_comp_silent",
    eventId: "evt_comp_silent",
  });
  ok(failed.skipped === true && failed.sent === false, "payment-failed stays silent");

  const magicRoute = readFileSync("app/api/auth/magic-link/route.ts", "utf8");
  ok(magicRoute.includes("deliverLoginLink"), "login still sends the magic link when requested");
  ok(!magicRoute.includes("isCompAccessEmail"), "the login route does not special-case comp");
  ok(!magicRoute.includes("triggerOnboardingMail"), "login does not send onboarding");
  const ops = readFileSync("lib/ops.ts", "utf8");
  const magicFn = ops.slice(ops.indexOf("export async function sendMagicLinkMail"));
  ok(magicFn.includes("MAGIC_LINK_WINDOW_MS"), "the login link keeps its throttle");
  ok(!magicFn.includes("isCompAccessEmail"), "the login mailer is not suppressed for comp");
  const onboardingFn = ops.slice(
    ops.indexOf("export async function triggerOnboardingMail"),
    ops.indexOf("export async function handleFailedPayment"),
  );
  ok(
    onboardingFn.indexOf("isCompAccessEmail") < onboardingFn.indexOf("sendDedupedEmail"),
    "onboarding returns before the send",
  );
}

async function checkDeliveryPlan() {
  const calls = { n: 0 };
  const allowed = await postDelivery(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: loginCookie(COMP),
      },
      body: JSON.stringify({ answers: answers() }),
    }),
    {
      lookup: {
        findDocumentById: async () => null,
        listDocumentFamily: async () => [],
        findLatestDocumentByStripeSessionId: async () => null,
      },
      resolveCheckout: async () => {
        calls.n += 1;
        return { error: "invalid" as const };
      },
    },
  );
  ok(allowed.status === 200, `comp PDF plan without a session is 200 (got ${allowed.status})`);
  ok(calls.n === 0, "a comp plan without a session does not ask Stripe");

  const denied = await postDelivery(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: loginCookie(COMP),
      },
      body: JSON.stringify({ sessionId: TEST_SESSION, answers: answers() }),
    }),
    {
      lookup: {
        findDocumentById: async () => null,
        listDocumentFamily: async () => [],
        findLatestDocumentByStripeSessionId: async () => null,
      },
      resolveCheckout: async () => {
        calls.n += 1;
        return { error: "invalid" as const };
      },
    },
  );
  ok(denied.status === 401, "cs_test_ does not authorize the delivery plan");
  ok(calls.n === 1, "the test-mode id is still resolved, not treated as payment");
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    if (ch < "A" || ch > "Z") break;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function sliceGrid(grid: string[][], range: string): string[][] {
  const bang = range.indexOf("!");
  const spec = bang >= 0 ? range.slice(bang + 1) : range;
  const [start, end] = spec.split(":");
  const startMatch = /^([A-Z]+)(\d+)$/.exec(start ?? "");
  if (!startMatch) return [];
  const startCol = colIndex(startMatch[1] ?? "A");
  const startRow = Number(startMatch[2]);
  let endCol = startCol;
  let endRow = grid.length;
  if (end) {
    const endMatch = /^([A-Z]+)(\d+)?$/.exec(end);
    if (endMatch) {
      endCol = colIndex(endMatch[1] ?? "A");
      if (endMatch[2]) endRow = Number(endMatch[2]);
    }
  }
  const rows: string[][] = [];
  for (let row = startRow - 1; row < endRow && row < grid.length; row += 1) {
    const line = grid[row] ?? [];
    const cells: string[] = [];
    for (let col = startCol; col <= endCol; col += 1) cells.push(line[col] ?? "");
    rows.push(cells);
  }
  return rows;
}

/**
 * The account hub keeps an entity snapshot for 45s on each instance.
 * „Firma anlegen“ appends on whichever instance handles the POST, then
 * /account often renders somewhere else. A warm snapshot must not hide the row.
 */
async function checkFirmaCreate() {
  const fallback = "Die Firma konnte nicht angelegt werden. Bitte versuchen Sie es erneut.";
  ok(firmaSaveError({ ok: true }, fallback) === fallback, "ok without a company id is not a success");
  ok(
    firmaSaveError({ ok: true, entity: { entityId: "ent-saved" } }, fallback) === null,
    "a stored company id may leave the form",
  );
  ok(
    firmaSaveError({ ok: false, error: "Bitte anmelden." }, fallback) === "Bitte anmelden.",
    "a rejected save keeps the server message",
  );
  ok(
    customerFacingSaveError(new Error("Request failed with status code 403"), fallback) === fallback,
    "a Sheets client error is replaced by the Sie-Form sentence",
  );
  ok(
    customerFacingSaveError(new EntityLimitError(5), fallback).startsWith("Maximal "),
    "the company limit stays the existing sentence",
  );
  const form = readFileSync("app/account/firma/firma-form.tsx", "utf8");
  ok(form.includes("firmaSaveError"), "the form stays on the page unless the company was stored");
  ok(
    form.includes(fallback),
    "a failed create shows the Sie-Form error",
  );
  ok(
    form.indexOf("firmaSaveError") < form.indexOf('router.push("/account")'),
    "the redirect is not reached when the save failed",
  );

  const saved = {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    sheet: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    vercel: process.env.VERCEL,
    smoke: process.env.GOBD_BLOB_SMOKE,
  };
  const header = [...ENTITY_SHEET_COLUMNS];
  const existing = toEntity(OTHER, { name: "Bestehende GmbH" }, "ent-paid", "2026-10-01T00:00:00.000Z");
  const grid: string[][] = [header, entitySheetValues(existing, header)];
  let failAppend = false;
  const ops: string[] = [];
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheets@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "test-key";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
  process.env.VERCEL = "1";
  delete process.env.GOBD_BLOB_SMOKE;
  clearAllSheetReadCaches();
  installSheetsHandler(async ({ op, args }) => {
    ops.push(op);
    const range = typeof args.range === "string" ? args.range : "";
    const ranges = Array.isArray(args.ranges) ? (args.ranges as string[]) : [];
    if (op === "spreadsheets.get") {
      return { data: { sheets: [{ properties: { title: "entities" } }] } };
    }
    if (op === "values.batchGet") {
      return { data: { valueRanges: ranges.map((item) => ({ values: sliceGrid(grid, item) })) } };
    }
    if (op === "values.get") return { data: { values: sliceGrid(grid, range) } };
    if (op === "values.append") {
      if (failAppend) {
        const error = new Error("quota") as Error & { response?: { status: number } };
        error.response = { status: 503 };
        throw error;
      }
      const body = args.requestBody as { values?: string[][] } | undefined;
      for (const row of body?.values ?? []) grid.push(row);
      return { data: { updates: { updatedRows: body?.values?.length ?? 0 } } };
    }
    if (op === "values.update" || op === "values.batchUpdate" || op === "spreadsheets.batchUpdate") {
      return { data: {} };
    }
    throw new Error(`unexpected sheets op ${op}`);
  });
  try {
    const headerCache = createTtlSingleflight<string[]>(Number.POSITIVE_INFINITY);
    const valuesCache = createTtlSingleflight<string[][]>(45_000);
    headerCache.remember(header);
    valuesCache.remember([["stale-id", "stale@example.com", "Stale GmbH"]]);
    const fresh = await readCachedGrid({
      tab: "entities",
      op: "entities",
      headerRange: "A1:AZ1",
      valuesRange: "A2:AZ",
      headerCache,
      valuesCache,
      reuseValues: false,
    });
    ok(
      fresh.values.every((row) => row[0] !== "stale-id"),
      "a company read does not reuse the previous instance snapshot",
    );
    const blankHeader = createTtlSingleflight<string[]>(Number.POSITIVE_INFINITY);
    blankHeader.remember([]);
    const blankValues = createTtlSingleflight<string[][]>(45_000);
    blankValues.remember([["ent-hidden", COMP, "Versteckt GmbH"]]);
    const reread = await readCachedGrid({
      tab: "entities",
      op: "entities",
      headerRange: "A1:AZ1",
      valuesRange: "A2:AZ",
      headerCache: blankHeader,
      valuesCache: blankValues,
      reuseValues: false,
    });
    ok(reread.header[0] === "entity_id", "a blank cached header is not reused");

    ok((await listEntitiesByEmail(COMP)).length === 0, "the comp mailbox starts without a company");
    const sneaked = toEntity(
      COMP,
      { name: "Comp Smoke Test GmbH", street: "Teststraße 1", zip: "10115", city: "Berlin" },
      "ent-sneak",
      "2026-10-13T08:00:00.000Z",
    );
    grid.push(entitySheetValues(sneaked, header));
    const afterOtherInstance = await listEntitiesByEmail(COMP);
    ok(
      afterOtherInstance.some((row) => row.entityId === "ent-sneak" && row.city === "Berlin"),
      "a company appended on another instance is visible on the next account read",
    );
    ok(
      (await listEntitiesByEmail(OTHER)).some((row) => row.entityId === "ent-paid") &&
        (await listEntitiesByEmail(OTHER)).every((row) => row.userEmail === OTHER),
      "another mailbox still sees only its own company",
    );

    const created = await createEntity(
      COMP,
      { name: "Comp Smoke Test GmbH", street: "Teststraße 1", zip: "10115", city: "Berlin", stnr: "", ustId: "" },
      { checkoutPrefill: "done" },
    );
    ok(created.backend === "sheets", "a comp mailbox writes the company sheet, not a file");
    ok(created.entity.userEmail === COMP, "the stored company belongs to the comp login");
    ok(created.entity.checkoutPrefill === "done", "saving the form settles checkout prefill");
    ok(!ops.some((op) => op.toLowerCase().includes("stripe")), "creating a company does not call Stripe");
    const listed = await listEntitiesByEmail(COMP);
    ok(
      listed.some(
        (row) =>
          row.entityId === created.entity.entityId &&
          row.name === "Comp Smoke Test GmbH" &&
          row.street === "Teststraße 1" &&
          row.zip === "10115" &&
          row.city === "Berlin" &&
          row.stnr === "" &&
          row.ustId === "",
      ),
      "the account list returns the company the form just saved",
    );
    ok(listed.every((row) => row.userEmail === COMP), "the comp list does not include the other mailbox");

    const paid = await createEntity(OTHER, {
      name: "Weitere GmbH",
      street: "Hafenweg 2",
      zip: "20095",
      city: "Hamburg",
    });
    ok(paid.entity.userEmail === OTHER, "a non-comp mailbox still creates a company");
    ok(
      (await listEntitiesByEmail(OTHER)).some((row) => row.entityId === paid.entity.entityId) &&
        (await listEntitiesByEmail(COMP)).every((row) => row.entityId !== paid.entity.entityId),
      "the new company stays on the mailbox that created it",
    );

    failAppend = true;
    await assert.rejects(
      () => createEntity(COMP, { name: "Unsichtbar GmbH" }),
      (error: unknown) => error instanceof SheetsUnavailableError,
      "a Sheets failure is not stored as a successful company",
    );
    ok(
      (await listEntitiesByEmail(COMP)).every((row) => row.name !== "Unsichtbar GmbH"),
      "the failed save does not show up as a company",
    );
  } finally {
    installSheetsHandler(null);
    clearAllSheetReadCaches();
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("GOOGLE_SERVICE_ACCOUNT_EMAIL", saved.email);
    restore("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", saved.key);
    restore("GOOGLE_SHEETS_SPREADSHEET_ID", saved.sheet);
    restore("VERCEL", saved.vercel);
    restore("GOBD_BLOB_SMOKE", saved.smoke);
  }
}

checkAllowlist();
checkAccountUi();
checkCheckoutGuard()
  .then(() => checkSubmit())
  .then(() => checkMailsStaySilent())
  .then(() => checkDeliveryPlan())
  .then(() => checkFirmaCreate())
  .then(() => {
    console.log("check-comp-access: green");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
