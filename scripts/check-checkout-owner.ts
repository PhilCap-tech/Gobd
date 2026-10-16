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
import { authCookieDeletionLines, SESSION_COOKIE, createSessionToken, verifySessionToken } from "../lib/auth";
import {
  deliverBuyerOnboarding,
  forgetBuyerOnboarding,
  plantBuyerOnboardingMarker,
} from "../lib/buyer-onboarding";
import { scheduleCheckoutAfterResponse } from "../lib/checkout-after";
import { boundCheckoutEntityId, checkoutEntityIdForEmail } from "../lib/checkout-entity";
import {
  ensureBuyerFirmForCheckout,
  forgetCheckoutFirmClaim,
  type BuyerFirmStore,
} from "../lib/checkout-firm";
import { encodeIntakePayloadRef } from "../lib/intake-payload";
import { installSheetsHandler } from "../lib/sheets-client";
import { clearAllSheetReadCaches, findLatestDocumentByStripeSessionId } from "../lib/store";
import { forgetCheckoutSessionGrant } from "../lib/checkout-session-grant";
import { toEntity, type Entity, type EntityInput } from "../lib/entities";
import { SHEET_COLUMNS, emptyAnswers, emptySheetRow, emailsEqual, sheetRowValues } from "../lib/types";

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
  await forgetCheckoutFirmClaim(BUYER);
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
  await forgetCheckoutFirmClaim(BUYER);
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

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    if (ch < "A" || ch > "Z") break;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function sliceRange(grid: string[][], range: string): string[][] {
  const bang = range.indexOf("!");
  const spec = bang >= 0 ? range.slice(bang + 1) : range;
  if (/^\d+:\d+$/.test(spec)) {
    const [start, end] = spec.split(":").map((part) => Number(part));
    return grid.slice((start ?? 1) - 1, end);
  }
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

/** A session lookup must not download every Blob answer just to miss. */
async function checkSessionLookupSkipsPayloads() {
  const env = process.env as Record<string, string | undefined>;
  const keys = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEETS_SPREADSHEET_ID",
  ] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, env[key]]));
  env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheet@example.com";
  env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "key";
  env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-checkout-owner";
  const hit = "cs_test_payload_hit";
  const other = emptySheetRow();
  other.documentId = "doc-payload-other";
  other.email = OTHER;
  other.stripeSessionId = "cs_test_payload_other";
  other.status = "intake_submitted";
  other.version = "1";
  other.fragen = encodeIntakePayloadRef("/tmp/gobd-missing-checkout-answers.json", "deadbeef");
  const owned = emptySheetRow();
  owned.documentId = "doc-payload-hit";
  owned.email = BUYER;
  owned.stripeSessionId = hit;
  owned.status = "intake_submitted";
  owned.version = "1";
  const grid = [
    [...SHEET_COLUMNS],
    sheetRowValues(other, [...SHEET_COLUMNS]),
    sheetRowValues(owned, [...SHEET_COLUMNS]),
  ];
  installSheetsHandler(async ({ op, args }) => {
    const range = typeof args.range === "string" ? args.range : "";
    const ranges = Array.isArray(args.ranges) ? (args.ranges as string[]) : [];
    if (op === "spreadsheets.get") {
      return {
        data: {
          sheets: [
            {
              properties: {
                title: "intakes",
                gridProperties: { columnCount: SHEET_COLUMNS.length },
              },
            },
          ],
        },
      };
    }
    if (op === "values.batchGet") {
      return { data: { valueRanges: ranges.map((item) => ({ values: sliceRange(grid, item) })) } };
    }
    if (op === "values.get") return { data: { values: sliceRange(grid, range) } };
    throw new Error(`unexpected sheets op ${op}`);
  });
  clearAllSheetReadCaches();
  try {
    const missing = await findLatestDocumentByStripeSessionId("cs_test_payload_nobody");
    ok(missing === null, "a checkout without a document does not read every answer payload");
    const found = await findLatestDocumentByStripeSessionId(hit);
    ok(found?.email === BUYER, "the matching document is still found without the other payloads");
  } finally {
    installSheetsHandler(null);
    clearAllSheetReadCaches();
    for (const key of keys) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  }
}

async function checkGrantReturnsBeforeAccountWork() {
  const sessionId = "cs_test_fast_return_4c98";
  await forgetCheckoutSessionGrant(sessionId).catch(() => undefined);
  const started = Date.now();
  let scheduled = 0;
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
      }),
      lookupDocumentOwner: async () => null,
      schedule: () => {
        scheduled += 1;
      },
    },
  );
  ok(Date.now() - started < 2_000, "the redirect does not wait for firm or mail");
  ok(scheduled === 1, "firm and mail are scheduled once");
  const location = granted.headers.get("location") ?? "";
  ok(location.includes("grant=set"), "the buyer still lands with grant=set");
  ok(!location.includes("entity_id="), "an unverified firm id is not forwarded");
  ok(!location.includes(FOREIGN), "another mailbox's firm id is dropped");
  ok(
    verifySessionToken(granted.cookies.get(SESSION_COOKIE)?.value) === BUYER,
    "the session cookie is set before account work",
  );
  const grantSource = readFileSync("app/api/checkout/grant/route.ts", "utf8");
  ok(grantSource.includes("scheduleCheckoutAfterResponse"), "production schedules account work after the response");
  ok(grantSource.includes("notifyBuyerOfCheckout"), "the welcome mail still goes out");
  ok(grantSource.includes("ensureBuyerFirmForCheckout"), "the firm is still created");
  ok(grantSource.includes("matchingTestEntityId"), "the welcome mail still sees a test firm");
  ok(grantSource.includes('mailed === "inflight"'), "a fresh welcome claim is left in place");
  ok(!grantSource.includes("await scheduleCheckoutAfterResponse"), "the redirect does not await that schedule");
  const afterSource = readFileSync("lib/checkout-after.ts", "utf8");
  ok(afterSource.includes('from "next/server"'), "the scheduler still uses after");
  ok(afterSource.includes('from "@vercel/functions"'), "the scheduler keeps the work alive with waitUntil");
  ok(afterSource.includes("waitUntil(run())"), "waitUntil holds the same background promise");
  const intake = readFileSync("app/intake/page.tsx", "utf8");
  const redirectAt = intake.indexOf('fastEntry === "grant"');
  const scanAt = intake.indexOf("await checkoutAlreadyGranted");
  ok(redirectAt > 0 && scanAt > redirectAt, "a fresh session id redirects before the document scan");
  await forgetCheckoutSessionGrant(sessionId).catch(() => undefined);
}

async function checkFirmRace() {
  const email = "race.firm@example.com";
  await forgetCheckoutFirmClaim(email);
  const firms: Entity[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let creates = 0;
  const store: BuyerFirmStore = {
    async getEntity(id) {
      return firms.find((firm) => firm.entityId === id) ?? null;
    },
    async listEntitiesByEmail(address) {
      return firms.filter((firm) => emailsEqual(firm.userEmail, address));
    },
    async createEntity(owner, input, options) {
      creates += 1;
      if (creates === 1) await gate;
      const entity = toEntity(owner, input, `firm-race-${creates}`);
      entity.checkoutPrefill = options?.checkoutPrefill === "review" ? "review" : "";
      firms.push(entity);
      return { entity };
    },
    async updateEntity() {
      return null;
    },
  };
  const first = ensureBuyerFirmForCheckout({ email, company: "Race GmbH", city: "Hamburg" }, store);
  const second = ensureBuyerFirmForCheckout({ email, company: "Race GmbH", city: "Hamburg" }, store);
  await new Promise((resolve) => setTimeout(resolve, 100));
  release();
  const [a, b] = await Promise.all([first, second]);
  ok(Boolean(a) && a === b, "webhook and the checkout return share one firm");
  ok(firms.length === 1 && creates === 1, "the race does not create a second firm");
  await forgetCheckoutFirmClaim(email);
}

async function checkScheduleRunsOnce() {
  let runs = 0;
  scheduleCheckoutAfterResponse(async () => {
    runs += 1;
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  ok(runs === 1, "background work starts once");
}

async function checkBackgroundLeavesFreshClaim() {
  const sessionId = "cs_test_bg_inflight_4c98";
  const email = "inflight.bg@example.com";
  await forgetCheckoutSessionGrant(sessionId).catch(() => undefined);
  await forgetBuyerOnboarding(sessionId);
  await forgetCheckoutFirmClaim(email);
  await plantBuyerOnboardingMarker(sessionId, {
    email,
    status: "claiming",
    at: new Date().toISOString(),
  });
  let background = Promise.resolve();
  const started = Date.now();
  const granted = await completeCheckoutGrant(
    new Request(`http://localhost/api/checkout/grant?session_id=${encodeURIComponent(sessionId)}`),
    {
      resolveCheckout: async () => ({
        email,
        company: "Inflight GmbH",
        stripeSessionId: sessionId,
        stripeCustomerId: "cus_inflight",
        stub: false,
      }),
      lookupDocumentOwner: async () => null,
      schedule: (work) => {
        background = work();
      },
    },
  );
  ok(Date.now() - started < 2_000, "a fresh claim does not hold the redirect");
  ok((granted.headers.get("location") ?? "").includes("grant=set"), "the redirect still lands");
  await background;
  const again = await deliverBuyerOnboarding({
    email,
    company: "Inflight GmbH",
    sessionId,
  });
  ok(again === "inflight", "background work does not take over a fresh claim");
  await forgetCheckoutSessionGrant(sessionId).catch(() => undefined);
  await forgetBuyerOnboarding(sessionId);
  await forgetCheckoutFirmClaim(email);
}

async function checkBackgroundSkipsTestFirm() {
  const sessionId = "cs_test_bg_listed_4c98";
  const listed = "48c6805d-3d34-4a80-9747-38ce4edb3eed";
  const email = "listed.bg@example.com";
  await forgetCheckoutSessionGrant(sessionId).catch(() => undefined);
  await forgetBuyerOnboarding(sessionId);
  await forgetCheckoutFirmClaim(email);
  let background = Promise.resolve();
  await completeCheckoutGrant(
    new Request(
      `http://localhost/api/checkout/grant?session_id=${encodeURIComponent(sessionId)}&entity_id=${encodeURIComponent(listed)}`,
    ),
    {
      resolveCheckout: async () => ({
        email,
        company: "R4 Mystery Test GmbH",
        stripeSessionId: sessionId,
        stripeCustomerId: "cus_listed",
        stub: false,
      }),
      lookupDocumentOwner: async () => null,
      schedule: (work) => {
        background = work();
      },
    },
  );
  await background;
  const follow = await deliverBuyerOnboarding({
    email,
    company: "R4 Mystery Test GmbH",
    sessionId,
  });
  ok(follow === "sent" || follow === "stub", "a test firm does not consume the welcome claim");
  await forgetCheckoutSessionGrant(sessionId).catch(() => undefined);
  await forgetBuyerOnboarding(sessionId);
  await forgetCheckoutFirmClaim(email);
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
    await checkSessionLookupSkipsPayloads();
    await checkGrantReturnsBeforeAccountWork();
    await checkScheduleRunsOnce();
    await checkBackgroundLeavesFreshClaim();
    await checkBackgroundSkipsTestFirm();
    await checkFirmRace();
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
