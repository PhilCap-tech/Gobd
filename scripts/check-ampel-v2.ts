/**
 * Ampel ohne E-Mail (Flag AMPEL_NO_EMAIL_ENABLED, Preview-Override ?ampel_v2=1).
 * - Override wirkt nie in Production.
 * - Flag aus: bisheriger Ablauf unverändert (Dateien gepinnt, Seite rendert AmpelCheck).
 * - Flag an: kein `?a=` in der URL, gclid/utm bleiben erhalten, neue Schritte nur im Flag-Pfad.
 * Usage: npx tsx scripts/check-ampel-v2.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  ampelNoEmailEnvEnabled,
  ampelV2OverrideAllowed,
  isAmpelNoEmailEnabled,
  stripAnswerCodeFromSearch,
} from "@/lib/ampel-v2-flag";
import { AMPEL_STEP_EVENTS, parseAmpelStepBody } from "@/lib/ampel-step-event";
import { AMPEL_V2_COPY, AMPEL_V2_PLACEHOLDER, AMPEL_V2_SHORT_LABELS, ampelV2Einordnung } from "@/lib/ampel-v2-copy";
import { AMPEL_QUESTIONS } from "@/lib/ampel-questions";
import { replaceCheckSearch } from "@/lib/campaign-params";

const read = (path: string) => readFileSync(path, "utf8");
const sha = (path: string) => createHash("sha256").update(read(path)).digest("hex");

// --- Flag + override -------------------------------------------------------
const on = { ampel_v2: "1" };
assert.equal(isAmpelNoEmailEnabled(undefined, {}), false, "unset env means OFF");
assert.equal(isAmpelNoEmailEnabled(undefined, { AMPEL_NO_EMAIL_ENABLED: "" }), false);
assert.equal(isAmpelNoEmailEnabled(undefined, { AMPEL_NO_EMAIL_ENABLED: "0" }), false);
assert.equal(isAmpelNoEmailEnabled(undefined, { AMPEL_NO_EMAIL_ENABLED: "yes" }), false);
assert.equal(ampelNoEmailEnvEnabled({ AMPEL_NO_EMAIL_ENABLED: "true" }), true);
assert.equal(isAmpelNoEmailEnabled(undefined, { AMPEL_NO_EMAIL_ENABLED: "1", VERCEL_ENV: "production" }), true);

// Production: the override must never work, whatever the query looks like.
const prod = { VERCEL_ENV: "production" };
assert.equal(ampelV2OverrideAllowed(prod), false, "override not allowed in production");
for (const query of [on, { ampel_v2: ["1"] }, { ampel_v2: "true" }, { ampel_v2: "1", a: "x" }]) {
  assert.equal(isAmpelNoEmailEnabled(query, prod), false, `production ignores ${JSON.stringify(query)}`);
  assert.equal(isAmpelNoEmailEnabled(query, { ...prod, AMPEL_NO_EMAIL_ENABLED: "0" }), false);
}
// Preview / local: only the exact value 1.
assert.equal(isAmpelNoEmailEnabled(on, { VERCEL_ENV: "preview" }), true);
assert.equal(isAmpelNoEmailEnabled({ ampel_v2: ["1", "0"] }, { VERCEL_ENV: "preview" }), true);
assert.equal(isAmpelNoEmailEnabled({ ampel_v2: "0" }, { VERCEL_ENV: "preview" }), false);
assert.equal(isAmpelNoEmailEnabled({}, { VERCEL_ENV: "preview" }), false);
assert.equal(isAmpelNoEmailEnabled(on, {}), true, "local dev may use the override");

// The page must not read search params in production and must pick the old flow when OFF.
const page = read("app/ampel-check/page.tsx");
assert.match(page, /const query = ampelV2OverrideAllowed\(\) \? await searchParams : undefined;/);
assert.match(page, /noEmail \? <AmpelCheckV2 ctaPrice=\{AMPEL_CTA\.price\} \/> : <AmpelCheck ctaPrice=\{AMPEL_CTA\.price\} \/>/);
assert.doesNotMatch(page, /"ampel_v2"/, "page leaves the override to lib/ampel-v2-flag");

// --- Flag OFF: unchanged ---------------------------------------------------
// Pinned so the flag-off flow stays byte-for-byte as before. Update only on purpose.
const PINNED: Record<string, string> = {
  "app/ampel-check/ampel-check.tsx": "baf8e37c43595e8504a4817b7662703eec1a029a5d593a4b1b490ed9a49fa17e",
  "components/ampel-result.tsx": "bf82592ecc31401440e38425aab477ef29d6741b1c1597fe5778392fac6f6bb4",
};
for (const [path, hash] of Object.entries(PINNED)) {
  assert.equal(sha(path), hash, `${path} changed: flag-off flow must stay unchanged`);
}

// --- Events only on the flag-on path ----------------------------------------
const NEW_EVENTS = [
  "ampel_result_view",
  "ampel_report_offer_view",
  "ampel_report_submit",
  "ampel_report_sent",
  "ampel_product_click",
] as const;
const v1 = read("app/ampel-check/ampel-check.tsx");
const v2 = read("app/ampel-check/ampel-check-v2.tsx");
for (const event of NEW_EVENTS) {
  assert.ok((AMPEL_STEP_EVENTS as readonly string[]).includes(event), `${event} is whitelisted`);
  assert.ok(!v1.includes(event), `${event} must not be sent by the flag-off flow`);
}
for (const event of ["ampel_result_view", "ampel_report_offer_view", "ampel_report_submit", "ampel_product_click"]) {
  assert.ok(v2.includes(`event: "${event}"`), `flag-on flow sends ${event}`);
}
assert.ok(v2.includes("noteAmpelReportSent("), "flag-on flow sends ampel_report_sent");
assert.ok(!v2.includes("noteAmpelSubmitResult") && !v2.includes("ampel_submit_click") && !v2.includes("sendAmpelEmailView"));
for (const component of ["components/ampel-result.tsx", "components/campaign-link.tsx", "components/consent-banner.tsx"]) {
  const text = read(component);
  for (const event of NEW_EVENTS) assert.ok(!text.includes(event), `${component} must not send ${event}`);
}
// Server whitelist: plain events take no extra fields; submit/sent take valid/status only.
assert.ok(parseAmpelStepBody({ event: "ampel_result_view" }));
assert.equal(parseAmpelStepBody({ event: "ampel_result_view", n: 1 }), null);
assert.equal(parseAmpelStepBody({ event: "ampel_product_click", email: "x@y.de" }), null);
assert.equal(parseAmpelStepBody({ event: "ampel_report_submit", valid: true })?.valid, "true");
assert.equal(parseAmpelStepBody({ event: "ampel_report_submit" }), null);
assert.equal(parseAmpelStepBody({ event: "ampel_report_sent", status: "pending_ok" })?.status, "pending_ok");
assert.equal(parseAmpelStepBody({ event: "ampel_report_sent", status: "200" }), null);

// No new tracking / Ads conversion / storage on the flag-on path.
for (const forbidden of [
  "gtag(",
  "fbq",
  "trackLeadSubmit",
  "conversion",
  "sessionStorage",
  "localStorage",
  "document.cookie",
  "router.replace",
  "router.push",
  "replaceCheckSearch",
  "pushState",
]) {
  assert.ok(!v2.includes(forbidden), `ampel-check-v2.tsx must not use ${forbidden}`);
}

// --- No ?a= in the URL with the flag on -----------------------------------
assert.ok(!/\ba:\s*code\b/.test(v2) && !v2.includes("encodeAmpelAnswers(next)) {"), "answer code is never written to the URL");
assert.ok(!/[?&]a=/.test(v2), "no literal ?a= in the flag-on flow");
assert.ok(!v2.includes('searchParams.get("a")'), "flag-on flow does not read answers from the URL");
assert.equal(stripAnswerCodeFromSearch("?gclid=G1&a=abc&utm_source=g&utm_campaign=c"), "?gclid=G1&utm_source=g&utm_campaign=c");
assert.equal(stripAnswerCodeFromSearch("?a=abc"), "");
assert.equal(stripAnswerCodeFromSearch("?gclid=G1"), null, "nothing to strip leaves the URL as is");

// --- gclid / utm carried --------------------------------------------------
// The flag-on flow never rewrites the URL (only the a= strip above), so gclid/gbraid/wbraid/utm_*
// stay in window.location.search for: questions, result, offer, submit (submitVariantFields as
// today) and product click (CampaignLink, consent-gated as today).
assert.ok(v2.includes("...submitVariantFields(window.location.search)"), "submit uses today's field helper");
assert.ok(v2.includes("<AmpelCta price={ctaPrice} />"), "product click uses today's CampaignLink CTA");
assert.equal(
  (v2.match(/history\.replaceState/g) ?? []).length,
  1,
  "only one address-bar write (the a= strip)",
);
// Same campaign keep-list as today, documented by the existing helper.
const kept = new URLSearchParams(
  replaceCheckSearch(new URLSearchParams("gclid=G1&utm_source=g&utm_medium=cpc&wbraid=W&a=abc"), { a: "" }),
);
assert.equal(kept.get("gclid"), "G1");
assert.equal(kept.get("utm_medium"), "cpc");
assert.equal(kept.has("a"), false);
// gclid is never sent to the server by the flag-on submit.
assert.ok(!/gclid|gbraid|wbraid/.test(v2.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "no click id handling in v2 code");

// --- Copy: Growth content 1:1, remaining placeholders, two approved strings -----
assert.equal(AMPEL_V2_COPY.offerHeading, "Ihr ausführlicher Ampel-Bericht als PDF");
assert.equal(AMPEL_V2_COPY.offerButton, "Bericht per E-Mail erhalten");
assert.equal(AMPEL_V2_COPY.h1, "GoBD-Ampel: Ihre Ersteinschätzung zur Verfahrensdokumentation");
assert.equal(AMPEL_V2_COPY.title, "GoBD-Ampel: kostenlose Ersteinschätzung in 10 Fragen");
assert.equal(Object.keys(AMPEL_V2_SHORT_LABELS).length, 10);
for (const question of AMPEL_QUESTIONS) assert.ok(AMPEL_V2_SHORT_LABELS[question.id], `short label for ${question.id}`);
assert.match(ampelV2Einordnung("gelb", ["iks"]), /Bei 1 Frage haben/);
assert.match(ampelV2Einordnung("gelb", ["iks", "scannen"]), /Bei 2 Fragen haben/);
assert.match(ampelV2Einordnung("rot", ["kasse_tse"]), /Deshalb zeigt die Ampel Rot/);
assert.match(ampelV2Einordnung("rot", ["iks"]), /Die drei Grundlagen sind nach Ihren Angaben vorhanden/);
assert.ok(!ampelV2Einordnung("rot", ["kasse_tse"]).includes("häufig"), "E13");
assert.ok(AMPEL_V2_COPY.shareMessage.includes("(keine Steuer- oder Rechtsberatung durch den Anbieter des Tools)"), "E14");
// Ads conversion: flag-on only, only inside the accepted-send branch, never in the flag-off flow.
assert.ok(!v1.includes("trackAmpelReportConversion"), "flag-off flow sends no Ads conversion");
assert.ok(/if \(leadAccepted\) \{\n\s+trackAmpelCheckSubmit\(\);\n(?:\s+\/\/.*\n)?\s+trackAmpelReportConversion\(/.test(v2), "Ads conversion only after an accepted send");
assert.equal((v2.match(/trackAmpelReportConversion\(/g) ?? []).length, 1);
assert.ok(v2.includes('flow: "bericht"'), "flag-on submit asks for consent version 2026-10-30");
for (const key of ["neinHeading", "offerIntro", "sentHeading", "sentText"] as const) {
  assert.ok(String(AMPEL_V2_COPY[key]).startsWith(AMPEL_V2_PLACEHOLDER), `${key} is a placeholder`);
}
// Title/meta switch only with the flag: v1 metadata object stays the old one.
assert.match(page, /const metadataV1: Metadata = \{\n  title: \{ absolute: AMPEL_TITLE \},\n  description: AMPEL_INTRO,/);
assert.match(page, /if \(!isAmpelNoEmailEnabled\(query\)\) return metadataV1;/);

console.log("check-ampel-v2: ok");
