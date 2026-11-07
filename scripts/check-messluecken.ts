/**
 * Messlücken: deduped questionnaire starts, autosave is not a start,
 * channel classes, test exclusion, Berlin days, and no identifiers in the row.
 *
 *   npm run check:messluecken
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as postAmpelStep } from "@/app/api/ampel/step/route";
import { handleAmpelStatsRequest } from "@/lib/ampel-admin-http";
import { clearAmpelStepRateForTest } from "@/lib/ampel-step-rate";
import { parseAmpelStepBody } from "@/lib/ampel-step-event";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { getMeasureSheetsTab } from "@/lib/env";
import { MesslueckenSection } from "@/components/messluecken-admin";
import { readMeasureStarts, setMeasureClaimRootForTest } from "@/lib/measure-claim";
import {
  classifyMeasureChannel,
  resolveMeasureChannel,
  type MeasureChannel,
} from "@/lib/measure-channel";
import {
  MEASURE_ACTIVE_SINCE,
  MEASURE_COLUMNS,
  MEASURE_METRICS,
  MEASURE_LABELS,
  MEASURE_NOT_MEASURED_LABEL,
  measureActiveDay,
  measureActiveNote,
  MEASURE_WINDOW_DAYS,
  buildMeasureReport,
  channelTotal,
  measureCells,
  measureDate,
  measureMetricFromAmpelStep,
  shouldCountIntakeStart,
  type MeasureRow,
} from "@/lib/measure-event";
import { recordAmpelMeasure, recordIntakeStart, recordNewAccount, setMeasureNowForTest } from "@/lib/measure-record";
import {
  installMeasureSheetClientForTest,
  liveMeasureWriteAllowed,
  readMeasureRows,
  recordMeasureRow,
  type MeasureSheetClient,
} from "@/lib/measure-store";
import {
  isMeasureTestEmail,
  isMeasureTestReferrer,
  measureCohort,
  measureTestFromAgent,
  setMeasureVercelEnvForTest,
} from "@/lib/measure-test";

function ok(condition: unknown, message: string): asserts condition {
  assert.equal(Boolean(condition), true, message);
}

const CLICK = "CLICK-SECRET";
const MAIL = "buyer@example.com";

function mockSheet() {
  const titles: string[] = [];
  const written: string[][] = [];
  const client: MeasureSheetClient = {
    async get() {
      return {
        data: { sheets: titles.map((title, index) => ({ properties: { title, sheetId: index + 1 } })) },
      };
    },
    async batchUpdate(args) {
      const title = args.requestBody.requests[0]?.addSheet?.properties.title ?? "";
      if (!title || titles.includes(title)) throw new Error("Sheet already exists");
      titles.push(title);
      return { data: { replies: [{ addSheet: { properties: { sheetId: titles.length } } }] } };
    },
    async valuesGet(args) {
      const range = String(args.range);
      if (range.endsWith("!A:E")) return { data: { values: written.map((row) => [...row]) } };
      if (!range.endsWith("!A1:E1")) throw new Error("bad-range");
      const header = written[0];
      return { data: { values: header ? [[...header]] : [] } };
    },
    async valuesAppend(args) {
      const row = args.requestBody.values[0] ?? [];
      assert.equal(row.length, MEASURE_COLUMNS.length);
      written.push([...row]);
      return { data: {} };
    },
  };
  return { client, written, titles };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/ampel/step", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function dataRows(written: string[][]): string[][] {
  return written.filter((row) => row[0] !== "date");
}

async function main() {
  process.env.MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || "messluecken-check-secret";
  setMeasureVercelEnvForTest("production");
  ok(automatedRunForbidsLiveWrites(), "npm run check:messluecken keeps live writes closed");
  ok(getMeasureSheetsTab() === "messluecken", "the tab is messluecken and not an env var");
  ok(!readFileSync("lib/env.ts", "utf8").includes("GOOGLE_SHEETS_MESSLUECKEN"), "no new sheets env var");

  ok(measureDate(new Date("2026-11-07T22:30:00.000Z")) === "2026-11-07", "22:30Z in winter is still the Berlin day");
  ok(measureDate(new Date("2026-11-07T23:30:00.000Z")) === "2026-11-08", "23:30Z in winter is the next Berlin day");
  ok(measureDate(new Date("2026-07-07T21:30:00.000Z")) === "2026-07-07", "21:30Z in summer is still the Berlin day");
  ok(measureDate(new Date("2026-07-07T22:30:00.000Z")) === "2026-07-08", "22:30Z in summer is the next Berlin day");
  ok(!measureDate(new Date("2026-11-07T23:30:00.000Z")).includes("T"), "the bucket is a date");

  const channelCases: Array<{ referrer: string; search: string; channel: MeasureChannel; label: string }> = [
    { referrer: "https://www.google.de/search?q=gobd", search: "", channel: "search_unklar", label: "google search is not certain organic" },
    { referrer: "https://www.google.com/", search: "", channel: "search_unklar", label: "google referrer alone is search_unklar" },
    { referrer: "https://www.bing.com/search?q=a", search: "", channel: "search_unklar", label: "bing is not certain organic" },
    { referrer: "https://duckduckgo.com/", search: "", channel: "search_unklar", label: "duckduckgo is not certain organic" },
    { referrer: "https://www.google.com/", search: `?gclid=${CLICK}`, channel: "paid", label: "gclid" },
    { referrer: "https://www.google.com/", search: "?gbraid=GB", channel: "paid", label: "gbraid" },
    { referrer: "https://www.google.com/", search: "?wbraid=WB", channel: "paid", label: "wbraid" },
    { referrer: "https://www.google.com/", search: "?utm_medium=cpc", channel: "paid", label: "utm_medium cpc" },
    { referrer: "https://www.google.com/", search: "?utm_medium=PAID", channel: "paid", label: "utm_medium paid" },
    { referrer: "https://www.google.com/", search: "?utm_medium=email", channel: "search_unklar", label: "google plus a non-paid medium stays search_unklar" },
    { referrer: "", search: "?utm_medium=cpc", channel: "paid", label: "paid medium without referrer" },
    { referrer: "", search: "", channel: "direct", label: "no referrer and no utm" },
    { referrer: "   ", search: "", channel: "direct", label: "blank referrer is direct" },
    { referrer: "", search: "?utm_source=newsletter", channel: "unknown", label: "utm without paid medium or referrer" },
    { referrer: "https://news.example/story", search: "", channel: "unknown", label: "other site" },
    { referrer: "https://www.googleadservices.com/pagead/aclk", search: "", channel: "unknown", label: "ads host without a click id" },
    { referrer: "https://ads.google.com/aw/overview", search: "", channel: "unknown", label: "ads.google.com is not search" },
    { referrer: "https://www.gobd-doku-erstellen.de/", search: "", channel: "unknown", label: "own site is not direct" },
  ];
  for (const item of channelCases) {
    assert.equal(classifyMeasureChannel({ referrer: item.referrer, search: item.search }), item.channel, item.label);
    const rendered = classifyMeasureChannel({ referrer: item.referrer, search: item.search });
    ok(!rendered.includes(CLICK) && rendered !== item.search, `${item.label} returns only the class`);
  }

  assert.equal(
    resolveMeasureChannel({
      referrerHeader: `https://www.gobd-doku-erstellen.de/ampel-check?gclid=${CLICK}`,
      clientChannel: "search_unklar",
    }),
    "paid",
    "a click id on the request wins",
  );
  assert.equal(
    resolveMeasureChannel({
      referrerHeader: "https://www.gobd-doku-erstellen.de/intake",
      clientChannel: "search_unklar",
    }),
    "search_unklar",
    "an in-memory search class fills a first-party request",
  );
  assert.equal(
    resolveMeasureChannel({
      referrerHeader: "https://www.gobd-doku-erstellen.de/intake",
      clientChannel: "paid",
    }),
    "unknown",
    "client paid without a request signal is unknown",
  );
  assert.equal(
    resolveMeasureChannel({
      referrerHeader: "https://news.example/a",
      clientChannel: "search_unklar",
    }),
    "unknown",
    "an external non-search referrer stays unknown",
  );
  assert.equal(resolveMeasureChannel({ referrerHeader: null, clientChannel: "search_unklar" }), "direct", "no referrer is direct");
  assert.equal(
    resolveMeasureChannel({
      referrerHeader: "https://www.google.de/search?q=gobd",
      clientChannel: "direct",
    }),
    "search_unklar",
    "the server keeps a search referrer as uncertain",
  );
  for (const email of [
    "gobd-test@mail.grokbot.com",
    " GOBD-Test@Mail.GrokBot.com ",
    "gobd-test+e7n@mail.grokbot.com",
    "GOBD-Test+E7N@Mail.Grokbot.com",
    "delivered@resend.dev",
    "A@RESEND.DEV",
    "cappe@gmx.de",
    "Cappe@GMX.de",
  ]) {
    ok(isMeasureTestEmail(email), `${email.trim()} is a test address`);
  }
  for (const email of [
    "other@mail.grokbot.com",
    "gobd-test+@mail.grokbot.com",
    "gobd-test+a.b@mail.grokbot.com",
    "x@mail.resend.dev",
    "kunde@example.com",
    "cappe@gmx.com",
  ]) {
    ok(!isMeasureTestEmail(email), `${email} stays in the standard count`);
  }
  ok(isMeasureTestReferrer("https://grokbot.com/run") && isMeasureTestReferrer("https://www.grokbot.com/a"), "grokbot.com is a test referrer");
  ok(!isMeasureTestReferrer("https://grokbot.com.evil.example/") && !isMeasureTestReferrer("https://example.com/"), "a lookalike host is not a test");
  ok(
    measureTestFromAgent({ ip: "203.0.113.10", userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }) === false,
    "there is no IP or user-agent allowlist, and a bot user-agent is not a test",
  );
  ok(!/\/bot\/i/.test(readFileSync("lib/measure-test.ts", "utf8")), "the test rule is not a blanket bot match");
  ok(measureCohort({ email: "delivered@resend.dev" }) === "test", "a resend.dev address is the test cohort");
  ok(measureCohort({ email: MAIL, referrer: "https://www.grokbot.com/" }) === "test", "a grokbot referrer is the test cohort");
  ok(measureCohort({ email: MAIL, signal: "grokbot" }) === "test", "the in-memory grokbot signal is the test cohort");
  ok(measureCohort({ email: MAIL }) === "standard", "a normal address on production is standard");
  ok(measureCohort({ vercelEnv: "preview", email: MAIL }) === "test", "preview is never standard");
  ok(measureCohort({ vercelEnv: "development", email: MAIL }) === "test", "development is never standard");
  ok(measureCohort({ vercelEnv: undefined, email: MAIL }) === "test", "a missing VERCEL_ENV is never standard");
  ok(measureCohort({ vercelEnv: "production", gobdTest: "1", email: MAIL }) === "test", "gobd_test=1 moves a production event into test");
  ok(measureCohort({ vercelEnv: "production", gobdTest: "0", email: MAIL }) === "standard", "gobd_test=0 does not mark a test and does not change standard");
  ok(
    measureCohort({ vercelEnv: "production", gobdTest: "0", email: "delivered@resend.dev" }) === "test",
    "a false test flag cannot pull a test address back into standard",
  );
  ok(
    measureCohort({ vercelEnv: "production", referrer: "https://www.gobd-doku-erstellen.de/ampel-check?gobd_test=1" }) === "test",
    "the query on the event request is enough",
  );
  for (const vercelEnv of ["preview", "development", undefined, ""]) {
    ok(
      !liveMeasureWriteAllowed({ installed: false, automated: false, vercelEnv, configured: true }),
      `${vercelEnv || "empty"} does not write the live sheet`,
    );
  }
  ok(
    liveMeasureWriteAllowed({ installed: false, automated: false, vercelEnv: "production", configured: true }),
    "production may write the live sheet",
  );
  ok(
    !liveMeasureWriteAllowed({ installed: false, automated: true, vercelEnv: "production", configured: true }),
    "a check run does not write the live sheet",
  );

  ok(shouldCountIntakeStart(null) && shouldCountIntakeStart(undefined), "a missing draft is a start");
  ok(!shouldCountIntakeStart({ draftKey: "email:a:default:gesamt" }), "an existing draft is an autosave, not a start");
  const route = readFileSync("app/api/intake/draft/route.ts", "utf8");
  ok(route.includes("if (!shouldCountIntakeStart(stored)) return;"), "the draft route counts only a missing draft");
  ok(route.includes("noteIntakeStart(request, stored, draft, body)"), "both save paths can note a start");
  const unchanged = route.indexOf("return unchangedResponse(stored)");
  const noted = route.indexOf("noteIntakeStart(request, stored, draft, body)");
  ok(unchanged > 0 && unchanged < noted, "an unchanged autosave returns before a start is noted");
  ok(readFileSync("app/auth/verify/route.ts", "utf8").includes("recordNewAccount"), "magic-link verify counts a new account");
  ok(!readFileSync("lib/checkout-session.ts", "utf8").includes("recordNewAccount"), "checkout sessions are not new accounts");
  ok(!readFileSync("app/api/stripe/webhook/route.ts", "utf8").includes("recordNewAccount"), "Stripe customers are not new accounts");

  const beacon = readFileSync("lib/ampel-step-beacon.ts", "utf8");
  const hints = readFileSync("lib/measure-client.ts", "utf8");
  ok(beacon.includes("measurePageHints()"), "the beacon sends the in-memory class");
  for (const file of [beacon, hints]) {
    ok(!file.includes("localStorage") && !file.includes("sessionStorage") && !file.includes("document.cookie"), "the class is not stored in the browser");
  }
  const form = readFileSync("app/intake/intake-form.tsx", "utf8");
  const localAt = form.indexOf("window.localStorage.setItem");
  const hintAt = form.indexOf("...measurePageHints()");
  ok(localAt > 0 && hintAt > localAt, "the intake save can attach the class");
  ok(!form.slice(localAt, hintAt).includes("measurePageHints"), "the local draft snapshot does not take the class");
  const adminPage = readFileSync("app/admin/ampel/page.tsx", "utf8");
  ok(adminPage.includes("MesslueckenSection") && !adminPage.includes("utm") && !adminPage.includes("gclid"), "the admin page keeps campaign words out of its source");

  ok(parseAmpelStepBody({ event: "ampel_q_view", n: 1, channel: "search_unklar" })?.event === "ampel_q_view", "a search_unklar hint is accepted");
  ok(parseAmpelStepBody({ event: "ampel_q_view", n: 1, channel: "organic" }) === null, "organic is not a stored class");
  ok(parseAmpelStepBody({ event: "ampel_q_view", n: 1, gobd_test: "1" })?.event === "ampel_q_view", "gobd_test=1 is accepted");
  ok(parseAmpelStepBody({ event: "ampel_q_view", n: 1, gobd_test: "yes" }) === null, "a free-form test flag is rejected");
  ok(parseAmpelStepBody({ event: "ampel_q_view", n: 1, channel: "ppc" }) === null, "an unknown channel is rejected");
  ok(parseAmpelStepBody({ event: "ampel_q_view", n: 1, signal: "bot" }) === null, "an unknown signal is rejected");
  ok(parseAmpelStepBody({ event: "ampel_q_answer", n: 1, answer: "ja" }) === null, "an answer value is still rejected");
  assert.deepEqual(measureMetricFromAmpelStep({ event: "ampel_q_view", n: "1", status: "", choice: "", valid: "", v: "default" }), {
    metric: "ampel_start",
    n: "",
  });
  assert.equal(
    measureMetricFromAmpelStep({ event: "ampel_q_view", n: "2", status: "", choice: "", valid: "", v: "default" }),
    null,
  );
  assert.deepEqual(
    measureMetricFromAmpelStep({ event: "ampel_submit_result", n: "", status: "ok", choice: "", valid: "", v: "default" }),
    { metric: "ampel_result", n: "" },
  );
  assert.equal(
    measureMetricFromAmpelStep({ event: "ampel_submit_result", n: "", status: "400", choice: "", valid: "", v: "default" }),
    null,
  );

  const root = mkdtempSync(path.join(tmpdir(), "messluecken-"));
  setMeasureClaimRootForTest(root);
  setMeasureNowForTest(() => new Date("2026-11-07T23:30:00.000Z"));
  const sheet = mockSheet();
  installMeasureSheetClientForTest({ client: sheet.client, configured: true });
  clearAmpelStepRateForTest();

  await recordIntakeStart({
    draftKey: `email:${MAIL}:default:gesamt`,
    email: MAIL,
    referrerHeader: `https://www.gobd-doku-erstellen.de/intake?gclid=${CLICK}`,
    clientChannel: "organic",
  });
  await recordIntakeStart({
    draftKey: `email:${MAIL}:default:gesamt`,
    email: MAIL,
    referrerHeader: "https://www.google.de/",
  });
  ok(!shouldCountIntakeStart({ draftKey: "other" }), "autosave guard");
  const beforeAutosave = dataRows(sheet.written).length;
  if (shouldCountIntakeStart({ draftKey: "other" })) {
    await recordIntakeStart({ draftKey: "should-not-run", email: MAIL });
  }
  ok(dataRows(sheet.written).length === beforeAutosave, "an autosave does not call the counter");
  await recordIntakeStart({
    draftKey: "email:delivered@resend.dev:default:gesamt",
    email: "delivered@resend.dev",
    referrerHeader: "https://www.google.de/search?q=x",
  });
  const intakeRows = dataRows(sheet.written);
  ok(intakeRows.length === 2, "the same draft key counts once, a second key counts again");
  ok(intakeRows[0]?.[0] === "2026-11-08" && intakeRows[0]?.[1] === "intake_start" && intakeRows[0]?.[3] === "paid", "the start uses the Berlin day and paid");
  ok(intakeRows[1]?.[4] === "test" && intakeRows[0]?.[4] === "standard", "the test address is a separate cohort");
  const flat = intakeRows.flat().join(" ");
  ok(!flat.includes(CLICK) && !flat.includes(MAIL) && !flat.includes("203.0.113"), "the row has no click id, email or address");
  const claimFiles = readdirSync(root).filter((name) => name.endsWith(".json"));
  ok(claimFiles.length === 2 && claimFiles.every((name) => /^[0-9a-f]{64}\.json$/.test(name)), "claim names are hashes");
  for (const name of claimFiles) {
    const body = readFileSync(path.join(root, name), "utf8");
    ok(!body.includes(MAIL) && !body.includes("resend.dev") && !body.includes(CLICK), "a claim file has no identifier");
    assert.equal(typeof JSON.parse(body).at, "string");
  }

  setMeasureClaimRootForTest(null);
  const skippedBefore = dataRows(sheet.written).length;
  await recordNewAccount({ email: "neu@kunde.example", referrerHeader: null });
  ok(dataRows(sheet.written).length === skippedBefore, "without a test root a check does not claim or count");
  setMeasureClaimRootForTest(root);
  await recordNewAccount({ email: "Neu@Kunde.example", referrerHeader: null });
  await recordNewAccount({ email: "neu@kunde.example", referrerHeader: "https://www.google.de/" });
  const accounts = dataRows(sheet.written).filter((row) => row[1] === "magic_link_first_login");
  ok(accounts.length === 1 && accounts[0]?.[3] === "direct" && accounts[0]?.[4] === "standard", "the first magic-link account counts once as direct");
  ok(!accounts.flat().join(" ").includes("neu@kunde.example"), "the account row has no email");

  clearAmpelStepRateForTest();
  const paidView = await postAmpelStep(
    post(
      { event: "ampel_q_view", n: 1, channel: "search_unklar" },
      { referer: `https://www.gobd-doku-erstellen.de/ampel-check?gclid=${CLICK}`, "x-real-ip": "203.0.113.20" },
    ),
  );
  ok(paidView.status === 204, "a question view is accepted");
  const answer = await postAmpelStep(
    post(
      { event: "ampel_q_answer", n: 3, channel: "direct" },
      { referer: "https://www.google.de/search?q=gobd", "x-real-ip": "203.0.113.21" },
    ),
  );
  ok(answer.status === 204, "an answer is accepted");
  const emailView = await postAmpelStep(
    post({ event: "ampel_email_view" }, { referer: "https://www.google.de/", "x-real-ip": "203.0.113.22" }),
  );
  ok(emailView.status === 204, "an email view is accepted and is not a funnel row");
  const result = await postAmpelStep(
    post(
      { event: "ampel_submit_result", status: "pending_ok", signal: "grokbot", channel: "unknown" },
      { referer: "https://www.gobd-doku-erstellen.de/ampel-check", "x-real-ip": "203.0.113.23" },
    ),
  );
  ok(result.status === 204, "a pending result is accepted");
  const rejected = await postAmpelStep(
    post(
      { event: "ampel_submit_result", status: "400" },
      { referer: "https://www.google.de/", "x-real-ip": "203.0.113.24" },
    ),
  );
  ok(rejected.status === 204, "a rejected submit is accepted by the beacon");
  const clientPaid = await postAmpelStep(
    post(
      { event: "ampel_q_view", n: 1, channel: "paid" },
      { referer: "https://www.gobd-doku-erstellen.de/ampel-check", "x-real-ip": "203.0.113.25" },
    ),
  );
  ok(clientPaid.status === 204, "a client paid hint is still a valid beacon");

  const funnel = dataRows(sheet.written).filter((row) => row[1]?.startsWith("ampel_"));
  assert.deepEqual(
    funnel.map((row) => [row[1], row[2], row[3], row[4]]),
    [
      ["ampel_start", "", "paid", "standard"],
      ["ampel_answer", "3", "search_unklar", "standard"],
      ["ampel_result", "", "unknown", "test"],
      ["ampel_start", "", "unknown", "standard"],
    ],
    "the funnel keeps start, the question, the result, and drops client-only paid",
  );
  ok(!funnel.flat().join(" ").includes(CLICK), "the funnel row does not keep the click id");

  const now = new Date("2026-11-14T12:00:00.000Z");
  ok(measureDate(now) === "2026-11-14", "14.11. is the Berlin report day");
  const rows: MeasureRow[] = [
    { date: "2026-11-07", metric: "intake_start", n: "", channel: "search_unklar", cohort: "standard" },
    { date: "2026-11-08", metric: "intake_start", n: "", channel: "search_unklar", cohort: "standard" },
    { date: "2026-11-08", metric: "intake_start", n: "", channel: "paid", cohort: "test" },
    { date: "2026-11-08", metric: "ampel_answer", n: "1", channel: "direct", cohort: "standard" },
    { date: "2026-11-08", metric: "ampel_answer", n: "3", channel: "unknown", cohort: "standard" },
    { date: "2026-11-08", metric: "ampel_answer", n: "1", channel: "paid", cohort: "test" },
    { date: "2026-10-01", metric: "magic_link_first_login", n: "", channel: "direct", cohort: "standard" },
  ];
  ok(measureActiveDay("intake_start") === "2026-11-07", "activation is the Berlin day of the fixed instant");
  ok(measureActiveNote("ampel_start") === "ab 20:23", "the activation day is partial from 20:23");
  ok(
    MEASURE_METRICS.every((metric) => MEASURE_ACTIVE_SINCE[metric] === "2026-11-07T20:23:00+01:00"),
    "every metric shares the #321 production activation and does not read a deploy env var",
  );
  const report = buildMeasureReport(rows, { now });
  ok(report.windowDays === MEASURE_WINDOW_DAYS && report.timezone === "Europe/Berlin", "the report is the Berlin window");
  ok(report.metrics.length === 5, "every metric is present");
  const intake = report.metrics.find((item) => item.metric === "intake_start");
  ok(intake && intake.from === "2026-11-07" && intake.activeSince === MEASURE_ACTIVE_SINCE.intake_start && intake.days.length === 14, "intake is measured from the activation day");
  ok(intake?.firstStandardEvent === "2026-11-07", "the first standard row on or after activation is informational");
  ok(intake?.channelBasisLabel === "Kanal des Ereignis-Requests", "the channel is the event request, not the landing");
  const before = intake?.days.find((day) => day.date === "2026-11-06");
  const activationDay = intake?.days.find((day) => day.date === "2026-11-07");
  const on = intake?.days.find((day) => day.date === "2026-11-08");
  const emptyDay = intake?.days.find((day) => day.date === "2026-11-12");
  ok(before && before.measured === false && !before.partial, "a day before activation is not measured");
  ok(
    activationDay?.measured === true && activationDay.partial && channelTotal(activationDay.standard) === 1,
    "the activation day counts the standard row that already exists",
  );
  ok(on && on.measured && !on.partial && on.standard.search_unklar === 1 && channelTotal(on.test) === 1, "tests stay out of the standard cells");
  ok(emptyDay?.measured === true && channelTotal(emptyDay.standard) === 0 && channelTotal(emptyDay.test) === 0, "a later day without rows is a real zero");
  ok(intake && channelTotal(intake.total.standard) === 2 && channelTotal(intake.total.test) === 1, "standard rows on and after activation are counted");
  const login = report.metrics.find((item) => item.metric === "magic_link_first_login");
  ok(login?.firstStandardEvent == null && login?.days.find((day) => day.date === "2026-11-08")?.measured === true, "no standard event leaves a measured zero and does not invent a first event");
  const answerReport = report.metrics.find((item) => item.metric === "ampel_answer");
  const answerDay = answerReport?.days.find((day) => day.date === "2026-11-08");
  ok(answerDay?.answers.find((item) => item.n === 1)?.standard.direct === 1, "question 1 is its own answer count");
  ok(answerDay?.answers.find((item) => item.n === 3)?.standard.unknown === 1, "question 3 is its own answer count");
  ok(answerDay?.answers.find((item) => item.n === 1)?.test.paid === 1, "a test answer is not in the standard question count");
  ok(!report.metrics.some((item) => item.days.some((day) => day.date === "2026-10-01")), "a day outside the window is left out");

  const html = renderToStaticMarkup(createElement(MesslueckenSection, { report, configured: true, failed: false }));
  ok(html.includes(MEASURE_NOT_MEASURED_LABEL), "the admin view says nicht gemessen");
  ok(html.includes("Sie sehen") && html.includes("Messbeginn 07.11.2026") && html.includes("ab 20:23"), "the admin view uses Sie, the activation day and the partial clock");
  ok(html.includes("Suche, unklar") && html.includes("Kanal des Ereignis-Requests"), "the admin view shows the uncertain search class and the event-request channel");
  ok(html.includes(MEASURE_LABELS.magic_link_first_login), "the admin view names the magic-link login");
  ok(!html.includes(">Organisch<") && !html.includes("zählen als organisch"), "the admin view does not call a search referrer organic");
  ok(!html.includes(MAIL) && !html.includes(CLICK) && !html.includes("203.0.113"), "the admin view has no visitor identifier");

  const loaded = await readMeasureRows();
  ok(loaded.configured && loaded.rows.length === dataRows(sheet.written).length, "the sheet reader keeps the written rows");
  const bad: MeasureSheetClient = {
    async get() {
      throw Object.assign(new Error("messluecken-header"), { name: "MeasureHeaderError" });
    },
    async batchUpdate() {
      return { data: {} };
    },
    async valuesGet() {
      return { data: { values: [] } };
    },
    async valuesAppend() {
      return { data: {} };
    },
  };
  installMeasureSheetClientForTest({ client: bad, configured: true });
  const stats = await handleAmpelStatsRequest(
    new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", {
      headers: { authorization: "Bearer messluecken-check" },
    }),
    {
      token: "messluecken-check",
      load: async () => [],
      now: () => now,
    },
  );
  ok(stats.status === 200, "a measure read failure does not replace the lead report");
  const body = stats.body as { messluecken?: { error?: boolean; configured?: boolean } };
  ok(body.messluecken?.error === true, "the failure stays on messluecken");
  ok(!JSON.stringify(body).includes(MAIL) && !JSON.stringify(body).includes(CLICK), "the stats payload has no identifier from this check");

  const cells = measureCells({ date: "2026-11-08", metric: "intake_start", n: "", channel: "paid", cohort: "standard" });
  assert.deepEqual(cells, ["2026-11-08", "intake_start", "", "paid", "standard"]);

  installMeasureSheetClientForTest({ client: sheet.client, configured: true });
  const afterTestsFirst = await readMeasureStarts();
  ok(afterTestsFirst.standard.ampel_result == null, "a first test result does not write a standard marker");
  ok(afterTestsFirst.test.ampel_result === "2026-11-08", "the test start stays on its own key");
  const testOnlyReport = buildMeasureReport(
    dataRows(sheet.written).map((row) => ({
      date: row[0] ?? "",
      metric: row[1] as MeasureRow["metric"],
      n: row[2] ?? "",
      channel: row[3] as MeasureRow["channel"],
      cohort: row[4] as MeasureRow["cohort"],
    })),
    { now },
  );
  const testOnlyResult = testOnlyReport.metrics.find((item) => item.metric === "ampel_result");
  ok(
    testOnlyResult?.activeSince === MEASURE_ACTIVE_SINCE.ampel_result &&
      testOnlyResult.firstStandardEvent == null &&
      testOnlyResult.days.find((day) => day.date === "2026-11-08")?.measured === true &&
      channelTotal(testOnlyResult.days.find((day) => day.date === "2026-11-08")?.standard ?? { search_unklar: 0, paid: 0, direct: 0, unknown: 0 }) === 0,
    "after only a test result the standard day is a measured zero and activation is unchanged",
  );
  mkdirSync(path.join(root, "starts"), { recursive: true });
  writeFileSync(path.join(root, "starts", "ampel_result.json"), JSON.stringify({ date: "2026-11-02" }));
  const ignoredLegacy = await readMeasureStarts();
  ok(ignoredLegacy.standard.ampel_result == null, "the old shared start file is not adopted");
  setMeasureNowForTest(() => new Date("2026-11-10T12:00:00.000Z"));
  await recordAmpelMeasure({
    metric: "ampel_result",
    n: "",
    referrerHeader: "https://www.gobd-doku-erstellen.de/ampel-check",
    clientChannel: "direct",
  });
  const afterStandard = await readMeasureStarts();
  ok(afterStandard.standard.ampel_result == null, "a standard event does not write a standard marker");
  ok(afterStandard.test.ampel_result === "2026-11-08", "the standard event does not move the test marker");
  const withStandard = buildMeasureReport(
    dataRows(sheet.written).map((row) => ({
      date: row[0] ?? "",
      metric: row[1] as MeasureRow["metric"],
      n: row[2] ?? "",
      channel: row[3] as MeasureRow["channel"],
      cohort: row[4] as MeasureRow["cohort"],
    })),
    { now: new Date("2026-11-14T12:00:00.000Z") },
  );
  ok(
    withStandard.metrics.find((item) => item.metric === "ampel_result")?.firstStandardEvent === "2026-11-10",
    "the first standard event is the earliest standard row, not the old marker",
  );
  setMeasureNowForTest(() => new Date("2026-11-11T12:00:00.000Z"));
  await recordAmpelMeasure({
    metric: "ampel_result",
    n: "",
    gobdTest: "1",
    referrerHeader: "https://www.gobd-doku-erstellen.de/ampel-check?gobd_test=1",
    clientChannel: "direct",
  });
  const afterLaterTest = await readMeasureStarts();
  const afterLaterReport = buildMeasureReport(
    dataRows(sheet.written).map((row) => ({
      date: row[0] ?? "",
      metric: row[1] as MeasureRow["metric"],
      n: row[2] ?? "",
      channel: row[3] as MeasureRow["channel"],
      cohort: row[4] as MeasureRow["cohort"],
    })),
    { now: new Date("2026-11-14T12:00:00.000Z") },
  );
  ok(afterLaterTest.standard.ampel_result == null && afterLaterTest.test.ampel_result === "2026-11-08", "a later test does not write or move markers");
  ok(
    afterLaterReport.metrics.find((item) => item.metric === "ampel_result")?.firstStandardEvent === "2026-11-10" &&
      afterLaterReport.metrics.find((item) => item.metric === "ampel_result")?.activeSince === MEASURE_ACTIVE_SINCE.ampel_result,
    "a later test does not move activation or the first standard event",
  );
  ok(readFileSync(path.join(root, "starts", "ampel_result.json"), "utf8").includes("2026-11-02"), "the old start file is left untouched");
  setMeasureVercelEnvForTest("preview");
  installMeasureSheetClientForTest({ client: sheet.client, configured: true });
  const previewBefore = dataRows(sheet.written).length;
  await recordMeasureRow({ date: "2026-11-14", metric: "ampel_start", n: "", channel: "paid", cohort: "standard" });
  const previewRow = dataRows(sheet.written).at(-1);
  ok(dataRows(sheet.written).length === previewBefore + 1 && previewRow?.[4] === "test", "a non-production write that a test client accepts is stored as test");
  installMeasureSheetClientForTest(null);
  const skippedPreview = dataRows(sheet.written).length;
  await recordMeasureRow({ date: "2026-11-14", metric: "ampel_start", n: "", channel: "direct", cohort: "standard" });
  ok(dataRows(sheet.written).length === skippedPreview, "preview does not append to the live sheet");
  setMeasureVercelEnvForTest("production");
  installMeasureSheetClientForTest(null);
  await recordMeasureRow({ date: "2026-11-14", metric: "ampel_start", n: "", channel: "direct", cohort: "standard" });
  ok(dataRows(sheet.written).length === skippedPreview, "a check run does not append even when the override says production");

  setMeasureNowForTest(null);
  setMeasureClaimRootForTest(null);
  setMeasureVercelEnvForTest(null);
  installMeasureSheetClientForTest(null);
  clearAmpelStepRateForTest();
  console.log("check-messluecken: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
