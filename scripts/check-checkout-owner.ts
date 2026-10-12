/**
 * Checkout belongs to the buyer, logout expires only the cookies that were
 * set, and an unauthenticated draft delete removes nothing.
 *
 *   npx tsx scripts/check-checkout-owner.ts
 *
 * Synthetic @example.com only. No Stripe, no Resend, no production data.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POST as logout } from "../app/api/auth/logout/route";
import { completeCheckoutHandoff } from "../app/api/auth/checkout-handoff/route";
import { completeCheckoutGrant } from "../app/api/checkout/grant/route";
import { deleteIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { accountCompanyCards } from "../lib/account-hub";
import {
  PAID_INTAKE_LABEL,
  paidIntakePathForOwner,
  undocumentedPaidSessionId,
} from "../lib/account-paid-intake";
import { authCookieDeletionLines, SESSION_COOKIE, createSessionToken } from "../lib/auth";
import { deliverBuyerOnboarding, forgetBuyerOnboarding } from "../lib/buyer-onboarding";
import { boundCheckoutEntityId, checkoutEntityIdForEmail } from "../lib/checkout-entity";
import { ensureBuyerFirmForCheckout, type BuyerFirmStore } from "../lib/checkout-firm";
import { forgetCheckoutSessionGrant } from "../lib/checkout-session-grant";
import { toEntity, type Entity, type EntityInput } from "../lib/entities";
import { emptyAnswers, emptySheetRow, emailsEqual } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer.c@example.com";
const OWNER_A = "owner.a@example.com";
const OTHER = "session.other@example.com";
const FOREIGN = "17d54c7c-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC = "4ec861e1-f37c-4c99-8f11-72af8a819225";

function memoryFirms() {
  const firms: Entity[] = [];
  const store: BuyerFirmStore = {
    async getEntity(id) {
      return firms.find((firm) => firm.entityId === id) ?? null;
    },
    async listEntitiesByEmail(email) {
      return firms.filter((firm) => emailsEqual(firm.userEmail, email));
    },
    async createEntity(email, input: EntityInput, options) {
      const entity = toEntity(email, input, `firm-${firms.length + 1}`);
      entity.checkoutPrefill = options?.checkoutPrefill === "review" ? "review" : "";
      firms.push(entity);
      return { entity };
    },
    async updateEntity(id, input, email, options) {
      const entity = firms.find((firm) => firm.entityId === id);
      if (!entity || (email && !emailsEqual(entity.userEmail, email))) return null;
      if (input.city !== undefined) entity.city = input.city;
      if (input.street !== undefined) entity.street = input.street;
      if (input.zip !== undefined) entity.zip = input.zip;
      if (input.name !== undefined) entity.name = input.name;
      if (options?.checkoutPrefill) entity.checkoutPrefill = options.checkoutPrefill;
      return entity;
    },
  };
  return { firms, store };
}

function draftIo(cleared: string[]): DraftWriteIo {
  return {
    async loadIntakeDraft() {
      return null;
    },
    async saveIntakeDraft() {
      throw new Error("save");
    },
    async clearIntakeDraft(key) {
      cleared.push(key);
    },
    lookup: {
      async findDocumentById() {
        return null;
      },
      async listDocumentFamily() {
        return [];
      },
      async findLatestDocumentByStripeSessionId() {
        return null;
      },
    },
    async resolveCheckout() {
      return { error: "missing" };
    },
  };
}

async function checkBinding() {
  ok(
    boundCheckoutEntityId({
      checkoutEmail: BUYER,
      entityId: FOREIGN,
      entityOwnerEmail: OWNER_A,
      sessionEmail: OWNER_A,
      dropWhenSessionDiffers: true,
    }) === "",
    "a session for A does not bind A's firm to buyer C",
  );
  ok(
    boundCheckoutEntityId({
      checkoutEmail: BUYER,
      entityId: FOREIGN,
      entityOwnerEmail: OWNER_A,
    }) === "",
    "webhook and grant ignore an entity owned by someone else",
  );
  ok(
    boundCheckoutEntityId({
      checkoutEmail: BUYER,
      entityId: "firm-buyer",
      entityOwnerEmail: BUYER,
      sessionEmail: BUYER,
      dropWhenSessionDiffers: true,
    }) === "firm-buyer",
    "the buyer's own firm stays on the checkout",
  );
  ok(
    checkoutEntityIdForEmail({
      typedEmail: BUYER,
      sessionEmail: OWNER_A,
      entityId: FOREIGN,
    }) === "",
    "changing the checkout email drops the prefilled firm",
  );
  ok(
    checkoutEntityIdForEmail({
      typedEmail: OWNER_A,
      sessionEmail: OWNER_A,
      entityId: FOREIGN,
    }) === FOREIGN,
    "the session email keeps its own firm",
  );

  const memory = memoryFirms();
  memory.firms.push(toEntity(OWNER_A, { name: "Firma A", city: "Berlin" }, FOREIGN));
  const created = await ensureBuyerFirmForCheckout(
    { email: BUYER, company: "Neue GmbH", entityId: FOREIGN, city: "Hamburg", zip: "20095" },
    memory.store,
  );
  ok(created !== FOREIGN && created.startsWith("firm-"), "a foreign entity id creates the buyer's firm");
  const firm = memory.firms.find((row) => row.entityId === created);
  ok(firm?.userEmail === BUYER && firm.city === "Hamburg", "the new firm carries at least the city");
  ok(firm?.checkoutPrefill === "review", "the billing address is marked for review");
  ok(memory.firms.filter((row) => emailsEqual(row.userEmail, OWNER_A)).length === 1, "A's firm is left as it was");
  const again = await ensureBuyerFirmForCheckout(
    { email: BUYER, company: "Neue GmbH", entityId: FOREIGN, city: "Hamburg" },
    memory.store,
  );
  ok(again === created && memory.firms.length === 2, "a second bind does not create another firm");

  const page = readFileSync("app/checkout/page.tsx", "utf8");
  ok(!page.includes("|| requestedEntityId"), "checkout does not prefill an unowned entity id");
  ok(readFileSync("app/checkout/checkout-form.tsx", "utf8").includes("checkoutEntityIdForEmail"), "the form drops the firm when the email changes");
  ok(readFileSync("app/api/checkout/route.ts", "utf8").includes("boundCheckoutEntityId"), "checkout creation checks the owner on the server");
  ok(readFileSync("app/api/stripe/webhook/route.ts", "utf8").includes("ensureBuyerFirmForCheckout"), "the webhook binds the firm to the checkout email");
  const intake = readFileSync("app/intake/page.tsx", "utf8");
  ok(intake.includes("stripeOwned"), "intake does not keep a Stripe entity id the buyer does not own");
}

async function checkLogout() {
  const lines = authCookieDeletionLines("https://www.gobd-doku-erstellen.de/api/auth/logout");
  ok(lines.length === 4, `logout prepares 4 expirations, not a matrix (got ${lines.length})`);
  ok(lines.every((line) => !/domain=/i.test(line) && line.includes("Path=/;")), "expirations are host-only and Path=/");
  const response = await logout(
    new Request("https://www.gobd-doku-erstellen.de/api/auth/logout", { method: "POST" }),
  );
  ok(response.status === 303, "logout returns 303");
  ok((response.headers.get("location") ?? "").endsWith("/login"), "logout lands on /login");
  ok(response.headers.getSetCookie().length === 4, "the response carries only those four Set-Cookie lines");
  const route = readFileSync("app/api/auth/logout/route.ts", "utf8");
  ok(route.includes("export async function POST"), "logout is a POST route handler");
  ok(!route.includes("purgeContractData") && !route.includes("clearIntakeDraft"), "logout does not delete documents or drafts");
}

async function checkDraftDelete() {
  const cleared: string[] = [];
  const anon = await deleteIntakeDraft(
    new Request(`http://localhost/api/intake/draft?draftKey=${encodeURIComponent("cs_test_other_session")}`),
    draftIo(cleared),
  );
  ok(anon.status === 401, "DELETE without a session is 401");
  ok(cleared.length === 0, "DELETE without a session removes nothing");

  const foreign = await deleteIntakeDraft(
    new Request(`http://localhost/api/intake/draft?draftKey=${encodeURIComponent("cs_test_other_session")}`, {
      headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}` },
    }),
    draftIo(cleared),
  );
  ok(foreign.status === 403, "DELETE of another session id is 403");
  ok(cleared.length === 0, "a foreign session removes nothing");

  const route = readFileSync("app/api/intake/draft/route.ts", "utf8");
  const wipe = route.indexOf("await io.clearIntakeDraft");
  const gate = route.indexOf("draftDeleteDenial");
  ok(gate > 0 && wipe > gate, "the delete runs only after the owner check");
  ok(!route.includes("purgeContractData"), "draft delete does not purge a submitted document");
}

async function checkDocumentsStayVisible() {
  const firm = toEntity(BUYER, { name: "Smoke D Test GmbH" }, "firm-d");
  const doc = {
    ...emptySheetRow(),
    email: BUYER,
    documentId: DOC,
    entityId: FOREIGN,
    company: "Smoke D Test GmbH",
    timestamp: "2026-10-12T00:00:00.000Z",
    status: "intake_submitted",
    version: "1.0",
  };
  const hub = accountCompanyCards([firm], [doc], []);
  const shown = hub.groups.flatMap((group) => group.families);
  ok(shown.length === 1 && shown[0]?.latest.documentId === DOC, "a document stays visible when its firm id is foreign");
  ok(readFileSync("lib/store.ts", "utf8").includes("parentDocumentId"), "document lookup also matches the family id");
  for (const file of [
    "app/api/auth/logout/route.ts",
    "app/api/auth/checkout-handoff/route.ts",
    "app/api/checkout/grant/route.ts",
  ]) {
    const text = readFileSync(file, "utf8");
    ok(!text.includes("purgeContractData"), `${file} does not purge customer documents`);
  }
}

async function checkPaidIntake() {
  const paidOnly = {
    ...emptySheetRow(),
    email: BUYER,
    stripeSessionId: "cs_test_paid_open",
    status: "paid",
    company: "TEST R134 Kernprozess GmbH",
    timestamp: "2026-10-12T14:00:00.000Z",
  };
  const other = {
    ...emptySheetRow(),
    email: OWNER_A,
    stripeSessionId: "cs_test_owner_a",
    status: "paid",
    timestamp: "2026-10-12T15:00:00.000Z",
  };
  const done = {
    ...emptySheetRow(),
    email: BUYER,
    stripeSessionId: "cs_test_done",
    documentId: DOC,
    status: "intake_submitted",
    timestamp: "2026-10-12T16:00:00.000Z",
  };
  ok(
    undocumentedPaidSessionId([paidOnly, other, done], BUYER) === "cs_test_paid_open",
    "an open purchase is the buyer's paid session without a document",
  );
  ok(undocumentedPaidSessionId([done], BUYER) === "", "a submitted document is not an open purchase");
  ok(
    paidIntakePathForOwner({
      sessionEmail: OTHER,
      ownerEmail: BUYER,
      sessionId: "cs_test_paid_open",
    }) === "",
    "the intake link is empty for a different login",
  );
  ok(
    paidIntakePathForOwner({
      sessionEmail: BUYER,
      ownerEmail: BUYER,
      sessionId: "cs_test_paid_open",
    }).includes("session_id=cs_test_paid_open"),
    "the owner gets the paid intake",
  );
  const account = readFileSync("app/account/page.tsx", "utf8");
  ok(account.includes("PAID_INTAKE_LABEL"), "the account offers the paid intake");
  ok(
    readFileSync("lib/account-paid-intake.ts", "utf8").includes(PAID_INTAKE_LABEL),
    "the button label is Verfahrensdokumentation starten",
  );
  ok(account.includes("paidIntakePathForOwner"), "the account checks the owner before linking");
}

async function checkGrantAndHandoff() {
  const sessionId = "cs_test_owner_bind_4c98";
  await forgetCheckoutSessionGrant(sessionId).catch(() => undefined);
  let seen = "";
  const granted = await completeCheckoutGrant(
    new Request(
      `http://localhost/api/checkout/grant?session_id=${encodeURIComponent(sessionId)}&entity_id=${encodeURIComponent(FOREIGN)}`,
    ),
    {
      resolveCheckout: async () => ({
        email: BUYER,
        company: "Neue GmbH",
        stripeSessionId: sessionId,
        stripeCustomerId: "cus_buyer",
        stub: false,
        entityId: FOREIGN,
        billingAddress: { city: "Hamburg", postalCode: "20095", line1: "Speicherstadt 1" },
      }),
      lookupDocumentOwner: async () => null,
      notifyBuyer: async () => undefined,
      bindBuyerFirm: async (input) => {
        seen = input.entityId ?? "";
        ok(input.city === "Hamburg", "grant passes the billing city");
        return "firm-buyer";
      },
    },
  );
  const location = granted.headers.get("location") ?? "";
  ok(seen === FOREIGN, "grant sees the foreign id and replaces it");
  ok(location.includes("entity_id=firm-buyer"), "the return uses the buyer's firm");
  ok(!location.includes(FOREIGN), "the return does not keep A's firm");
  await forgetCheckoutSessionGrant(sessionId).catch(() => undefined);

  let nextSeen = "";
  await completeCheckoutHandoff(
    new Request("http://localhost/api/auth/checkout-handoff", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}`,
      },
      body: new URLSearchParams({ session_id: sessionId, entity_id: FOREIGN }).toString(),
    }),
    {
      resolveOwner: async () => BUYER,
      deliver: async (_email, next) => {
        nextSeen = next;
        return "stub";
      },
      buyerEntityId: async () => "firm-buyer",
    },
  );
  ok(nextSeen.includes("session_id=") && nextSeen.includes("entity_id=firm-buyer"), "the magic link keeps the buyer's firm");
  ok(!nextSeen.includes(FOREIGN), "the magic link drops a foreign firm");

  nextSeen = "";
  await completeCheckoutHandoff(
    new Request("http://localhost/api/auth/checkout-handoff", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}`,
      },
      body: new URLSearchParams({ session_id: sessionId, entity_id: FOREIGN }).toString(),
    }),
    {
      resolveOwner: async () => BUYER,
      deliver: async (_email, next) => {
        nextSeen = next;
        return "stub";
      },
      buyerEntityId: async () => "",
    },
  );
  ok(!nextSeen.includes("entity_id="), "a firm the buyer does not own is omitted");
}

async function checkWelcomeClaim() {
  const sessionId = "cs_test_welcome_claim_4c98";
  await forgetBuyerOnboarding(sessionId);
  const results = await Promise.all([
    deliverBuyerOnboarding({ email: BUYER, company: "Neue GmbH", sessionId }),
    deliverBuyerOnboarding({ email: BUYER, company: "Neue GmbH", sessionId }),
  ]);
  const delivered = results.filter((status) => status === "sent" || status === "stub");
  ok(delivered.length === 1, `parallel welcome calls send once (got ${results.join(",")})`);
  const buyer = readFileSync("lib/buyer-onboarding.ts", "utf8");
  const start = buyer.indexOf("export async function deliverBuyerOnboarding");
  ok(
    buyer.indexOf("claimOnboardingSend", start) < buyer.indexOf("triggerOnboardingMail", start),
    "the welcome claim is taken before the send",
  );
  await forgetBuyerOnboarding(sessionId);
}

const MAIL_ENV = ["RESEND_API_KEY", "EMAIL_FROM", "VERCEL_ENV", "NODE_ENV"] as const;

async function main() {
  const env = process.env as Record<string, string | undefined>;
  const saved: Record<string, string | undefined> = {};
  for (const key of MAIL_ENV) saved[key] = env[key];
  delete env.RESEND_API_KEY;
  delete env.EMAIL_FROM;
  delete env.VERCEL_ENV;
  delete env.BLOB_READ_WRITE_TOKEN;
  env.NODE_ENV = "development";
  if (!env.MAGIC_LINK_SECRET?.trim()) env.MAGIC_LINK_SECRET = "check-checkout-owner-offline-secret";
  try {
    await checkBinding();
    await checkLogout();
    await checkDraftDelete();
    await checkDocumentsStayVisible();
    await checkPaidIntake();
    await checkGrantAndHandoff();
    await checkWelcomeClaim();
    console.log("check-checkout-owner: ok");
  } finally {
    for (const key of MAIL_ENV) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
