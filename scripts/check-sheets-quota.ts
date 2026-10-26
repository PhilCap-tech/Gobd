/**
 * Sheets-quota: how many API calls one submit, one draft PUT, one account
 * load and one PDF download make. No network and no production data.
 *
 *   npx tsx scripts/check-sheets-quota.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { downloadPdf } from "../app/api/docs/[id]/download/route";
import { putIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { submitIntake, type IntakeIo } from "../app/api/intake/route";
import { AccountCompanyCard } from "../components/account-company-card";
import { accountCompanyCards, draftsNotOnCompanyCard } from "../lib/account-hub";
import { SESSION_COOKIE, createSessionToken } from "../lib/auth";
import {
  clearDocumentIndexMemory,
  installDocumentIndex,
} from "../lib/document-index";
import { AUDIT_SHEET_COLUMNS } from "../lib/audit-log";
import { setBlobMarkerTestDir } from "../lib/blob-marker";
import { emptyEntity, ENTITY_SHEET_COLUMNS } from "../lib/entities";
import { findActiveMembership } from "../lib/membership-store";
import { MEMBERSHIP_SHEET_COLUMNS, membershipSheetValues, type Membership } from "../lib/memberships";
import { fetchRetrying503, isPdfResponse } from "../lib/fetch-retry";
import type { IntakeDraft } from "../lib/intake-draft-shared";
import { clearLifecycleReadCache, listLifecycleByEmail } from "../lib/kuendigung-store";
import { TODAY_EUR, TODAY_GROSS_LABEL } from "../lib/pricing";
import { installSheetsHandler } from "../lib/sheets-client";
import { beginSheetsMeasure, runWithSheetsMeasure, takeSheetsMeasure, type SheetsCall } from "../lib/sheets-meter";
import { runWithSheetsRoute } from "../lib/sheets-outage";
import { SheetsUnavailableError } from "../lib/sheets-unavailable";
import {
  appendRecord,
  clearAllSheetReadCaches,
  listDocumentFamily,
  prepareDurableIntakeRow,
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
/** Tabs whose appends land in the mock grid (draft PUT path). */
const APPEND_TABS = new Set(["memberships", "audit_log"]);
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
  const member = emptySheetRow();
  member.documentId = DOC_TEAM;
  member.parentDocumentId = DOC_TEAM;
  member.email = BUYER;
  member.company = "Quota GmbH";
  member.entityId = ENT_TEAM;
  member.status = "intake_submitted";
  member.version = "1";
  member.timestamp = "2026-10-12T12:00:00.000Z";
  grids.get("intakes")?.push(sheetRowValues(member, [...SHEET_COLUMNS]));
  grids.set("memberships", [[...MEMBERSHIP_SHEET_COLUMNS]]);
  grids.set("audit_log", [[...AUDIT_SHEET_COLUMNS]]);
  grids.set("entities", [["entity_id", "user_email", "name"], [ENT_TEAM, BUYER, "Quota GmbH"]]);
}

function routeIntakeIo(appends: SheetRow[]): IntakeIo {
  return {
    findDocumentById,
    findLatestDocumentByStripeSessionId,
    listDocumentFamily,
    listEntitiesByEmail,
    getOwnedEntity,
    findLatestStripeCustomerIdByEmail,
    resolveCheckoutSession: async () => ({ error: "invalid" as const }),
    prepareDurableIntakeRow,
    appendRecord: async (row) => {
      appends.push(row);
      return appendRecord(row);
    },
    generatePdf: async (input) => ({
      buffer: Buffer.from("%PDF-1.4\n"),
      documentId: input.documentId || "pdf",
      plan: { status: "ready", chapters: [], openItems: [], pdf: null },
    }),
    storePdf: async () => ({ url: "", pathname: "memory/a.pdf", backend: "file" as const }),
    sendDeliveryMail: async () => ({ stub: true, sent: false, action: "delivery" }),
    deliverLoginLink: async () => "stub" as const,
    queueOwnerNotice: () => {},
  };
}

function revisionPost(submitId?: string) {
  return new Request("http://localhost/api/intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE}=${createSessionToken(BUYER)}`,
    },
    body: JSON.stringify({
      email: BUYER,
      company: "Quota GmbH",
      documentId: DOC_TEAM,
      entityId: ENT_TEAM,
      answers: answers(),
      validFrom: "2026-10-26",
      changeSummary: "Quota-Check",
      changedBy: BUYER,
      ...(submitId ? { submitId } : {}),
    }),
  });
}

/** The real POST /api/intake against the mock grid (PDF and mail are stubs). */
async function checkSubmitRoute(): Promise<{ cold: number; warm: number }> {
  resetMemory();
  resetGrids();
  const appends: SheetRow[] = [];
  const io = routeIntakeIo(appends);
  const cold = await measure("POST /api/intake", async () => {
    const response = await submitIntake(revisionPost("11111111-2222-4333-8444-555555555555"), io);
    ok(response.status === 200, `a revision POST is 200 (got ${response.status} ${await response.clone().text()})`);
  });
  const warm = await measure("POST /api/intake", async () => {
    const response = await submitIntake(revisionPost("11111111-2222-4333-8444-666666666666"), io);
    ok(response.status === 200, `a second revision POST is 200 (got ${response.status})`);
  });
  console.log(
    "intake POST (route):",
    JSON.stringify({
      cold: cold.map((call) => call.op),
      warm: warm.map((call) => `${call.op} ${call.range ?? ""}`.trim()),
    }),
  );
  return { cold: cold.length, warm: warm.length };
}

const DOC_TEAM = "doc-quota-team";
const ENT_TEAM = "ent-quota-team";
const MEMBER = "member-quota@example.com";

function teamMembership(status: Membership["status"]): Membership {
  return {
    membershipId: "mem-quota-1",
    ownerEmail: BUYER,
    memberEmail: MEMBER,
    entityId: ENT_TEAM,
    status,
    moduleIds: "",
    tokenHash: "",
    invitedAt: "2026-10-12T12:00:00.000Z",
    acceptedAt: status === "active" ? "2026-10-12T12:05:00.000Z" : "",
    revokedAt: status === "revoked" ? "2026-10-13T12:00:00.000Z" : "",
    invitedBy: BUYER,
    updatedAt: "2026-10-13T12:00:00.000Z",
  };
}

function setMembership(status: Membership["status"] | null) {
  const rows: string[][] = [[...MEMBERSHIP_SHEET_COLUMNS]];
  if (status) rows.push(membershipSheetValues(teamMembership(status)));
  grids.set("memberships", rows);
}

function memoryDraftIo(seed?: IntakeDraft): DraftWriteIo {
  const drafts = new Map<string, IntakeDraft>();
  if (seed) drafts.set(seed.draftKey, seed);
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
    lookup: { findDocumentById, listDocumentFamily, findLatestDocumentByStripeSessionId },
    resolveCheckout: async () => ({ error: "invalid" as const }),
    findActiveMembership,
  };
}

function teamDraftPut(email: string, revision: number, text: string) {
  const body = answers();
  body.katalog = {
    ...(body.katalog ?? {}),
    A01: { status: "bestaetigt", values: { company: text } },
  };
  return new Request("http://localhost/api/intake/draft", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE}=${createSessionToken(email)}`,
    },
    body: JSON.stringify({
      draftKey: `doc:${DOC_TEAM}`,
      documentId: DOC_TEAM,
      entityId: ENT_TEAM,
      step: 2,
      revision,
      answers: body,
    }),
  });
}

function membershipReads(calls: SheetsCall[]): number {
  return calls.filter((call) => (call.range ?? "").startsWith("memberships!A2")).length;
}

/**
 * The real PUT /api/intake/draft route against the mock grid: membership,
 * audit and lookups all run. Returns the measured counts.
 */
async function checkDraftPutRoute(): Promise<{ ownerCold: number; ownerWarm: number; ownerSame: number; member: number }> {
  resetMemory();
  resetGrids();
  setMembership(null);
  const io = memoryDraftIo();
  const coldCalls: SheetsCall[] = [];
  const cold = await runWithSheetsRoute("PUT /api/intake/draft", async () => {
    beginSheetsMeasure();
    const response = await putIntakeDraft(teamDraftPut(BUYER, 1, "Quota GmbH 1"), io);
    coldCalls.push(...takeSheetsMeasure());
    return response;
  });
  ok(cold.status === 200, `owner draft PUT is 200 (got ${cold.status})`);
  const warm = await measure("PUT /api/intake/draft", async () => {
    const response = await putIntakeDraft(teamDraftPut(BUYER, 2, "Quota GmbH 2"), io);
    ok(response.status === 200, `a second owner draft PUT is 200 (got ${response.status})`);
  });
  const same = await measure("PUT /api/intake/draft", async () => {
    const response = await putIntakeDraft(teamDraftPut(BUYER, 3, "Quota GmbH 2"), io);
    ok(response.status === 200, `an unchanged owner draft PUT is 200 (got ${response.status})`);
  });
  ok(membershipReads(coldCalls) === 0 && membershipReads(warm) === 0, "the document owner (session = stored row) needs no membership read");
  console.log(
    "draft PUT (route):",
    JSON.stringify({
      ownerCold: coldCalls.map((call) => call.op),
      ownerWarm: warm.map((call) => call.op),
      ownerSame: same.map((call) => call.op),
    }),
  );

  // Member: active membership is read fresh on every PUT, revocation applies at once.
  setMembership("active");
  const ownerDraft = (await (await putIntakeDraft(teamDraftPut(BUYER, 1, "Team"), memoryDraftIo())).json()) as {
    draft: IntakeDraft;
  };
  const memberIo = memoryDraftIo({ ...ownerDraft.draft, revision: 1 });
  const first = await measure("PUT /api/intake/draft", async () => {
    const response = await putIntakeDraft(teamDraftPut(MEMBER, 2, "Team"), memberIo);
    ok(response.status === 200, `an active member draft PUT is 200 (got ${response.status} ${await response.clone().text()})`);
  });
  ok(membershipReads(first) === 1, "a member PUT reads the membership rows");
  const again = await measure("PUT /api/intake/draft", async () => {
    const response = await putIntakeDraft(teamDraftPut(MEMBER, 3, "Team"), memberIo);
    ok(response.status === 200, `a second member draft PUT is 200 (got ${response.status})`);
  });
  ok(membershipReads(again) === 1, "every member PUT reads the membership rows again (no cache)");
  setMembership("revoked");
  const revoked = await measure("PUT /api/intake/draft", async () => {
    const response = await putIntakeDraft(teamDraftPut(MEMBER, 4, "Team"), memberIo);
    ok(response.status === 403, `a revoked member is 403 on the very next PUT (got ${response.status})`);
  });
  ok(membershipReads(revoked) === 1, "the revoked PUT read the membership rows fresh");
  // Revoked member keeps a fresh read on every PUT, too.
  const revokedAgain = await measure("PUT /api/intake/draft", async () => {
    const response = await putIntakeDraft(teamDraftPut(MEMBER, 5, "Team"), memberIo);
    ok(response.status === 403, `a revoked member stays 403 (got ${response.status})`);
  });
  ok(membershipReads(revokedAgain) === 1, "a second revoked PUT reads the membership rows fresh again");
  // Re-activated: allowed again on the very next PUT (no stale cache either way).
  setMembership("active");
  const reactivated = await putIntakeDraft(teamDraftPut(MEMBER, 6, "Team"), memberIo);
  ok(reactivated.status === 200, `a re-activated member is allowed on the next PUT (got ${reactivated.status})`);
  setMembership(null);
  const stranger = await putIntakeDraft(teamDraftPut(OTHER, 1, "Fremd"), memoryDraftIo());
  ok(stranger.status === 403, `a stranger without membership is 403 (got ${stranger.status})`);
  console.log("draft PUT (member):", JSON.stringify(again.map((call) => call.op)));
  return { ownerCold: coldCalls.length, ownerWarm: warm.length, ownerSame: same.length, member: again.length };
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
          sheets: [...grids.keys()].map((title) => ({
            properties: {
              title,
              gridProperties: { columnCount: title === "intakes" ? SHEET_COLUMNS.length : 26 },
            },
          })),
        },
      };
    }
    if (op === "values.batchGet") {
      return { data: { valueRanges: ranges.map((item) => ({ values: sliceRange(item) })) } };
    }
    if (op === "values.get") return { data: { values: sliceRange(range) } };
    if (op === "values.append") {
      const tab = range.split("!")[0] ?? "";
      const body = args.requestBody as { values?: string[][] } | undefined;
      if (APPEND_TABS.has(tab)) grids.get(tab)?.push(...(body?.values ?? []));
      return { data: {} };
    }
    if (op === "values.update" || op === "values.batchUpdate") {
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
    ok(
      accountAgain.length === 1 && (accountAgain[0]?.range ?? "").startsWith("entities!"),
      "a repeated account load only re-reads the company sheet",
    );
    ok(
      accountAgain.every((call) => !(call.range ?? "").startsWith("intakes")),
      "a repeated account load does not re-read the intake grid",
    );

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

    clearAllSheetReadCaches();
    let entityBatches = 0;
    installSheetsHandler(async ({ op, args }) => {
      if (op !== "values.batchGet") throw new Error(op);
      entityBatches += 1;
      const ranges = Array.isArray(args.ranges) ? args.ranges.map(String) : [];
      const headerReady = entityBatches > 1;
      return {
        data: {
          valueRanges: ranges.map((range) => {
            if (range.includes("!A1:")) {
              return { values: headerReady ? [[...ENTITY_SHEET_COLUMNS]] : [[]] };
            }
            return { values: [["ent-hidden", BUYER, "Sichtbare GmbH"]] };
          }),
        },
      };
    });
    const recoveredFirms = await listEntitiesByEmail(BUYER);
    ok(
      recoveredFirms.some((row) => row.entityId === "ent-hidden"),
      "a company read with rows but no header retries and does not come back empty",
    );
    clearAllSheetReadCaches();
    entityBatches = 0;
    installSheetsHandler(async ({ op, args }) => {
      if (op !== "values.batchGet") throw new Error(op);
      const ranges = Array.isArray(args.ranges) ? args.ranges.map(String) : [];
      return {
        data: {
          valueRanges: ranges.map((range) => {
            if (range.includes("!A1:")) return { values: [[]] };
            return { values: [["ent-hidden", BUYER, "Sichtbare GmbH"]] };
          }),
        },
      };
    });
    await assert.rejects(
      () => listEntitiesByEmail(BUYER),
      (error: unknown) => error instanceof SheetsUnavailableError,
      "a company grid that stays headerless is an outage, not zero firms",
    );
    clearAllSheetReadCaches();
    installClient();
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
    setBlobMarkerTestDir(mkdtempSync(path.join(tmpdir(), "sheets-quota-markers-")));
    // Measured on main before this change with the same mock grid and routes.
    const before = { ownerCold: 13, ownerWarm: 6, ownerSame: 6, member: 6, postCold: 6, postWarm: 3 };
    const route = await checkDraftPutRoute();
    console.log("draft PUT route counts:", JSON.stringify(route));
    ok(route.ownerWarm <= 2, `a warm owner draft PUT is at most 2 Sheets calls (got ${route.ownerWarm}, before ${before.ownerWarm})`);
    ok(route.ownerSame === 0, `an unchanged owner draft PUT makes no Sheets call (got ${route.ownerSame}, before ${before.ownerSame})`);
    ok(route.ownerCold < before.ownerCold, `a cold owner draft PUT makes fewer Sheets calls (got ${route.ownerCold}, before ${before.ownerCold})`);
    ok(route.member <= 3, `a member draft PUT is at most 3 Sheets calls incl. the fresh membership read (got ${route.member}, before ${before.member})`);
    const submitRoute = await checkSubmitRoute();
    console.log("intake POST route counts:", JSON.stringify(submitRoute));
    ok(submitRoute.warm <= before.postWarm, `a warm intake POST stays within ${before.postWarm} Sheets calls (got ${submitRoute.warm})`);
    ok(submitRoute.cold <= before.postCold, `a cold intake POST stays within ${before.postCold} Sheets calls (got ${submitRoute.cold})`);
    console.log(
      "Sheets calls before -> after:",
      JSON.stringify({
        putOwnerCold: [before.ownerCold, route.ownerCold],
        putOwnerWarm: [before.ownerWarm, route.ownerWarm],
        putOwnerUnchanged: [before.ownerSame, route.ownerSame],
        putMember: [before.member, route.member],
        postCold: [before.postCold, submitRoute.cold],
        postWarm: [before.postWarm, submitRoute.warm],
      }),
    );
    console.log("sheets quota checks passed");
  } finally {
    setBlobMarkerTestDir(null);
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
