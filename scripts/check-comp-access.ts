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
import { postDelivery } from "../app/api/delivery/route";
import { submitIntake, type IntakeIo } from "../app/api/intake/route";
import { AccountAboCard } from "../components/account-abo";
import { AccountBillingStatus } from "../components/account-billing";
import { AccountCompanyCard } from "../components/account-company-card";
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
  compIntakePath,
  firmaAnlegenAllowed,
  isCompAccessEmail,
} from "../lib/comp-access";
import { canAccessDocument } from "../lib/documents";
import { emptyEntity } from "../lib/entities";
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
  ok(COMP_ACCESS_EMAILS.length === 2, "the allowlist is the approved mailbox plus the smoke address");
  ok(COMP_ACCESS_EMAILS[0] === COMP, "the mailbox is winkler@winkler-segtrop.de");
  ok(
    COMP_ACCESS_EMAILS[1] === "gobd-test@mail.grokbot.com" &&
      isCompAccessEmail("GOBD-TEST@mail.grokbot.com"),
    "the temporary smoke address is entitled",
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

  const account = readFileSync("app/account/page.tsx", "utf8");
  ok(account.includes("Firma anlegen"), "the hub still offers Firma anlegen");
  ok(account.includes("isCompAccessEmail"), "the hub checks the allowlist");
  const entities = readFileSync("app/api/entities/route.ts", "utf8");
  ok(entities.includes("firmaAnlegenAllowed"), "Firma anlegen uses the login gate");
  ok(!entities.includes("resolveCheckoutSession"), "Firma anlegen does not ask Stripe");
  const intake = readFileSync("app/intake/page.tsx", "utf8");
  ok(intake.includes("isCompAccessEmail"), "intake start checks the allowlist");
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

checkAllowlist();
checkAccountUi();
checkSubmit()
  .then(() => checkMailsStaySilent())
  .then(() => checkDeliveryPlan())
  .then(() => {
    console.log("check-comp-access: green");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
