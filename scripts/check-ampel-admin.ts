/**
 * Ampel admin counts: bearer auth, test-address filter, Berlin day boundaries.
 * Usage: npx tsx scripts/check-ampel-admin.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import nextConfig from "../next.config";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { WIPE_EMAIL_ALLOWLIST } from "../lib/admin-wipe";
import { isAmpelAdminEmail } from "../lib/ampel-admin";
import { AMPEL_ADMIN_CACHE_CONTROL, AMPEL_ADMIN_ROBOTS_TAG } from "../lib/ampel-admin-headers";
import { automatedRunForbidsLiveWrites, LiveWriteRefusedError } from "../lib/live-write-guard";
import { tryClaimMailDedupeSlot } from "../lib/mail-dedupe";
import { createSheetsClient } from "../lib/sheets-client";
import { handleAmpelStatsRequest } from "../lib/ampel-admin-http";
import { requestAmpelConfirmation } from "../lib/ampel-confirm";
import { AMPEL_QUESTIONS, type AmpelAnswer } from "../lib/ampel-questions";
import { AMPEL_CHECK_RETENTION_DAYS } from "../lib/ampel-retention";
import { deliverAmpelResult } from "../lib/ampel-result-send";
import { encodeAmpelAnswers, type AmpelAnswerMap } from "../lib/ampel-score";
import {
  ampelCountWindows,
  berlinDayStart,
  buildAmpelStats,
  ampelAddressNote,
  isAmpelTestEmail,
  type AmpelStatsReport,
} from "../lib/ampel-stats";
import { emptyReadinessLead, READINESS_SHEET_COLUMNS, type ReadinessLead } from "../lib/readiness";
import { INDEXABLE_STATIC_PATHS } from "../lib/seo";
import { SheetsUnavailableError } from "../lib/sheets-unavailable";

if (!automatedRunForbidsLiveWrites()) {
  process.env.npm_lifecycle_event = "check:ampel-admin";
}

const TOKEN = `ampel-admin-${"k".repeat(32)}`;
const STATS_URL = "https://www.gobd-doku-erstellen.de/api/admin/ampel-stats";

function ok(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  console.log("ok:", message);
}

function lead(partial: Partial<ReadinessLead> & Pick<ReadinessLead, "leadId" | "email" | "timestamp">): ReadinessLead {
  return {
    ...emptyReadinessLead(),
    ampelLight: "gruen",
    status: "ampel_pdf",
    ...partial,
  };
}

function allJa(): AmpelAnswerMap {
  const map: AmpelAnswerMap = {};
  for (const question of AMPEL_QUESTIONS) map[question.id] = "ja" satisfies AmpelAnswer;
  return map;
}

function request(authorization?: string, url = STATS_URL, method = "GET"): Request {
  return new Request(url, {
    method,
    headers: authorization ? { authorization } : {},
  });
}

function listSourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx|md|mjs)$/.test(entry.name)) found.push(full.split(path.sep).join("/"));
  }
  return found;
}

function reportOf(body: unknown): AmpelStatsReport {
  ok(body && typeof body === "object", "stats body is an object");
  return body as AmpelStatsReport;
}

async function withConsole(run: (lines: string[]) => Promise<void>) {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((item) => String(item)).join(" "));
  };
  try {
    await run(lines);
  } finally {
    console.error = original;
  }
}

async function main() {
  let loads = 0;
  const countingLoad = async () => {
    loads += 1;
    return [];
  };

  const missingEnv = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}`), {
    token: undefined,
    load: countingLoad,
  });
  ok(missingEnv.status === 404, "missing ADMIN_TOKEN is 404");
  ok(loads === 0, "missing env does not read leads");
  ok(!JSON.stringify(missingEnv.body).includes("entries"), "missing env returns no rows");

  const blankEnv = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}`), {
    token: "   ",
    load: countingLoad,
  });
  ok(blankEnv.status === 404 && loads === 0, "blank ADMIN_TOKEN stays closed");

  const noHeader = await handleAmpelStatsRequest(request(), { token: TOKEN, load: countingLoad });
  ok(noHeader.status === 401 && loads === 0, "missing bearer is 401");

  const wrong = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}x`), {
    token: TOKEN,
    load: countingLoad,
  });
  ok(wrong.status === 401 && loads === 0, "wrong token is 401");

  const shorter = await handleAmpelStatsRequest(request(`Bearer ${TOKEN.slice(0, -1)}`), {
    token: TOKEN,
    load: countingLoad,
  });
  ok(shorter.status === 401 && loads === 0, "shorter token is 401");

  const basic = await handleAmpelStatsRequest(request(`Basic ${TOKEN}`), {
    token: TOKEN,
    load: countingLoad,
  });
  ok(basic.status === 401 && loads === 0, "non-bearer scheme is 401");

  const previous = process.env.ADMIN_TOKEN;
  try {
    delete process.env.ADMIN_TOKEN;
    const fromProcess = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}`), { load: countingLoad });
    ok(fromProcess.status === 404 && loads === 0, "unset process env disables the token door");
    process.env.ADMIN_TOKEN = `  ${TOKEN}  `;
    const trimmed = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}`), {
      load: async () => [],
    });
    ok(trimmed.status === 200, "surrounding whitespace on ADMIN_TOKEN is ignored");
    ok(trimmed.headers["Cache-Control"] === AMPEL_ADMIN_CACHE_CONTROL, "success sets no-store");
    ok(trimmed.headers["X-Robots-Tag"] === AMPEL_ADMIN_ROBOTS_TAG, "success sets noindex");
  } finally {
    if (previous === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previous;
  }

  const post = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}`, STATS_URL, "POST"), {
    token: TOKEN,
    load: countingLoad,
  });
  ok(post.status === 405 && loads === 0, "a valid token still cannot POST");

  ok(noHeader.headers["X-Robots-Tag"] === AMPEL_ADMIN_ROBOTS_TAG, "401 sets noindex");
  ok(noHeader.headers["Cache-Control"] === "no-store", "401 sets no-store");
  ok(JSON.stringify(wrong.body) === JSON.stringify({ error: "Unauthorized" }), "401 body has no lead data");

  const springNow = new Date("2026-03-29T00:30:00.000Z");
  const autumnNow = new Date("2026-10-14T22:30:00.000Z");
  ok(berlinDayStart(2026, 3, 29) === Date.parse("2026-03-28T23:00:00.000Z"), "Berlin midnight before the spring clock change");
  ok(berlinDayStart(2026, 10, 25) === Date.parse("2026-10-24T22:00:00.000Z"), "Berlin midnight on the autumn clock change");
  ok(berlinDayStart(2026, 1, 15) === Date.parse("2026-01-14T23:00:00.000Z"), "Berlin midnight in winter");
  const springWindow = ampelCountWindows(springNow);
  ok(springWindow.todayStart === Date.parse("2026-03-28T23:00:00.000Z"), "today starts at Berlin midnight during CET");
  ok(springWindow.last7Start === Date.parse("2026-03-22T23:00:00.000Z"), "seven Berlin days reach back across the date");
  const autumnWindow = ampelCountWindows(autumnNow);
  ok(autumnWindow.todayStart === Date.parse("2026-10-14T22:00:00.000Z"), "today starts at Berlin midnight when UTC is still the previous day");
  ok(autumnWindow.last7Start === Date.parse("2026-10-08T22:00:00.000Z"), "seven Berlin days start six midnights earlier");

  const rows = [
    lead({
      leadId: "ampel-today",
      email: "today@kunde.example",
      timestamp: "2026-03-28T23:10:00.000Z",
      marketingOptIn: "pending",
      mailed: "",
      ampelLight: "gelb",
      accessToken: "secret-access-token-xyz",
      consentIp: "198.51.100.77",
      ampelAnswers: "SECRETANSWERS",
    }),
    lead({
      leadId: "ampel-week",
      email: "week@kunde.example",
      timestamp: "2026-03-28T22:30:00.000Z",
      marketingOptIn: "confirmed",
      mailed: "ja",
      ampelLight: "gruen",
    }),
    lead({
      leadId: "ampel-old",
      email: "old@kunde.example",
      timestamp: "2026-03-22T22:30:00.000Z",
      marketingOptIn: "",
      mailed: "nein",
      ampelLight: "rot",
    }),
    lead({
      leadId: "ampel-test-today",
      email: "gobd16x-probe@gmail.com",
      timestamp: "2026-03-28T23:20:00.000Z",
      mailed: "ja",
    }),
    lead({
      leadId: "ampel-test-week",
      email: "inbox@mail.tm",
      timestamp: "2026-03-25T12:00:00.000Z",
    }),
    lead({
      leadId: "ampel-invalid",
      email: "undated@kunde.example",
      timestamp: "",
      consentAt: "",
    }),
    lead({
      leadId: "ampel-future",
      email: "future@kunde.example",
      timestamp: "2026-03-30T00:00:00.000Z",
    }),
    lead({
      leadId: "readiness-other",
      email: "not-ampel@kunde.example",
      timestamp: "2026-03-28T23:10:00.000Z",
    }),
    lead({
      leadId: "ampel-expired",
      email: "",
      timestamp: "2026-03-28T23:05:00.000Z",
      status: "ampel_expired",
      marketingOptIn: "",
      ampelLight: "",
    }),
  ];

  const hidden = buildAmpelStats(rows, { now: springNow, includeTests: false });
  ok(hidden.counts.withTests.total === 8, "total includes test rows and skips other lead types");
  ok(hidden.counts.withTests.today === 3, "today follows the Berlin date, including the test row");
  ok(hidden.counts.withTests.last7Days === 5, "seven Berlin days exclude the older and future rows");
  ok(hidden.counts.withoutTests.total === 6, "total without test addresses");
  ok(hidden.counts.withoutTests.today === 2, "today without the test address");
  ok(hidden.counts.withoutTests.last7Days === 3, "seven days without the test address");
  ok(hidden.counts.withTests.last7Days >= hidden.counts.withTests.today, "the week includes today");
  ok(hidden.entries.every((entry) => !entry.test), "the default list hides test addresses");
  ok(!hidden.entries.some((entry) => entry.email.endsWith("@mail.tm")), "a mail.tm row stays hidden");
  const today = hidden.entries.find((entry) => entry.email === "today@kunde.example");
  ok(today?.result === "Gelb" && today.optIn === "unbestätigt", "stored opt-in and light are shown");
  ok(today != null && today.mailed === "unbekannt" && !("utmSource" in today), "an empty mailed cell stays unknown and utm is not reported");
  const week = hidden.entries.find((entry) => entry.email === "week@kunde.example");
  ok(week != null && week.optIn === "bestätigt" && week.mailed === "ja" && !("utmSource" in week), "stored mailed is shown without a source");
  const older = hidden.entries.find((entry) => entry.email === "old@kunde.example");
  ok(older?.optIn === "keins" && older.mailed === "nein", "a recorded nein stays nein");
  const expired = hidden.entries.find((entry) => entry.email === "");
  ok(expired?.optIn === "unbekannt" && expired.result === "unbekannt", "a redacted row does not invent an opt-in");
  ok(hidden.entries[0]?.email === "future@kunde.example", "the newest row is first");

  const shown = buildAmpelStats(rows, { now: springNow, includeTests: true });
  ok(
    shown.includeTests &&
      shown.entries.some((entry) => entry.test && entry.note === "Test" && entry.email === "gobd16x-probe@gmail.com"),
    "the filter can show marked test rows",
  );
  const marked = buildAmpelStats(
    [
      lead({ leadId: "ampel-ex", email: "blob-1@example.com", timestamp: "2023-11-14T22:13:20.000Z" }),
      lead({ leadId: "ampel-ikat", email: "team@ikat-gmbh.de", timestamp: "2026-03-28T23:10:00.000Z" }),
      lead({ leadId: "ampel-sdc", email: "team@sdc-ventures.com", timestamp: "2026-03-28T23:10:00.000Z" }),
      lead({ leadId: "ampel-real", email: "real@kunde.example", timestamp: "2026-03-28T23:10:00.000Z" }),
    ],
    { now: springNow, includeTests: true },
  );
  ok(marked.entries.find((entry) => entry.email === "blob-1@example.com")?.note === "Test", "example.com is labelled Test");
  ok(marked.entries.find((entry) => entry.email === "team@ikat-gmbh.de")?.note === "intern", "ikat-gmbh.de is labelled intern");
  ok(marked.entries.find((entry) => entry.email === "team@sdc-ventures.com")?.note === "intern", "sdc-ventures.com is labelled intern");
  ok(marked.counts.withoutTests.total === 1, "example.com and company domains stay out of the cleaned counter");
  ok(shown.counts.withoutTests.total === hidden.counts.withoutTests.total, "showing test rows does not change the cleaned counter");

  const autumn = buildAmpelStats(
    [
      lead({ leadId: "ampel-a", email: "after@kunde.example", timestamp: "2026-10-14T22:15:00.000Z" }),
      lead({ leadId: "ampel-b", email: "before@kunde.example", timestamp: "2026-10-14T21:30:00.000Z" }),
      lead({ leadId: "ampel-c", email: "edge@kunde.example", timestamp: "2026-10-08T22:00:00.000Z" }),
      lead({ leadId: "ampel-d", email: "outside@kunde.example", timestamp: "2026-10-08T21:30:00.000Z" }),
    ],
    { now: autumnNow },
  );
  ok(autumn.counts.withoutTests.today === 1, "only the instant after Berlin midnight counts as today");
  ok(autumn.counts.withoutTests.last7Days === 3, "the seventh Berlin day includes its midnight and excludes the minute before");

  ok(isAmpelTestEmail("gobd16x-probe@gmail.com"), "gobd16x- local part is a test address");
  ok(isAmpelTestEmail("  Gobd16X-Probe@Gmail.com "), "the test prefix ignores case and space");
  ok(!isAmpelTestEmail("not-gobd16x-probe@gmail.com"), "the prefix must start the local part");
  ok(!isAmpelTestEmail("gobd16xprobe@gmail.com"), "the hyphen belongs to the pattern");
  ok(isAmpelTestEmail("person@maxxspace.com"), "maxxspace.com is a test domain");
  ok(!isAmpelTestEmail("person@sub.maxxspace.com"), "a subdomain of maxxspace.com is not the test domain");
  ok(isAmpelTestEmail("person@mail.tm"), "mail.tm is a test domain");
  ok(!isAmpelTestEmail("person@mail.tm.example"), "a lookalike of mail.tm is kept");
  ok(isAmpelTestEmail("info@gobd-doku-erstellen.de"), "the site domain is a test address");
  ok(!isAmpelTestEmail("info@gobd-doku-erstellen.de.example"), "a lookalike of the site domain is kept");
  ok(isAmpelTestEmail("Cappe@GMX.de"), "cappe@gmx.de is a test address");
  ok(!isAmpelTestEmail("cappe@gmx.com"), "a different gmx host is kept");
  ok(isAmpelTestEmail("kunde@example.com") && ampelAddressNote("kunde@example.com") === "Test", "example.com is a test address");
  ok(!isAmpelTestEmail("kunde@example.com.example"), "a lookalike of example.com is kept");
  ok(!isAmpelTestEmail("kunde@sub.example.com"), "a subdomain of example.com is kept");
  ok(isAmpelTestEmail("person@ikat-gmbh.de") && ampelAddressNote("person@IKAT-GmbH.de") === "intern", "ikat-gmbh.de is internal");
  ok(isAmpelTestEmail("person@sdc-ventures.com") && ampelAddressNote("person@sdc-ventures.com") === "intern", "sdc-ventures.com is internal");
  ok(!isAmpelTestEmail("person@sub.sdc-ventures.com"), "a subdomain of sdc-ventures.com is kept");
  ok(!isAmpelTestEmail("kunde@example.org"), "a normal address is kept");

  const authed = await handleAmpelStatsRequest(
    request(`Bearer ${TOKEN}`, `${STATS_URL}?includeTests=1`),
    { token: TOKEN, load: async () => rows, now: () => springNow },
  );
  ok(authed.status === 200, "the right token returns the report");
  const bodyText = JSON.stringify(authed.body);
  ok(!bodyText.includes("secret-access-token-xyz"), "the report omits the access token");
  ok(!bodyText.includes("198.51.100.77"), "the report omits the consent IP");
  ok(!bodyText.includes("SECRETANSWERS"), "the report omits the answer code");
  ok(reportOf(authed.body).includeTests === true, "includeTests=1 shows test rows");
  ok(reportOf(authed.body).timezone === "Europe/Berlin", "the report names the Berlin timezone");

  await withConsole(async (lines) => {
    const limited = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}`), {
      token: TOKEN,
      load: async () => {
        throw new SheetsUnavailableError(429);
      },
    });
    ok(limited.status === 503, "Sheets 429 becomes 503");
    ok(limited.headers["Retry-After"] === "3", "Sheets 429 sets Retry-After");
    ok(!JSON.stringify(limited.body).includes("@"), "the 429 body has no address");
    const down = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}`), {
      token: TOKEN,
      load: async () => {
        throw new SheetsUnavailableError(503);
      },
    });
    ok(down.status === 503, "Sheets 503 stays 503");
    const leaked = new Error("leak user@example.com from 203.0.113.8");
    leaked.name = "Boom";
    const failed = await handleAmpelStatsRequest(request(`Bearer ${TOKEN}`), {
      token: TOKEN,
      load: async () => {
        throw leaked;
      },
    });
    ok(failed.status === 500, "an unexpected failure is 500");
    ok(!lines.join("\n").includes("user@example.com"), "error logs omit the address");
    ok(!lines.join("\n").includes("203.0.113.8"), "error logs omit the IP");
    ok(lines.some((line) => line.includes("Boom")), "error logs keep the error name");
  });

  const answers = allJa();
  const code = encodeAmpelAnswers(answers);
  ok(code, "fixture answers encode");
  const saved: ReadinessLead[] = [];
  const sent = await deliverAmpelResult(
    "person@example.com",
    answers,
    code ?? "",
    {
      email: "person@example.com",
      answers: code,
      ref: "",
      marketing: true,
      honeypot: "",
      ip: "203.0.113.10",
    },
    {
      now: () => Date.parse("2026-10-14T10:00:00.000Z"),
      mail: async () => ({ sent: true, stub: false }),
      purge: async () => {},
      saveLead: async (row) => {
        saved.push({ ...row });
      },
      confirm: async (input) => {
        ok(input.mailed === "ja" && !("utmSource" in input), "confirmation keeps the mail flag and no source");
        return { ok: true, throttled: false };
      },
    },
  );
  ok(sent.ok && !("honeypot" in sent) && sent.mailed, "a sent result still reports mailed");
  ok(saved[0] != null && saved[0].mailed === "ja" && !("utmSource" in saved[0]), "the sheet row stores mailed and not utm");
  ok(saved[0]?.marketingOptIn === "pending", "a checked opt-in is stored as unconfirmed");

  const savedEmpty: ReadinessLead[] = [];
  await deliverAmpelResult(
    "plain@example.com",
    answers,
    code ?? "",
    {
      email: "plain@example.com",
      answers: code,
      ref: "",
      marketing: false,
      honeypot: "",
      ip: "203.0.113.11",
    },
    {
      now: () => Date.parse("2026-10-14T11:00:00.000Z"),
      mail: async () => ({ sent: true, stub: false }),
      purge: async () => {},
      saveLead: async (row) => {
        savedEmpty.push({ ...row });
      },
      confirm: async () => ({ ok: true, throttled: false }),
    },
  );
  ok(
    savedEmpty[0] != null && savedEmpty[0].mailed === "ja" && savedEmpty[0].marketingOptIn === "" && !("utmSource" in savedEmpty[0]),
    "a sent mail is recorded and no opt-in stays empty",
  );

  const confirmStore = new Map<string, ReadinessLead>();
  const confirmed = await requestAmpelConfirmation(
    {
      email: "keep@example.com",
      answers: code ?? "",
      ref: "",
      mailed: "ja",
    },
    {
      findLead: async () => confirmStore.values().next().value ?? null,
      saveLead: async (row) => {
        confirmStore.set(row.leadId, { ...row });
      },
      sendConfirmation: async () => ({ sent: true, stub: false }),
      now: () => Date.parse("2026-10-14T12:00:00.000Z"),
    },
  );
  const confirmedRow = [...confirmStore.values()].at(-1);
  ok(confirmed.ok && confirmedRow != null && confirmedRow.mailed === "ja" && !("utmSource" in confirmedRow), "the confirmation write keeps mailed and not utm");

  ok(AMPEL_CHECK_RETENTION_DAYS === 90, "the 90-day retention is unchanged");
  const storeSource = readFileSync("lib/store.ts", "utf8");
  const listBody = storeSource.slice(
    storeSource.indexOf("export async function listAmpelLeads"),
    storeSource.indexOf("export type EntityStoreResult"),
  );
  ok(!listBody.includes("redactAmpelLead") && !listBody.includes("purgeExpired"), "the count read does not change retention");

  ok(
    WIPE_EMAIL_ALLOWLIST.every((email) => isAmpelAdminEmail(email)),
    "the admin page reuses the wipe allowlist",
  );
  ok(isAmpelAdminEmail("Philip.Cappelletti@SDC-Ventures.com"), "admin match ignores case");
  ok(!isAmpelAdminEmail("smoke@example.com"), "example.com smoke mail is not an admin");
  ok(!isAmpelAdminEmail("winkler@winkler-segtrop.de"), "comp access is not admin access");
  ok(!isAmpelAdminEmail(null) && !isAmpelAdminEmail(""), "a missing session is not an admin");

  const page = readFileSync("app/admin/ampel/page.tsx", "utf8");
  ok(page.includes("isAmpelAdminEmail") && page.includes("notFound("), "the page refuses anyone outside the allowlist");
  ok(page.includes("index: false") && page.includes("follow: false"), "the page metadata is noindex");
  ok(!page.includes("console."), "the page does not log");
  ok(page.includes("E-Mail-Adresse") && page.includes("{entry.email"), "the admin page shows the stored address");
  ok(!page.includes("UTM") && !page.includes("utm"), "the admin page does not show a source");
  ok(
    (READINESS_SHEET_COLUMNS as readonly string[]).includes("mailed") &&
      !(READINESS_SHEET_COLUMNS as readonly string[]).includes("utm_source"),
    "the sheet stores mailed and not utm_source",
  );
  ok(!bodyText.includes("utmSource") && !bodyText.includes("utm_source"), "the report has no utm field");

  const allowedMentions = new Set([
    "app/admin/ampel/page.tsx",
    "app/api/admin/ampel-stats/route.ts",
    "next.config.ts",
    "scripts/check-ampel-admin.ts",
  ]);
  const files = ["app", "components", "content", "lib"].flatMap((dir) => listSourceFiles(dir));
  ok(files.length > 10, "the link scan sees the app");
  for (const file of files) {
    if (allowedMentions.has(file)) continue;
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("/admin/ampel"), false, `${file} links the admin page`);
    assert.equal(text.includes("/api/admin/ampel-stats"), false, `${file} links the stats API`);
  }
  ok(true, "public pages do not link the admin count");
  ok(!INDEXABLE_STATIC_PATHS.some((path) => path.includes("admin")), "the sitemap source list has no admin path");
  const pages = await sitemap();
  ok(!pages.some((item) => item.url.includes("/admin")), "the sitemap omits the admin page");

  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = Array.isArray(rule?.disallow) ? rule.disallow : rule?.disallow ? [rule.disallow] : [];
  ok(disallow.includes("/admin"), "robots.txt disallows /admin");
  ok(disallow.includes("/api/"), "robots.txt still disallows /api/");

  const configured = await nextConfig.headers?.();
  const pageHeaders = configured?.find((item) => item.source === "/admin/ampel")?.headers ?? [];
  const apiHeaders = configured?.find((item) => item.source === "/api/admin/ampel-stats")?.headers ?? [];
  for (const set of [pageHeaders, apiHeaders]) {
    ok(set.some((item) => item.key === "Cache-Control" && item.value === "no-store"), "config sets no-store");
    ok(set.some((item) => item.key === "X-Robots-Tag" && item.value === "noindex, nofollow"), "config sets the robots header");
  }

  const sheetEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheets@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "not-used";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
  try {
    let refused = false;
    try {
      await createSheetsClient().spreadsheets.values.append({
        spreadsheetId: "sheet-test",
        range: "readiness_leads!A1",
        requestBody: { values: [["blob-0@example.com"]] },
      });
    } catch (error) {
      refused = error instanceof LiveWriteRefusedError;
    }
    ok(refused, "a Sheets append during this check is refused before the network");
    const claim = await tryClaimMailDedupeSlot("ampel-admin-live-write-guard");
    ok(claim === "created" || claim === "exists", "mail dedupe uses the file ledger while Blob credentials are set");
  } finally {
    if (sheetEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = sheetEmail;
    if (sheetKey === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    else process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = sheetKey;
    if (sheetId === undefined) delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    else process.env.GOOGLE_SHEETS_SPREADSHEET_ID = sheetId;
    if (blobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = blobToken;
  }

  console.log("check-ampel-admin: green");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "check-ampel-admin failed");
  process.exit(1);
});
