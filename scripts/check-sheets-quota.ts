/**
 * Sheets-quota: how many API calls one submit, one draft PUT, one account
 * load and one PDF download make. No network and no production data.
 *
 *   npx tsx scripts/check-sheets-quota.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { downloadPdf } from "../app/api/docs/[id]/download/route";
import { AccountCompanyCard } from "../components/account-company-card";
import { accountCompanyCards, draftsNotOnCompanyCard } from "../lib/account-hub";
import { SESSION_COOKIE, createSessionToken } from "../lib/auth";
import {
  clearDocumentIndexMemory,
  installDocumentIndex,
} from "../lib/document-index";
import { emptyEntity } from "../lib/entities";
import { fetchRetrying503, isPdfResponse } from "../lib/fetch-retry";
import type { IntakeDraft } from "../lib/intake-draft-shared";
import { clearLifecycleReadCache, listLifecycleByEmail } from "../lib/kuendigung-store";
import { TODAY_EUR, TODAY_GROSS_LABEL } from "../lib/pricing";
import { installSheetsHandler } from "../lib/sheets-client";
import { beginSheetsMeasure, runWithSheetsMeasure, takeSheetsMeasure, type SheetsCall } from "../lib/sheets-meter";
import { SheetsUnavailableError } from "../lib/sheets-unavailable";
import {
  appendRecord,
  clearAllSheetReadCaches,
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  findLatestStripeCustomerIdByEmail,
  findUndocumentedPaidSessionId,
  getAccountProfile,
  getOwnedEntity,
  findReadinessLeadById,
  listDocumentsByEmail,
  listEntitiesByEmail,
} from "../lib/store";
import {
  SHEET_COLUMNS,
  emptyAnswers,
  emptySheetRow,
  sheetRowValues,
  type IntakeAnswers,
  type SheetRow,
} from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer-quota@example.com";
const OTHER = "other-quota@example.com";
const DOC = "doc-quota-1";
const SESSION = "cs_test_quota";

/**
 * Counts on main before this change, from the code paths (no shared cache):
 * each intake read was spreadsheets.get + header values.get + body values.get.
 */
const BEFORE = {
  download: 6,
  draftPut: 6,
  account: 12,
  intakeSubmit: 11,
};

const grids = new Map<string, string[][]>();
let failSheets = false;
const seenRanges: string[] = [];

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    if (ch < "A" || ch > "Z") break;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function sliceRange(range: string): string[][] {
  const bang = range.indexOf("!");
  const tab = bang >= 0 ? range.slice(0, bang) : "intakes";
  const spec = bang >= 0 ? range.slice(bang + 1) : range;
  const grid = grids.get(tab) ?? [];
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

function resetGrids() {
  const stored = emptySheetRow();
  stored.documentId = DOC;
  stored.parentDocumentId = DOC;
  stored.email = BUYER;
  stored.company = "Quota GmbH";
  stored.stripeSessionId = SESSION;
  stored.status = "intake_submitted";
  stored.version = "1";
  stored.timestamp = "2026-10-12T12:00:00.000Z";
  grids.set("intakes", [[...SHEET_COLUMNS], sheetRowValues(stored, [...SHEET_COLUMNS])]);
  grids.set("entities", [["entity_id", "user_email", "name"]]);
  grids.set("readiness_leads", [["lead_id", "email"]]);
  grids.set("profiles", [["email", "name"]]);
  grids.set("subscription_lifecycle", [["email", "stripe_subscription_id"]]);
}

function quotaError(): Error {
  const error = new Error("quota") as Error & { response?: { status: number } };
  error.response = { status: 503 };
  return error;
}

function installClient() {
  installSheetsHandler(async ({ op, args }) => {
    const range = typeof args.range === "string" ? args.range : "";
    const ranges = Array.isArray(args.ranges) ? (args.ranges as string[]) : [];
    if (range) seenRanges.push(range);
    for (const item of ranges) seenRanges.push(item);
    if (failSheets) throw quotaError();
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
      return { data: { valueRanges: ranges.map((item) => ({ values: sliceRange(item) })) } };
    }
    if (op === "values.get") return { data: { values: sliceRange(range) } };
    if (op === "values.append" || op === "values.update" || op === "values.batchUpdate") {
      return { data: {} };
    }
    if (op === "spreadsheets.batchUpdate") return { data: {} };
    throw new Error(`unexpected sheets op ${op}`);
  });
}

function resetMemory() {
  clearAllSheetReadCaches();
  clearLifecycleReadCache();
  clearDocumentIndexMemory();
  seenRanges.length = 0;
  failSheets = false;
}

async function measure(route: string, run: () => Promise<unknown>): Promise<SheetsCall[]> {
  beginSheetsMeasure();
  await runWithSheetsMeasure(route, run);
  return takeSheetsMeasure();
}

function fullGridRange(range: string): boolean {
  return /!A2:[A-Z]+$/.test(range);
}

function answers(): IntakeAnswers {
  const next = emptyAnswers();
  next.katalog = {
    ...(next.katalog ?? {}),
    A01: { status: "bestaetigt", values: { company: "Smoke F Test GmbH" } },
  };
  return next;
}

function openDraft(overrides: Partial<IntakeDraft> = {}): IntakeDraft {
  return {
    draftKey: `session:${SESSION}:gesamt`,
    email: BUYER,
    stripeSessionId: SESSION,
    documentId: "",
    entityId: "",
    step: 2,
    answers: answers(),
    updatedAt: "2026-10-12T12:00:00.000Z",
    ...overrides,
  };
}

function firm(entityId: string) {
  return {
    ...emptyEntity(),
    entityId,
    userEmail: BUYER,
    name: "Smoke F Test GmbH",
  };
}

function renderContinue(entities: ReturnType<typeof firm>[], drafts: IntakeDraft[]): string {
  const hub = accountCompanyCards(entities, [], drafts);
  const cards = hub.groups
    .map((group) =>
      renderToStaticMarkup(
        createElement(AccountCompanyCard, {
          email: BUYER,
          group,
          empty: group.families.length === 0 && group.continueDrafts.length === 0,
        }),
      ),
    )
    .join("");
  const loose = draftsNotOnCompanyCard(hub);
  const box =
    loose.length > 0
      ? `<section id="offene-entwuerfe">${loose.map(() => "Weiter ausfüllen").join("")}</section>`
      : "";
  return cards + box;
}

async function main() {
  const saved = {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    sheet: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    blob: process.env.BLOB_READ_WRITE_TOKEN,
    stripe: process.env.STRIPE_SECRET_KEY,
    vercel: process.env.VERCEL,
  };
  const blobs = new Map<string, SheetRow>();
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheets@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "test-key";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.VERCEL;
  installDocumentIndex({
    async get(pathname) {
      return blobs.get(pathname) ?? null;
    },
    async put(pathname, row) {
      blobs.set(pathname, row);
    },
  });
  installClient();
  resetGrids();
  try {
    console.log(
      "before:",
      JSON.stringify(BEFORE),
      "— each intake read was a column lookup plus header plus the whole grid",
    );

    resetMemory();
    const firstDownload = await measure("GET /api/docs/[id]/download", () => findDocumentById(DOC));
    ok(firstDownload.length > 0 && firstDownload.length <= 3, "a cold download is at most 3 Sheets calls");
    ok(
      firstDownload.every((call) => !fullGridRange(call.range ?? "")),
      "a download does not read the whole intake grid",
    );
    const indexed = await findDocumentById(DOC);
    ok(indexed?.documentId === DOC && indexed.email === BUYER, "the targeted row is the owner's document");
    clearDocumentIndexMemory();
    const shared = await measure("GET /api/docs/[id]/download", () => findDocumentById(DOC));
    ok(shared.length === 0, "another instance reads the Blob index and skips Sheets");

    resetMemory();
    blobs.clear();
    const coldRows = await measure("loadRows", () => listDocumentsByEmail(BUYER));
    ok(coldRows.length <= 2, "a cold intake read is one column lookup plus one batchGet");
    ok(coldRows.some((call) => call.op === "values.batchGet"), "header and values share one batchGet");
    const warmRows = await measure("loadRows", () => listDocumentsByEmail(BUYER));
    ok(warmRows.length === 0, "a second intake read inside 45s makes no Sheets call");

    resetMemory();
    const account = await measure("GET /account", async () => {
      await listDocumentsByEmail(BUYER);
      await listEntitiesByEmail(BUYER);
      await getAccountProfile(BUYER);
      await findLatestStripeCustomerIdByEmail(BUYER);
      await listLifecycleByEmail(BUYER);
      await findUndocumentedPaidSessionId(BUYER);
    });
    ok(account.length < BEFORE.account, "an account load makes fewer Sheets calls than before");
    ok(account.length <= 5, "a cold account load stays within 5 Sheets calls");
    const accountAgain = await measure("GET /account", async () => {
      await listDocumentsByEmail(BUYER);
      await listEntitiesByEmail(BUYER);
      await getAccountProfile(BUYER);
      await findLatestStripeCustomerIdByEmail(BUYER);
      await listLifecycleByEmail(BUYER);
      await findUndocumentedPaidSessionId(BUYER);
    });
    ok(accountAgain.length === 0, "a repeated account load makes no Sheets call");

    resetMemory();
    const draftPut = await measure("PUT /api/intake/draft", async () => {
      await findLatestDocumentByStripeSessionId(SESSION);
      await findLatestDocumentByStripeSessionId(SESSION);
      await listLifecycleByEmail(BUYER);
    });
    ok(draftPut.length < BEFORE.draftPut, "a draft PUT makes fewer Sheets calls than before");
    ok(draftPut.filter((call) => call.op === "values.get").length <= 1, "a draft PUT does not re-read a cached header");
    const draftAgain = await measure("PUT /api/intake/draft", async () => {
      await findLatestDocumentByStripeSessionId(SESSION);
      await listLifecycleByEmail(BUYER);
    });
    ok(draftAgain.length === 0, "a repeated draft PUT makes no Sheets call");

    const submit = await measure("POST /api/intake", async () => {
      await findLatestDocumentByStripeSessionId(SESSION);
      await findLatestStripeCustomerIdByEmail(BUYER);
      await listEntitiesByEmail(BUYER);
      await getOwnedEntity("ent-missing", BUYER);
      await listLifecycleByEmail(BUYER);
      await appendRecord({ ...emptySheetRow(), email: BUYER, documentId: "doc-new", company: "Quota GmbH" });
    });
    ok(submit.length < BEFORE.intakeSubmit, "an intake submit makes fewer Sheets calls than before");
    console.log(
      "after:",
      JSON.stringify({
        download: firstDownload.length,
        downloadCached: shared.length,
        draftPut: draftPut.length,
        account: account.length,
        intakeSubmit: submit.length,
      }),
    );

    const owner = `${SESSION_COOKIE}=${createSessionToken(BUYER)}`;
    const foreign = `${SESSION_COOKIE}=${createSessionToken(OTHER)}`;
    beginSheetsMeasure();
    const foreignDownload = await downloadPdf(
      new Request(`http://localhost/api/docs/${DOC}/download`, { headers: { cookie: foreign } }),
      DOC,
    );
    const foreignCalls = takeSheetsMeasure();
    ok(foreignDownload.status === 403, "a foreign account is 403 from the cached row");
    ok(foreignCalls.length === 0, "that 403 does not call Sheets");

    resetMemory();
    blobs.clear();
    failSheets = true;
    process.env.VERCEL = "1";
    const down = await downloadPdf(
      new Request(`http://localhost/api/docs/${DOC}/download`, { headers: { cookie: owner } }),
      DOC,
    );
    ok(down.status === 503, "an owner download during an outage is 503 when ownership is unknown");
    ok(down.headers.get("Retry-After") === "3", "the download 503 carries Retry-After");
    await assert.rejects(
      () => listEntitiesByEmail(BUYER),
      (error: unknown) => error instanceof SheetsUnavailableError,
      "a company read on Vercel does not fall back to an empty file",
    );
    await assert.rejects(
      () => findReadinessLeadById("lead-missing"),
      (error: unknown) => error instanceof SheetsUnavailableError,
      "a readiness read on Vercel does not fall back to an empty file",
    );
    delete process.env.VERCEL;
    failSheets = false;

    const beforeSubmit = renderContinue([firm("ent-smoke")], [openDraft()]);
    const continueLinks = beforeSubmit.match(/Weiter ausfüllen/g) ?? [];
    ok(continueLinks.length === 1, "before submit, Weiter ausfüllen appears once");
    ok(!beforeSubmit.includes("offene-entwuerfe"), "before submit the draft box is absent");
    const duplicated = renderContinue(
      [firm("ent-smoke"), firm("ent-other")],
      [
        openDraft({ draftKey: "session:cs_test_quota:gesamt", entityId: "ent-smoke", updatedAt: "2026-10-12T11:00:00.000Z" }),
        openDraft({
          draftKey: "email:buyer-quota@example.com:default:gesamt",
          entityId: "",
          updatedAt: "2026-10-12T12:00:00.000Z",
        }),
      ],
    );
    ok((duplicated.match(/Weiter ausfüllen/g) ?? []).length === 1, "two keys for one checkout stay on the company card");
    ok(!duplicated.includes("offene-entwuerfe"), "the second key is not a separate draft box");

    let attempts = 0;
    const savedPdf = await fetchRetrying503("/api/intake", { method: "POST" }, {
      retries: 3,
      wait: async (ms) => {
        ok(ms === 3000, "the client waits for Retry-After");
      },
      fetch: async () => {
        attempts += 1;
        if (attempts < 4) {
          return new Response(JSON.stringify({ error: "Bitte versuchen Sie es in einem Moment erneut." }), {
            status: 503,
            headers: { "Retry-After": "3", "content-type": "application/json" },
          });
        }
        return new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } });
      },
    });
    ok(attempts === 4 && isPdfResponse(savedPdf), "the client retries a 503 three times and then accepts a PDF");
    ok(
      !isPdfResponse(new Response("{}", { status: 503, headers: { "content-type": "application/json" } })),
      "JSON is never treated as a downloadable file",
    );
    const link = readFileSync("components/pdf-download-link.tsx", "utf8");
    ok(link.includes("preventDefault") && link.includes("isPdfResponse"), "the download link checks the body before saving");

    const stripe = readFileSync("lib/stripe.ts", "utf8");
    ok(TODAY_EUR === 198 && TODAY_GROSS_LABEL === "235,62", "the page gross total is 235,62 on 198 net");
    ok(stripe.includes("tax_rates: taxRates"), "checkout adds the tax rate when STRIPE_TAX_RATE_ID is set");
    console.log(
      "tax: with STRIPE_TAX_RATE_ID the exclusive 19% on 149 + 49 net is 235,62 gross, matching the page. Without the env var Stripe charges 198 net. No code change.",
    );
    console.log("sheets quota checks passed");
  } finally {
    installSheetsHandler(null);
    installDocumentIndex(null);
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("GOOGLE_SERVICE_ACCOUNT_EMAIL", saved.email);
    restore("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", saved.key);
    restore("GOOGLE_SHEETS_SPREADSHEET_ID", saved.sheet);
    restore("BLOB_READ_WRITE_TOKEN", saved.blob);
    restore("STRIPE_SECRET_KEY", saved.stripe);
    restore("VERCEL", saved.vercel);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
