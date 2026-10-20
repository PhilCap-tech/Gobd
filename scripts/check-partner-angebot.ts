/**
 * Prebuild: /partner-angebot buy CTAs go to Digistore24, the incoming query
 * is appended encoded, and the page stays noindex and out of the sitemap.
 *
 *   npx tsx scripts/check-partner-angebot.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sitemap from "../app/sitemap";
import { buildLlmsTxt } from "../lib/llms-txt";
import {
  DIGISTORE24_PRODUCT_URL,
  PARTNER_ANGEBOT_LEGAL_NOTICE,
  PARTNER_ANGEBOT_PATH,
  PARTNER_ANGEBOT_ROBOTS_TAG,
  digistore24BuyHref,
} from "../lib/partner-angebot";
import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "../lib/pricing";
import { INDEXABLE_STATIC_PATHS, canonicalUrl } from "../lib/seo";

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function source(file: string): string {
  return readFileSync(file, "utf8");
}

ok(SETUP_EUR === 149 && MONTHLY_EUR === 49 && TODAY_EUR === 198, "homepage price constants are unchanged");
ok(
  DIGISTORE24_PRODUCT_URL === "https://www.digistore24.com/product/751404",
  "product url is the Digistore24 offer",
);
ok(PARTNER_ANGEBOT_ROBOTS_TAG === "noindex, nofollow", "robots tag is noindex, nofollow");
ok(
  PARTNER_ANGEBOT_LEGAL_NOTICE.includes("Digistore24") &&
    PARTNER_ANGEBOT_LEGAL_NOTICE.startsWith("["),
  "legal notice is a marked placeholder",
);

function expectHref(search: Parameters<typeof digistore24BuyHref>[0], expected: string, label: string) {
  const href = digistore24BuyHref(search);
  ok(href === expected, label);
  const url = new URL(href);
  ok(
    `${url.origin}${url.pathname}` === DIGISTORE24_PRODUCT_URL,
    `${label} keeps the product host and path`,
  );
}

expectHref(undefined, DIGISTORE24_PRODUCT_URL, "empty query stays the product url");
expectHref("", DIGISTORE24_PRODUCT_URL, "blank string stays the product url");
expectHref({}, DIGISTORE24_PRODUCT_URL, "empty record stays the product url");
expectHref(
  { aff: "test123" },
  `${DIGISTORE24_PRODUCT_URL}?aff=test123`,
  "aff=test123 is passed through",
);
expectHref(
  "?aff=test123&campaignkey=herbst",
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&campaignkey=herbst`,
  "query string keeps aff and campaignkey",
);
expectHref(
  { aff: "test123", campaignkey: "a&b=c d" },
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&campaignkey=a%26b%3Dc+d`,
  "reserved characters are encoded",
);
expectHref(
  { aff: ["test123", "second"] },
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&aff=second`,
  "repeated aff values are kept",
);
expectHref(
  `https://www.gobd-doku-erstellen.de${PARTNER_ANGEBOT_PATH}?aff=test123&campaignkey=x`,
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&campaignkey=x`,
  "a full page url contributes only its query",
);

const page = source("app/partner-angebot/page.tsx");
const buyTags = [...page.matchAll(/<BuyCta\b([^>]*)>/g)];
ok(buyTags.length >= 4, "the page has the buy buttons");
for (const tag of buyTags) {
  ok(tag[1].includes("href={buyHref}"), "each buy button receives the Digistore24 href");
}
ok(page.includes("ctaHref={buyHref}"), "the header buy button uses the same href");
ok(page.includes("data-partner-cta=\"digistore24\""), "buy anchors are marked");
ok(page.includes("digistore24BuyHref"), "the page builds the href from the helper");
ok(page.includes("{PARTNER_ANGEBOT_LEGAL_NOTICE}"), "the placeholder is rendered");
ok(page.includes("index: false") && page.includes("follow: false"), "metadata is noindex, nofollow");
ok(page.includes("SETUP_EUR") && page.includes("MONTHLY_EUR") && page.includes("TODAY_EUR"), "prices come from pricing.ts");
ok(page.includes("GELD_ZURUECK_MICRO") && page.includes("HERO_PRICE_BOX"), "guarantee and price box are the homepage constants");
ok(!page.includes("/checkout"), "the page does not link to /checkout");
ok(!/stripe/i.test(page), "the page does not mention Stripe");
ok(!page.includes('"198') && !page.includes("198 €"), "198 is not hardcoded on the page");
ok(!page.includes("149 €") && !/[^A-Z_]149[^0-9]/.test(page), "149 is not hardcoded on the page");

const home = source("app/page.tsx");
ok(home.includes('href="/checkout"'), "the homepage checkout anchors stay");

const config = source("next.config.ts");
ok(config.includes("PARTNER_ANGEBOT_PATH"), "the robots header is bound to the partner path");
ok(config.includes("PARTNER_ANGEBOT_ROBOTS_TAG"), "the header uses the noindex tag");

const header = source("components/site-header.tsx");
const footer = source("components/site-footer.tsx");
ok(!header.includes(PARTNER_ANGEBOT_PATH), "the header does not link the partner page");
ok(!footer.includes(PARTNER_ANGEBOT_PATH), "the footer does not link the partner page");
ok(
  !(INDEXABLE_STATIC_PATHS as readonly string[]).includes(PARTNER_ANGEBOT_PATH),
  "the partner page is not an indexable path",
);

const llms = buildLlmsTxt();
ok(!llms.includes(PARTNER_ANGEBOT_PATH), "llms.txt omits the partner page");

async function main() {
  const urls = (await sitemap()).map((entry) => entry.url);
  ok(!urls.includes(canonicalUrl(PARTNER_ANGEBOT_PATH)), "sitemap omits the partner page");
  console.log("check-partner-angebot: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
