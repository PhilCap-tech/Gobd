/**
 * One active subscription covers firms 1–5. Firm 6 stays on checkout.
 * past_due, canceled, and a cs_test_ id alone do not. A non-owner is denied.
 *
 *   npx tsx scripts/check-subscription-coverage.ts
 *
 * No network, no Sheet write, no mail send.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { submitIntake, type IntakeIo } from "../app/api/intake/route";
import { AccountBillingStatus } from "../components/account-billing";
import { AccountCompanyCard } from "../components/account-company-card";
import { SESSION_COOKIE, createSessionToken } from "../lib/auth";
import { newDocumentPath } from "../lib/documents";
import { emptyEntity, MAX_ENTITIES_PER_ACCOUNT, type Entity } from "../lib/entities";
import {
  EXTRA_FIRM_NOTE,
  coveredIntakePath,
  emptyIncludedFirmCoverage,
  firmDocumentHref,
  firmPosition,
  firmStartDecision,
  includedFirmsOpen,
  storedPaidEntitlementRow,
  type IncludedFirmCoverage,
} from "../lib/subscription-coverage";
import { emptyAnswers, emptySheetRow, type IntakeAnswers, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const OWNER = "buyer.coverage@example.com";
const OTHER = "other.coverage@example.com";
const CUSTOMER = "cus_coverage_owner";

function coverage(overrides: Partial<IncludedFirmCoverage> = {}): IncludedFirmCoverage {
  return {
    hasStoredPaidEntitlement: true,
    subscriptionStatuses: ["active"],
    lookupFailed: false,
    stripeCustomerId: CUSTOMER,
    ...overrides,
  };
}

function firm(id: string, email = OWNER): Entity {
  return {
    ...emptyEntity(),
    entityId: id,
    userEmail: email,
    name: `Firma ${id}`,
    createdAt: `2026-01-${id.slice(-2).padStart(2, "0")}T00:00:00.000Z`,
  };
}

function decide(
  position: number,
  row: IncludedFirmCoverage,
  owner = OWNER,
  session = OWNER,
  entityId = `ent-${position}`,
) {
  return firmStartDecision({
    sessionEmail: session,
    entityOwnerEmail: owner,
    entityId,
    firmPosition: position,
    coverage: row,
  });
}

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

function intakeIo(input: {
  firms: Entity[];
  coverage: IncludedFirmCoverage;
  rows: SheetRow[];
}) {
  const stripeCalls = { n: 0 };
  const coverageCalls = { n: 0 };
  const pdfs = { n: 0 };
  const io: IntakeIo = {
    findDocumentById: async () => null,
    listDocumentFamily: async () => [],
    findLatestDocumentByStripeSessionId: async () => null,
    listEntitiesByEmail: async (email) => input.firms.filter((row) => row.userEmail === email),
    getOwnedEntity: async (entityId, email) =>
      input.firms.find((row) => row.entityId === entityId && row.userEmail === email) ?? null,
    findLatestStripeCustomerIdByEmail: async () => {
      stripeCalls.n += 1;
      return CUSTOMER;
    },
    findRowByStripeSessionId: async () => null,
    includedFirmCoverage: async () => {
      coverageCalls.n += 1;
      return input.coverage;
    },
    resolveCheckoutSession: async () => {
      stripeCalls.n += 1;
      return { error: "missing" as const };
    },
    prepareDurableIntakeRow: async (row) => row,
    appendRecord: async (row) => {
      const stored = { ...emptySheetRow(), ...row };
      input.rows.push(stored);
      return { backend: "file", row: stored };
    },
    generatePdf: async (pdfInput) => {
      pdfs.n += 1;
      return {
        buffer: Buffer.from("%PDF-1.4\n"),
        documentId: pdfInput.documentId || "pdf",
        plan: { status: "ready", chapters: [], openItems: [], pdf: null },
      };
    },
    storePdf: async () => ({ url: "", pathname: "memory/coverage.pdf", backend: "file" as const }),
    sendDeliveryMail: async () => ({ stub: true, sent: false, action: "delivery" as const }),
    deliverLoginLink: async () => "sent" as const,
  };
  return { io, stripeCalls, coverageCalls, pdfs };
}

const ordered = ["ent-1", "ent-2", "ent-3", "ent-4", "ent-5", "ent-6"].map((id) => firm(id));
ok(firmPosition(ordered, "ent-2") === 2, "the second firm is position 2");
ok(firmPosition(ordered, "ent-5") === 5, "the fifth firm is position 5");
ok(firmPosition(ordered, "ent-6") === 6, "the sixth firm is position 6");
ok(firmPosition(ordered, "missing") === 0, "a firm outside the list has no position");

const active = coverage();
for (const position of [2, 3, 4, 5]) {
  const decision = decide(position, active);
  ok(decision === "intake", `active subscription: firm ${position} leads to intake`);
  ok(
    firmDocumentHref(decision, `ent-${position}`) === coveredIntakePath(`ent-${position}`),
    `firm ${position} href is /intake?modus=gesamt&entity_id=`,
  );
  ok(
    coveredIntakePath(`ent-${position}`).includes("modus=gesamt"),
    `firm ${position} intake is the Gesamtdokument`,
  );
  ok(
    !coveredIntakePath(`ent-${position}`).includes("session_id"),
    `firm ${position} intake has no checkout session`,
  );
}
ok(decide(1, active) === "intake", "the first firm of an active subscription is covered too");
ok(decide(6, active) === "checkout", "the sixth firm stays on checkout");
ok(
  firmDocumentHref("checkout", "ent-6") === newDocumentPath("ent-6"),
  "the sixth firm href is the existing checkout",
);

ok(
  decide(2, coverage({ subscriptionStatuses: ["trialing"] })) === "intake",
  "trialing counts as active, same as the billing status helper",
);
ok(
  decide(2, coverage({ subscriptionStatuses: ["past_due"] })) === "checkout",
  "past_due does not cover further firms",
);
ok(
  decide(2, coverage({ subscriptionStatuses: ["active", "past_due"] })) === "checkout",
  "a past_due subscription keeps the billing status off active",
);
ok(
  decide(2, coverage({ subscriptionStatuses: ["unpaid"] })) === "checkout",
  "unpaid, the ended past_due state, does not cover further firms",
);
ok(
  decide(2, coverage({ subscriptionStatuses: ["canceled"] })) === "checkout",
  "a canceled subscription does not cover further firms",
);
ok(
  decide(2, coverage({ subscriptionStatuses: [] })) === "checkout",
  "no subscription status does not cover further firms",
);
ok(
  decide(2, coverage({ hasStoredPaidEntitlement: false, subscriptionStatuses: ["active"] })) ===
    "checkout",
  "an active status without a stored paid row does not cover further firms",
);
ok(
  decide(2, coverage({ lookupFailed: true })) === "checkout",
  "a failed subscription lookup does not cover further firms",
);
ok(!includedFirmsOpen(emptyIncludedFirmCoverage()), "an empty coverage record is closed");

ok(!storedPaidEntitlementRow(null), "no row is not a stored entitlement");
ok(
  !storedPaidEntitlementRow({ status: "" }),
  "a cs_test_ id without a paid status is not a stored entitlement",
);
ok(
  !storedPaidEntitlementRow({ status: "paid_stub" }),
  "a stub status is not a stored entitlement",
);
ok(
  storedPaidEntitlementRow({ status: "paid" }),
  "a stored paid row is the entitlement, not the session id",
);
ok(storedPaidEntitlementRow({ status: "intake_submitted" }), "a submitted intake row is stored payment");

ok(decide(2, active, OWNER, OTHER) === "denied", "another mailbox does not get the firm");
ok(decide(2, active, OWNER, "") === "denied", "a missing login does not get the firm");
ok(decide(0, active) === "denied", "a firm the owner does not have is denied");
ok(firmDocumentHref("denied", "ent-2") === "", "a denied firm has no intake and no checkout href");

const coveredCard = renderToStaticMarkup(
  createElement(AccountCompanyCard, {
    email: OWNER,
    empty: true,
    coveredIntakeHref: coveredIntakePath("ent-2"),
    group: { entity: firm("ent-2"), families: [] },
  }),
);
ok(coveredCard.includes("/intake?"), "Neues Dokument on a covered firm opens intake");
ok(coveredCard.includes("modus=gesamt"), "the covered card keeps the Gesamtdokument");
ok(coveredCard.includes("entity_id=ent-2"), "the covered card names the firm");
ok(!coveredCard.includes("/checkout"), "the covered card does not open checkout");
ok(/<a\b[^>]*>Neues Dokument<\/a>/.test(coveredCard), "Neues Dokument stays a native anchor");

const sixthCard = renderToStaticMarkup(
  createElement(AccountCompanyCard, {
    email: OWNER,
    empty: true,
    extraFirmNote: true,
    group: { entity: firm("ent-6"), families: [] },
  }),
);
ok(sixthCard.includes("/checkout?entity_id=ent-6"), "the sixth firm card stays on checkout");
ok(sixthCard.includes(EXTRA_FIRM_NOTE), "the sixth firm card names the extra subscription");
ok(EXTRA_FIRM_NOTE.includes("Sie") || EXTRA_FIRM_NOTE.includes("Ihr"), "the note uses Sie");
ok(
  ["v2", "v3"].includes((process.env.PRICING_MODEL ?? "").trim().toLowerCase())
    ? EXTRA_FIRM_NOTE === "Für jede weitere Firma legen Sie bitte ein eigenes Konto mit einer eigenen E-Mail-Adresse an."
    : EXTRA_FIRM_NOTE.includes(String(MAX_ENTITIES_PER_ACCOUNT)),
  "the note names the included firm count (v3: one-firm text)",
);

const ordinaryCard = renderToStaticMarkup(
  createElement(AccountCompanyCard, {
    email: OTHER,
    empty: true,
    group: { entity: firm("ent-2", OTHER), families: [] },
  }),
);
ok(ordinaryCard.includes("/checkout?entity_id=ent-2"), "without coverage the card still starts at checkout");
ok(!ordinaryCard.includes(EXTRA_FIRM_NOTE), "a firm inside the five does not show the extra-firm note");

const billing = renderToStaticMarkup(
  createElement(AccountBillingStatus, {
    status: "active",
    stripeReady: true,
    hasCustomer: true,
    lookupFailed: false,
  }),
);
ok(billing.includes(EXTRA_FIRM_NOTE), "billing states the five-firm rule");
ok(!billing.includes("nicht pro"), "billing no longer says the price is never per firm");

const checkoutPage = readFileSync("app/checkout/page.tsx", "utf8");
ok(checkoutPage.includes("redirect(coveredIntakePath("), "checkout redirects a covered firm on the server");
const checkoutApi = readFileSync("app/api/checkout/route.ts", "utf8");
const compApi = checkoutApi.indexOf("compCheckoutRedirect");
const coveredApi = checkoutApi.indexOf("coveredIntakePath");
const createApi = checkoutApi.indexOf("createCheckoutSession");
ok(
  compApi > 0 && coveredApi > compApi && createApi > coveredApi,
  "checkout API sends a covered firm to intake before Stripe",
);
ok(checkoutPage.includes("!isCompAccessEmail(email)"), "checkout leaves comp mailboxes on their own path");
ok(!checkoutPage.includes('from "next/link"'), "the checkout page does not client-navigate the redirect");

const intakePage = readFileSync("app/intake/page.tsx", "utf8");
ok(intakePage.includes("firmStartDecision"), "intake decides coverage on the server");
ok(intakePage.includes("!isCompAccessEmail(sessionEmail)"), "intake leaves the comp start path in place");
ok(intakePage.includes('decision === "denied"'), "a non-owner does not get the questionnaire");
ok(intakePage.includes('decision === "checkout"'), "an uncovered firm is sent back to checkout");

const intakeRoute = readFileSync("app/api/intake/route.ts", "utf8");
const compAt = intakeRoute.indexOf("isCompAccessEmail(sessionEmail)");
const coveredAt = intakeRoute.indexOf("io.includedFirmCoverage");
ok(compAt > 0 && coveredAt > compAt, "comp access is decided before included-firm coverage");
ok(
  intakeRoute.includes("!sessionId && sessionEmail && requestedEntity && io.includedFirmCoverage"),
  "included-firm submit ignores a checkout session id",
);

const storeSource = readFileSync("lib/store.ts", "utf8");
ok(
  !storeSource.includes("new EntityLimitError"),
  "a sixth firm can be stored; checkout is the gate",
);

const accountPage = readFileSync("app/account/page.tsx", "utf8");
ok(accountPage.includes("!compAccess && group.entity"), "the account hub does not apply coverage to comp");
ok(accountPage.includes("coveredIntakeHref"), "the account hub passes the intake href");

const cardSource = readFileSync("components/account-company-card.tsx", "utf8");
ok(
  /compAccess\s*\?\s*compIntakePath\(entity\.entityId\)\s*:\s*coveredIntakeHref \|\| newDocumentPath\(entity\.entityId\)/.test(
    cardSource,
  ),
  "comp keeps its intake path; coverage only replaces checkout",
);

async function submit(position: number, row: IncludedFirmCoverage, session = OWNER) {
  const rows: SheetRow[] = [];
  const firms = ordered.filter((item) => Number(item.entityId.slice(4)) <= Math.max(position, 1));
  const harness = intakeIo({ firms, coverage: row, rows });
  const response = await submitIntake(
    postIntake(loginCookie(session), {
      email: OTHER,
      company: "Fremd GmbH",
      entityId: `ent-${position}`,
      answers: answers(),
    }),
    harness.io,
  );
  const body = (await response.json()) as { error?: string; documentId?: string };
  return { response, body, rows, ...harness };
}

async function checkSubmit() {
  const second = await submit(2, active);
  ok(second.response.status === 200, `firm 2 submit is 200 (got ${second.response.status} ${second.body.error ?? ""})`);
  ok(second.pdfs.n === 1, "firm 2 submit writes a PDF without a new checkout");
  ok(second.stripeCalls.n === 0, "firm 2 submit does not ask Stripe for a session");
  ok(second.rows[0]?.entityId === "ent-2", "firm 2 submit keeps the company");
  ok(second.rows[0]?.email === OWNER, "firm 2 submit keeps the logged-in owner");
  ok(second.rows[0]?.stripeSessionId === "", "firm 2 submit does not invent a checkout session");
  ok(second.rows[0]?.stripeCustomerId === CUSTOMER, "firm 2 submit keeps the stored customer");
  ok(!second.body.documentId?.startsWith("cs_test_"), "the document id is not a test checkout id");

  const fifth = await submit(5, active);
  ok(fifth.response.status === 200, "firm 5 submit is allowed");
  ok(fifth.rows[0]?.entityId === "ent-5", "firm 5 submit binds that company");

  const sixth = await submit(6, active);
  ok(sixth.response.status === 401, `firm 6 submit stays on the checkout gate (got ${sixth.response.status})`);
  ok(sixth.pdfs.n === 0, "firm 6 submit does not write a PDF");
  ok(sixth.body.error === "Checkout-Session fehlt.", "firm 6 keeps the missing-checkout copy");

  const due = await submit(3, coverage({ subscriptionStatuses: ["past_due"] }));
  ok(due.response.status === 401, "past_due firm 3 stays on the checkout gate");
  ok(due.pdfs.n === 0, "past_due does not write a PDF");

  const ended = await submit(4, coverage({ subscriptionStatuses: ["canceled"] }));
  ok(ended.response.status === 401, "a canceled subscription does not open firm 4");

  const foreign = await submit(2, active, OTHER);
  ok(foreign.response.status === 403, `a non-owner is denied (got ${foreign.response.status})`);
  ok(foreign.pdfs.n === 0, "a non-owner does not write a PDF");
  ok(foreign.coverageCalls.n === 0, "a non-owner does not receive the coverage decision");
  ok(foreign.body.error === "Kein Zugriff.", "a non-owner gets no access");

  const bare = await submit(2, coverage({ hasStoredPaidEntitlement: false }));
  ok(bare.response.status === 401, "without a stored paid row the firm stays on checkout");

  const testOnly = intakeIo({ firms: ordered.slice(0, 2), coverage: active, rows: [] });
  const testRes = await submitIntake(
    postIntake(loginCookie(OWNER), {
      sessionId: "cs_test_coverage_alone",
      email: OWNER,
      company: "Firma ent-2",
      entityId: "ent-2",
      answers: answers(),
    }),
    testOnly.io,
  );
  const testBody = (await testRes.json()) as { error?: string };
  ok(testRes.status !== 200, "cs_test_ alone does not submit a covered firm");
  ok(testOnly.coverageCalls.n === 0, "cs_test_ alone does not use included-firm coverage");
  ok(testOnly.pdfs.n === 0, "cs_test_ alone does not write a PDF");
  ok(Boolean(testBody.error), "cs_test_ alone returns an error");
}

checkSubmit()
  .then(() => {
    console.log("check-subscription-coverage: green");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
