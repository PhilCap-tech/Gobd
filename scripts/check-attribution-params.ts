/**
 * Campaign params and src/v stay on the check URL. Ampel and Kassen rows
 * keep the utm columns and write them empty. No lead path copies
 * utm_source or utm_campaign onto readiness_leads. Click ids are not stored.
 * Usage: npx tsx scripts/check-attribution-params.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { requestAmpelConfirmation } from "../lib/ampel-confirm";
import { AMPEL_QUESTIONS } from "../lib/ampel-questions";
import { createMemoryAmpelRateStore } from "../lib/ampel-rate-limit";
import { deliverAmpelResult } from "../lib/ampel-result-send";
import { createMemoryAmpelSuppressionStore, setAmpelSuppressionTestStore } from "../lib/ampel-suppression";
import { encodeAmpelAnswers, type AmpelAnswerMap } from "../lib/ampel-score";
import { hrefWithCampaignParams, replaceCheckSearch, submitUtmFields, submitVariantFields } from "../lib/campaign-params";
import { submitKassenResult } from "../lib/kassen-check-send";
import { keptCheckAttribution, storedCheckAttribution, withoutAmpelUtm } from "../lib/lead-attribution";
import { emptyReadinessLead, READINESS_SHEET_COLUMNS, type ReadinessLead } from "../lib/readiness";
import { TEST_ENTITY_IDS } from "../lib/test-entities";

function ok(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  console.log("ok:", message);
}

const landing = new URLSearchParams(
  "gclid=CLICK123&gbraid=BRAID1&wbraid=WBRAID1&utm_source=google&utm_medium=cpc&utm_campaign=landing_pilot&utm_content=broad_test&utm_term=gobd&foo=drop&a=old",
);

const replaced = new URLSearchParams(replaceCheckSearch(landing, { a: "JJJJJJJJJJ", ref: "Kanzlei" }));
ok(replaced.get("gclid") === "CLICK123", "replace keeps gclid");
ok(replaced.get("gbraid") === "BRAID1", "replace keeps gbraid");
ok(replaced.get("wbraid") === "WBRAID1", "replace keeps wbraid");
ok(replaced.get("utm_source") === "google", "replace keeps utm_source");
ok(replaced.get("utm_medium") === "cpc", "replace keeps utm_medium");
ok(replaced.get("utm_campaign") === "landing_pilot", "replace keeps utm_campaign");
ok(replaced.get("utm_content") === "broad_test", "replace keeps utm_content");
ok(replaced.get("utm_term") === "gobd", "replace keeps utm_term");
ok(replaced.get("a") === "JJJJJJJJJJ", "replace sets the answer code");
ok(replaced.get("ref") === "Kanzlei", "replace sets the internal ref");
ok(replaced.get("foo") === null, "replace drops an unrelated param");

const withVariant = new URLSearchParams(
  "gclid=CLICK123&utm_source=google&utm_campaign=landing_pilot&src=hero&v=a&utm_medium=cpc&foo=drop",
);
const keptVariant = new URLSearchParams(replaceCheckSearch(withVariant, { a: "JJJJJJJJJJ", ref: "" }));
ok(keptVariant.get("gclid") === "CLICK123", "replace keeps gclid next to src and v");
ok(keptVariant.get("utm_source") === "google", "replace keeps utm_source next to src and v");
ok(keptVariant.get("utm_medium") === "cpc", "replace keeps utm_medium next to src and v");
ok(keptVariant.get("utm_campaign") === "landing_pilot", "replace keeps utm_campaign next to src and v");
ok(keptVariant.get("src") === "hero" && keptVariant.get("v") === "a", "replace keeps src and v");
ok(keptVariant.get("ref") === null, "replace still drops an empty ref");
ok(keptVariant.get("a") === "JJJJJJJJJJ", "an answer code still replaces the query");
ok(keptVariant.get("foo") === null, "replace still drops an unrelated param");

const restartedVariant = new URLSearchParams(replaceCheckSearch(keptVariant, { a: "", ref: "" }));
ok(restartedVariant.get("a") === null, "restart drops the answer code when src and v are present");
ok(restartedVariant.get("src") === "hero" && restartedVariant.get("v") === "a", "restart keeps src and v");
ok(restartedVariant.get("gclid") === "CLICK123", "restart keeps gclid next to src and v");

const restarted = new URLSearchParams(replaceCheckSearch(replaced, { a: "", ref: "Kanzlei" }));
ok(restarted.get("a") === null, "restart drops the answer code");
ok(restarted.get("gclid") === "CLICK123", "restart keeps gclid");
ok(restarted.get("utm_source") === "google", "restart keeps utm_source");
ok(restarted.get("utm_campaign") === "landing_pilot", "restart keeps utm_campaign");

const submitted = submitUtmFields(`?${landing.toString()}`);
assert.deepEqual(submitted, { utm_source: "google", utm_campaign: "landing_pilot" });
ok(!("gclid" in submitted) && !("gbraid" in submitted) && !("wbraid" in submitted), "the submit body has no click id");
assert.deepEqual(submitUtmFields(""), {});
ok(submitUtmFields("?utm_source=%20%20").utm_source === undefined, "a blank utm is omitted");

const heroHref = hrefWithCampaignParams(
  "/ampel-check?src=hero&v=a",
  "?gclid=test123&gbraid=BRAID1&wbraid=WBRAID1&utm_source=testsrc&utm_campaign=testcamp&utm_medium=cpc&foo=drop",
);
const heroUrl = new URL(heroHref, "https://www.gobd-doku-erstellen.de");
ok(heroUrl.pathname === "/ampel-check", "the hero href stays on the ampel check");
ok(heroUrl.searchParams.get("src") === "hero" && heroUrl.searchParams.get("v") === "a", "the hero href keeps src and v");
ok(heroUrl.searchParams.get("gclid") === "test123", "the hero href keeps gclid");
ok(heroUrl.searchParams.get("gbraid") === "BRAID1" && heroUrl.searchParams.get("wbraid") === "WBRAID1", "the hero href keeps the other click ids");
ok(heroUrl.searchParams.get("utm_source") === "testsrc", "the hero href keeps utm_source");
ok(heroUrl.searchParams.get("utm_campaign") === "testcamp", "the hero href keeps utm_campaign");
ok(heroUrl.searchParams.get("foo") === null, "the hero href drops an unrelated param");
ok(
  hrefWithCampaignParams("/ampel-check?src=hero&v=a", "") === "/ampel-check?src=hero&v=a",
  "the server render keeps the plain hero href",
);
const otherCta = new URL(hrefWithCampaignParams("/ampel-check", "?gclid=test123&utm_source=testsrc"), "https://www.gobd-doku-erstellen.de");
ok(otherCta.searchParams.get("gclid") === "test123" && otherCta.searchParams.get("utm_source") === "testsrc", "another funnel href keeps gclid and utm");
ok(otherCta.searchParams.get("src") === null, "another funnel href does not invent src");

const submitBody = {
  ...submitUtmFields("?gclid=test123&gbraid=BRAID1&wbraid=WBRAID1&utm_source=testsrc&utm_campaign=testcamp&src=hero&v=a&foo=drop"),
  ...submitVariantFields("?gclid=test123&gbraid=BRAID1&wbraid=WBRAID1&utm_source=testsrc&utm_campaign=testcamp&src=hero&v=a&foo=drop"),
};
assert.deepEqual(submitBody, { utm_source: "testsrc", utm_campaign: "testcamp", src: "hero", v: "a" });
ok(!("gclid" in submitBody) && !("gbraid" in submitBody) && !("wbraid" in submitBody), "the submit body never contains a click id");
ok(submitVariantFields("?src=Hero&v=" + "a".repeat(21) + "&gclid=CLICK").src === undefined, "a variant outside the whitelist is omitted");
ok(submitVariantFields("?v=" + "a".repeat(20)).v === "a".repeat(20), "a 20 character variant is kept");
ok(!("gclid" in submitVariantFields("?gclid=CLICK&src=hero")), "variant fields do not read a click id");

const real = storedCheckAttribution({
  email: "person@kunde.example",
  tool: "ampel",
  utmSource: "google",
  utmCampaign: "landing_pilot",
});
assert.deepEqual(real, { tool: "ampel", utmSource: "google", utmCampaign: "landing_pilot", src: "", variant: "" });
const marked = storedCheckAttribution({
  email: "person@kunde.example",
  tool: "ampel",
  utmSource: "testsrc",
  utmCampaign: "testcamp",
  src: "hero",
  variant: "a",
});
assert.deepEqual(marked, {
  tool: "ampel",
  utmSource: "testsrc",
  utmCampaign: "testcamp",
  src: "hero",
  variant: "a",
});
assert.deepEqual(withoutAmpelUtm(marked), {
  tool: "ampel",
  utmSource: "",
  utmCampaign: "",
  src: "hero",
  variant: "a",
});
assert.deepEqual(marked, {
  tool: "ampel",
  utmSource: "testsrc",
  utmCampaign: "testcamp",
  src: "hero",
  variant: "a",
}, "blanking UTM does not change the counted object");
const kassen = storedCheckAttribution({
  email: "person@kunde.example",
  tool: "kassen",
  utmSource: " google ",
  utmCampaign: "",
});
assert.deepEqual(kassen, { tool: "kassen", utmSource: "google", utmCampaign: "", src: "", variant: "" });
for (const email of ["probe@example.com", "gobd16x-probe@gmail.com", "info@gobd-doku-erstellen.de"]) {
  const hidden = storedCheckAttribution({
    email,
    tool: "ampel",
    utmSource: "google",
    utmCampaign: "landing_pilot",
    src: "hero",
    variant: "a",
  });
  assert.deepEqual(hidden, { tool: "", utmSource: "", utmCampaign: "", src: "", variant: "" }, email);
}
const listed = storedCheckAttribution({
  email: "person@kunde.example",
  entityId: TEST_ENTITY_IDS[0],
  tool: "kassen",
  utmSource: "google",
  utmCampaign: "landing_pilot",
  src: "hero",
  variant: "a",
});
assert.deepEqual(listed, { tool: "", utmSource: "", utmCampaign: "", src: "", variant: "" });
assert.deepEqual(
  keptCheckAttribution({ tool: "ampel", utmSource: "google", utmCampaign: "landing_pilot" }, null),
  { tool: "ampel", utmSource: "", utmCampaign: "", src: "", variant: "" },
  "a new row keeps the tool and writes utm empty",
);
assert.deepEqual(
  keptCheckAttribution(
    { tool: "kassen", utmSource: "new", utmCampaign: "new" },
    { tool: "kassen", utmSource: "google", utmCampaign: "pilot" },
  ),
  { tool: "kassen", utmSource: "google", utmCampaign: "pilot", src: "", variant: "" },
  "an update keeps the utm already stored on the row",
);
ok(
  keptCheckAttribution({}, { tool: "kassen", utmSource: "google", utmCampaign: "pilot" }).tool === "kassen",
  "a missing source keeps the stored row",
);
ok(
  keptCheckAttribution({ tool: "", utmSource: "", utmCampaign: "" }, { tool: "ampel", utmSource: "google", utmCampaign: "pilot" }).tool === "" &&
    keptCheckAttribution({ tool: "", utmSource: "", utmCampaign: "" }, { tool: "ampel", utmSource: "google", utmCampaign: "pilot" }).utmSource === "google",
  "an explicit empty tool stays empty and does not wipe stored utm",
);
ok(
  keptCheckAttribution({}, { tool: "ampel", utmSource: "google", utmCampaign: "pilot", src: "hero", variant: "a" }).src === "hero" &&
    keptCheckAttribution({}, { src: "hero", variant: "a" }).variant === "a",
  "a missing variant keeps the stored row",
);

const columns = READINESS_SHEET_COLUMNS as readonly string[];
ok(columns.includes("tool") && columns.includes("utm_source") && columns.includes("utm_campaign"), "the sheet has the count columns");
ok(columns.includes("src") && columns.includes("variant"), "the sheet has src and variant");
ok(!columns.includes("gclid") && !columns.includes("gbraid") && !columns.includes("wbraid"), "the sheet has no click id column");

async function main(): Promise<void> {
  setAmpelSuppressionTestStore(createMemoryAmpelSuppressionStore());
  const answers: AmpelAnswerMap = {};
  for (const question of AMPEL_QUESTIONS) answers[question.id] = "ja";
  const code = encodeAmpelAnswers(answers);
  ok(code, "fixture answers encode");
  const saved: ReadinessLead[] = [];
  const confirmed = await requestAmpelConfirmation(
    {
      email: "person@kunde.example",
      answers: code ?? "",
      ref: "",
      mailed: "ja",
      tool: "ampel",
      utmSource: "google",
      utmCampaign: "landing_pilot",
      src: "hero",
      variant: "a",
    },
    {
      findLead: async () => null,
      saveLead: async (row) => {
        saved.push({ ...row });
      },
      sendConfirmation: async () => ({ sent: true, stub: true }),
      now: () => Date.parse("2026-10-14T12:00:00.000Z"),
    },
  );
  const row = saved.at(-1) ?? emptyReadinessLead();
  ok(
    confirmed.ok &&
      row.tool === "ampel" &&
      row.utmSource === "" &&
      row.utmCampaign === "" &&
      row.src === "hero" &&
      row.variant === "a",
    "a new confirmation writes utm columns empty and keeps src and variant",
  );
  ok(!("gclid" in row) && !("gbraid" in row) && !("wbraid" in row), "the confirmation write has no click id");

  const written: ReadinessLead[] = [];
  const sent = await deliverAmpelResult(
    "person@kunde.example",
    answers,
    code ?? "",
    {
      email: "person@kunde.example",
      answers: code,
      ref: "",
      marketing: false,
      honeypot: "",
      ip: "203.0.113.20",
      utmSource: "testsrc",
      utmCampaign: "testcamp",
      src: "hero",
      variant: "a",
    },
    {
      now: () => Date.parse("2026-10-14T12:00:00.000Z"),
      mail: async () => ({ sent: false, stub: true }),
      saveLead: async (lead) => {
        written.push({ ...lead });
      },
    },
  );
  const lead = written.at(-1) ?? emptyReadinessLead();
  ok(
    sent.ok && lead.tool === "ampel" && lead.utmSource === "" && lead.utmCampaign === "" && lead.src === "hero" && lead.variant === "a",
    "the ampel row writes utm columns empty and keeps src and variant",
  );
  ok(!("gclid" in lead) && !("gbraid" in lead) && !("wbraid" in lead), "the ampel row has no click id");

  const hiddenRows: ReadinessLead[] = [];
  await deliverAmpelResult(
    "probe@example.com",
    answers,
    code ?? "",
    {
      email: "probe@example.com",
      answers: code,
      ref: "",
      marketing: false,
      honeypot: "",
      ip: "203.0.113.21",
      utmSource: "testsrc",
      utmCampaign: "testcamp",
      src: "hero",
      variant: "a",
    },
    {
      now: () => Date.parse("2026-10-14T12:00:00.000Z"),
      mail: async () => ({ sent: false, stub: true }),
      saveLead: async (leadRow) => {
        hiddenRows.push({ ...leadRow });
      },
    },
  );
  const hiddenLead = hiddenRows.at(-1) ?? emptyReadinessLead();
  ok(hiddenLead.tool === "" && hiddenLead.src === "" && hiddenLead.variant === "", "a test address stores empty src and variant");

  const kassenRows: ReadinessLead[] = [];
  const kassenSent = await submitKassenResult(
    {
      email: "kasse@kunde.example",
      answers: "JJJJJJ",
      ref: "",
      marketing: false,
      honeypot: "",
      ip: "203.0.113.30",
      utmSource: "google",
      utmCampaign: "kassen_pilot",
    },
    {
      store: createMemoryAmpelRateStore(),
      handoff: false,
      now: () => Date.parse("2026-10-14T12:00:00.000Z"),
      mail: async () => ({ sent: false, stub: true }),
      saveLead: async (row) => {
        kassenRows.push({ ...row });
      },
    },
  );
  const kassenLead = kassenRows.at(-1) ?? emptyReadinessLead();
  ok(
    kassenSent.ok && kassenLead.tool === "kassen" && kassenLead.utmSource === "" && kassenLead.utmCampaign === "",
    "the kassen row writes utm columns empty",
  );

  const preserved: ReadinessLead[] = [];
  const existing = emptyReadinessLead();
  existing.email = "person@kunde.example";
  existing.consentAt = "2026-10-14T12:00:00.000Z";
  existing.tool = "kassen";
  existing.utmSource = "stored-source";
  existing.utmCampaign = "stored-campaign";
  const preservedConfirm = await requestAmpelConfirmation(
    {
      email: "person@kunde.example",
      answers: code ?? "",
      ref: "",
      mailed: "ja",
      tool: "kassen",
      utmSource: "google",
      utmCampaign: "landing_pilot",
    },
    {
      findLead: async () => existing,
      saveLead: async (row) => {
        preserved.push({ ...row });
      },
      sendConfirmation: async () => ({ sent: true, stub: true }),
      now: () => Date.parse("2026-10-14T12:00:00.000Z"),
    },
  );
  const preservedRow = preserved.at(-1) ?? emptyReadinessLead();
  ok(
    preservedConfirm.ok && preservedRow.utmSource === "stored-source" && preservedRow.utmCampaign === "stored-campaign",
    "a confirmation update leaves the utm already stored on the row",
  );
}

const pages = ["app/ampel-check/ampel-check.tsx", "app/kassen-check/kassen-check.tsx"];
for (const file of pages) {
  const text = readFileSync(file, "utf8");
  ok(text.includes("replaceCheckSearch("), `${file} keeps campaign params on replace`);
  ok(!text.includes("gclid") && !text.includes("gbraid") && !text.includes("wbraid"), `${file} does not read a click id`);
  ok(!text.includes("localStorage"), `${file} does not write localStorage`);
}
const ampelPage = readFileSync("app/ampel-check/ampel-check.tsx", "utf8");
ok(!ampelPage.includes("submitUtmFields("), "Ampel does not send utm fields");
ok(!readFileSync("app/kassen-check/kassen-check.tsx", "utf8").includes("submitUtmFields("), "Kassen does not send utm fields");
ok(ampelPage.includes("sessionStorage") && ampelPage.includes("shownKey"), "Ampel still only uses sessionStorage for the shown result");
ok(ampelPage.includes("submitVariantFields("), "Ampel sends src and variant from the URL");
ok(!ampelPage.includes("gclid"), "Ampel does not persist a click id");

const sendSource = readFileSync("lib/ampel-result-send.ts", "utf8");
ok(sendSource.includes("lead.src = attribution.src") && sendSource.includes("lead.variant = attribution.variant"), "the lead write stores src and variant");
ok(!sendSource.includes("gclid") && !sendSource.includes("gbraid") && !sendSource.includes("wbraid"), "the lead write does not read a click id");

const ampelRoutes = [
  "app/api/ampel/ergebnis/route.ts",
  "app/api/ampel/ergebnis/senden/route.ts",
];
for (const file of ampelRoutes) {
  const text = readFileSync(file, "utf8");
  ok(!text.includes("utm_source") && !text.includes("utm_campaign") && !text.includes("utmSource"), `${file} does not forward utm fields`);
  ok(!text.includes("gclid") && !text.includes("gbraid") && !text.includes("wbraid"), `${file} does not read a click id`);
  ok(text.includes("src: value.src") && text.includes("variant: value.v"), `${file} forwards src and variant`);
}
const kassenRoutes = [
  "app/api/kassen-check/ergebnis/route.ts",
  "app/api/kassen-check/ergebnis/senden/route.ts",
];
for (const file of kassenRoutes) {
  const text = readFileSync(file, "utf8");
  ok(!text.includes("utm_source") && !text.includes("utm_campaign") && !text.includes("utmSource"), `${file} does not forward utm fields`);
  ok(!text.includes("gclid") && !text.includes("gbraid") && !text.includes("wbraid"), `${file} does not read a click id`);
}

const tracking = readFileSync("lib/tracking.ts", "utf8");
ok(tracking.includes('trackConsentedGaEvent("ampel_check_submit")'), "GA4 ampel_check_submit exists");
ok(tracking.includes('trackConsentedGaEvent("kassen_check_submit")'), "GA4 kassen_check_submit exists");
ok(!tracking.includes("export function trackLeadSubmit"), "the Ads lead conversion stays removed");
ok(sendSource.includes("const attribution = withoutAmpelUtm(counted);"), "every check lead write blanks utm columns");
ok(!sendSource.includes('deps.check === "kassen-check" ? counted'), "kassen does not keep a separate utm write");
const attributionSource = readFileSync("lib/lead-attribution.ts", "utf8");
const keptStart = attributionSource.indexOf("export function keptCheckAttribution");
const keptBody = attributionSource.slice(keptStart);
ok(keptStart !== -1, "keptCheckAttribution is the confirmation attribution");
ok(!keptBody.includes("input.utmSource") && !keptBody.includes("input.utmCampaign"), "confirmation does not copy utm from the caller");
ok(
  keptBody.includes('existing?.utmSource ?? ""') && keptBody.includes('existing?.utmCampaign ?? ""'),
  "confirmation keeps stored utm and writes empty on a new row",
);
const utmWriteHits: string[] = [];
const utmRoots = ["app", "components", "lib"];
const utmStack = utmRoots.map((root) => path.join(process.cwd(), root));
while (utmStack.length) {
  const dir = utmStack.pop()!;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      utmStack.push(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const rel = path.relative(process.cwd(), full);
    if (rel === "lib/campaign-params.ts") continue;
    const text = readFileSync(full, "utf8");
    if (text.includes("submitUtmFields")) utmWriteHits.push(`${rel}: submitUtmFields`);
    if (text.includes("value.utm_source") || text.includes("value.utm_campaign")) {
      utmWriteHits.push(`${rel}: request utm`);
    }
  }
}
assert.deepEqual(utmWriteHits, [], "no lead path sends or forwards utm into readiness_leads");
ok(!tracking.includes("gclid"), "tracking does not store a click id");

const header = readFileSync("components/site-header.tsx", "utf8");
const home = readFileSync("app/page.tsx", "utf8");
const campaignLink = readFileSync("components/campaign-link.tsx", "utf8");
ok(header.includes('{ href: "/readiness", label: "3-Minuten-Check" }'), "the default nav still opens the readiness check");
ok(home.includes('{ href: "/readiness", label: "3-Minuten-Check" }'), "the homepage nav still opens the readiness check");
ok(home.includes('const AMPEL_HERO_HREF = "/ampel-check?src=hero&v=a"'), "the hero href keeps src and variant");
ok(home.includes("<CampaignLink") && home.includes("href={AMPEL_HERO_HREF}"), "the hero link passes campaign params on the client");
ok((home.match(/<CampaignLink\b/g) ?? []).length >= 7, "homepage funnel and checkout links pass campaign params");
const checkoutCampaignLinks = home.match(/<CampaignLink\b[^>]*href="\/checkout"/g) ?? [];
ok(checkoutCampaignLinks.length === 4, "the four homepage checkout links use CampaignLink");
const homeWithoutCampaignLinks = home.replace(/<CampaignLink\b[\s\S]*?>/g, "");
ok(!homeWithoutCampaignLinks.includes('href="/checkout"'), "no plain href=\"/checkout\" remains in app/page.tsx");
ok(!/<a\b[^>]*href="\/checkout"/.test(home), "the homepage has no plain checkout anchor");
ok(
  /<CampaignLink\b[^>]*className="btn hide-sm"[^>]*href=\{ctaHref\}/.test(header),
  "the header CTA uses CampaignLink",
);
ok(!/<a\b[^>]*className="btn hide-sm"/.test(header), "the header CTA is not a plain anchor");
ok(!home.includes("localStorage") && !home.includes("sessionStorage") && !home.includes("document.cookie"), "the homepage writes nothing to storage");
ok(!header.includes("localStorage") && !header.includes("sessionStorage") && !header.includes("document.cookie"), "the header writes nothing to storage");
ok(!home.includes("gclid") && !header.includes("gclid"), "the homepage and header do not name a click id");
ok(campaignLink.includes("cta?: HomeCtaId"), "the campaign link accepts an optional homepage CTA id");
ok(campaignLink.includes("sendHomeCta("), "the campaign link can send the homepage beacon");
ok(!home.includes("sendHomeCta") && !header.includes("sendHomeCta"), "the page and header leave the beacon call in the client link");
ok(campaignLink.includes("useState(href)") && campaignLink.includes("window.location.search"), "the link starts from the plain href and reads the page URL");
ok(campaignLink.includes("hrefWithCampaignParams("), "the link reuses the campaign helper");
ok(
  !campaignLink.includes("localStorage") && !campaignLink.includes("sessionStorage") && !campaignLink.includes("document.cookie"),
  "the link stores nothing",
);
ok(!campaignLink.includes("gclid") && !campaignLink.includes("gbraid") && !campaignLink.includes("wbraid"), "the link does not name a click id");

main()
  .then(() => {
    console.log("attribution params checks passed");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
