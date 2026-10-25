/**
 * Prebuild: Vorlagen email gate.
 * Memory store and a fake mail sender. No Sheet write, no Resend call.
 *
 *   npm run check:vorlagen
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createMemoryAmpelRateStore } from "../lib/ampel-rate-limit";
import { LiveWriteRefusedError, automatedRunForbidsLiveWrites } from "../lib/live-write-guard";
import { installSheetsHandler } from "../lib/sheets-client";
import { canonicalUrl, INDEXABLE_STATIC_PATHS } from "../lib/seo";
import sitemap from "../app/sitemap";
import { GET as downloadGet } from "../app/api/magnet/datei/route";
import { POST as requestPost } from "../app/api/magnet/anfordern/route";
import { POST as stepPost } from "../app/api/magnet/step/route";
import { emptyCalc, parseMagnetCalc, viewCalc, type CalcSnapshot } from "../lib/vorlagen/calc";
import {
  confirmMagnet,
  confirmMagnetMarketing,
  requestMagnet,
  renewMagnet,
  setMagnetDepsForTest,
  type MagnetDeps,
} from "../lib/vorlagen/flow";
import {
  MAGNET_DOI_TTL_MS,
  MAGNET_DOWNLOAD_TTL_MS,
  MAGNET_FILENAMES,
} from "../lib/vorlagen/ids";
import { MAGNET_LEAD_COLUMNS, type MagnetLead } from "../lib/vorlagen/lead";
import { buildMagnetDoiMail, buildMagnetFileMail } from "../lib/vorlagen/mail";
import { renderMagnetFile } from "../lib/vorlagen/documents";
import { CHECKLISTE_MARKDOWN } from "../lib/vorlagen/text-checkliste";
import { createMemoryMagnetStore } from "../lib/vorlagen/store";
import { magnetLeadStore } from "../lib/vorlagen/store";
import { clearMagnetStepRateForTest } from "../lib/vorlagen/step-rate";
import { recordMagnetStep } from "../lib/vorlagen/step-store";
import { parseMagnetStepBody } from "../lib/vorlagen/step-event";
import {
  createMagnetDoiToken,
  createMagnetDownloadToken,
  downloadExpiry,
  readMagnetDoiToken,
  readMagnetDownloadToken,
  verifyMagnetDoiToken,
} from "../lib/vorlagen/token";
import { resetTrackingForChecks, trackMagnetConfirmed } from "../lib/tracking";
import type { DedupedMailInput } from "../lib/mail-dedupe";

process.env.npm_lifecycle_event = "check:vorlagen";
process.env.MAGIC_LINK_SECRET = "check-vorlagen-offline-secret";
delete process.env.NEXT_PUBLIC_MAGNET_ADS_CONVERSION;
delete process.env.NEXT_PUBLIC_MAGNET_ADS_SEND_TO;

let failed = 0;
function ok(condition: unknown, label: string) {
  if (condition) {
    console.log(`ok ${label}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${label}`);
}

function source(file: string) {
  return readFileSync(file, "utf8");
}

function filesUnder(dir: string, pattern: RegExp): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(full, pattern));
    else if (pattern.test(entry.name)) found.push(full);
  }
  return found;
}

function pdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const parts: string[] = [];
  for (const block of raw.matchAll(/\[([^\[\]]*)\]\s*TJ/g)) {
    for (const hex of block[1].matchAll(/<([0-9A-Fa-f]+)>/g)) {
      if (hex[1].length % 2 !== 0) continue;
      parts.push(Buffer.from(hex[1], "hex").toString("latin1"));
    }
  }
  return parts.join("");
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function tokenFrom(mail: string): string {
  const match = mail.match(/[?&]token=([^&\s]+)/);
  if (!match) return "";
  return decodeURIComponent(match[1]);
}

function payloadOf(token: string): Record<string, unknown> | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  try {
    return JSON.parse(Buffer.from(token.slice(0, dot), "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const sampleLead: MagnetLead = {
  timestamp: "2026-06-01T10:00:00+02:00",
  leadId: `mg_${"a".repeat(20)}`,
  email: "kunde@example.com",
  magnetId: "checkliste-kassen-nachschau",
  status: "requested",
  doiSentAt: "",
  doiConfirmedAt: "",
  firstDownloadAt: "",
  downloadCount: "0",
  marketingOptIn: "no",
  marketingConfirmedAt: "",
  consentTextVersion: "vorlage:2026-10-25",
  mailStatus: "",
  withdrawnAt: "",
  redactedAt: "",
};

function harness() {
  const store = createMemoryMagnetStore();
  const sent: DedupedMailInput[] = [];
  let clock = Date.parse("2026-06-01T08:00:00.000Z");
  let blocked = false;
  const deps: MagnetDeps = {
    now: () => clock,
    store,
    rate: createMemoryAmpelRateStore(),
    send: async (input) => {
      sent.push(input);
      return { sent: true, stub: false };
    },
    blocked: async () => blocked,
    suppress: async () => undefined,
  };
  setMagnetDepsForTest(deps);
  return {
    store,
    sent,
    setClock(value: number) {
      clock = value;
    },
    clock() {
      return clock;
    },
    setBlocked(value: boolean) {
      blocked = value;
    },
  };
}

async function download(token: string): Promise<Response> {
  return downloadGet(new Request(`https://example.com/api/magnet/datei?token=${encodeURIComponent(token)}`));
}

async function main() {
  let sheetsCalled = false;
  installSheetsHandler(async () => {
    sheetsCalled = true;
    throw new Error("vorlagen-check tried to call Google Sheets");
  });

  ok(automatedRunForbidsLiveWrites(), "check:vorlagen keeps live writes closed");
  let refused = false;
  try {
    await magnetLeadStore().insert(sampleLead);
  } catch (error) {
    refused = error instanceof LiveWriteRefusedError;
  }
  ok(refused, "default lead insert throws LiveWriteRefusedError");
  ok((await magnetLeadStore().listByEmail("kunde@example.com")).length === 0, "check does not list production leads");
  ok((await magnetLeadStore().findById(sampleLead.leadId)) === null, "check does not read a production lead");
  await recordMagnetStep({
    date: "2026-06-01",
    event: "magnet_view",
    n: "1",
    status: "",
    choice: "",
    valid: "",
    v: "default",
    device: "desktop",
  });
  ok(!sheetsCalled, "the check never calls Google Sheets");

  const now = 1_700_000_000_000;
  const doi = createMagnetDoiToken(
    { leadId: sampleLead.leadId, email: sampleLead.email, magnet: "checkliste-kassen-nachschau" },
    now,
  );
  ok(doi !== null && verifyMagnetDoiToken(doi, now + MAGNET_DOI_TTL_MS) !== null, "DOI token lasts 48 hours");
  ok(verifyMagnetDoiToken(doi, now + MAGNET_DOI_TTL_MS + 1) === null, "DOI token ends after 48 hours");
  ok(readMagnetDoiToken(doi, now + MAGNET_DOI_TTL_MS + 1)?.expired === true, "an expired DOI token is marked expired");
  const exp = downloadExpiry(now);
  ok(exp - now === MAGNET_DOWNLOAD_TTL_MS, "download expiry is 30 days after confirmation");
  const downloadToken = createMagnetDownloadToken({
    leadId: sampleLead.leadId,
    email: sampleLead.email,
    magnet: "checkliste-kassen-nachschau",
    exp,
  });
  ok(readMagnetDownloadToken(downloadToken, exp)?.expired === false, "download token is valid through the 30th day");
  ok(readMagnetDownloadToken(downloadToken, exp + 1)?.expired === true, "download token is expired after 30 days");

  const columns = MAGNET_LEAD_COLUMNS.join(",");
  for (const key of ["utm", "gclid", "gbraid", "wbraid", "ref", "kanzlei", "src", "variant", "consent_ip", "has_click", "calc"]) {
    ok(!columns.includes(key), `lead columns omit ${key}`);
  }
  const route = source("app/api/magnet/anfordern/route.ts");
  ok(!route.includes("utm") && !/gclid|gbraid|wbraid/.test(route), "the request route does not read campaign fields");

  const calc: CalcSnapshot = {
    ...emptyCalc(),
    stunden_eigen: 10,
    stundensatz_eigen: 50,
    stunden_stb: 3,
    satz_stb_min: 66,
    satz_stb_max: 164,
    monate_tool: 12,
    hinzuschaetzung_netto: 10000,
    ust_satz: 0.19,
    grenzsteuersatz: 42,
    jahre: 1,
    zinsmonate: 0,
  };
  const view = viewCalc(calc);
  ok(view.eigen.includes("500,00"), "10 hours times 50 euros is 500");
  ok(view.stb.includes("198,00") && view.stb.includes("492,00"), "3 hours times 66 and 164");
  ok(view.tool.includes("737,00"), "12 months of the tool is 737 euros");
  ok(view.blockB.includes("6.100,00") && !view.blockB.includes("und Zinsen"), "block B without interest is 6100");
  const withInterest = viewCalc({ ...calc, zinsmonate: 2 });
  ok(withInterest.blockB.includes("6.118,30") && withInterest.blockB.includes("und Zinsen"), "two interest months add 18.30");
  ok(viewCalc(emptyCalc()).eigen === "Bitte Stunden eingeben", "empty hours stay empty");
  ok(parseMagnetCalc({ ...calc, utm_source: "nope" }) === null, "calc rejects extra keys");
  const bulky = JSON.stringify({ monate_tool: 1, note: "a".repeat(500) });
  ok(Buffer.byteLength(bulky) > 512 && parseMagnetCalc(bulky) === null, "calc rejects a body over 512 bytes");
  ok(parseMagnetCalc({ magnet: "kostenrechner" }) === null, "calc whitelist rejects unknown keys");

  const utm = harness();
  const posted = await requestPost(
    new Request("https://example.com/api/magnet/anfordern", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.10" },
      body: JSON.stringify({
        email: "kunde@example.com",
        magnet: "checkliste-kassen-nachschau",
        marketing: false,
        utm_source: "utm-should-vanish",
        utm_medium: "utm-should-vanish",
        utm_campaign: "utm-should-vanish",
        gclid: "click-should-vanish",
        gbraid: "gbraid-should-vanish",
        wbraid: "wbraid-should-vanish",
        ref: "ref-should-vanish",
        kanzlei: "kanzlei-should-vanish",
        src: "src-should-vanish",
        v: "variant-should-vanish",
        has_click_id: true,
        consent_ip: "198.51.100.9",
      }),
    }),
  );
  ok(posted.status === 200, "a request with campaign fields is accepted");
  const stored = JSON.stringify(utm.store.rows());
  const mailed = utm.sent.map((mail) => `${mail.subject}\n${mail.text}\n${mail.html}`).join("\n");
  for (const marker of [
    "utm-should-vanish",
    "click-should-vanish",
    "gbraid-should-vanish",
    "wbraid-should-vanish",
    "ref-should-vanish",
    "kanzlei-should-vanish",
    "src-should-vanish",
    "variant-should-vanish",
    "198.51.100.9",
  ]) {
    ok(!stored.includes(marker) && !mailed.includes(marker), `campaign value ${marker} is discarded`);
  }
  ok(utm.store.rows()[0]?.marketingOptIn === "no", "marketing stays off when the box is not checked");
  ok(utm.sent.length === 1 && utm.sent[0]?.subject === "Bitte bestätigen Sie Ihre Anforderung", "only the transactional confirmation mail is sent");

  const early = createMagnetDownloadToken({
    leadId: utm.store.rows()[0]!.leadId,
    email: "kunde@example.com",
    magnet: "checkliste-kassen-nachschau",
    exp: utm.clock() + MAGNET_DOWNLOAD_TTL_MS,
  });
  const hidden = await download(early ?? "");
  const hiddenBody = await hidden.text();
  ok(hidden.status === 404 && !hiddenBody.startsWith("%PDF"), "an unconfirmed file URL is not a PDF");

  const doiToken = tokenFrom(utm.sent[0]?.text ?? "");
  const firstConfirm = await confirmMagnet(doiToken);
  ok(firstConfirm.ok === true, "the confirmation link unlocks the file");
  const confirmedAt = utm.store.rows()[0]?.doiConfirmedAt ?? "";
  const fileMails = () => utm.sent.filter((mail) => mail.subject === "Ihre Vorlage").length;
  ok(fileMails() === 1, "confirmation sends one file mail");
  const secondConfirm = await confirmMagnet(doiToken);
  ok(secondConfirm.ok === true && utm.store.rows()[0]?.doiConfirmedAt === confirmedAt, "a second confirmation keeps the original time");
  ok(fileMails() === 1, "a second confirmation does not send another file mail");

  const bad = await download("not-a-token");
  const badBody = await bad.text();
  ok(bad.status === 404 && !badBody.startsWith("%PDF"), "a bad token is not a PDF");
  const stale = createMagnetDownloadToken({
    leadId: utm.store.rows()[0]!.leadId,
    email: "kunde@example.com",
    magnet: "checkliste-kassen-nachschau",
    exp: utm.clock() - 1000,
  });
  const gone = await download(stale ?? "");
  const goneBody = await gone.text();
  ok(gone.status === 410 && !goneBody.startsWith("%PDF"), "an expired download link is not a PDF");

  const fileToken = firstConfirm.ok ? firstConfirm.downloadToken : "";
  const firstFile = await download(fileToken);
  const firstPdf = Buffer.from(await firstFile.arrayBuffer());
  ok(firstFile.status === 200 && firstPdf.subarray(0, 4).toString("latin1") === "%PDF", "the checklist download is a PDF");
  ok(pdfText(firstPdf).includes("Steuer- oder Rechtsberatung"), "the checklist PDF keeps the content wording");
  const secondFile = await download(fileToken);
  ok(secondFile.status === 200, "the download link can be used again");
  ok(utm.store.rows()[0]?.downloadCount === "2", "each download increments the counter");

  const kosten = harness();
  const asked = await requestMagnet({
    email: "kunde-rechner@example.com",
    magnet: "kostenrechner",
    marketing: false,
    calc,
    ip: "203.0.113.20",
  });
  ok(asked.ok === true, "the calculator request is accepted");
  const kostenRow = JSON.stringify(kosten.store.rows());
  ok(!kostenRow.includes("stunden_eigen") && !kostenRow.includes("10000"), "calculator inputs are not stored on the lead");
  const kostenToken = tokenFrom(kosten.sent[0]?.text ?? "");
  const kostenPayload = payloadOf(kostenToken);
  ok(JSON.stringify(kostenPayload?.calc ?? "").includes("10000"), "calculator inputs travel in the signed confirmation token");
  const kostenConfirmed = await confirmMagnet(kostenToken);
  ok(kostenConfirmed.ok === true, "the calculator confirmation succeeds");
  const kostenDownload = kostenConfirmed.ok ? payloadOf(kostenConfirmed.downloadToken) : null;
  ok(JSON.stringify(kostenDownload?.calc ?? "").includes("10000"), "calculator inputs travel in the download token");
  const kostenPdf = (await renderMagnetFile("kostenrechner", calc)).pdf;
  const kostenText = pdfText(kostenPdf);
  ok(kostenText.includes("GoBD Rz. 155"), "the calculator PDF quotes GoBD Rz. 155");
  ok(!kostenText.includes("25000") && !kostenText.includes("25.000"), "the calculator PDF has no fine amount");
  const gliederungText = pdfText((await renderMagnetFile("gliederung-verfahrensdoku", null)).pdf);
  ok(gliederungText.includes("149"), "the outline PDF keeps the content-file price");
  for (const magnet of ["kostenrechner", "checkliste-kassen-nachschau", "gliederung-verfahrensdoku"] as const) {
    const doiMail = buildMagnetDoiMail({ title: "Vorlage", confirmUrl: "https://example.com/vorlagen/bestaetigen?token=abc" });
    const fileMail = buildMagnetFileMail({ title: "Vorlage", downloadUrl: "https://example.com/api/magnet/datei?token=abc" });
    const bundle = `${doiMail.subject}\n${doiMail.text}\n${doiMail.html}\n${fileMail.subject}\n${fileMail.text}\n${fileMail.html}`;
    ok(!bundle.includes("149") && !bundle.includes(magnet), "transactional mail has no price and no product pitch");
  }
  ok(!CHECKLISTE_MARKDOWN.includes("Bußgeld"), "the checklist source has no fine");
  const tree = [
    ...filesUnder("lib/vorlagen", /\.ts$/),
    ...filesUnder("app/vorlagen", /\.tsx?$/),
    ...filesUnder("components", /^vorlagen-.*\.tsx$/),
    "components/kostenrechner.tsx",
  ];
  ok(!tree.some((file) => source(file).includes("10 % des Jahresumsatzes")), "the unused IHK quote is absent");

  const honey = harness();
  const trapped = await requestMagnet({
    email: "kunde@example.com",
    magnet: "gliederung-verfahrensdoku",
    fax_number: "bot",
    ip: "203.0.113.30",
  });
  ok(trapped.ok === true && honey.sent.length === 0 && honey.store.rows().length === 0, "the honeypot sends no mail and writes no row");

  const invalid = await requestMagnet({ email: "kunde@example.com", magnet: "ampel", ip: "203.0.113.31" });
  ok(!invalid.ok && invalid.status === 400, "an unknown magnet is rejected");

  const opted = harness();
  const marketing = await requestMagnet({
    email: "kunde-werbung@example.com",
    magnet: "gliederung-verfahrensdoku",
    marketing: true,
    ip: "203.0.113.32",
  });
  ok(marketing.ok === true, "a checked marketing box is accepted");
  ok(opted.store.rows()[0]?.marketingOptIn === "pending", "marketing stays pending until its own confirmation");
  ok(opted.sent.some((mail) => mail.subject === "Bitte bestätigen Sie Ihre E-Mail"), "marketing sends a separate mail");
  const marketingToken = tokenFrom(opted.sent.find((mail) => mail.subject === "Bitte bestätigen Sie Ihre E-Mail")?.text ?? "");
  const marketingConfirmed = await confirmMagnetMarketing(marketingToken);
  ok(marketingConfirmed.ok === true && opted.store.rows()[0]?.marketingOptIn === "yes", "the marketing link sets yes");
  ok((opted.store.rows()[0]?.marketingConfirmedAt ?? "").length > 0, "the marketing confirmation time is stored");
  const fileOnly = await confirmMagnet(tokenFrom(opted.sent[0]?.text ?? ""));
  ok(fileOnly.ok === true, "the file download works together with marketing");

  const suppressed = harness();
  suppressed.setBlocked(true);
  const blocked = await requestMagnet({
    email: "kunde-stopp@example.com",
    magnet: "checkliste-kassen-nachschau",
    marketing: true,
    ip: "203.0.113.33",
  });
  ok(blocked.ok === true, "a suppressed address still receives the file confirmation");
  ok(suppressed.sent.length === 1 && suppressed.sent[0]?.subject === "Bitte bestätigen Sie Ihre Anforderung", "a suppressed address gets no marketing mail");
  ok(suppressed.store.rows()[0]?.marketingOptIn === "no", "suppression does not leave marketing pending");

  const expired = harness();
  const aged = await requestMagnet({
    email: "kunde-alt@example.com",
    magnet: "checkliste-kassen-nachschau",
    ip: "203.0.113.34",
  });
  ok(aged.ok === true, "the expiring request is stored");
  const agedToken = tokenFrom(expired.sent[0]?.text ?? "");
  expired.setClock(expired.clock() + MAGNET_DOI_TTL_MS + 60_000);
  const agedConfirm = await confirmMagnet(agedToken);
  ok(!agedConfirm.ok && agedConfirm.reason === "expired", "an expired confirmation link asks for a new one");
  const renewed = await renewMagnet(agedToken, { ip: "203.0.113.34" });
  ok(renewed.ok === true && expired.sent.length === 2, "renewing an expired link sends a new mail");

  const limited = harness();
  let lastLimited: { ok: boolean; status?: number } = { ok: true };
  for (let index = 0; index < 4; index += 1) {
    lastLimited = await requestMagnet({
      email: "kunde-limit@example.com",
      magnet: "checkliste-kassen-nachschau",
      ip: "203.0.113.35",
    });
  }
  ok(lastLimited.ok === false && lastLimited.status === 429, "the fourth request from one address is rate limited");

  clearMagnetStepRateForTest();
  ok(parseMagnetStepBody({ event: "magnet_view", n: 1, email: "kunde@example.com" }) === null, "a step body with an email is rejected");
  ok(parseMagnetStepBody({ event: "magnet_view", n: 1, gclid: "x" }) === null, "a step body with a click id is rejected");
  ok(parseMagnetStepBody({ event: "magnet_download", n: 1 }) === null, "the client cannot record a download");
  const withEmail = await stepPost(
    new Request("https://example.com/api/magnet/step", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.70" },
      body: JSON.stringify({ event: "magnet_view", n: 1, email: "kunde@example.com", gclid: "x" }),
    }),
  );
  ok(withEmail.status === 400, "the step route rejects email and click id");
  const oversized = await stepPost(
    new Request("https://example.com/api/magnet/step", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.71" },
      body: `{"event":"magnet_view","n":1,"pad":"${"a".repeat(600)}"}`,
    }),
  );
  ok(oversized.status === 400, "a step body over 512 bytes is rejected");
  let stepStatus = 0;
  for (let index = 0; index < 61; index += 1) {
    const response = await stepPost(
      new Request("https://example.com/api/magnet/step", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.80" },
        body: JSON.stringify({ event: "magnet_view", n: 1 }),
      }),
    );
    stepStatus = response.status;
  }
  ok(stepStatus === 429, "the 61st step from one address is rate limited");

  const gate = source("components/vorlagen-gate.tsx");
  ok(gate.includes("useState(false)") && !gate.includes("defaultChecked"), "the marketing box is not preselected");
  ok(!gate.includes("trackMagnetConfirmed") && !gate.includes("trackLeadSubmit"), "the form does not fire a conversion");
  const panel = source("app/vorlagen/bestaetigen/confirm-panel.tsx");
  const okAt = panel.indexOf("data?.ok && data.downloadToken");
  const trackAt = panel.indexOf("trackMagnetConfirmed()");
  ok(okAt !== -1 && trackAt > okAt, "the conversion runs only after a successful confirmation");
  ok(panel.indexOf("trackLeadSubmit") === -1, "the confirmation does not use the lead conversion");
  ok(!source("components/kostenrechner.tsx").includes("trackMagnetConfirmed"), "the calculator does not convert on its own");

  const calls: unknown[][] = [];
  const storage = new Map<string, string>();
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      location: { protocol: "https:" },
      gtag: (...args: unknown[]) => {
        calls.push(args);
      },
    },
    document: { cookie: "" },
  });
  storage.set("gobd_consent", JSON.stringify({ essential: true, marketing: true }));
  resetTrackingForChecks();
  ok(trackMagnetConfirmed() === false && calls.length === 0, "the ads conversion stays off without the flag, even with consent");

  const scanned = [
    ...filesUnder("app/vorlagen", /\.tsx?$/),
    ...filesUnder("app/api/magnet", /\.ts$/),
    ...filesUnder("lib/vorlagen", /\.ts$/),
    ...filesUnder("components", /^vorlagen-.*\.tsx$/),
    "components/kostenrechner.tsx",
  ];
  for (const file of scanned) {
    const text = stripComments(source(file));
    ok(!text.includes("localStorage") && !text.includes("sessionStorage"), `${file} stores nothing in the browser`);
    ok(!text.includes("philip.cappelletti"), `${file} does not name the owner address`);
    ok(!/\bgclid\b|\bgbraid\b|\bwbraid\b|\butm_/.test(text), `${file} does not handle click ids`);
  }
  const publicPdfs = filesUnder("public", /\.pdf$/i);
  for (const name of Object.values(MAGNET_FILENAMES)) {
    ok(!publicPdfs.some((file) => file.endsWith(name)), `public has no ${name}`);
  }

  const indexable = INDEXABLE_STATIC_PATHS as readonly string[];
  for (const path of [
    "/vorlagen",
    "/vorlagen/kostenrechner",
    "/vorlagen/checkliste-kassen-nachschau",
    "/vorlagen/gliederung-verfahrensdoku",
  ]) {
    ok(indexable.includes(path), `sitemap lists ${path}`);
    ok(!source(`app${path}/page.tsx`).includes("noindex"), `${path} is indexable`);
  }
  for (const path of [
    "/vorlagen/bestaetigen",
    "/vorlagen/erneut",
    "/vorlagen/werbung/bestaetigen",
    "/vorlagen/werbung/abmelden",
  ]) {
    ok(!indexable.includes(path), `sitemap source omits ${path}`);
    ok(source(`app${path}/page.tsx`).includes("index: false"), `${path} is noindex`);
  }
  const entries = await sitemap();
  ok(entries.some((entry) => entry.url === canonicalUrl("/vorlagen")), "the sitemap emits /vorlagen");
  ok(!entries.some((entry) => entry.url === canonicalUrl("/vorlagen/bestaetigen")), "the sitemap omits the confirmation page");

  setMagnetDepsForTest(null);
  if (failed > 0) {
    console.error(`check-vorlagen: ${failed} failed`);
    process.exit(1);
  }
  console.log("check-vorlagen: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
