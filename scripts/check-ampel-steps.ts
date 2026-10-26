/**
 * Cookieless Ampel step counter: whitelist, device class, sheet row, rate limit.
 * Usage: npx tsx scripts/check-ampel-steps.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { getAmpelStepsSheetsTab } from "@/lib/env";
import { installSheetsHandler } from "@/lib/sheets-client";
import {
  AMPEL_STEP_COLUMNS,
  AMPEL_STEP_KNOWN_VARIANTS,
  AMPEL_STEP_WINDOW_DAYS,
  ampelStepDate,
  ampelStepDevice,
  ampelStepRowsFromValues,
  ampelSubmitResultStatus,
  buildAmpelStepReport,
  formatAmpelStepDrop,
  type AmpelStepRow,
} from "@/lib/ampel-step-event";
import { AMPEL_STEP_RATE_LIMIT as RATE_LIMIT, AMPEL_STEP_RATE_WINDOW_MS, clearAmpelStepRateForTest, takeAmpelStepRate } from "@/lib/ampel-step-rate";
import {
  clearAmpelStepSheetCache,
  installAmpelStepSheetClientForTest,
  type AmpelStepSheetClient,
} from "@/lib/ampel-step-store";
import { POST as postAmpelStep, setAmpelStepNowForTest } from "@/app/api/ampel/step/route";

if (!automatedRunForbidsLiveWrites()) {
  process.env.npm_lifecycle_event = "check:ampel-steps";
}

function ok(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  console.log("ok:", message);
}

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const CLOCK = new Date("2026-10-21T22:30:00.000Z");
const EXAMPLE_IP = "203.0.113.44";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/ampel/step", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json", ...headers },
  });
}

function createMock() {
  const titles: string[] = [];
  const written: string[][] = [];
  let adds = 0;
  const client: AmpelStepSheetClient = {
    async get() {
      return {
        data: { sheets: titles.map((title, index) => ({ properties: { title, sheetId: index + 1 } })) },
      };
    },
    async batchUpdate(args) {
      const title = args.requestBody.requests[0]?.addSheet?.properties.title ?? "";
      if (!title || titles.includes(title)) throw new Error("Sheet already exists");
      titles.push(title);
      adds += 1;
      return { data: { replies: [{ addSheet: { properties: { sheetId: titles.length, title } } }] } };
    },
    async valuesGet(args) {
      const range = String(args.range);
      if (range.endsWith("!A:H")) return { data: { values: written.map((row) => [...row]) } };
      if (!range.endsWith("!A1:H1")) throw new Error("bad-range");
      const header = written[0];
      return { data: { values: header ? [[...header]] : [] } };
    },
    async valuesAppend(args) {
      assert.equal(args.valueInputOption, "RAW");
      assert.equal(args.insertDataOption, "INSERT_ROWS");
      assert.equal(args.requestBody.values.length, 1);
      const row = args.requestBody.values[0] ?? [];
      assert.equal(row.length, AMPEL_STEP_COLUMNS.length);
      written.push([...row]);
      return { data: {} };
    },
  };
  return {
    client,
    titles,
    written,
    adds: () => adds,
  };
}

async function main() {
  ok(automatedRunForbidsLiveWrites(), "check:ampel-steps keeps live writes closed");
  ok(getAmpelStepsSheetsTab() === "ampel_steps", "the step tab is ampel_steps");
  ok(RATE_LIMIT === 60, "the in-memory limit is 60 per minute");
  ok(ampelStepDate(CLOCK) === "2026-10-22" && CLOCK.toISOString().slice(0, 10) === "2026-10-21", "the date is the Berlin day, not UTC");
  ok(!ampelStepDate(CLOCK).includes("T") && !ampelStepDate(CLOCK).includes(":"), "the date has no time");
  ok(ampelStepDevice(IPHONE) === "mobile" && ampelStepDevice(ANDROID) === "mobile", "a phone user agent is mobile");
  ok(ampelStepDevice(DESKTOP) === "desktop" && ampelStepDevice("") === "desktop", "a desktop user agent stays desktop");
  ok(ampelStepDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)") === "mobile", "an iPad user agent is mobile");
  ok(ampelSubmitResultStatus({ status: 200 }) === "ok", "a 2xx result is ok");
  ok(ampelSubmitResultStatus({ status: 200, pending: true }) === "pending_ok", "a pending DOI result is pending_ok");
  ok(ampelSubmitResultStatus({ status: 400 }) === "400", "status 400 stays 400");
  ok(ampelSubmitResultStatus({ status: 429 }) === "429", "status 429 stays 429");
  ok(ampelSubmitResultStatus({ status: 503 }) === "5xx", "a server error is 5xx");
  ok(ampelSubmitResultStatus({ status: 0, timedOut: true }) === "timeout", "a client timeout is timeout");
  ok(ampelSubmitResultStatus({ status: 403 }) === null, "an unlisted status is not stored");

  const home = readFileSync("app/page.tsx", "utf8");
  const linked = [...home.matchAll(/\/ampel-check\?[^"'\\\s]*\bv=([a-z0-9_-]+)/g)].map((match) => match[1]);
  ok(linked.includes("a"), "the homepage still links variant a");
  for (const variant of linked) {
    ok((AMPEL_STEP_KNOWN_VARIANTS as readonly string[]).includes(variant), `variant ${variant} is on the step whitelist`);
  }

  const sheetEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  let handlerCalls = 0;
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheets@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "not-used";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
  installSheetsHandler(async () => {
    handlerCalls += 1;
    throw new Error("should-not-write");
  });
  try {
    const guarded = await postAmpelStep(
      post({ event: "ampel_q_view", n: 1 }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.10" }),
    );
    ok(guarded.status === 204 && handlerCalls === 0, "a check run does not write the live sheet");
    ok(!guarded.headers.get("set-cookie"), "a step response sets no cookie");
  } finally {
    installSheetsHandler(null);
    if (sheetEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = sheetEmail;
    if (sheetKey === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    else process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = sheetKey;
    if (sheetId === undefined) delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    else process.env.GOOGLE_SHEETS_SPREADSHEET_ID = sheetId;
  }

  clearAmpelStepRateForTest();
  clearAmpelStepSheetCache();
  const unconfigured = await postAmpelStep(
    post({ event: "ampel_email_view" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.11" }),
  );
  ok(unconfigured.status === 204 && handlerCalls === 0, "no write when Sheets is unconfigured");

  const mock = createMock();
  installAmpelStepSheetClientForTest({ client: mock.client, configured: false });
  const skipped = await postAmpelStep(
    post({ event: "ampel_email_view" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.12" }),
  );
  ok(skipped.status === 204 && mock.written.length === 0, "a disabled sheet client is not written");

  installAmpelStepSheetClientForTest({ client: mock.client, configured: true });
  setAmpelStepNowForTest(() => CLOCK);
  clearAmpelStepRateForTest();

  const rejected: Array<{ body: unknown; label: string }> = [
    { body: { event: "ampel_result", n: 1 }, label: "unknown event" },
    { body: { event: "ampel_q_view", n: 11 }, label: "n=11" },
    { body: { event: "ampel_q_answer", n: 1, answer: "ja" }, label: "answer field" },
    { body: { event: "ampel_q_view", n: 1, color: "gruen" }, label: "extra key" },
    { body: { event: "ampel_q_view", n: "1" }, label: "n as a string" },
    { body: { event: "ampel_submit_click", valid: "true" }, label: "valid as a string" },
    { body: { event: "ampel_q_view", n: 1, v: "A" }, label: "garbage variant" },
    { body: { event: "ampel_q_view", n: 1, v: "a".repeat(21) }, label: "oversized variant" },
    { body: "x".repeat(513), label: "oversized body" },
  ];
  for (const [index, item] of rejected.entries()) {
    const response = await postAmpelStep(
      post(item.body, { "user-agent": IPHONE, "x-real-ip": `203.0.113.${20 + index}` }),
    );
    ok(response.status === 400, `${item.label} returns 400`);
  }
  ok(mock.written.length === 0 && mock.adds() === 0, "rejected bodies do not write a row");

  const accepted = await postAmpelStep(
    post({ event: "ampel_q_view", n: 1, v: "a" }, { "user-agent": IPHONE, "x-real-ip": EXAMPLE_IP }),
  );
  ok(accepted.status === 204, "a valid view returns 204");
  ok(mock.adds() === 1 && mock.titles[0] === "ampel_steps", "the tab is created once");
  ok(JSON.stringify(mock.written[0]) === JSON.stringify([...AMPEL_STEP_COLUMNS]), "the header is the 8 columns");
  const example = mock.written[1];
  console.log("example row:", JSON.stringify(example));
  ok(
    JSON.stringify(example) === JSON.stringify(["2026-10-22", "ampel_q_view", "1", "", "", "", "a", "mobile"]),
    "the example row is date, event, n, empty status, empty choice, empty valid, variant a, mobile",
  );
  ok(/^\d{4}-\d{2}-\d{2}$/.test(example[0]) && !example[0].includes("T") && !example[0].includes(":"), "the date cell is date-only");
  ok(!example.join(" ").includes(EXAMPLE_IP) && !example.join(" ").includes("iPhone"), "the row has no IP and no user agent");

  const desktop = await postAmpelStep(
    post({ event: "ampel_q_answer", n: 2 }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.60" }),
  );
  ok(desktop.status === 204 && mock.written.at(-1)?.[7] === "desktop" && mock.written.at(-1)?.[6] === "default", "a desktop answer without v is default");
  ok(mock.adds() === 1, "a second event does not create the tab again");

  const unknownVariant = await postAmpelStep(
    post({ event: "ampel_email_view", v: "b" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.61" }),
  );
  const storedVariant = mock.written.at(-1) ?? [];
  ok(unknownVariant.status === 204 && storedVariant[6] === "default" && !storedVariant.includes("b"), "an unknown variant is stored as default");

  const lines: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((item) => String(item)).join(" "));
  };
  installAmpelStepSheetClientForTest({
    client: {
      ...mock.client,
      async valuesAppend() {
        const error = new Error(`secret ${EXAMPLE_IP} ${IPHONE}`);
        error.name = "SheetDown";
        throw error;
      },
    },
    configured: true,
  });
  clearAmpelStepSheetCache();
  try {
    const failed = await postAmpelStep(
      post({ event: "ampel_q_view", n: 3 }, { "user-agent": IPHONE, "x-real-ip": "203.0.113.62" }),
    );
    ok(failed.status === 204, "a sheet error still returns 204");
  } finally {
    console.error = originalError;
    installAmpelStepSheetClientForTest({ client: mock.client, configured: true });
  }
  ok(lines.length === 1 && lines[0] === "[ampel-step] SheetDown", "a sheet error is logged by name only");
  ok(!lines.join(" ").includes(EXAMPLE_IP) && !lines.join(" ").includes("iPhone"), "the log has no address and no user agent");

  clearAmpelStepRateForTest();
  const floodIp = "203.0.113.70";
  let allowed = 0;
  for (let index = 0; index < RATE_LIMIT; index += 1) {
    const response = await postAmpelStep(
      post({ event: "consent_choice", choice: "accept" }, { "user-agent": DESKTOP, "x-real-ip": floodIp }),
    );
    if (response.status === 204) allowed += 1;
  }
  ok(allowed === RATE_LIMIT, "events inside the rate limit return 204");
  const beforeBlock = mock.written.length;
  const blocked = await postAmpelStep(
    post({ event: "consent_choice", choice: "reject" }, { "user-agent": DESKTOP, "x-real-ip": floodIp }),
  );
  ok(blocked.status === 429 && mock.written.length === beforeBlock, "the next event returns 429 and writes nothing");
  ok(mock.written.every((row) => row.length === AMPEL_STEP_COLUMNS.length), "every written row has only the 8 columns");
  const later = takeAmpelStepRate(floodIp, Date.now() + AMPEL_STEP_RATE_WINDOW_MS);
  ok(later, "the rate bucket expires with the window");
  clearAmpelStepRateForTest();

  const rows: AmpelStepRow[] = [
    { date: "2026-10-22", event: "ampel_q_view", n: "1", status: "", choice: "", valid: "", v: "a", device: "mobile" },
    { date: "2026-10-22", event: "ampel_q_view", n: "1", status: "", choice: "", valid: "", v: "a", device: "desktop" },
    { date: "2026-10-22", event: "ampel_q_view", n: "2", status: "", choice: "", valid: "", v: "a", device: "mobile" },
    { date: "2026-10-22", event: "ampel_q_answer", n: "1", status: "", choice: "", valid: "", v: "a", device: "mobile" },
    { date: "2026-10-22", event: "ampel_email_view", n: "", status: "", choice: "", valid: "", v: "a", device: "mobile" },
    { date: "2026-10-22", event: "ampel_submit_click", n: "", status: "", choice: "", valid: "true", v: "a", device: "desktop" },
    { date: "2026-10-22", event: "ampel_submit_click", n: "", status: "", choice: "", valid: "false", v: "a", device: "mobile" },
    { date: "2026-10-22", event: "ampel_submit_result", n: "", status: "ok", choice: "", valid: "", v: "a", device: "mobile" },
    { date: "2026-10-22", event: "ampel_submit_result", n: "", status: "pending_ok", choice: "", valid: "", v: "a", device: "desktop" },
    { date: "2026-10-22", event: "consent_choice", n: "", status: "", choice: "accept", valid: "", v: "default", device: "mobile" },
    { date: "2026-10-22", event: "consent_choice", n: "", status: "", choice: "reject", valid: "", v: "default", device: "desktop" },
    { date: "2026-10-08", event: "ampel_q_view", n: "1", status: "", choice: "", valid: "", v: "a", device: "mobile" },
  ];
  const parsed = ampelStepRowsFromValues([
    [...AMPEL_STEP_COLUMNS],
    ["2026-10-22T00:00:00", "ampel_q_view", "1", "", "", "", "a", "mobile"],
    ["2026-10-22", "ampel_q_view", "1", "", "", "", "a", "mobile", "extra"],
  ]);
  ok(parsed.length === 1 && parsed[0].date === "2026-10-22" && parsed[0].n === "1", "a timed row is ignored and an extra cell is not a column");
  const report = buildAmpelStepReport(rows, { now: CLOCK });
  ok(report.days.length === AMPEL_STEP_WINDOW_DAYS, "the report covers 14 Berlin days");
  ok(report.days[0].date === "2026-10-09" && report.days.at(-1)?.date === "2026-10-22", "the window ends on the Berlin day");
  const day = report.days.at(-1);
  const gesamt = day?.devices.find((item) => item.device === "gesamt");
  const mobile = day?.devices.find((item) => item.device === "mobile");
  const desktopStat = day?.devices.find((item) => item.device === "desktop");
  ok(gesamt?.pageview === 2 && mobile?.pageview === 1 && desktopStat?.pageview === 1, "pageview splits mobile and desktop");
  ok(mobile?.emailView === 1 && desktopStat?.submitValid === 1 && mobile?.submitInvalid === 1, "email and submit clicks are counted");
  ok(mobile?.results.ok === 1 && desktopStat?.results.pending_ok === 1, "submit results keep their status");
  ok(mobile?.consentAccept === 1 && desktopStat?.consentReject === 1, "consent choices are counted");
  ok(day?.questions[0].dropPct == null && day?.questions[1].dropPct === 50, "drop is measured against the previous question");
  ok(day?.questions[1].viewed === 1 && day?.questions[0].answered === 1, "question 2 was viewed once and question 1 answered once");
  ok(report.total.devices[0].pageview === 2, "the total row sums the window");
  ok(!report.days.some((item) => item.date === "2026-10-08"), "a day outside the window is left out");
  const onlyA = buildAmpelStepReport(rows, { now: CLOCK, variant: "a" });
  ok(onlyA.days.at(-1)?.devices[0].pageview === 2 && onlyA.days.at(-1)?.devices[0].consentAccept === 0, "variant a leaves the default consent out");
  const onlyDefault = buildAmpelStepReport(rows, { now: CLOCK, variant: "default" });
  ok(onlyDefault.days.at(-1)?.devices[0].pageview === 0 && onlyDefault.days.at(-1)?.devices[0].consentAccept === 1, "variant default keeps the consent row");
  ok(formatAmpelStepDrop(null) === "—" && formatAmpelStepDrop(50) === "50 %" && formatAmpelStepDrop(12.5) === "12,5 %", "drop percents use a German decimal");

  const beacon = readFileSync("lib/ampel-step-beacon.ts", "utf8");
  ok(beacon.includes("navigator.sendBeacon") && beacon.includes("keepalive: true"), "the client uses a beacon and a keepalive fetch");
  ok(!beacon.includes("userAgent") && !beacon.includes("innerWidth") && !beacon.includes("screen"), "the client does not read a device hint");
  ok(!beacon.includes("localStorage") && !beacon.includes("sessionStorage"), "the client does not use storage");
  ok(beacon.includes('path !== "/ampel-check"'), "consent is counted only on the Ampel check");
  const page = readFileSync("app/ampel-check/ampel-check.tsx", "utf8");
  ok(page.includes("sendAmpelQuestionView(step + 1)"), "a shown question sends a view");
  ok(page.includes('sendAmpelStep({ event: "ampel_q_answer", n: step + 1 })'), "an answer sends the question number only");
  ok(page.includes("sendAmpelEmailView()"), "the email form sends a view");
  ok(page.includes('sendAmpelStep({ event: "ampel_submit_click", valid: emailLooksValid(email) })'), "the submit button sends valid");
  ok(page.includes("noteAmpelSubmitResult("), "the submit result is mapped from the response");
  ok(!page.includes("localStorage"), "the check page still has no localStorage");
  const banner = readFileSync("components/consent-banner.tsx", "utf8");
  ok(banner.includes('sendAmpelConsentChoice("accept")') && banner.includes('sendAmpelConsentChoice("reject")'), "the banner sends the choice");
  ok(banner.includes("saveConsent(true)") && banner.includes("saveConsent(false)"), "the banner still saves the choice");
  const admin = readFileSync("app/admin/ampel/page.tsx", "utf8");
  ok(admin.includes("Schritte (letzte 14 Tage)") && admin.includes("isAmpelAdminEmail"), "the admin page shows the step section behind the same auth");
  ok(!admin.includes("utm") && !admin.includes("UTM") && !admin.includes("console."), "the admin page still hides source and logs");
  const privacy = readFileSync("content/legal/datenschutz.md", "utf8");
  const section = privacy.split("## 6. Vercel Web Analytics")[1]?.split("## 7. Server-Logfiles")[0] ?? "";
  const paragraph =
    "**Cookielose Statistik auf der Startseite und im Ampel-Check.** Zusätzlich zählen wir auf der Seite des Ampel-Checks mit einer eigenen, cookielosen Statistik, wie viele Besucher die einzelnen Schritte erreichen (z. B. Frage angezeigt oder beantwortet, E-Mail-Formular angezeigt, Absenden), und welche Auswahl im Cookie-Hinweis getroffen wurde. Ebenso zählen wir auf unserer Startseite cookielos, wie oft die einzelnen Schaltflächen angeklickt werden (z. B. „Dokumentation erstellen“ oder „Kostenlosen Ampel-Check starten“) und wie oft die Startseite aufgerufen wird. Ihr Browser sendet dazu nur den Namen des Schritts bzw. der Schaltfläche oder die Kennung des Seitenaufrufs, im Ampel-Check zusätzlich die angezeigte Seitenvariante, an unseren eigenen Server, und eine grobe Geräteklasse, die wir auf unserem Server aus der technischen Browserkennung ableiten und danach verwerfen. Ihre Antworten, Ihre E-Mail-Adresse, Kennungen und Ihre IP-Adresse speichern wir dafür nicht. Wir speichern je Schritt nur das Datum ohne Uhrzeit, ohne Bezug zu einer Person, und werten dies ausschließlich als Tagessummen aus. Es werden weder Cookies gesetzt noch Informationen auf Ihrem Endgerät gespeichert, und es sind keine Drittanbieter beteiligt. Technisch bedingt wird beim Übertragen Ihre IP-Adresse kurzzeitig von unserem Hosting-Anbieter verarbeitet (siehe Abschnitt „Server-Logfiles“). Rechtsgrundlage ist unser berechtigtes Interesse, unsere Website und den Ampel-Check verständlich und funktionsfähig zu gestalten (Art. 6 Abs. 1 lit. f DSGVO). Sie können dem jederzeit widersprechen (Art. 21 DSGVO), z. B. per E-Mail an info@gobd-doku-erstellen.de.";
  ok(section.includes(paragraph), "section 6 ends with the step paragraph");
  ok(privacy.includes("## 7. Server-Logfiles") && privacy.includes("**Stand:** 26.10.2026"), "the server-log heading and the stand date stay");
  ok(!readFileSync("content/legal/cookies.md", "utf8").includes("Schrittstatistik"), "the cookie notice is unchanged");
  const route = readFileSync("app/api/ampel/step/route.ts", "utf8");
  ok(!route.includes("console.") && !route.includes("cookies("), "the route does not log and does not read cookies");
  const store = readFileSync("lib/ampel-step-store.ts", "utf8");
  ok(store.includes('console.error("[ampel-step]", name)'), "sheet errors log the error name only");
  const rate = readFileSync("lib/ampel-step-rate.ts", "utf8");
  ok(!rate.includes("console.") && rate.includes('createHash("sha256")'), "the rate key is a hash and is not logged");
  ok(readFileSync("package.json", "utf8").includes("npm run check:ampel-steps"), "prebuild runs the step check");

  setAmpelStepNowForTest(null);
  installAmpelStepSheetClientForTest(null);
  clearAmpelStepRateForTest();
  clearAmpelStepSheetCache();
  console.log("check-ampel-steps: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
