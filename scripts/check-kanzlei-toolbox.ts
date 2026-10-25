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
import { AMPEL_QUESTIONS } from "@/lib/ampel-questions";
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
import { kanzleiEntryPath, revokeKanzleiToolbox, submitKanzleiToolbox } from "@/lib/kanzlei-toolbox-flow";
import {
  addKanzleiCount,
  lookupPublicKanzlei,
  purgeKanzleiToolboxFile as purgeStore,
  readKanzleiToolbox,
  setKanzleiToolboxFileForTest,
  updateKanzleiToolbox,
} from "@/lib/kanzlei-toolbox-store";
import { createKanzleiDoiToken, createKanzleiRevokeToken } from "@/lib/kanzlei-toolbox-token";
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
  ok(!storeSource.includes("@vercel/blob") && !storeSource.includes("createSheetsClient"), "the register does not import Blob or Sheets");
  ok(!storeSource.includes("upsertReadinessLead"), "the register does not write the lead sheet");
  ok(storeSource.includes("kanzlei-toolbox.json"), "the register is the toolbox file");

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
  ok(!source("vercel.json").includes("crons"), "no cron is registered");

  const sendSource = source("lib/ampel-result-send.ts");
  ok(sendSource.includes('lead.utmSource = flow ? "" : attribution.utmSource'), "a toolbox lead stores no utm source");
  ok(sendSource.includes('lead.utmCampaign = flow ? "" : attribution.utmCampaign'), "a toolbox lead stores no utm campaign");
  ok(sendSource.includes('ref: flow ? "" : sanitizeAmpelRef(input.ref)'), "a toolbox lead stores no free-text ref");
  ok(sendSource.includes('utmSource: flow ? "" : attribution.utmSource'), "a toolbox confirmation stores no utm source");

  const page = source("app/ampel-check/ampel-check.tsx");
  ok(page.includes("AMPEL_SHARE_KANZLEI"), "the share card still uses the toolbox copy");
  ok(!page.includes('name="ref"') && !page.includes("Empfohlen von"), "free-text ref is not shown as a recommendation");
  ok(page.includes("hint ? {} : submitUtmFields"), "a toolbox visit omits utm from the submit body");
  ok(page.includes('ref: hint ? "" : refName'), "a toolbox visit submits an empty ref");
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
  const doiKey = kanzleiToolboxDoiKey("k_0123456789abcdef");
  const kitKey = kanzleiToolboxKitKey("k_0123456789abcdef");
  ok(doiKey === "kanzlei-toolbox-doi:k_0123456789abcdef" && kitKey === "kanzlei-toolbox-kit:k_0123456789abcdef", "each toolbox mail has its own key");
  ok(!/utm|ref|gclid|gbraid|wbraid/i.test(`${doiKey} ${kitKey}`), "the dedupe keys carry no campaign value");
  ok(!kanzleiMailAllowed(KANZLEI_MAIL_SINK), "a check run does not mail the sink");
  ok(!kanzleiMailAllowed(KANZLEI_MAIL_BLOCKED), "the blocked address is never mailed");
  ok(!kanzleiMailAllowed("kanzlei@example.org"), "a check run does not mail an applicant");

  const doi = createKanzleiDoiToken({
    kanzleiId: "k_0123456789abcdef",
    slug: "nordlicht-ab12",
    displayName: "Nordlicht Steuerberatung",
    website: "https://example.org",
    email: "kanzlei@example.org",
    city: "Hamburg",
    consentAt: "2026-10-25T00:00:00.000Z",
    consentText: "Einwilligung",
    consentTextVersion: "2026-10-25-entwurf",
    reportOptIn: false,
  });
  ok(doi, "a DOI token can be signed");
  const doiPayload = JSON.parse(Buffer.from((doi ?? "").split(".")[0] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  ok(!Object.keys(doiPayload).some((key) => key.toLowerCase().includes("utm") || key === "ref"), "the DOI token has no utm and no ref");

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
    ok(purgeStore(old, new Date("2026-10-25T00:00:00.000Z")), "retention changes the file");
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
    ok(saved[1]?.advisorRef === "Kanzlei Mueller", "a visit without a toolbox slug still keeps ref");
    ok(!JSON.stringify(mail).includes("utm_"), "no toolbox mail body was built with utm");

    const token = createKanzleiRevokeToken(verifiedId);
    ok(token, "a revoke token can be signed");
    const revoked = await revokeKanzleiToolbox(token ?? "");
    ok(revoked.ok, "revocation succeeds");
    ok((await lookupPublicKanzlei("nordlicht-ab12")) === null, "revocation removes the name immediately");
    const afterRevoke = await kanzleiEntryPath("nordlicht-ab12", "", "https://www.gobd-doku-erstellen.de/k/nordlicht-ab12");
    ok(!afterRevoke.includes("kanzlei="), "a revoked link no longer attributes the visit");
  } finally {
    setAmpelStepNowForTest(null);
    installAmpelStepSheetClientForTest(null);
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
