/**
 * Cookieless homepage CTA counter: whitelist, device class, sheet row, rate limit.
 * Usage: npx tsx scripts/check-home-cta-counter.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeCtaSection } from "@/components/home-cta-admin";
import { POST as postHomeCta, setHomeCtaNowForTest } from "@/app/api/home/cta/route";
import { handleAmpelStatsRequest } from "@/lib/ampel-admin-http";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { ampelStepDate, ampelStepDevice, ampelStepWindowDates, AMPEL_STEP_WINDOW_DAYS } from "@/lib/ampel-step-event";
import { AMPEL_STEP_RATE_LIMIT as RATE_LIMIT, AMPEL_STEP_RATE_WINDOW_MS, clearAmpelStepRateForTest, takeAmpelStepRate } from "@/lib/ampel-step-rate";
import { getHomeCtaSheetsTab } from "@/lib/env";
import { createHomeCtaGesture, releaseHomeView, resetHomeViewForTest, sendHomeCta, sendHomeView } from "@/lib/home-cta-beacon";
import {
  HOME_CTA_COLUMNS,
  HOME_CTA_IDS,
  HOME_CTA_LABELS,
  HOME_CTA_WINDOW_DAYS,
  HOME_VIEW_COUNTING_FROM,
  HOME_VIEW_ENABLED,
  buildHomeCtaReport,
  formatHomeCtaClickRate,
  homeCtaDate,
  homeCtaDevice,
  homeCtaRowsFromValues,
  homeCtaWindowDates,
  homeViewCountingLabel,
  parseHomeCtaBody,
  type HomeCtaId,
  type HomeCtaReport,
  type HomeCtaRow,
} from "@/lib/home-cta-event";
import {
  clearHomeCtaSheetCache,
  installHomeCtaSheetClientForTest,
  type HomeCtaSheetClient,
} from "@/lib/home-cta-store";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import { installSheetsHandler } from "@/lib/sheets-client";

if (!automatedRunForbidsLiveWrites()) {
  process.env.npm_lifecycle_event = "check:home-cta-counter";
}

function ok(condition: unknown, message: string): void {
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
const TOKEN = `home-cta-${"k".repeat(32)}`;

function post(body: unknown, headers: Record<string, string> = {}): Request {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/home/cta", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json", ...headers },
  });
}

function createMock() {
  const titles: string[] = [];
  const written: string[][] = [];
  let adds = 0;
  const client: HomeCtaSheetClient = {
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
      if (range.endsWith("!A:C")) return { data: { values: written.map((row) => [...row]) } };
      if (!range.endsWith("!A1:C1")) throw new Error("bad-range");
      const header = written[0];
      return { data: { values: header ? [[...header]] : [] } };
    },
    async valuesAppend(args) {
      assert.equal(args.valueInputOption, "RAW");
      assert.equal(args.insertDataOption, "INSERT_ROWS");
      assert.equal(args.requestBody.values.length, 1);
      const row = args.requestBody.values[0] ?? [];
      assert.equal(row.length, HOME_CTA_COLUMNS.length);
      written.push([...row]);
      return { data: {} };
    },
  };
  return { client, titles, written, adds: () => adds };
}

function sheetReader(values: string[][] | null, options?: { fail?: string; sheets?: boolean }) {
  let reads = 0;
  let writes = 0;
  const client: HomeCtaSheetClient = {
    async get() {
      reads += 1;
      const present = options?.sheets !== false;
      return {
        data: { sheets: present ? [{ properties: { title: getHomeCtaSheetsTab(), sheetId: 9 } }] : [] },
      };
    },
    async batchUpdate() {
      writes += 1;
      throw new Error("home cta write");
    },
    async valuesGet() {
      reads += 1;
      if (options?.fail) {
        const error = new Error(options.fail);
        error.name = "SheetDown";
        throw error;
      }
      return { data: { values: values ?? [] } };
    },
    async valuesAppend() {
      writes += 1;
      throw new Error("home cta write");
    },
  };
  return { client, reads: () => reads, writes: () => writes };
}

function lead(): ReadinessLead {
  return {
    ...emptyReadinessLead(),
    leadId: "ampel-home-cta",
    email: "steps@kunde.example",
    timestamp: "2026-10-21T22:30:00.000Z",
    ampelLight: "gruen",
    status: "ampel_pdf",
  };
}

function homeCtaOf(body: unknown): Record<string, unknown> {
  ok(body && typeof body === "object" && "homeCta" in body, "the report includes homeCta");
  const homeCta = (body as { homeCta: unknown }).homeCta;
  ok(homeCta && typeof homeCta === "object" && !Array.isArray(homeCta), "homeCta is an object");
  return homeCta as Record<string, unknown>;
}

function savedEnv() {
  return {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    sheet: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    tab: process.env.GOOGLE_SHEETS_HOME_CTA_TAB,
    vercel: process.env.VERCEL_ENV,
    event: process.env.npm_lifecycle_event,
  };
}

function restoreEnv(saved: ReturnType<typeof savedEnv>): void {
  const set = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  set("GOOGLE_SERVICE_ACCOUNT_EMAIL", saved.email);
  set("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", saved.key);
  set("GOOGLE_SHEETS_SPREADSHEET_ID", saved.sheet);
  set("GOOGLE_SHEETS_HOME_CTA_TAB", saved.tab);
  set("VERCEL_ENV", saved.vercel);
  set("npm_lifecycle_event", saved.event);
}

function applySheetEnv(): void {
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheets@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "not-used";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-test";
  delete process.env.GOOGLE_SHEETS_HOME_CTA_TAB;
}

async function withHome(
  path: string,
  beacon: (url: string, data?: BodyInit | null) => boolean,
  run: () => Promise<void> | void,
): Promise<void> {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousBeacon = navigator.sendBeacon;
  (globalThis as { window?: { location: { pathname: string } } }).window = { location: { pathname: path } };
  navigator.sendBeacon = beacon as Navigator["sendBeacon"];
  try {
    await run();
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previousWindow;
    navigator.sendBeacon = previousBeacon;
  }
}

async function main() {
  const saved = savedEnv();
  if (!automatedRunForbidsLiveWrites()) process.env.npm_lifecycle_event = "check:home-cta-counter";
  try {
    ok(automatedRunForbidsLiveWrites(), "check:home-cta-counter keeps live writes closed");
    ok(getHomeCtaSheetsTab() === "home_cta", "the CTA tab defaults to home_cta");
    process.env.GOOGLE_SHEETS_HOME_CTA_TAB = "home_cta_custom";
    ok(getHomeCtaSheetsTab() === "home_cta_custom", "GOOGLE_SHEETS_HOME_CTA_TAB overrides the tab");
    delete process.env.GOOGLE_SHEETS_HOME_CTA_TAB;
    ok(RATE_LIMIT === 60, "the shared in-memory limit is 60 per minute");
    ok(HOME_CTA_WINDOW_DAYS === AMPEL_STEP_WINDOW_DAYS && HOME_CTA_WINDOW_DAYS === 14, "the window is 14 days");
    const buttonIds = HOME_CTA_IDS.filter((id) => id !== "home_view");
    ok(buttonIds.length === 10, "the ten buttons stay on the whitelist");
    ok(HOME_VIEW_ENABLED === true, "home_view is enabled");
    ok(HOME_VIEW_COUNTING_FROM === "2026-10-23", "views count from the Berlin day after 22.10");
    ok(homeViewCountingLabel() === "ab 23.10.2026", "the admin label is ab 23.10.2026");
    ok(formatHomeCtaClickRate(null) === "\u2013", "a zero home_view shows a dash");
    ok(HOME_CTA_IDS.length === 11 && HOME_CTA_IDS.includes("home_view"), "the whitelist is the ten buttons plus the view");
    ok(HOME_CTA_LABELS.home_view.length > 0, "home_view keeps an admin label");
    for (const id of HOME_CTA_IDS) ok(HOME_CTA_LABELS[id].length > 0, `${id} has an admin label`);
    const clocks = [
      "2026-01-15T22:30:00.000Z",
      "2026-03-29T00:30:00.000Z",
      "2026-06-21T21:30:00.000Z",
      "2026-10-21T22:30:00.000Z",
      "2026-10-24T21:30:00.000Z",
    ];
    for (const iso of clocks) {
      const at = new Date(iso);
      ok(homeCtaDate(at) === ampelStepDate(at), `the Berlin day matches the step counter at ${iso}`);
    }
    ok(homeCtaDate(CLOCK) === "2026-10-22" && !homeCtaDate(CLOCK).includes("T") && !homeCtaDate(CLOCK).includes(":"), "the date is the Berlin day and has no time");
    ok(JSON.stringify(homeCtaWindowDates(CLOCK)) === JSON.stringify(ampelStepWindowDates(CLOCK)), "the 14-day window matches the step counter");
    for (const agent of [IPHONE, ANDROID, DESKTOP, "", "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"]) {
      ok(homeCtaDevice(agent) === ampelStepDevice(agent), "the device class matches the step counter");
    }
    ok(homeCtaDevice(IPHONE) === "mobile" && homeCtaDevice(DESKTOP) === "desktop", "a phone is mobile and a desktop stays desktop");

    for (const id of HOME_CTA_IDS) {
      assert.deepEqual(parseHomeCtaBody({ cta: id }), { cta: id }, `${id} is accepted`);
    }
    const rejectedBodies: unknown[] = [
      null,
      [],
      "hero_ampel",
      {},
      { cta: "" },
      { cta: "nope" },
      { cta: "HERO_AMPEL" },
      { cta: "hero_ampel " },
      { cta: "hero_ampel", src: "gads" },
      { cta: "hero_ampel", camp: "landing_pilot" },
      { cta: "hero_ampel", v: "a" },
      { cta: "hero_ampel", device: "mobile" },
      { cta: "hero_ampel", date: "2026-10-22" },
      { event: "home_view" },
      { cta: "home_view", extra: true },
    ];
    for (const body of rejectedBodies) ok(parseHomeCtaBody(body) == null, `rejected body ${JSON.stringify(body)}`);
    assert.deepEqual(parseHomeCtaBody({ cta: "home_view" }), { cta: "home_view" }, "home_view is the only accepted view payload");
    ok(true, "parse keeps only the whitelisted cta");

    const home = readFileSync("app/page.tsx", "utf8");
    const header = readFileSync("components/site-header.tsx", "utf8");
    const beacon = readFileSync("lib/home-cta-beacon.ts", "utf8");
    const events = readFileSync("lib/home-cta-event.ts", "utf8");
    const link = readFileSync("components/home-cta-link.tsx", "utf8");
    const campaign = readFileSync("components/campaign-link.tsx", "utf8");
    const route = readFileSync("app/api/home/cta/route.ts", "utf8");
    const store = readFileSync("lib/home-cta-store.ts", "utf8");
    const adminPage = readFileSync("app/admin/ampel/page.tsx", "utf8");
    const adminTable = readFileSync("components/home-cta-admin.tsx", "utf8");
    const admin = `${adminPage}\n${adminTable}`;
    const http = readFileSync("lib/ampel-admin-http.ts", "utf8");
    const privacy = readFileSync("content/legal/datenschutz.md", "utf8");
    const cookies = readFileSync("content/legal/cookies.md", "utf8");
    ok(home.includes("{HERO_HEADLINE}") && home.includes("{HERO_SUBLINE}") && home.includes("{HERO_PRIMARY}"), "the hero copy constants stay");
    ok(/export const HOME_VIEW_ENABLED = true\b/.test(events), "HOME_VIEW_ENABLED is the compile-time constant true");
    ok(events.includes('HOME_VIEW_COUNTING_FROM = "2026-10-23"'), "the counting date is a constant");
    ok(!events.includes("process.env"), "the view flag is not an env var");
    ok(home.includes("<HomeViewBeacon"), "the homepage keeps the view beacon");
    const viewFn = beacon.slice(beacon.indexOf("export function sendHomeView"));
    ok(
      viewFn.indexOf("HOME_VIEW_ENABLED") !== -1 && viewFn.indexOf('sendHomeCta("home_view")') > viewFn.indexOf("HOME_VIEW_ENABLED"),
      "sendHomeView checks the flag before it sends a view",
    );
    ok(!home.includes('cta="home_view"'), "the view is not a button id on the page");
    for (const id of HOME_CTA_IDS) {
      if (id === "home_view") continue;
      if (id === "header_checkout") {
        ok(header.includes(`cta="${id}"`), "the header CTA is header_checkout");
        continue;
      }
      ok(home.includes(`cta="${id}"`), `${id} is on the homepage`);
    }
    ok(/<HomeCtaLink\b[^>]*cta="hero_muster"/.test(home), "Muster stays off CampaignLink and still counts");
    ok(/<HomeCtaLink\b[^>]*cta="unsure_readiness"/.test(home), "the readiness CTA stays off CampaignLink and still counts");
    for (const id of ["hero_checkout", "price_checkout", "final_checkout", "sticky_checkout"]) {
      ok(new RegExp(`<CampaignLink\\b[^>]*cta="${id}"[^>]*href="/checkout"`).test(home), `${id} stays a checkout CampaignLink`);
    }
    ok(/<CampaignLink\b[^>]*className="btn hide-sm"[^>]*cta="header_checkout"[^>]*href=\{ctaHref\}/.test(header), "the header CTA keeps CampaignLink");
    ok(!home.includes("localStorage") && !home.includes("sessionStorage") && !header.includes("localStorage"), "the page and header still write nothing");
    ok(beacon.includes("navigator.sendBeacon") && beacon.includes("keepalive: true"), "the client uses a beacon and a keepalive fetch");
    ok(beacon.includes('return path === "/"'), "the beacon runs only on the homepage");
    ok(beacon.includes("sendHomeView") && link.includes("releaseHomeView"), "a view is one per entry");
    const onClick = campaign.slice(campaign.indexOf("function onClick"));
    ok(onClick.indexOf("gesture.click") !== -1 && onClick.indexOf("gesture.click") < onClick.indexOf("preventDefault"), "the beacon is sent before navigation");
    ok(!onClick.includes("await "), "the click handler does not wait");
    for (const [file, text] of [
      ["lib/home-cta-beacon.ts", beacon],
      ["components/home-cta-link.tsx", link],
      ["components/campaign-link.tsx", campaign],
    ] as const) {
      for (const banned of ["userAgent", "matchMedia", "innerWidth", "outerWidth", "screen", "devicePixelRatio", "localStorage", "sessionStorage", "document.cookie", "referrer"]) {
        ok(!text.includes(banned), `${file} does not read ${banned}`);
      }
    }
    ok(!beacon.includes("location.search") && !beacon.includes("utm") && !beacon.includes("gclid") && !link.includes("location.search"), "the beacon sends no campaign data");
    ok(!route.includes("console.") && !route.includes("cookies("), "the route does not log and does not read cookies");
    ok(route.includes('headers.get("user-agent")') && route.includes("takeAmpelStepRate"), "device and the rate limit stay on the server");
    ok(store.includes('console.error("[home-cta]", name)') && !store.includes("console.log"), "sheet errors log the error name only");
    ok(store.includes("automatedRunForbidsLiveWrites()") && store.includes('VERCEL_ENV === "preview"'), "checks and previews do not write");
    ok(adminPage.includes("<HomeCtaSection") && admin.includes("Startseite CTA (letzte 14 Tage)") && admin.includes("HOME_CTA_LABELS") && admin.includes("<th>Mobil</th>"), "the admin page shows the CTA table");
    ok(admin.includes("homeViewCountingLabel()") && admin.includes("formatHomeCtaClickRate") && admin.includes("Klickrate"), "the Startseite table shows the click rate");
    ok(admin.includes("\u2013"), "the Startseite table shows a dash when home_view is zero");
    ok(!admin.includes("utm") && !admin.includes("UTM") && !admin.includes("gclid") && !admin.includes("console."), "the admin page still hides source and logs");
    ok(http.includes("readHomeCtaRows(") && http.includes("homeCta"), "the stats handler adds homeCta");
    ok(!http.includes("recordHomeCta") && !http.includes("valuesAppend"), "the stats handler does not write CTA rows");
    const envReads = http.match(/process\.env\.[A-Z0-9_]+/g) ?? [];
    ok(envReads.length === 1 && envReads[0] === "process.env.ADMIN_TOKEN", "stats auth still uses only ADMIN_TOKEN");
    const privacySection = privacy.split("## 6. Vercel Web Analytics")[1]?.split("## 7. Server-Logfiles")[0] ?? "";
    const homepageSentence =
      "Ebenso zählen wir auf unserer Startseite cookielos, wie oft die einzelnen Schaltflächen angeklickt werden (z. B. „Dokumentation erstellen“ oder „Kostenlosen Ampel-Check starten“) und wie oft die Startseite aufgerufen wird.";
    const sentFields =
      "Ihr Browser sendet dazu nur den Namen des Schritts bzw. der Schaltfläche oder die Kennung des Seitenaufrufs, im Ampel-Check zusätzlich die angezeigte Seitenvariante, an unseren eigenen Server, und eine grobe Geräteklasse, die wir auf unserem Server aus der technischen Browserkennung ableiten und danach verwerfen.";
    ok(privacySection.includes(homepageSentence), "section 6 states that the homepage count includes page views");
    ok(privacySection.includes(sentFields), "section 6 names the page-view id in the following sentence");
    ok(!privacySection.includes("nur den Namen des Schritts bzw. der Schaltfläche, im Ampel-Check"), "the old send sentence is not left in place");
    ok(privacy.includes("**Stand:** 26.10.2026"), "the privacy stand date stays");
    ok(!privacy.includes("home_cta") && !cookies.includes("home_cta"), "the legal texts do not name the sheet tab");
    ok(!cookies.includes("wie oft die Startseite aufgerufen wird"), "the cookie notice is unchanged");
    ok(readFileSync("package.json", "utf8").includes("npm run check:home-cta-counter"), "prebuild runs the CTA check");
    ok(!readFileSync("components/vercel-analytics.tsx", "utf8").includes("home_cta"), "there is no Vercel custom event");

    const pending: Array<() => void> = [];
    const gesture = createHomeCtaGesture((release) => pending.push(release));
    let sent = 0;
    const send = () => {
      sent += 1;
    };
    gesture.pointerDown(send);
    gesture.click(send);
    ok(sent === 1, "a press and its click count once");
    gesture.click(send);
    ok(sent === 2, "a keyboard click counts on its own");
    pending.shift()?.();
    gesture.pointerDown(send);
    gesture.pointerDown(send);
    ok(sent === 4, "each press counts");

    resetHomeViewForTest();
    const seen: Blob[] = [];
    let beaconCalls = 0;
    await withHome("/", (url, data) => {
      beaconCalls += 1;
      ok(url === "/api/home/cta", "the beacon posts to /api/home/cta");
      if (data instanceof Blob) seen.push(data);
      return true;
    }, () => {
      sendHomeCta("hero_checkout");
    });
    ok(beaconCalls === 1 && seen.length === 1 && seen[0].type === "application/json", "one beacon carries a json blob");
    assert.deepEqual(JSON.parse(await seen[0].text()), { cta: "hero_checkout" }, "the beacon body is only the cta id");
    beaconCalls = 0;
    await withHome("/checkout", () => {
      beaconCalls += 1;
      return false;
    }, () => {
      sendHomeCta("hero_ampel");
      sendHomeView();
    });
    ok(beaconCalls === 0, "a click off the homepage sends nothing");
    await withHome("/", (_url, data) => {
      if (data instanceof Blob) seen.push(data);
      return true;
    }, () => {
      sendHomeView();
      sendHomeView();
      releaseHomeView();
      sendHomeView();
    });
    const viewPayloads = await Promise.all(seen.slice(1).map((blob) => blob.text()));
    ok(viewPayloads.length === 1 && viewPayloads[0] === '{"cta":"home_view"}', "strict-mode remount sends one view");
    const viewBody = JSON.parse(viewPayloads[0]) as Record<string, unknown>;
    ok(Object.keys(viewBody).length === 1 && viewBody.cta === "home_view", "the view payload contains only the cta id");
    releaseHomeView();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await withHome("/", (_url, data) => {
      if (data instanceof Blob) seen.push(data);
      return true;
    }, () => {
      sendHomeView();
    });
    ok(seen.length === 3, "a later entry sends another view");
    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init: init ?? {} });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    try {
      await withHome("/", () => false, () => {
        sendHomeCta("final_ampel");
      });
    } finally {
      globalThis.fetch = previousFetch;
    }
    ok(fetchCalls.length === 1 && fetchCalls[0].url === "/api/home/cta", "a refused beacon falls back to fetch");
    ok(fetchCalls[0].init.method === "POST" && fetchCalls[0].init.keepalive === true, "the fallback is a keepalive POST");
    assert.deepEqual(JSON.parse(String(fetchCalls[0].init.body)), { cta: "final_ampel" }, "the fallback body is only the cta id");
    resetHomeViewForTest();

    let handlerCalls = 0;
    applySheetEnv();
    installHomeCtaSheetClientForTest(null);
    installSheetsHandler(async () => {
      handlerCalls += 1;
      throw new Error("should-not-write");
    });
    clearAmpelStepRateForTest();
    const guarded = await postHomeCta(post({ cta: "hero_ampel" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.10" }));
    ok(guarded.status === 204 && handlerCalls === 0, "a check run does not write the live sheet");
    const guardedView = await postHomeCta(post({ cta: "home_view" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.10" }));
    ok(guardedView.status === 204 && handlerCalls === 0, "a check run does not write a home_view");
    ok(!guarded.headers.get("set-cookie"), "a CTA response sets no cookie");
    const savedEvent = process.env.npm_lifecycle_event;
    process.env.npm_lifecycle_event = "dev";
    process.env.VERCEL_ENV = "preview";
    const preview = await postHomeCta(post({ cta: "hero_ampel" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.11" }));
    ok(preview.status === 204 && handlerCalls === 0 && !automatedRunForbidsLiveWrites(), "a preview does not write the live sheet");
    const previewView = await postHomeCta(post({ cta: "home_view" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.11" }));
    ok(previewView.status === 204 && handlerCalls === 0, "a preview does not write a home_view");
    if (savedEvent === undefined) delete process.env.npm_lifecycle_event;
    else process.env.npm_lifecycle_event = savedEvent;
    delete process.env.VERCEL_ENV;
    ok(automatedRunForbidsLiveWrites(), "the check guard is restored");

    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    installSheetsHandler(null);
    const unconfigured = await postHomeCta(post({ cta: "hero_ampel" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.12" }));
    ok(unconfigured.status === 204 && handlerCalls === 0, "no write when Sheets is unconfigured");
    const unconfiguredView = await postHomeCta(post({ cta: "home_view" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.12" }));
    ok(unconfiguredView.status === 204 && handlerCalls === 0, "home_view is accepted when Sheets is unconfigured and writes nothing");

    const mock = createMock();
    installHomeCtaSheetClientForTest({ client: mock.client, configured: false });
    const skipped = await postHomeCta(post({ cta: "hero_ampel" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.13" }));
    ok(skipped.status === 204 && mock.written.length === 0, "a disabled sheet client is not written");

    installHomeCtaSheetClientForTest({ client: mock.client, configured: true });
    setHomeCtaNowForTest(() => CLOCK);
    clearAmpelStepRateForTest();
    const rejected: Array<{ body: unknown; label: string }> = [
      { body: { cta: "nope" }, label: "unknown cta" },
      { body: { cta: "hero_ampel", src: "gads" }, label: "src key" },
      { body: { cta: "hero_ampel", camp: "landing_pilot" }, label: "camp key" },
      { body: { cta: "hero_ampel", v: "a" }, label: "variant key" },
      { body: { cta: "hero_ampel", device: "mobile" }, label: "client device" },
      { body: { event: "home_view" }, label: "missing cta" },
      { body: { cta: "hero_ampel", ctaNote: "free text" }, label: "free text" },
      { body: "x".repeat(513), label: "oversized body" },
    ];
    for (const [index, item] of rejected.entries()) {
      const response = await postHomeCta(post(item.body, { "user-agent": IPHONE, "x-real-ip": `203.0.113.${20 + index}` }));
      ok(response.status === 400, `${item.label} returns 400`);
    }
    ok(mock.written.length === 0 && mock.adds() === 0, "rejected bodies do not write a row");
    const afterRejects = await postHomeCta(post({ cta: "hero_ampel" }, { "user-agent": IPHONE, "x-real-ip": "203.0.113.20" }));
    ok(afterRejects.status === 204, "rejected bodies do not consume the rate limit");

    const acceptedIp = "203.0.113.40";
    for (const id of HOME_CTA_IDS) {
      const userAgent = id === "home_view" ? DESKTOP : IPHONE;
      const response = await postHomeCta(post({ cta: id }, { "user-agent": userAgent, "x-real-ip": acceptedIp }));
      ok(response.status === 204, `${id} returns 204`);
    }
    ok(mock.adds() === 1 && mock.titles[0] === "home_cta", "the tab is created once");
    ok(JSON.stringify(mock.written[0]) === JSON.stringify([...HOME_CTA_COLUMNS]), "the header is date, cta, device");
    const example = mock.written.find((row) => row[1] === "hero_ampel");
    console.log("example row:", JSON.stringify(example));
    ok(
      JSON.stringify(example) === JSON.stringify(["2026-10-22", "hero_ampel", "mobile"]),
      "the example row is the Berlin day, the CTA, and mobile",
    );
    const viewRow = mock.written.find((row) => row[1] === "home_view");
    const heroRow = mock.written.find((row) => row[1] === "hero_ampel");
    ok(process.env.VERCEL_ENV !== "preview", "the configured write is not a preview");
    ok(
      viewRow != null && JSON.stringify(viewRow) === JSON.stringify(["2026-10-22", "home_view", "desktop"]),
      "home_view is accepted and written in prod mode as the Berlin day, the event, and the device class",
    );
    ok(viewRow?.length === HOME_CTA_COLUMNS.length && heroRow?.[2] === "mobile", "device comes from the user agent and the view row has no extra field");
    ok(!mock.written.some((row) => row.join(" ").includes(EXAMPLE_IP) || row.join(" ").includes("iPhone")), "rows have no IP and no user agent");
    ok(mock.adds() === 1, "further events do not create the tab again");

    process.env.GOOGLE_SHEETS_HOME_CTA_TAB = "home_cta_custom";
    clearHomeCtaSheetCache();
    const custom = await postHomeCta(post({ cta: "sticky_checkout" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.41" }));
    ok(custom.status === 204 && mock.titles.includes("home_cta_custom"), "the tab name follows the env");
    delete process.env.GOOGLE_SHEETS_HOME_CTA_TAB;

    const lines: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      lines.push(args.map((item) => String(item)).join(" "));
    };
    installHomeCtaSheetClientForTest({
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
    clearHomeCtaSheetCache();
    try {
      const failed = await postHomeCta(post({ cta: "hero_muster" }, { "user-agent": IPHONE, "x-real-ip": "203.0.113.62" }));
      ok(failed.status === 204, "a sheet error still returns 204");
    } finally {
      console.error = originalError;
      installHomeCtaSheetClientForTest({ client: mock.client, configured: true });
    }
    ok(lines.length === 1 && lines[0] === "[home-cta] SheetDown", "a sheet error is logged by name only");
    ok(!lines.join(" ").includes(EXAMPLE_IP) && !lines.join(" ").includes("iPhone"), "the log has no address and no user agent");

    clearAmpelStepRateForTest();
    const floodIp = "203.0.113.70";
    let allowed = 0;
    for (let index = 0; index < RATE_LIMIT; index += 1) {
      const response = await postHomeCta(post({ cta: "header_checkout" }, { "user-agent": DESKTOP, "x-real-ip": floodIp }));
      if (response.status === 204) allowed += 1;
    }
    ok(allowed === RATE_LIMIT, "events inside the rate limit return 204");
    const beforeBlock = mock.written.length;
    const blocked = await postHomeCta(post({ cta: "header_checkout" }, { "user-agent": DESKTOP, "x-real-ip": floodIp }));
    ok(blocked.status === 429 && mock.written.length === beforeBlock, "the next event returns 429 and writes nothing");
    const other = await postHomeCta(post({ cta: "header_checkout" }, { "user-agent": DESKTOP, "x-real-ip": "203.0.113.71" }));
    ok(other.status === 204, "another address is not blocked");
    const stillBlocked = await postHomeCta(post({ cta: "header_checkout" }, { "user-agent": DESKTOP, "x-real-ip": floodIp }));
    ok(stillBlocked.status === 429, "the blocked address stays blocked");
    const later = takeAmpelStepRate(floodIp, Date.now() + AMPEL_STEP_RATE_WINDOW_MS);
    ok(later, "the rate bucket expires with the window");
    clearAmpelStepRateForTest();
    ok(mock.written.every((row) => row.length === HOME_CTA_COLUMNS.length), "every written row has only the three columns");
    ok(readAmpelClientIp(post({ cta: "hero_ampel" }, { "x-real-ip": floodIp })).ip === floodIp, "the route limit uses the same address reader");

    const rows: HomeCtaRow[] = [
      { date: "2026-10-22", cta: "hero_ampel", device: "mobile" },
      { date: "2026-10-22", cta: "hero_ampel", device: "desktop" },
      { date: "2026-10-22", cta: "home_view", device: "mobile" },
      { date: "2026-10-22", cta: "home_view", device: "mobile" },
      { date: "2026-10-08", cta: "sticky_checkout", device: "mobile" },
    ];
    const parsed = homeCtaRowsFromValues([
      [...HOME_CTA_COLUMNS],
      ["2026-10-22T00:00:00", "hero_ampel", "mobile"],
      ["2026-10-22", "hero_ampel", "mobile", "extra"],
      ["2026-10-22", "not_a_cta", "mobile"],
      ["2026-10-22", "hero_ampel", "tablet"],
    ]);
    ok(parsed.length === 1 && parsed[0].cta === "hero_ampel" && parsed[0].device === "mobile", "a timed row, an unknown id and a bad device are ignored");
    const stored = homeCtaRowsFromValues([
      [...HOME_CTA_COLUMNS],
      ["2026-10-22", "home_view", "mobile"],
      ["2026-10-22", "hero_ampel", "desktop"],
    ]);
    ok(stored.some((row) => row.cta === "hero_ampel"), "stored button clicks stay readable");
    ok(stored.some((row) => row.cta === "home_view"), "stored views stay readable and are not deleted");
    const storedBefore = JSON.stringify(stored);
    buildHomeCtaReport(stored, { now: CLOCK });
    ok(JSON.stringify(stored) === storedBefore, "aggregation does not modify stored rows");
    ok(homeCtaRowsFromValues([["date", "cta", "src"], ["2026-10-22", "hero_ampel", "mobile"]]).length === 0, "a foreign header yields no rows");
    const rowsBefore = JSON.stringify(rows);
    const report = buildHomeCtaReport(rows, { now: CLOCK });
    ok(JSON.stringify(rows) === rowsBefore, "aggregation does not modify the sheet rows");
    ok(report.days.length === HOME_CTA_WINDOW_DAYS, "the report covers 14 Berlin days");
    ok(report.days[0].date === "2026-10-09" && report.days.at(-1)?.date === "2026-10-22", "the window ends on the Berlin day");
    const last = report.days.at(-1);
    const hero = last?.counts.find((item) => item.cta === "hero_ampel");
    const view = last?.counts.find((item) => item.cta === "home_view");
    const sticky = last?.counts.find((item) => item.cta === "sticky_checkout");
    ok(hero?.mobile === 1 && hero.desktop === 1 && hero.total === 2, "a CTA splits mobile and desktop");
    ok(view?.mobile === 0 && view.desktop === 0 && view.total === 0, "home_view before 2026-10-23 is ignored");
    const onlyOldViews = buildHomeCtaReport([{ date: "2026-10-22", cta: "home_view", device: "mobile" }], { now: CLOCK });
    ok(!onlyOldViews.hasRows && onlyOldViews.clickRate.homeView === 0 && onlyOldViews.clickRate.rate === null, "views before the reactivation date do not count");
    ok(formatHomeCtaClickRate(onlyOldViews.clickRate.rate) === "\u2013", "ignored views leave the rate as a dash");
    ok(sticky?.total === 0, "a day outside the window is left out");
    ok(report.total.counts.find((item) => item.cta === "hero_ampel")?.total === 2, "the total row sums the window");
    ok(report.clickRate.from === "2026-10-23" && report.clickRate.homeView === 0 && report.clickRate.clicks === 0 && report.clickRate.rate === null, "clicks before the reactivation date stay in the table and out of the rate");
    ok(report.hasRows, "the report notices stored rows");
    ok(!report.days.some((day) => day.date === "2026-10-08"), "the outside day is not a column");
    ok(last?.counts.length === HOME_CTA_IDS.length, "every CTA is present even when it is zero");

    applySheetEnv();
    const values = [[...HOME_CTA_COLUMNS], ...rows.map((row) => [row.date, row.cta, row.device])];
    const populated = sheetReader(values);
    installHomeCtaSheetClientForTest({ client: populated.client, configured: true });
    const counted = await handleAmpelStatsRequest(new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", { headers: { authorization: `Bearer ${TOKEN}` } }), {
      token: TOKEN,
      load: async () => [lead()],
      now: () => CLOCK,
    });
    ok(counted.status === 200 && populated.writes() === 0, "homeCta stats are read-only");
    const body = counted.body as {
      timezone?: string;
      counts?: unknown;
      entries?: Array<{ email?: string }>;
      steps?: unknown;
      homeCta?: { configured?: boolean; error?: boolean; timezone?: string; windowDays?: number; report?: HomeCtaReport };
    };
    ok(body.timezone === "Europe/Berlin" && body.counts != null && Array.isArray(body.entries) && body.steps != null, "lead stats and steps stay on the response");
    ok(body.entries?.[0]?.email === "steps@kunde.example", "lead rows stay on the response");
    const countedHome = homeCtaOf(counted.body);
    ok(countedHome.configured === true && countedHome.error !== true, "a readable sheet sets configured");
    ok(countedHome.timezone === "Europe/Berlin" && countedHome.windowDays === 14, "homeCta uses the Berlin 14-day window");
    assert.deepEqual(body.homeCta?.report, buildHomeCtaReport(rows, { now: CLOCK }), "homeCta matches the admin aggregation");
    ok(body.homeCta?.report?.clickRate.rate === null && body.homeCta.report.clickRate.homeView === 0, "the stats response ignores home_view before 2026-10-23");
    ok(!JSON.stringify(countedHome).includes("gclid") && !JSON.stringify(countedHome).includes("203.0.113"), "homeCta has no click id and no address");

    const rateNow = new Date("2026-10-23T22:30:00.000Z");
    ok(homeCtaDate(rateNow) === "2026-10-24", "the rate clock is the Berlin day after reactivation");
    const rateRows: HomeCtaRow[] = [
      { date: "2026-10-22", cta: "home_view", device: "mobile" },
      { date: "2026-10-22", cta: "home_view", device: "desktop" },
      { date: "2026-10-22", cta: "hero_checkout", device: "mobile" },
      { date: "2026-10-22", cta: "hero_checkout", device: "desktop" },
      { date: "2026-10-23", cta: "home_view", device: "mobile" },
      { date: "2026-10-23", cta: "home_view", device: "desktop" },
      { date: "2026-10-23", cta: "hero_ampel", device: "mobile" },
      { date: "2026-10-23", cta: "hero_ampel", device: "desktop" },
      { date: "2026-10-24", cta: "home_view", device: "mobile" },
      { date: "2026-10-24", cta: "home_view", device: "mobile" },
      { date: "2026-10-24", cta: "sticky_checkout", device: "mobile" },
      { date: "2026-10-10", cta: "home_view", device: "mobile" },
      { date: "2026-10-10", cta: "final_ampel", device: "desktop" },
    ];
    const rateReport = buildHomeCtaReport(rateRows, { now: rateNow });
    const rateDay22 = rateReport.days.find((day) => day.date === "2026-10-22");
    const rateDay23 = rateReport.days.find((day) => day.date === "2026-10-23");
    ok(rateDay22?.counts.find((item) => item.cta === "home_view")?.total === 0, "22.10 views stay out of the daily count");
    ok(rateDay22?.counts.find((item) => item.cta === "hero_checkout")?.total === 2, "22.10 button clicks stay in the per-CTA rows");
    ok(rateDay23?.counts.find((item) => item.cta === "home_view")?.total === 2, "views on the reactivation day count");
    ok(rateReport.total.counts.find((item) => item.cta === "home_view")?.total === 4, "the home_view total is the counted page loads");
    ok(rateReport.clickRate.homeView === 4 && rateReport.clickRate.clicks === 3 && rateReport.clickRate.rate === 0.75, "the click rate is CTA clicks on or after 2026-10-23 divided by home_view");
    ok(formatHomeCtaClickRate(rateReport.clickRate.rate) === "75 %", "the click rate is shown as a percent");
    const ampelRate = rateReport.clickRate.byCta.find((item) => item.cta === "hero_ampel");
    const stickyRate = rateReport.clickRate.byCta.find((item) => item.cta === "sticky_checkout");
    const checkoutRate = rateReport.clickRate.byCta.find((item) => item.cta === "hero_checkout");
    ok(ampelRate?.clicks === 2 && ampelRate.rate === 0.5, "a CTA rate uses only its clicks on or after the reactivation date");
    ok(stickyRate?.clicks === 1 && stickyRate.rate === 0.25, "another CTA rate divides by the same home_view count");
    ok(checkoutRate?.clicks === 0 && checkoutRate.rate === 0, "clicks before the reactivation date are not in that CTA rate");
    ok(rateReport.clickRate.byCta.reduce((sum, item) => sum + item.clicks, 0) === rateReport.clickRate.clicks, "per-CTA clicks add up to the total click rate numerator");
    ok(!rateReport.days.some((day) => day.date === "2026-10-10"), "a view outside the window is not a column");
    const noViews = buildHomeCtaReport([{ date: "2026-10-24", cta: "hero_ampel", device: "mobile" }], { now: rateNow });
    ok(noViews.clickRate.homeView === 0 && noViews.clickRate.clicks === 1 && noViews.clickRate.rate === null, "a click without a counted view has no rate");
    ok(formatHomeCtaClickRate(noViews.clickRate.rate) === "\u2013", "the stats dash is the en dash");
    const rateHtml = renderToStaticMarkup(createElement(HomeCtaSection, { report: rateReport, configured: true, failed: false }));
    ok(rateHtml.includes("Startseite CTA (letzte 14 Tage)") && rateHtml.includes("Klickrate ab 23.10.2026"), "the rendered Startseite table labels the rate ab 23.10.2026");
    ok(rateHtml.includes(">4<") && rateHtml.includes("75 %"), "the rendered table shows the home_view count and the click rate");
    const emptyHtml = renderToStaticMarkup(createElement(HomeCtaSection, { report: noViews, configured: true, failed: false }));
    ok(emptyHtml.includes("\u2013") && !emptyHtml.includes("75 %"), "the rendered table shows a dash when home_view is zero");
    ok(!rateHtml.includes("utm") && !rateHtml.includes("gclid") && !rateHtml.includes("203.0.113"), "the rendered table has no campaign data and no address");
    const rateValues = [[...HOME_CTA_COLUMNS], ...rateRows.map((row) => [row.date, row.cta, row.device])];
    const rateSheet = sheetReader(rateValues);
    installHomeCtaSheetClientForTest({ client: rateSheet.client, configured: true });
    const rateStats = await handleAmpelStatsRequest(new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", { headers: { authorization: `Bearer ${TOKEN}` } }), {
      token: TOKEN,
      load: async () => [lead()],
      now: () => rateNow,
    });
    const rateHome = homeCtaOf(rateStats.body) as { report?: HomeCtaReport };
    assert.deepEqual(rateHome.report?.clickRate, rateReport.clickRate, "the stats response carries the same click rate");
    ok(rateSheet.writes() === 0, "the rate read does not write");

    const missingTab = sheetReader(null, { sheets: false });
    installHomeCtaSheetClientForTest({ client: missingTab.client, configured: true });
    const emptyTab = await handleAmpelStatsRequest(new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", { headers: { authorization: `Bearer ${TOKEN}` } }), {
      token: TOKEN,
      load: async () => [lead()],
      now: () => CLOCK,
    });
    const emptyHome = homeCtaOf(emptyTab.body) as { configured?: boolean; report?: HomeCtaReport };
    ok(emptyTab.status === 200 && emptyHome.configured === true && emptyHome.report?.hasRows === false, "a missing tab is configured and empty");
    ok(missingTab.writes() === 0, "a missing tab is not created by a read");

    const disabled = sheetReader(values);
    installHomeCtaSheetClientForTest({ client: disabled.client, configured: false });
    const disabledResult = await handleAmpelStatsRequest(new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", { headers: { authorization: `Bearer ${TOKEN}` } }), {
      token: TOKEN,
      load: async () => [lead()],
      now: () => CLOCK,
    });
    assert.deepEqual(homeCtaOf(disabledResult.body), { configured: false }, "a disabled test client does not read");
    ok(disabled.reads() === 0, "a disabled test client is not called");

    const failLines: string[] = [];
    console.error = (...args: unknown[]) => {
      failLines.push(args.map((item) => String(item)).join(" "));
    };
    try {
      const failing = sheetReader(null, { fail: `leak ${TOKEN} steps@kunde.example ${IPHONE}` });
      installHomeCtaSheetClientForTest({ client: failing.client, configured: true });
      const broken = await handleAmpelStatsRequest(new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", { headers: { authorization: `Bearer ${TOKEN}` } }), {
        token: TOKEN,
        load: async () => [lead()],
        now: () => CLOCK,
      });
      ok(broken.status === 200, "a CTA sheet failure still returns lead stats");
      assert.deepEqual(homeCtaOf(broken.body), { error: true }, "a CTA sheet failure is homeCta.error and nothing else");
      ok((broken.body as { entries?: Array<{ email?: string }> }).entries?.[0]?.email === "steps@kunde.example", "lead rows survive a CTA failure");
      ok(failing.writes() === 0, "a failed CTA read does not write");
      const logged = failLines.join("\n");
      ok(!logged.includes(TOKEN) && !logged.includes("steps@kunde.example") && !logged.includes("iPhone"), "a CTA failure does not log the token, the address or the user agent");
      ok(logged.includes("[home-cta] SheetDown"), "a CTA failure logs the error name only");
    } finally {
      console.error = originalError;
    }

    const badHeader = sheetReader([["date", "cta", "src"]]);
    installHomeCtaSheetClientForTest({ client: badHeader.client, configured: true });
    const headerFailure = await handleAmpelStatsRequest(new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", { headers: { authorization: `Bearer ${TOKEN}` } }), {
      token: TOKEN,
      load: async () => [lead()],
      now: () => CLOCK,
    });
    ok(headerFailure.status === 200, "a bad CTA header still returns lead stats");
    assert.deepEqual(homeCtaOf(headerFailure.body), { error: true }, "a bad CTA header is homeCta.error");

    installHomeCtaSheetClientForTest(null);
    installSheetsHandler(async () => {
      handlerCalls += 1;
      throw new Error("should-not-read");
    });
    const skippedRead = await handleAmpelStatsRequest(new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", { headers: { authorization: `Bearer ${TOKEN}` } }), {
      token: TOKEN,
      load: async () => [lead()],
      now: () => CLOCK,
    });
    ok(skippedRead.status === 200 && handlerCalls === 0, "a check run does not open the live CTA sheet");
    const skippedHome = homeCtaOf(skippedRead.body) as { configured?: boolean; report?: HomeCtaReport };
    ok(skippedHome.configured === true && skippedHome.report?.hasRows === false, "the skipped live read does not invent rows");

    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    installSheetsHandler(null);
    const unconfiguredStats = await handleAmpelStatsRequest(new Request("https://www.gobd-doku-erstellen.de/api/admin/ampel-stats", { headers: { authorization: `Bearer ${TOKEN}` } }), {
      token: TOKEN,
      load: async () => [lead()],
      now: () => CLOCK,
    });
    assert.deepEqual(homeCtaOf(unconfiguredStats.body), { configured: false }, "an unconfigured CTA sheet sets configured false");
    ok(unconfiguredStats.status === 200, "missing sheet config still returns lead stats");

    const id: HomeCtaId = "hero_ampel";
    ok(id === "hero_ampel", "the id type stays on the whitelist");
    console.log("check-home-cta-counter: ok");
  } finally {
    restoreEnv(saved);
    if (!automatedRunForbidsLiveWrites()) process.env.npm_lifecycle_event = "check:home-cta-counter";
    setHomeCtaNowForTest(null);
    installHomeCtaSheetClientForTest(null);
    installSheetsHandler(null);
    clearAmpelStepRateForTest();
    clearHomeCtaSheetCache();
    resetHomeViewForTest();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
