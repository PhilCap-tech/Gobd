/**
 * Kanzlei-Toolbox draft: register file, opaque id, no UTM/ref storage,
 * name only after verification, report threshold, retention.
 * Usage: npx tsx scripts/check-kanzlei-toolbox.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { POST as postAmpelStep, setAmpelStepNowForTest } from "@/app/api/ampel/step/route";
import { POST as postKanzleiReport } from "@/app/api/steuerberater/toolbox/bericht/route";
import { GET as getKanzleiCron } from "@/app/api/cron/kanzlei-toolbox/route";
import { AMPEL_QUESTIONS } from "@/lib/ampel-questions";
import { KASSEN_QUESTIONS } from "@/lib/kassen-check-questions";
import { deliverAmpelResult } from "@/lib/ampel-result-send";
import { encodeAmpelAnswers, type AmpelAnswerMap } from "@/lib/ampel-score";
import { AMPEL_STEP_COLUMNS } from "@/lib/ampel-step-event";
import { clearAmpelStepRateForTest } from "@/lib/ampel-step-rate";
import {
  clearAmpelStepSheetCache,
  installAmpelStepSheetClientForTest,
  type AmpelStepSheetClient,
} from "@/lib/ampel-step-store";
import { kanzleiHinweisText } from "@/lib/kanzlei-toolbox-copy";
import {
  buildKanzleiToolboxMail,
  kanzleiMailAllowed,
  kanzleiToolboxDoiKey,
  kanzleiToolboxKitKey,
  KANZLEI_MAIL_BLOCKED,
  KANZLEI_MAIL_SINK,
} from "@/lib/kanzlei-toolbox-mail";
import {
  KANZLEI_ID_RE,
  KANZLEI_RETENTION,
  allocateKanzleiSlug,
  buildMonthReport,
  emptyKanzleiFile,
  emptyKanzleiVerification,
  isKanzleiId,
  nameShown,
  newKanzleiId,
  reportValue,
  type KanzleiToolboxRecord,
} from "@/lib/kanzlei-toolbox";
import { confirmKanzleiToolbox, kanzleiEntryPath, revokeKanzleiToolbox, submitKanzleiToolbox } from "@/lib/kanzlei-toolbox-flow";
import {
  installKanzleiToolboxSheetClientForTest,
  kanzleiToolboxLiveSheetBlocked,
  kanzleiToolboxSheetIoAllowed,
  setKanzleiToolboxSheetEnabledForTest,
  type KanzleiToolboxSheetClient,
} from "@/lib/kanzlei-toolbox-sheet";
import {
  addKanzleiCount,
  issueKanzleiReportToken,
  issueKanzleiRevokeToken,
  lookupPublicKanzlei,
  purgeKanzleiToolboxFile as purgeStore,
  readKanzleiToolbox,
  resolveAdvisorRef,
  runKanzleiToolboxRetention,
  setKanzleiToolboxFileForTest,
  updateKanzleiToolbox,
} from "@/lib/kanzlei-toolbox-store";
import { hashKanzleiReportToken, kanzleiLinkSecretShape } from "@/lib/kanzlei-toolbox-token";
import { analyticsPageLocation } from "@/lib/tracking";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import type { ReadinessLead } from "@/lib/readiness";

if (!automatedRunForbidsLiveWrites()) {
  process.env.npm_lifecycle_event = "check:kanzlei-toolbox";
}

function ok(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  console.log("ok:", message);
}

function source(file: string): string {
  return readFileSync(file, "utf8");
}

function keysOf(value: unknown, found: string[] = []): string[] {
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    found.push(key);
    if (Array.isArray(child)) child.forEach((item) => keysOf(item, found));
    else keysOf(child, found);
  }
  return found;
}

function record(input: Partial<KanzleiToolboxRecord> & Pick<KanzleiToolboxRecord, "kanzleiId" | "slug" | "status">): KanzleiToolboxRecord {
  return {
    displayName: "Nordlicht Steuerberatung",
    website: "https://example.org",
    email: "kanzlei@example.org",
    city: "Hamburg",
    test: false,
    registeredAt: "2026-10-25T00:00:00.000Z",
    doiConfirmedAt: "2026-10-25T00:00:00.000Z",
    verifiedAt: "",
    removedAt: "",
    reportOptIn: true,
    consentAt: "2026-10-25T00:00:00.000Z",
    consentText: "Einwilligung",
    consentTextVersion: "2026-10-25-entwurf",
    authorityConfirmed: true,
    termsAccepted: true,
    reportTokenHash: "",
    reportTokenExp: 0,
    doiTokenHash: "",
    doiTokenExp: 0,
    revokeTokenHash: "",
    revokeTokenExp: 0,
    verification: {
      ...emptyKanzleiVerification(),
      emailDomain: "example.org",
      websiteDomain: "example.org",
      domainsMatch: true,
      freemail: false,
      impressumReachable: true,
      nameInImpressum: true,
      verzeichnisChecked: input.status === "verified",
    },
    ...input,
  };
}

function stepRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/ampel/step", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      "x-real-ip": ip,
    },
  });
}

function sheetMock(): { client: AmpelStepSheetClient; written: string[][] } {
  const titles: string[] = [];
  const written: string[][] = [];
  const client: AmpelStepSheetClient = {
    async get() {
      return { data: { sheets: titles.map((title, index) => ({ properties: { title, sheetId: index + 1 } })) } };
    },
    async batchUpdate(args) {
      const title = args.requestBody.requests[0]?.addSheet?.properties.title ?? "";
      titles.push(title);
      return { data: { replies: [{ addSheet: { properties: { sheetId: titles.length } } }] } };
    },
    async valuesGet(args) {
      if (String(args.range).endsWith("!A1:H1")) {
        const header = written[0];
        return { data: { values: header ? [[...header]] : [] } };
      }
      return { data: { values: written.map((row) => [...row]) } };
    },
    async valuesAppend(args) {
      const row = args.requestBody.values[0] ?? [];
      assert.equal(row.length, AMPEL_STEP_COLUMNS.length);
      written.push([...row]);
      return { data: {} };
    },
  };
  return { client, written };
}

async function main(): Promise<void> {
  ok(automatedRunForbidsLiveWrites(), "the check keeps live sheet and blob writes closed");
  ok(KANZLEI_RETENTION.contactDays === 30, "contact data is kept 30 days after the end");
  ok(KANZLEI_RETENTION.unconfirmedDays === 30, "an unconfirmed signup is kept 30 days");
  ok(KANZLEI_RETENTION.attributionMonths === 12, "attribution is kept 12 months");
  ok(KANZLEI_RETENTION.aggregateMonths === 24, "daily aggregates are kept 24 months");
  ok(KANZLEI_RETENTION.blockYears === 3 && KANZLEI_RETENTION.consentYears === 3, "blocklist and consent proof are kept 3 years");
  ok(KANZLEI_RETENTION.reportMinimum === 5, "the report threshold is 5");
  ok(reportValue(0) === "unter 5" && reportValue(4) === "unter 5" && reportValue(5) === "5", "values under 5 render as unter 5");

  const freshId = newKanzleiId();
  ok(isKanzleiId(freshId) && KANZLEI_ID_RE.test(freshId) && !freshId.includes("nord"), "a new id is opaque and has no name");

  const taken = new Set(["nordlicht-ab12"]);
  const drawn = ["nordlicht-ab12", "nordlicht-cd34"];
  const slug = allocateKanzleiSlug(taken, "Nordlicht", () => drawn.shift() ?? "nordlicht-zzzz");
  ok(slug === "nordlicht-cd34", "a reserved slug is not reused");

  const storeSource = source("lib/kanzlei-toolbox-store.ts");
  const sheetSource = source("lib/kanzlei-toolbox-sheet.ts");
  const toolboxSource = source("lib/kanzlei-toolbox.ts");
  ok(!storeSource.includes("@vercel/blob") && !storeSource.includes("createSheetsClient"), "the store file does not open Blob or Sheets itself");
  ok(sheetSource.includes("createSheetsClient"), "the prepared register uses the existing Sheets client");
  ok(!storeSource.includes("upsertReadinessLead"), "the register does not write the lead sheet");
  ok(storeSource.includes("kanzlei-toolbox.json"), "the file remains the store while the sheet switch is off");
  ok(toolboxSource.includes("export const KANZLEI_TOOLBOX_SHEET_ENABLED = false"), "the sheet switch stays off");
  ok(sheetSource.includes('process.env.VERCEL_ENV === "preview"'), "preview does not open the live sheet");
  ok(sheetSource.includes("kanzlei_toolbox") || source("lib/env.ts").includes('return "kanzlei_toolbox"'), "the prepared tab is kanzlei_toolbox");
  ok(!sheetSource.includes("utm_") && !sheetSource.includes("advisor_ref"), "the sheet columns do not carry utm or ref");

  const stripe = source("lib/stripe.ts");
  const checkout = source("app/api/checkout/route.ts");
  const cta = source("components/ampel-result.tsx");
  const campaign = source("lib/campaign-params.ts");
  const campaignLink = source("components/campaign-link.tsx");
  for (const [name, text] of [
    ["stripe", stripe],
    ["checkout", checkout],
    ["ampel cta", cta],
    ["campaign params", campaign],
    ["campaign link", campaignLink],
  ] as const) {
    ok(!text.toLowerCase().includes("kanzlei"), `${name} has no kanzlei parameter`);
  }
  ok(cta.includes('href="/checkout"'), "the Ampel CTA stays a plain checkout link");
  const vercel = source("vercel.json");
  ok(vercel.includes('"/api/cron/kanzlei-toolbox"') && vercel.includes('"0 3 * * *"'), "the daily Kanzlei cron is registered");
  ok(!vercel.includes("lifecycle"), "the removed lifecycle cron stays gone");
  const cronSource = source("app/api/cron/kanzlei-toolbox/route.ts");
  ok(cronSource.includes("CRON_SECRET") && cronSource.includes("authorization"), "the cron checks the CRON_SECRET bearer header");
  ok(!cronSource.includes("console."), "the cron does not log the request");
  const bericht = source("app/steuerberater/toolbox/bericht/page.tsx");
  ok(bericht.includes("index: false") && bericht.includes('referrer: "no-referrer"'), "the report page is noindex and sends no referrer");
  ok(!bericht.includes("console.") && !bericht.includes("searchParams") && !bericht.includes("?token="), "the report page does not read or log a query token");
  const reportRoute = source("app/api/steuerberater/toolbox/bericht/route.ts");
  ok(!reportRoute.includes("console."), "the report POST does not log the body");
  const reportClient = source("app/steuerberater/toolbox/bericht/report-client.tsx");
  ok(reportClient.includes('method: "POST"') && reportClient.includes("location.hash") && !reportClient.includes("console."), "the report client posts the fragment and does not log it");
  const ampelPage = source("app/ampel-check/page.tsx");
  ok(ampelPage.includes("generateMetadata") && ampelPage.includes("index: false"), "a kanzlei query noindexes the Ampel page");
  const config = source("next.config.ts");
  ok(config.includes('key: "kanzlei"') && config.includes('value: "noindex"'), "query kanzlei and /k send X-Robots-Tag noindex");
  ok(
    config.includes('"/steuerberater/toolbox/bericht"') &&
      config.includes('"/api/steuerberater/toolbox/bericht"') &&
      config.includes('value: "no-referrer"'),
    "the report page and POST set Referrer-Policy no-referrer",
  );
  ok(source("app/k/[slug]/route.ts").includes('"X-Robots-Tag": "noindex"'), "the /k redirect stays noindex");

  const sendSource = source("lib/ampel-result-send.ts");
  ok(sendSource.includes('lead.utmSource = flow ? "" : attribution.utmSource'), "a toolbox lead stores no utm source");
  ok(sendSource.includes('lead.utmCampaign = flow ? "" : attribution.utmCampaign'), "a toolbox lead stores no utm campaign");
  ok(sendSource.includes("resolveAdvisorRef(input.ref)") && sendSource.includes('const ref = flow ? "" : await resolveAdvisorRef(input.ref)'), "a toolbox lead stores no free-text ref");
  ok(sendSource.includes('utmSource: flow ? "" : attribution.utmSource'), "a toolbox confirmation stores no utm source");

  const page = source("app/ampel-check/ampel-check.tsx");
  ok(page.includes("AMPEL_SHARE_KANZLEI"), "the share card still uses the toolbox copy");
  ok(!page.includes('name="ref"') && !page.includes("Empfohlen von"), "free-text ref is not shown as a recommendation");
  ok(!page.includes("submitUtmFields"), "the Ampel submit does not send utm");
  ok(!page.includes('htmlFor="ampel-ref"') && !page.includes(">Name der Kanzlei<") && !page.includes("setRefName"), "the Ampel name field does not write advisor_ref");
  ok(page.includes('ref: hint ? "" : refName'), "a toolbox visit submits an empty ref");
  ok(!source("app/kassen-check/kassen-check.tsx").includes("Name der Kanzlei"), "Kassen has no free-text kanzlei name field");
  const beacon = source("lib/ampel-step-beacon.ts");
  ok(beacon.includes("setAmpelKanzleiStepId") && !beacon.includes("localStorage") && !beacon.includes("sessionStorage"), "the opaque id stays in memory");
  const stepRoute = source("app/api/ampel/step/route.ts");
  ok(
    stepRoute.includes("delete record.k") &&
      stepRoute.indexOf("withoutKanzleiKey(parsed)") < stepRoute.indexOf("parseAmpelStepBody(body)"),
    "k is removed before the step sheet parse",
  );

  const hint = kanzleiHinweisText("Nordlicht Steuerberatung");
  ok(hint.title === "Hinweis von Nordlicht Steuerberatung", "the line is Hinweis von");
  ok(hint.body.includes("nicht erstellt und nicht geprüft von der Kanzlei"), "the check is not created or reviewed by the Kanzlei");
  ok(!hint.body.includes("Empfohlen"), "the line does not say Empfohlen");

  const mailSource = source("lib/kanzlei-toolbox-mail.ts");
  ok(mailSource.includes("sendDedupedEmail(") && mailSource.includes("from \"@/lib/mail-dedupe\""), "toolbox mail uses the dedupe helper");
  ok(mailSource.includes("/steuerberater/toolbox/bericht#t=") && !mailSource.includes("bericht?token="), "the report link is a fragment, not a query token");
  ok(mailSource.includes("30 Tage gültig"), "the report mail says the link lasts 30 days");
  ok(mailSource.includes("kann einmal verwendet werden"), "the removal mail says the link is single use");
  ok(!mailSource.includes("createKanzleiRevokeToken") && !source("lib/kanzlei-toolbox-token.ts").includes("email"), "toolbox link secrets are not signed payloads and carry no email");
  ok(!source("lib/kanzlei-toolbox-flow.ts").includes("createKanzleiDoiToken"), "DOI confirm does not pack the application into the URL");
  const doiKey = kanzleiToolboxDoiKey("k_0123456789abcdef");
  const kitKey = kanzleiToolboxKitKey("k_0123456789abcdef");
  ok(doiKey === "kanzlei-toolbox-doi:k_0123456789abcdef" && kitKey === "kanzlei-toolbox-kit:k_0123456789abcdef", "each toolbox mail has its own key");
  ok(!/utm|ref|gclid|gbraid|wbraid/i.test(`${doiKey} ${kitKey}`), "the dedupe keys carry no campaign value");
  ok(!kanzleiMailAllowed(KANZLEI_MAIL_SINK), "a check run does not mail the sink");
  ok(!kanzleiMailAllowed(KANZLEI_MAIL_BLOCKED), "the blocked address is never mailed");
  ok(!kanzleiMailAllowed("kanzlei@example.org"), "a check run does not mail an applicant");

  const dir = await mkdtemp(path.join(tmpdir(), "kanzlei-toolbox-"));
  const filePath = path.join(dir, "kanzlei-toolbox.json");
  setKanzleiToolboxFileForTest(filePath);
  const verifiedId = "k_0123456789abcdef";
  const pendingId = "k_abcdef0123456789";
  try {
    await updateKanzleiToolbox((file) => {
      file.records.push(
        record({ kanzleiId: verifiedId, slug: "nordlicht-ab12", status: "verified", verifiedAt: "2026-10-25T00:00:00.000Z" }),
        record({
          kanzleiId: pendingId,
          slug: "nordlicht-cd34",
          status: "pending_doi",
          doiConfirmedAt: "",
          verification: emptyKanzleiVerification(),
        }),
      );
      file.reservedSlugs.push("nordlicht-ab12", "nordlicht-cd34");
    });

    const shown = await lookupPublicKanzlei("nordlicht-ab12");
    ok(shown?.displayName === "Nordlicht Steuerberatung" && shown.kanzleiId === verifiedId, "a verified name is loaded from the register");
    ok((await lookupPublicKanzlei("nordlicht-cd34")) === null, "a name is hidden before verification");
    ok(!nameShown(record({ kanzleiId: pendingId, slug: "nordlicht-cd34", status: "pending" })), "pending status does not show the name");

    const hiddenRedirect = await kanzleiEntryPath("nordlicht-cd34", "Mozilla/5.0", "https://www.gobd-doku-erstellen.de/k/nordlicht-cd34?utm_source=brief&ref=Freitext&gclid=CLICK");
    ok(!hiddenRedirect.includes("kanzlei="), "an unverified redirect has no kanzlei parameter");
    ok(!hiddenRedirect.includes("ref=") && !hiddenRedirect.includes("gclid="), "the redirect drops ref and click ids");
    ok(hiddenRedirect.includes("utm_source=brief"), "the redirect may keep utm on the URL only");
    const beforeCounts = await readKanzleiToolbox();
    ok(!beforeCounts.counts.some((row) => row.kanzleiId === pendingId), "an unverified redirect is not counted");

    const openRedirect = await kanzleiEntryPath("nordlicht-ab12", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "https://www.gobd-doku-erstellen.de/k/nordlicht-ab12?ref=Freitext");
    ok(openRedirect.includes("kanzlei=nordlicht-ab12") && !openRedirect.includes("ref="), "a verified redirect keeps the slug and drops ref");
    const counted = await readKanzleiToolbox();
    ok(counted.counts.some((row) => row.kanzleiId === verifiedId && row.kind === "redirect" && row.n === 1), "a verified redirect counts the opaque id");
    ok(!JSON.stringify(counted).includes("Freitext") && !JSON.stringify(counted).includes("utm_"), "the register file has no ref and no utm");
    ok(
      !keysOf(counted).some((key) => /^(ref|gclid|gbraid|wbraid|useragent|referrer)$/i.test(key) || key.toLowerCase().startsWith("utm")),
      "the register keys have no campaign or client fields",
    );

    await addKanzleiCount({ kanzleiId: verifiedId, kind: "start", device: "desktop", now: new Date("2026-10-25T12:00:00.000Z") });
    await addKanzleiCount({ kanzleiId: verifiedId, kind: "start", device: "desktop", now: new Date("2026-10-25T12:00:00.000Z") });
    await addKanzleiCount({ kanzleiId: verifiedId, kind: "complete", device: "desktop", now: new Date("2026-10-25T12:00:00.000Z") });
    const month = buildMonthReport((await readKanzleiToolbox()).counts, verifiedId, "2026-10");
    ok(month.calls === "unter 5" && month.starts === "unter 5" && month.completes === "unter 5", "a small month is shown as unter 5");
    assert.deepEqual(Object.keys(month).sort(), ["calls", "completes", "month", "starts"]);
    ok(!("purchases" in month) && !("light" in month), "the report has no purchases and no Ampel color");

    const old = emptyKanzleiFile();
    old.records.push(
      record({
        kanzleiId: "k_aaaaaaaaaaaaaaaa",
        slug: "alt-kanzlei-q7w8",
        status: "pending_doi",
        registeredAt: "2020-01-01T00:00:00.000Z",
        doiConfirmedAt: "",
      }),
    );
    old.reservedSlugs.push("alt-kanzlei-q7w8");
    old.attributions.push({ leadId: "lead-old", kanzleiId: verifiedId, at: "2024-01-01T00:00:00.000Z" });
    old.counts.push({ date: "2023-01-01", kanzleiId: verifiedId, device: "desktop", kind: "start", n: 2 });
    old.blocklist.push({ domain: "blocked.example", kanzleiId: verifiedId, reason: "missbrauch", at: "2020-01-01T00:00:00.000Z" });
    const purged = purgeStore(old, new Date("2026-10-25T00:00:00.000Z"));
    ok(purged.changed, "retention changes the file");
    ok(
      purged.deleted.length > 0 &&
        purged.deleted.every((row) => row.date === "2026-10-25" && row.n > 0 && Object.keys(row).sort().join(",") === "date,kind,n"),
      "the deletion log is count, kind and date",
    );
    ok(!JSON.stringify(purged.deleted).includes("lead-old") && !JSON.stringify(purged.deleted).includes("@"), "the deletion log has no personal data");
    ok(old.records.length === 0 && old.reservedSlugs.includes("alt-kanzlei-q7w8"), "an unconfirmed signup is deleted and the slug stays reserved");
    ok(old.attributions.length === 0, "attribution older than 12 months is deleted");
    ok(old.counts.length === 1 && old.counts[0]?.kanzleiId === "", "a count older than 24 months loses the Kanzlei id");
    ok(old.blocklist.length === 0, "a blocklist entry older than 3 years is deleted");

    clearAmpelStepRateForTest();
    clearAmpelStepSheetCache();
    const mock = sheetMock();
    installAmpelStepSheetClientForTest({ client: mock.client, configured: true });
    setAmpelStepNowForTest(() => new Date("2026-10-25T10:00:00.000Z"));
    const extra = await postAmpelStep(stepRequest({ event: "ampel_q_view", n: 1, k: verifiedId, color: "gruen" }, "203.0.113.21"));
    ok(extra.status === 400, "k does not allow an extra step field");
    const started = await postAmpelStep(stepRequest({ event: "ampel_q_view", n: 1, k: verifiedId }, "203.0.113.22"));
    ok(started.status === 204, "a start with k is accepted");
    const ignored = await postAmpelStep(stepRequest({ event: "ampel_q_view", n: 2, k: verifiedId }, "203.0.113.23"));
    ok(ignored.status === 204, "a later question view is accepted");
    const finished = await postAmpelStep(stepRequest({ event: "ampel_submit_result", status: "ok", k: verifiedId }, "203.0.113.24"));
    ok(finished.status === 204, "a complete with k is accepted");
    const stranger = await postAmpelStep(stepRequest({ event: "ampel_q_view", n: 1, k: "Nordlicht" }, "203.0.113.25"));
    ok(stranger.status === 204, "a free-text k is ignored");
    const afterSteps = await readKanzleiToolbox();
    const starts = afterSteps.counts.filter((row) => row.kanzleiId === verifiedId && row.kind === "start").reduce((sum, row) => sum + row.n, 0);
    const completes = afterSteps.counts.filter((row) => row.kanzleiId === verifiedId && row.kind === "complete").reduce((sum, row) => sum + row.n, 0);
    ok(starts === 3 && completes === 2, "start and complete counts use the opaque id");
    ok(mock.written.every((row) => !row.includes(verifiedId) && !row.includes("k")), "the step sheet does not store k");
    ok(mock.written[0]?.length === AMPEL_STEP_COLUMNS.length, "the step header stays the existing columns");

    const honeypot = await submitKanzleiToolbox({
      name: "Nordlicht Steuerberatung",
      website: "https://example.org",
      email: "kanzlei@example.org",
      city: "Hamburg",
      authority: true,
      terms: true,
      report: false,
      honeypot: "bot",
      ip: "203.0.113.30",
    });
    ok(honeypot.ok && honeypot.honeypot, "a honeypot signup is not stored");
    ok((await readKanzleiToolbox()).records.length === 2, "the honeypot added no record");

    const answers: AmpelAnswerMap = {};
    for (const question of AMPEL_QUESTIONS) answers[question.id] = "ja";
    const code = encodeAmpelAnswers(answers);
    ok(code, "fixture answers encode");
    const saved: ReadinessLead[] = [];
    const mail: string[] = [];
    await deliverAmpelResult(
      "probe@example.com",
      answers,
      code ?? "",
      {
        email: "probe@example.com",
        answers: code,
        ref: "Freitext Name",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.40",
        utmSource: "newsletter",
        utmCampaign: "oktober",
        kanzlei: "nordlicht-ab12",
      },
      {
        now: () => Date.parse("2026-10-25T10:00:00.000Z"),
        mail: async () => ({ sent: true, stub: false }),
        saveLead: async (row) => {
          saved.push(row);
        },
      },
    );
    ok(saved[0]?.advisorRef === "" && saved[0]?.utmSource === "" && saved[0]?.utmCampaign === "", "the lead row drops ref and utm for a toolbox slug");
    await deliverAmpelResult(
      "probe2@example.com",
      answers,
      code ?? "",
      {
        email: "probe2@example.com",
        answers: code,
        ref: "Kanzlei Mueller",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.41",
        utmSource: "newsletter",
        utmCampaign: "oktober",
      },
      {
        now: () => Date.parse("2026-10-25T11:00:00.000Z"),
        mail: async () => ({ sent: true, stub: false }),
        saveLead: async (row) => {
          saved.push(row);
        },
      },
    );
    ok(saved[1]?.advisorRef === "", "free text from ref stays empty");
    await deliverAmpelResult(
      "probe3@example.com",
      answers,
      code ?? "",
      {
        email: "probe3@example.com",
        answers: code,
        ref: "nordlicht-ab12",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.42",
        utmSource: "",
        utmCampaign: "",
      },
      {
        now: () => Date.parse("2026-10-25T12:00:00.000Z"),
        mail: async () => ({ sent: true, stub: false }),
        saveLead: async (row) => {
          saved.push(row);
        },
      },
    );
    ok(saved[2]?.advisorRef === "nordlicht-ab12", "a known kanzlei slug is stored as advisor_ref");
    await deliverAmpelResult(
      "probe4@example.com",
      answers,
      code ?? "",
      {
        email: "probe4@example.com",
        answers: code,
        ref: verifiedId,
        marketing: false,
        honeypot: "",
        ip: "203.0.113.43",
        utmSource: "",
        utmCampaign: "",
      },
      {
        now: () => Date.parse("2026-10-25T13:00:00.000Z"),
        mail: async () => ({ sent: true, stub: false }),
        saveLead: async (row) => {
          saved.push(row);
        },
      },
    );
    ok(saved[3]?.advisorRef === verifiedId, "a known kanzlei id is stored as advisor_ref");
    await deliverAmpelResult(
      "probe5@example.com",
      answers,
      code ?? "",
      {
        email: "probe5@example.com",
        answers: code,
        ref: "freie-eingabe-ab12",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.44",
        utmSource: "",
        utmCampaign: "",
      },
      {
        now: () => Date.parse("2026-10-25T13:30:00.000Z"),
        mail: async () => ({ sent: true, stub: false }),
        saveLead: async (row) => {
          saved.push(row);
        },
      },
    );
    ok(saved[4]?.advisorRef === "", "an unknown slug-shaped ref stays empty");
    const kassenAnswers: AmpelAnswerMap = {};
    for (const question of KASSEN_QUESTIONS) kassenAnswers[question.id] = "ja";
    const kassenCode = encodeAmpelAnswers(kassenAnswers, KASSEN_QUESTIONS);
    ok(kassenCode, "kassen fixture answers encode");
    await deliverAmpelResult(
      "kasse@nordlicht-probe.de",
      kassenAnswers,
      kassenCode ?? "",
      {
        email: "kasse@nordlicht-probe.de",
        answers: kassenCode,
        ref: "Name der Kanzlei",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.45",
        utmSource: "",
        utmCampaign: "",
      },
      {
        now: () => Date.parse("2026-10-25T13:40:00.000Z"),
        check: "kassen-check",
        mail: async () => ({ sent: true, stub: false }),
        saveLead: async (row) => {
          saved.push(row);
        },
      },
    );
    ok(saved[5]?.advisorRef === "" && saved[5]?.tool === "kassen", "Kassen drops the free-text name field");
    await deliverAmpelResult(
      "kasse2@nordlicht-probe.de",
      kassenAnswers,
      kassenCode ?? "",
      {
        email: "kasse2@nordlicht-probe.de",
        answers: kassenCode,
        ref: "nordlicht-ab12",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.46",
        utmSource: "",
        utmCampaign: "",
      },
      {
        now: () => Date.parse("2026-10-25T13:50:00.000Z"),
        check: "kassen-check",
        mail: async () => ({ sent: true, stub: false }),
        saveLead: async (row) => {
          saved.push(row);
        },
      },
    );
    ok(saved[6]?.advisorRef === "nordlicht-ab12", "Kassen stores an active slug");
    ok(!JSON.stringify(mail).includes("utm_"), "no toolbox mail body was built with utm");

    const cleanedLocation = analyticsPageLocation(
      "https://www.gobd-doku-erstellen.de/ampel-check?kanzlei=nordlicht-ab12&utm_source=brief&token=secret#t=fragment",
    );
    ok(
      cleanedLocation === "https://www.gobd-doku-erstellen.de/ampel-check?utm_source=brief",
      "analytics page_location drops kanzlei, token, and the fragment",
    );

    const issued = await issueKanzleiReportToken(verifiedId, Date.parse("2026-10-25T00:00:00.000Z"));
    ok(issued && issued.length >= 32 && !issued.includes(verifiedId), "a report secret is not the kanzlei id");
    const storedReport = await readKanzleiToolbox();
    const reportRow = storedReport.records.find((item) => item.kanzleiId === verifiedId);
    ok(
      reportRow?.reportTokenHash === hashKanzleiReportToken(issued ?? "") &&
        !JSON.stringify(storedReport).includes(issued ?? "missing-token"),
      "the register stores the report hash and not the secret",
    );
    const removalSecret = "a".repeat(43);
    const reportMail = buildKanzleiToolboxMail({
      displayName: "Nordlicht Steuerberatung",
      slug: "nordlicht-ab12",
      kanzleiId: verifiedId,
      verified: true,
      reportOptIn: true,
      reportToken: issued ?? "",
      revokeToken: removalSecret,
    });
    ok(
      reportMail?.text.includes(`#t=${encodeURIComponent(issued ?? "")}`) &&
        !reportMail.text.includes("bericht?token=") &&
        !reportMail.html.includes("bericht?token=") &&
        !reportMail.subject.includes(issued ?? "missing-token"),
      "the report mail puts the secret in the fragment only",
    );
    const reportRequest = (secret: string) =>
      new Request("https://example.com/api/steuerberater/toolbox/bericht", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: secret }),
      });
    const opened = await postKanzleiReport(reportRequest(issued ?? ""));
    const openedBody = (await opened.json()) as { ok?: boolean; months?: { month: string }[] };
    ok(opened.status === 200 && openedBody.ok === true && openedBody.months?.length === 2, "the report POST returns aggregates");
    ok(!JSON.stringify(openedBody).includes(issued ?? "missing-token") && !JSON.stringify(openedBody).includes("@"), "the report response has no secret and no email");
    const repeated = await postKanzleiReport(reportRequest(issued ?? ""));
    ok(repeated.status === 200, "the report secret stays valid until it is replaced or expires");
    const rotated = await issueKanzleiReportToken(verifiedId, Date.parse("2026-10-25T00:00:00.000Z"));
    ok(rotated && rotated !== issued, "issuing again rotates the secret");
    const stale = await postKanzleiReport(reportRequest(issued ?? ""));
    ok(stale.status === 404, "the replaced secret stops working immediately");
    const current = await postKanzleiReport(reportRequest(rotated ?? ""));
    ok(current.status === 200, "the new secret opens the report");
    await updateKanzleiToolbox((file) => {
      const row = file.records.find((item) => item.kanzleiId === verifiedId);
      if (row) row.reportTokenExp = Date.parse("2020-01-01T00:00:00.000Z");
    });
    const expired = await postKanzleiReport(reportRequest(rotated ?? ""));
    ok(expired.status === 404, "an expired report secret is refused");

    const token = await issueKanzleiRevokeToken(verifiedId, Date.parse("2026-10-25T00:00:00.000Z"));
    ok(kanzleiLinkSecretShape(token ?? ""), "a removal secret is a 256-bit id");
    const storedRevoke = await readKanzleiToolbox();
    ok(
      storedRevoke.records.find((item) => item.kanzleiId === verifiedId)?.revokeTokenHash === hashKanzleiReportToken(token ?? "") &&
        !JSON.stringify(storedRevoke).includes(token ?? "missing-token"),
      "the register stores the removal hash and not the secret",
    );
    const revoked = await revokeKanzleiToolbox(token ?? "");
    ok(revoked.ok, "revocation succeeds");
    ok((await lookupPublicKanzlei("nordlicht-ab12")) === null, "revocation removes the name immediately");
    const afterRevoke = await kanzleiEntryPath("nordlicht-ab12", "", "https://www.gobd-doku-erstellen.de/k/nordlicht-ab12");
    ok(!afterRevoke.includes("kanzlei="), "a revoked link no longer attributes the visit");
    ok((await resolveAdvisorRef("nordlicht-ab12")) === "" && (await resolveAdvisorRef("Kanzlei Mueller")) === "", "a removed code and free text stay empty");
    const reused = await revokeKanzleiToolbox(token ?? "");
    ok(!reused.ok, "a removal secret works once");

    const applicant = "delivered@resend.dev";
    const signed = await submitKanzleiToolbox(
      {
        name: "Nordlicht Steuerberatung",
        website: "https://doi-probe.example",
        email: applicant,
        city: "Hamburg",
        authority: true,
        terms: true,
        report: true,
        honeypot: "",
        ip: "203.0.113.90",
      },
      { now: () => Date.parse("2026-10-25T14:00:00.000Z") },
    );
    ok(signed.ok && signed.confirmUrl, "the DOI mail link is returned for the sink in this check");
    const confirmUrl = signed.ok ? (signed.confirmUrl ?? "") : "";
    const doiSecret = new URL(confirmUrl).searchParams.get("token") ?? "";
    ok(kanzleiLinkSecretShape(doiSecret), "the DOI link is a 256-bit id");
    ok(!confirmUrl.includes("@") && !confirmUrl.toLowerCase().includes(applicant), "the DOI link has no email address");
    ok(!doiSecret.includes("."), "the DOI link is not a signed JSON payload");
    const pendingFile = await readKanzleiToolbox();
    ok(
      pendingFile.records.some((item) => item.doiTokenHash === hashKanzleiReportToken(doiSecret)) &&
        !JSON.stringify(pendingFile).includes(doiSecret),
      "the register stores the DOI hash and not the secret",
    );
    const kitMails: { text: string; html: string }[] = [];
    const confirmed = await confirmKanzleiToolbox(doiSecret, {
      now: () => Date.parse("2026-10-25T14:05:00.000Z"),
      fetchImpl: async () => new Response("missing", { status: 404 }),
      send: async (input) => {
        kitMails.push({ text: input.text, html: input.html });
        return { stub: true, sent: false };
      },
    });
    ok(confirmed.ok, "the DOI secret confirms once");
    const second = await confirmKanzleiToolbox(doiSecret, { now: () => Date.parse("2026-10-25T14:06:00.000Z") });
    ok(!second.ok, "the DOI secret cannot be used twice");
    const kit = kitMails[0];
    ok(kit, "the toolbox mail was built");
    const mailBody = `${kit?.text ?? ""}\n${kit?.html ?? ""}`;
    const links = (mailBody.match(/https?:\/\/[^\s"'<>]+/g) ?? []).map((item) => item.replace(/[),.;]+$/g, ""));
    ok(links.length > 0 && links.every((item) => !item.includes("@") && !item.toLowerCase().includes(applicant)), "toolbox mail links carry no email");
    const removalFromMail = (kit?.text ?? "").match(/entfernen\?token=([A-Za-z0-9_-]{43})/)?.[1] ?? "";
    ok(kanzleiLinkSecretShape(removalFromMail), "the removal link in the mail is a 256-bit id");
    ok(!mailBody.includes("bericht?token="), "the toolbox mail does not put the report secret in the query");
    ok(!mailBody.includes(applicant), "the toolbox mail body does not repeat the address");
    const removedByMail = await revokeKanzleiToolbox(removalFromMail ?? "");
    ok(removedByMail.ok, "the mailed removal secret works");
    ok(!(await revokeKanzleiToolbox(removalFromMail ?? "")).ok, "the mailed removal secret works once");

    const expiredSignup = await submitKanzleiToolbox(
      {
        name: "Nordlicht Steuerberatung",
        website: "https://doi-expired.example",
        email: applicant,
        city: "Hamburg",
        authority: true,
        terms: true,
        report: false,
        honeypot: "",
        ip: "203.0.113.91",
      },
      { now: () => Date.parse("2026-10-25T15:00:00.000Z") },
    );
    ok(expiredSignup.ok && Boolean(expiredSignup.confirmUrl), "a second DOI link can be issued");
    const expiredSecret = new URL(expiredSignup.ok && expiredSignup.confirmUrl ? expiredSignup.confirmUrl : "https://example.invalid/").searchParams.get("token") ?? "";
    await updateKanzleiToolbox((file) => {
      const row = file.records.find((item) => item.doiTokenHash === hashKanzleiReportToken(expiredSecret));
      if (row) row.doiTokenExp = Date.parse("2020-01-01T00:00:00.000Z");
    });
    const expiredConfirm = await confirmKanzleiToolbox(expiredSecret, { now: () => Date.parse("2026-10-25T15:05:00.000Z") });
    ok(!expiredConfirm.ok, "an expired DOI secret is refused");

    const savedVercel = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    setKanzleiToolboxSheetEnabledForTest(true);
    ok(kanzleiToolboxLiveSheetBlocked(), "preview blocks the live sheet");
    ok(!kanzleiToolboxSheetIoAllowed(), "preview does not open the sheet even when the switch is on");
    setKanzleiToolboxSheetEnabledForTest(null);
    if (savedVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = savedVercel;

    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-check-secret";
    try {
      const denied = await getKanzleiCron(new Request("https://example.com/api/cron/kanzlei-toolbox"));
      ok(denied.status === 401, "the cron rejects a missing secret");
      const wrong = await getKanzleiCron(
        new Request("https://example.com/api/cron/kanzlei-toolbox", { headers: { authorization: "Bearer nope" } }),
      );
      ok(wrong.status === 401, "the cron rejects a wrong secret");
      const accepted = await getKanzleiCron(
        new Request("https://example.com/api/cron/kanzlei-toolbox", {
          headers: { authorization: "Bearer cron-check-secret" },
        }),
      );
      const cronBody = (await accepted.json()) as { ok: boolean; active: boolean; skipped: string; deleted: unknown[] };
      ok(accepted.status === 200 && cronBody.ok && cronBody.active === false && cronBody.skipped === "switch", "the cron stays idle while the switch is off");
      ok(cronBody.deleted.length === 0 && !JSON.stringify(cronBody).includes("cron-check-secret"), "the idle cron returns no rows and no secret");
    } finally {
      if (previousSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previousSecret;
    }

    const grid: string[][] = [];
    const sheetClient: KanzleiToolboxSheetClient = {
      async get() {
        return { data: { sheets: grid.length ? [{ properties: { title: "kanzlei_toolbox", sheetId: 1 } }] : [] } };
      },
      async batchUpdate() {
        return { data: { replies: [{ addSheet: { properties: { sheetId: 1 } } }] } };
      },
      async valuesGet() {
        return { data: { values: grid.map((row) => [...row]) } };
      },
      async valuesUpdate(args) {
        grid.length = 0;
        for (const row of args.requestBody.values) grid.push([...row]);
        return { data: {} };
      },
    };
    installKanzleiToolboxSheetClientForTest(sheetClient);
    setKanzleiToolboxSheetEnabledForTest(true);
    ok(kanzleiToolboxSheetIoAllowed(), "an installed test client may use the prepared sheet");
    const retained = await runKanzleiToolboxRetention(new Date("2026-10-25T00:00:00.000Z"));
    ok(retained.active && retained.skipped === "", "retention runs only through the installed sheet client");
    await updateKanzleiToolbox((current) => {
      current.records.push(
        record({
          kanzleiId: "k_bbbbbbbbbbbbbbbb",
          slug: "alt-sheet-q7w8",
          status: "pending_doi",
          email: "secret@example.org",
          displayName: "Geheimer Name",
          registeredAt: "2020-01-01T00:00:00.000Z",
          doiConfirmedAt: "",
        }),
      );
      current.attributions.push({ leadId: "lead-secret", kanzleiId: "k_bbbbbbbbbbbbbbbb", at: "2024-01-01T00:00:00.000Z" });
    });
    const sheetText = grid.map((row) => row.join("\t")).join("\n");
    ok(grid[0]?.join(",") === "row_kind,row_id,body,logged_on", "the sheet header is the prepared columns");
    ok(sheetText.includes("pending_doi") && sheetText.includes("attribution"), "the sheet keeps the deletion log kinds");
    ok(!sheetText.includes("secret@example.org") && !sheetText.includes("Geheimer Name") && !sheetText.includes("lead-secret"), "purged rows leave no personal data in the sheet");
    ok(!sheetText.includes("utm_") && !sheetText.includes("gclid"), "the sheet has no campaign fields");
  } finally {
    setAmpelStepNowForTest(null);
    installAmpelStepSheetClientForTest(null);
    setKanzleiToolboxSheetEnabledForTest(null);
    installKanzleiToolboxSheetClientForTest(null);
    clearAmpelStepSheetCache();
    setKanzleiToolboxFileForTest(null);
    await rm(dir, { recursive: true, force: true });
  }

  console.log("check-kanzlei-toolbox: ok");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
