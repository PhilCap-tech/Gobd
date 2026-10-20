/**
 * Campaign params stay on the check URL, and the lead row records only
 * tool + utm_source + utm_campaign. Click ids are not stored.
 * Usage: npx tsx scripts/check-attribution-params.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requestAmpelConfirmation } from "../lib/ampel-confirm";
import { AMPEL_QUESTIONS } from "../lib/ampel-questions";
import { createMemoryAmpelSuppressionStore, setAmpelSuppressionTestStore } from "../lib/ampel-suppression";
import { encodeAmpelAnswers, type AmpelAnswerMap } from "../lib/ampel-score";
import { replaceCheckSearch, submitUtmFields } from "../lib/campaign-params";
import { keptCheckAttribution, storedCheckAttribution } from "../lib/lead-attribution";
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

const real = storedCheckAttribution({
  email: "person@kunde.example",
  tool: "ampel",
  utmSource: "google",
  utmCampaign: "landing_pilot",
});
assert.deepEqual(real, { tool: "ampel", utmSource: "google", utmCampaign: "landing_pilot" });
const kassen = storedCheckAttribution({
  email: "person@kunde.example",
  tool: "kassen",
  utmSource: " google ",
  utmCampaign: "",
});
assert.deepEqual(kassen, { tool: "kassen", utmSource: "google", utmCampaign: "" });
for (const email of ["probe@example.com", "gobd16x-probe@gmail.com", "info@gobd-doku-erstellen.de"]) {
  const hidden = storedCheckAttribution({
    email,
    tool: "ampel",
    utmSource: "google",
    utmCampaign: "landing_pilot",
  });
  assert.deepEqual(hidden, { tool: "", utmSource: "", utmCampaign: "" }, email);
}
const listed = storedCheckAttribution({
  email: "person@kunde.example",
  entityId: TEST_ENTITY_IDS[0],
  tool: "kassen",
  utmSource: "google",
  utmCampaign: "landing_pilot",
});
assert.deepEqual(listed, { tool: "", utmSource: "", utmCampaign: "" });
ok(
  keptCheckAttribution({ tool: "ampel", utmSource: "google", utmCampaign: "landing_pilot" }, null).tool === "ampel",
  "an explicit source is kept",
);
ok(
  keptCheckAttribution({}, { tool: "kassen", utmSource: "google", utmCampaign: "pilot" }).tool === "kassen",
  "a missing source keeps the stored row",
);
ok(keptCheckAttribution({ tool: "", utmSource: "", utmCampaign: "" }, { tool: "ampel", utmSource: "google" }).tool === "", "an explicit empty source stays empty");

const columns = READINESS_SHEET_COLUMNS as readonly string[];
ok(columns.includes("tool") && columns.includes("utm_source") && columns.includes("utm_campaign"), "the sheet has the count columns");
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
    confirmed.ok && row.tool === "ampel" && row.utmSource === "google" && row.utmCampaign === "landing_pilot",
    "the confirmation write keeps the countable source",
  );
  ok(!("gclid" in row) && !("gbraid" in row) && !("wbraid" in row), "the confirmation write has no click id");
}

const pages = ["app/ampel-check/ampel-check.tsx", "app/kassen-check/kassen-check.tsx"];
for (const file of pages) {
  const text = readFileSync(file, "utf8");
  ok(text.includes("replaceCheckSearch("), `${file} keeps campaign params on replace`);
  ok(text.includes("submitUtmFields("), `${file} passes utm fields with the submit`);
  ok(!text.includes("gclid") && !text.includes("gbraid") && !text.includes("wbraid"), `${file} does not read a click id`);
  ok(!text.includes("localStorage"), `${file} does not write localStorage`);
}
const ampelPage = readFileSync("app/ampel-check/ampel-check.tsx", "utf8");
ok(ampelPage.includes("sessionStorage") && ampelPage.includes("shownKey"), "Ampel still only uses sessionStorage for the shown result");
ok(!ampelPage.includes("gclid"), "Ampel does not persist a click id");

const routes = [
  "app/api/ampel/ergebnis/route.ts",
  "app/api/ampel/ergebnis/senden/route.ts",
  "app/api/kassen-check/ergebnis/route.ts",
  "app/api/kassen-check/ergebnis/senden/route.ts",
];
for (const file of routes) {
  const text = readFileSync(file, "utf8");
  ok(text.includes("utmSource: value.utm_source") && text.includes("utmCampaign: value.utm_campaign"), `${file} forwards utm fields`);
  ok(!text.includes("gclid") && !text.includes("gbraid") && !text.includes("wbraid"), `${file} does not read a click id`);
}

const tracking = readFileSync("lib/tracking.ts", "utf8");
ok(tracking.includes('trackConsentedGaEvent("ampel_check_submit")'), "GA4 ampel_check_submit exists");
ok(tracking.includes('trackConsentedGaEvent("kassen_check_submit")'), "GA4 kassen_check_submit exists");
ok(tracking.includes("export function trackLeadSubmit"), "the Ads lead conversion stays");
ok(!tracking.includes("gclid"), "tracking does not store a click id");

const header = readFileSync("components/site-header.tsx", "utf8");
const home = readFileSync("app/page.tsx", "utf8");
ok(header.includes('{ href: "/readiness", label: "3-Minuten-Check" }'), "the default nav still opens the readiness check");
ok(home.includes('{ href: "/readiness", label: "3-Minuten-Check" }'), "the homepage nav still opens the readiness check");

main()
  .then(() => {
    console.log("attribution params checks passed");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
