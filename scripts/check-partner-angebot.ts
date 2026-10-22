/**
 * Prebuild: /partner-angebot buy CTAs go to Digistore24, the incoming query
 * is appended encoded, and the page stays noindex and out of the sitemap.
 *
 *   npx tsx scripts/check-partner-angebot.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sitemap from "../app/sitemap";
import { LegalMarkdown } from "../lib/legal-markdown";
import { buildLlmsTxt } from "../lib/llms-txt";
import {
  DIGISTORE24_PRODUCT_URL,
  PARTNER_ANGEBOT_LEGAL_NOTICE,
  PARTNER_ANGEBOT_NOTICE_HREF,
  PARTNER_ANGEBOT_NOTICE_LINK,
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
  PARTNER_ANGEBOT_LEGAL_NOTICE.startsWith("Der Kauf läuft über Digistore24") &&
    PARTNER_ANGEBOT_LEGAL_NOTICE.includes(PARTNER_ANGEBOT_NOTICE_LINK) &&
    PARTNER_ANGEBOT_NOTICE_HREF === "/agb" &&
    !PARTNER_ANGEBOT_LEGAL_NOTICE.includes("PLATZHALTER") &&
    !PARTNER_ANGEBOT_LEGAL_NOTICE.includes("["),
  "partner notice is the approved Digistore24 sentence",
);
ok(
  PARTNER_ANGEBOT_LEGAL_NOTICE.includes(
    `${TODAY_EUR} € zum Start (Einrichtung ${SETUP_EUR} € + 1. Monat ${MONTHLY_EUR} €), danach ${MONTHLY_EUR} €/Monat`,
  ),
  "partner notice prices match pricing.ts",
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
ok(
  page.includes("{PARTNER_ANGEBOT_NOTICE_BEFORE}") &&
    page.includes("{PARTNER_ANGEBOT_NOTICE_LINK}") &&
    page.includes("{PARTNER_ANGEBOT_NOTICE_AFTER}") &&
    page.includes("PARTNER_ANGEBOT_NOTICE_HREF"),
  "the approved notice is rendered and AGB (§ 9a) links to /agb",
);
ok(page.includes("index: false") && page.includes("follow: false"), "metadata is noindex, nofollow");
ok(page.includes("SETUP_EUR") && page.includes("MONTHLY_EUR") && page.includes("TODAY_EUR"), "prices come from pricing.ts");
ok(page.includes("GELD_ZURUECK_MICRO") && page.includes("HERO_PRICE_BOX"), "guarantee and price box are the homepage constants");
ok(!page.includes("/checkout"), "the page does not link to /checkout");
ok(!/stripe/i.test(page), "the page does not mention Stripe");
ok(!page.includes('"198') && !page.includes("198 €"), "198 is not hardcoded on the page");
ok(!page.includes("149 €") && !/[^A-Z_]149[^0-9]/.test(page), "149 is not hardcoded on the page");

const home = source("app/page.tsx");
ok((home.match(/<CampaignLink\b[^>]*href="\/checkout"/g) ?? []).length >= 4, "the homepage checkout links stay");
ok(!/<a\b[^>]*href="\/checkout"/.test(home), "the homepage checkout links are not plain anchors");

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

const agb = source("content/legal/agb.md");
ok(agb.includes("## § 9a Bestellungen über Digistore24 (Partner-Angebot)"), "AGB has § 9a");
ok(agb.includes("(4) Für Bestellungen über die Partnerseite https://www.gobd-doku-erstellen.de/partner-angebot, die über Digistore24 abgewickelt werden, gelten ergänzend und vorrangig die Regelungen in § 9a."), "AGB § 1 Abs. 4");
ok(
  agb.includes(
    `${TODAY_EUR} € zum Start (Einrichtung ${SETUP_EUR} € + 1. Monat ${MONTHLY_EUR} €), danach ${MONTHLY_EUR} € pro Monat`,
  ),
  "AGB § 9a prices match pricing.ts",
);
const privacy = source("content/legal/datenschutz.md");
ok(privacy.includes("## 12. Bestellungen über Digistore24 (Partner-Angebot)"), "privacy section 12");
ok(privacy.includes("## 13. Google Ads Conversion-Tracking und Google Analytics 4"), "Google Ads is section 13");
ok(privacy.includes("## 25. Änderungen"), "privacy sections run through 25");
ok(!privacy.includes("## 12. Google Ads"), "old section 12 heading is gone");
ok(privacy.includes("Käufe über Digistore24 melden wir nicht an Google."), "Google Ads sentence");
const faq = source("content/faq.md");
ok(
  faq.includes(
    "Bei Bestellungen über unsere Partnerseite (Digistore24) gelten dieselben Erstattungsregeln; die Erstattung beantragen Sie über Digistore24 (Soforthilfe-Link in der Bestellbestätigung) oder bei uns, abgewickelt wird sie über Digistore24 (§ 9a AGB).",
  ),
  "FAQ item 6 has the approved sentence",
);

function renderedHrefs(markdown: string): string[] {
  const html = renderToStaticMarkup(createElement(LegalMarkdown, { source: markdown }));
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

const agbHrefs = renderedHrefs(agb);
const privacyHrefs = renderedHrefs(privacy);
const faqHrefs = renderedHrefs(faq);
const exactHrefs = [
  "https://www.digistore24.com/page/privacy/1/de",
  "https://www.digistore24.com/page/terms/1/de",
  "https://www.gobd-doku-erstellen.de/partner-angebot",
];
for (const href of exactHrefs) {
  const hits = [...agbHrefs, ...privacyHrefs, ...faqHrefs].filter((value) => value === href || value.startsWith(href));
  ok(hits.includes(href), `autolink href is exactly ${href}`);
  ok(
    hits.every((value) => value === href),
    `no trailing punctuation in ${href}`,
  );
}
const privacyHtml = renderToStaticMarkup(createElement(LegalMarkdown, { source: privacy }));
const agbHtml = renderToStaticMarkup(createElement(LegalMarkdown, { source: agb }));
const faqHtml = renderToStaticMarkup(createElement(LegalMarkdown, { source: faq }));
ok(
  privacyHtml.includes("https://www.digistore24.com/page/privacy/1/de</a>)."),
  "privacy URL keeps ').' outside the link",
);
ok(
  agbHtml.includes("https://www.digistore24.com/page/terms/1/de</a>)."),
  "AGB terms URL keeps ').' outside the link",
);
ok(
  faqHtml.includes("https://www.gobd-doku-erstellen.de/partner-angebot</a>,"),
  "FAQ partner URL keeps the comma outside the link",
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
