/**
 * Kauf, Checkout-Grant, Entwurf, Intake — und ein Sheets-Ausfall.
 * Kein Netz, keine Prod-Daten, nur @example.com.
 *
 *   npx tsx scripts/check-intake-submit.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completeCheckoutGrant } from "../app/api/checkout/grant/route";
import { downloadPdf } from "../app/api/docs/[id]/download/route";
import { putIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { submitIntake, type IntakeIo } from "../app/api/intake/route";
import { accountCompanyCards, draftsNotOnCompanyCard } from "../lib/account-hub";
import {
  SESSION_COOKIE,
  createSessionToken,
} from "../lib/auth";
import { forgetCheckoutSessionGrant } from "../lib/checkout-session-grant";
import { emptyEntity } from "../lib/entities";
import type { IntakeDraft } from "../lib/intake-draft-shared";
import { DURABLE_STORE_MESSAGE } from "../lib/intake-payload";
import {
  createTtlSingleflight,
  retrySheetsCall,
  runWithSheetsRoute,
  SHEETS_RETRY_MESSAGE,
  SheetsUnavailableError,
} from "../lib/sheets-outage";
import { emptyAnswers, emptySheetRow, type IntakeAnswers, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer-f@example.com";
const OTHER = "other-buyer@example.com";
const SESSION = "cs_test_intake_submit_hotfix";
const COMPANY = "Smoke F Test GmbH";
const ENTITY = "ent_smoke_f";
const DOC = "doc-smoke-f";

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

function cookiePair(response: Response, name: string): string {
  const line = response.headers.getSetCookie().find((item) => item.startsWith(`${name}=`));
  return line?.split(";")[0] ?? "";
}

function loginCookie(email: string): string {
  return `${SESSION_COOKIE}=${createSessionToken(email)}`;
}

function outage(status = 429): SheetsUnavailableError {
  return new SheetsUnavailableError(status);
}

async function jsonOf(response: Response): Promise<{ error?: string; documentId?: string; ok?: boolean }> {
  return (await response.json()) as { error?: string; documentId?: string; ok?: boolean };
}

function memoryLookup(throwOutage = false) {
  return {
    async findDocumentById() {
      if (throwOutage) throw outage();
      return null;
    },
    async listDocumentFamily() {
      if (throwOutage) throw outage();
      return [] as SheetRow[];
    },
    async findLatestDocumentByStripeSessionId() {
      if (throwOutage) throw outage();
      return null;
    },
  };
}

function draftIo(options?: { throwOutage?: boolean; stored?: IntakeDraft | null }): DraftWriteIo {
  const drafts = new Map<string, IntakeDraft>();
  if (options?.stored) drafts.set(options.stored.draftKey, options.stored);
  const lookup = memoryLookup(options?.throwOutage);
  return {
    loadIntakeDraft: async (key) => drafts.get(key) ?? null,
    saveIntakeDraft: async (draft) => {
      drafts.set(draft.draftKey, draft);
      return { backend: "file" };
    },
    clearIntakeDraft: async (key) => {
      drafts.delete(key);
    },
    rememberOpenDraft: async () => true,
    forgetOpenDraft: async () => {},
    lookup,
    resolveCheckout: async (sessionId) => {
      if (sessionId === SESSION) return { email: BUYER, stub: false };
      return { error: "invalid" as const };
    },
  };
}

function intakeIo(rows: SheetRow[], options?: { throwRead?: boolean; throwAppend?: boolean }): IntakeIo {
  return {
    findDocumentById: async () => {
      if (options?.throwRead) throw outage();
      return null;
    },
    listDocumentFamily: async () => [],
    findLatestDocumentByStripeSessionId: async () => {
      if (options?.throwRead) throw outage(503);
      return null;
    },
    listEntitiesByEmail: async () => [],
    getOwnedEntity: async () => null,
    findLatestStripeCustomerIdByEmail: async () => null,
    resolveCheckoutSession: async (sessionId) => {
      if (sessionId === SESSION) {
        return {
          email: BUYER,
          company: COMPANY,
          stripeSessionId: SESSION,
          stripeCustomerId: "cus_test_smoke_f",
          stub: false,
          entityId: ENTITY,
        };
      }
      return { error: "invalid" as const };
    },
    prepareDurableIntakeRow: async (row) => row,
    appendRecord: async (row) => {
      if (options?.throwAppend) throw outage(429);
      const stored = { ...emptySheetRow(), ...row };
      rows.push(stored);
      return { backend: "file", row: stored };
    },
    generatePdf: async (input) => ({
      buffer: Buffer.from("%PDF-1.4\n"),
      documentId: input.documentId || "pdf",
      plan: { status: "ready", chapters: [], openItems: [], pdf: null },
    }),
    storePdf: async () => ({ url: "", pathname: "memory/a.pdf", backend: "file" as const }),
    sendDeliveryMail: async () => ({ stub: true, sent: false, action: "delivery" }),
    deliverLoginLink: async () => "stub" as const,
  };
}

function putDraft(cookie: string, revision: number) {
  return new Request("http://localhost/api/intake/draft", {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      sessionId: SESSION,
      email: BUYER,
      entityId: ENTITY,
      step: 2,
      revision,
      answers: answers(),
    }),
  });
}

function postIntake(cookie: string) {
  return new Request("http://localhost/api/intake", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      sessionId: SESSION,
      email: OTHER,
      company: "Fremd GmbH",
      entityId: ENTITY,
      answers: answers(),
    }),
  });
}

async function expectRetry(response: Response, label: string) {
  const body = await jsonOf(response);
  ok(response.status === 503, `${label} is 503 (got ${response.status})`);
  ok(response.headers.get("Retry-After") === "3", `${label} sends Retry-After`);
  ok(body.error === SHEETS_RETRY_MESSAGE, `${label} asks to retry in a moment`);
  ok(body.error !== "Kein Zugriff.", `${label} is not a forbidden response`);
  ok(!body.error?.includes("nicht gefunden"), `${label} is not a missing-document response`);
  ok(body.error !== "Konflikt: Server-Entwurf ist neuer.", `${label} is not a draft conflict`);
  ok(body.error !== DURABLE_STORE_MESSAGE, `${label} is not reported as a lost save`);
}

async function checkPurchasePath() {
  const rows: SheetRow[] = [];
  const granted = await completeCheckoutGrant(
    new Request(`http://localhost/api/checkout/grant?session_id=${encodeURIComponent(SESSION)}`),
    {
      resolveCheckout: async () => ({
        email: BUYER,
        company: COMPANY,
        stripeSessionId: SESSION,
        stripeCustomerId: "cus_test_smoke_f",
        stub: false,
        entityId: ENTITY,
      }),
      lookupDocumentOwner: async () => null,
      notifyBuyer: async () => {},
      bindBuyerFirm: async () => ENTITY,
    },
  );
  const sessionCookie = cookiePair(granted, SESSION_COOKIE);
  ok(sessionCookie.startsWith(`${SESSION_COOKIE}=`), "checkout grant logs the buyer in");
  ok(!granted.headers.get("location")?.includes("/login"), "a new purchase does not send the buyer to login");

  const draft = await putIntakeDraft(putDraft(sessionCookie, 1), draftIo());
  const draftBody = await jsonOf(draft);
  ok(draft.status === 200 && draftBody.ok === true, `draft PUT after grant is 200 (got ${draft.status})`);

  const intake = await submitIntake(postIntake(sessionCookie), intakeIo(rows));
  const intakeBody = await jsonOf(intake);
  ok(intake.status === 200, `intake POST after grant is 200 (got ${intake.status} ${intakeBody.error ?? ""})`);
  ok(Boolean(intakeBody.documentId), "intake POST stores a document id");
  ok(rows.length === 1 && rows[0]?.email === BUYER, "the stored row belongs to the checkout email");
  ok(rows[0]?.company === COMPANY, "the stored row keeps the checkout company");
}

async function checkOutageIs503() {
  const owner = loginCookie(BUYER);
  let finds = 0;
  const anonymous = await downloadPdf(
    new Request(`http://localhost/api/docs/${DOC}/download`),
    DOC,
    async () => {
      finds += 1;
      return null;
    },
  );
  ok(anonymous.status === 401 && finds === 0, "anonymous PDF download stays 401 before lookup");

  const missing = await downloadPdf(
    new Request(`http://localhost/api/docs/${DOC}/download`, { headers: { cookie: owner } }),
    DOC,
    async () => {
      throw outage(429);
    },
  );
  await expectRetry(missing, "owner PDF during a sheets outage");

  const foreign = await downloadPdf(
    new Request(`http://localhost/api/docs/${DOC}/download`, { headers: { cookie: owner } }),
    DOC,
    async () => ({
      ...emptySheetRow(),
      documentId: DOC,
      email: OTHER,
      stripeSessionId: SESSION,
    }),
  );
  const foreignBody = await jsonOf(foreign);
  ok(foreign.status === 403 && foreignBody.error === "Kein Zugriff.", "a foreign document stays 403");

  const conflictDraft: IntakeDraft = {
    draftKey: `session:${SESSION}:gesamt`,
    email: BUYER,
    stripeSessionId: SESSION,
    documentId: "",
    entityId: ENTITY,
    step: 2,
    answers: answers(),
    updatedAt: "2026-10-12T12:00:00.000Z",
    revision: 8,
  };
  const raced = await putIntakeDraft(putDraft(owner, 1), draftIo({ stored: conflictDraft }));
  const racedBody = await jsonOf(raced);
  ok(raced.status === 409 && racedBody.error?.includes("Konflikt"), "a real revision conflict stays 409");

  const draftDown = await putIntakeDraft(
    putDraft(owner, 1),
    draftIo({ throwOutage: true, stored: conflictDraft }),
  );
  await expectRetry(draftDown, "draft PUT during a sheets outage");

  const intakeDown = await submitIntake(postIntake(owner), intakeIo([], { throwRead: true }));
  await expectRetry(intakeDown, "intake POST when the sheet read fails");

  const appendDown = await submitIntake(postIntake(owner), intakeIo([], { throwAppend: true }));
  await expectRetry(appendDown, "intake POST when the sheet append fails");
}

async function checkCacheAndRetry() {
  const cache = createTtlSingleflight<number>(5_000);
  let loads = 0;
  const load = () => {
    loads += 1;
    return Promise.resolve(loads);
  };
  const first = await Promise.all([cache.read(load), cache.read(load), cache.read(load)]);
  ok(loads === 1 && first.every((value) => value === 1), "parallel intake reads share one sheets load");
  const again = await cache.read(load);
  ok(again === 1 && loads === 1, "a second read inside the TTL does not call sheets");
  const fresh = await cache.read(load, true);
  ok(fresh === 2 && loads === 2, "a fresh read after a write calls sheets again");
  cache.clear();
  let failed = 0;
  await assert.rejects(cache.read(async () => {
    failed += 1;
    throw outage(503);
  }));
  await cache.read(async () => {
    failed += 1;
    return 7;
  });
  ok(failed === 2, "a failed sheets read is not cached");

  let attempts = 0;
  const value = await runWithSheetsRoute("POST /api/intake", () =>
    retrySheetsCall(
      "intakes.values",
      async () => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error("quota") as Error & { response?: { status: number } };
          error.response = { status: 429 };
          throw error;
        }
        return "ok";
      },
      async () => {},
    ),
  );
  ok(value === "ok" && attempts === 3, "429 is retried with backoff and then succeeds");

  let bad = 0;
  await assert.rejects(
    retrySheetsCall(
      "intakes.header",
      async () => {
        bad += 1;
        const error = new Error("bad range") as Error & { status?: number };
        error.status = 400;
        throw error;
      },
      async () => {},
    ),
  );
  ok(bad === 1, "a 400 is not retried");
}

function checkSources() {
  const store = readFileSync("lib/store.ts", "utf8");
  const grid = readFileSync("lib/sheets-grid.ts", "utf8");
  const uncached = store.slice(
    store.indexOf("async function loadRowsUncached"),
    store.indexOf("async function loadRows("),
  );
  ok(uncached.includes("isVercelRuntime()"), "production reads do not use the file store");
  ok(
    uncached.indexOf("new SheetsUnavailableError") < uncached.indexOf("falle auf Datei zurück"),
    "the file fallback runs only after the Vercel outage throw",
  );
  ok(store.includes("columnCountCache"), "column count is cached");
  ok(store.includes("headerCache.peek"), "a cached header is not read again");
  ok(store.includes("rowsCache.read"), "loadRows is cached for the request burst");
  ok(store.includes('retrySheetsCall("intakes.columnCount"'), "column count retries 429 and 5xx");
  ok(store.includes('retrySheetsCall("intakes.header"'), "header reads retry 429 and 5xx");
  ok(grid.includes("values.batchGet"), "intake header and values share one batchGet");
  ok(store.includes('retrySheetsCall("intakes.append"'), "appends retry 429 and 5xx");
  ok(store.includes("writeThroughIntakeRow"), "a write updates the cached row");
  ok(store.includes("logSheetsFailure"), "sheets failures log route and status");
  ok(!store.includes("getSheetsTab()}!A2:AZ"), "intake values are not clipped at AZ");

  const account = readFileSync("app/account/page.tsx", "utf8");
  ok(account.includes("draftsNotOnCompanyCard"), "the account hub does not repeat a draft that is on a card");
  ok(account.includes("looseDrafts.map"), "the standalone draft box lists only drafts outside a card");

  const firm = {
    ...emptyEntity(),
    entityId: ENTITY,
    userEmail: BUYER,
    name: COMPANY,
  };
  const draft: IntakeDraft = {
    draftKey: `session:${SESSION}:gesamt`,
    email: BUYER,
    stripeSessionId: SESSION,
    documentId: "",
    entityId: ENTITY,
    step: 1,
    answers: answers(),
    updatedAt: "2026-10-12T12:00:00.000Z",
  };
  const hub = accountCompanyCards([firm], [], [draft]);
  ok(hub.groups[0]?.continueDrafts.length === 1, "Smoke F Test GmbH shows the draft in the company card");
  ok(draftsNotOnCompanyCard(hub).length === 0, "that draft is not also shown as its own box");
}

async function main() {
  const blob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    await checkPurchasePath();
    await checkOutageIs503();
    await checkCacheAndRetry();
    checkSources();
    console.log("intake submit checks passed");
  } finally {
    if (blob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = blob;
    await forgetCheckoutSessionGrant(SESSION);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
