/**
 * Prebuild: /llms.txt is served from the route and states the public price
 * and the no-tax-advice note. Refund text must be the FAQ/AGB sections.
 *
 *   npx tsx scripts/check-llms-txt.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { faqEntries, readFaqMarkdown } from "../lib/faq-entries";
import { agbMarkdown } from "../lib/legal-content";
import { LEGAL_OPERATOR } from "../lib/legal";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  impressumAddress,
  organizationJsonLd,
  productOfferJsonLd,
} from "../lib/jsonld";
import { buildLlmsTxt } from "../lib/llms-txt";
import { markdownH2Section } from "../lib/markdown-section";
import {
  MONTHLY_EUR,
  SETUP_EUR,
  TODAY_EUR,
  TODAY_GROSS_LABEL,
  VAT_PERCENT,
  grossCents,
} from "../lib/pricing";
import { CANONICAL_PRODUCTION_APP_URL } from "../lib/env";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const routePath = path.join(process.cwd(), "app/llms.txt/route.ts");
ok(existsSync(routePath), "app/llms.txt/route.ts exists");
const routeSource = readFileSync(routePath, "utf8");
ok(routeSource.includes("buildLlmsTxt"), "route serves buildLlmsTxt");
ok(routeSource.includes("text/plain"), "route content type is text/plain");

const text = buildLlmsTxt();
ok(text.startsWith("# GoBD-Verfahrensdokumentation"), "llms.txt has a title");
ok(text.includes("keine Steuerberatung"), "llms.txt contains keine Steuerberatung");
ok(
  text.includes(`${SETUP_EUR} € Setup + ${MONTHLY_EUR} €/Monat netto`),
  "llms.txt contains setup and monthly net price",
);
ok(
  text.includes(
    `${TODAY_EUR} € netto zum Start bzw. ${TODAY_GROSS_LABEL} € brutto inkl. ${VAT_PERCENT} % USt`,
  ),
  "llms.txt contains start net and gross price",
);
ok(text.includes("Fragebogen mit 24 Modulen"), "llms.txt describes the intake");
ok(text.includes("Nur für Unternehmen"), "llms.txt is B2B only");
const checkoutForm = readFileSync(
  path.join(process.cwd(), "app/checkout/checkout-form.tsx"),
  "utf8",
);
ok(
  checkoutForm.includes("Reverse Charge") &&
    checkoutForm.includes("bieten wir derzeit"),
  "reverse-charge sentence still exists on checkout",
);
ok(text.includes("Reverse Charge"), "llms.txt keeps the checkout tax sentence");

const origin = CANONICAL_PRODUCTION_APP_URL;
for (const page of [
  "/faq",
  "/agb",
  "/muster",
  "/steuerberater/muster",
  "/datenschutz",
  "/impressum",
  "/checkout",
]) {
  ok(text.includes(`${origin}${page}`), `llms.txt links ${page}`);
}

const faq = readFaqMarkdown();
const faqGuarantee = markdownH2Section(faq, "6. 14 Tage Zufriedenheitsgarantie");
const agbWithdrawal = markdownH2Section(agbMarkdown, "§ 8 Kein Widerrufsrecht (B2B)");
const agbGuarantee = markdownH2Section(agbMarkdown, "§ 9 Zufriedenheitsgarantie");
const agbTerm = markdownH2Section(
  agbMarkdown,
  "§ 12 Laufzeit, Verlängerung und Kündigung",
);
ok(text.includes(faqGuarantee), "llms.txt quotes the FAQ guarantee");
ok(text.includes(agbWithdrawal), "llms.txt quotes AGB § 8");
ok(text.includes(agbGuarantee), "llms.txt quotes AGB § 9");
ok(text.includes(agbTerm), "llms.txt quotes AGB § 12");
ok(
  faqGuarantee.includes("198 € zzgl. USt") && text.includes("198 € zzgl. USt"),
  "refund amount is the FAQ wording",
);
ok(
  !/sk_live_|sk_test_|pk_live_|pk_test_|price_[A-Za-z0-9]|txr_|cs_test_|cs_live_/.test(
    text,
  ),
  "llms.txt has no Stripe ids",
);

const rules = robots().rules;
const allow = Array.isArray(rules) ? rules[0]?.allow : rules.allow;
const disallow = Array.isArray(rules) ? rules[0]?.disallow : rules.disallow;
const allowList = Array.isArray(allow) ? allow : allow ? [allow] : [];
const disallowList = Array.isArray(disallow) ? disallow : disallow ? [disallow] : [];
ok(allowList.includes("/llms.txt"), "robots allows /llms.txt");
ok(allowList.includes("/sitemap.xml"), "robots allows the sitemap");
ok(allowList.includes("/faq"), "robots allows a public page");
ok(allowList.includes("/"), "robots keeps the public site allowed");
ok(disallowList.includes("/api/"), "robots disallows /api/");
ok(!allowList.some((entry) => entry.startsWith("/api")), "robots does not allow /api");
ok(
  robots().sitemap === `${origin}/sitemap.xml`,
  "robots references the sitemap",
);

const impressum = readFileSync(
  path.join(process.cwd(), "content/legal/impressum.md"),
  "utf8",
);
const address = impressumAddress();
ok(impressum.includes(LEGAL_OPERATOR.name), "operator name matches the Impressum");
ok(impressum.includes(address.streetAddress), "street matches the Impressum");
ok(
  impressum.includes(`${address.postalCode} ${address.addressLocality}`),
  "postal address matches the Impressum",
);
ok(impressum.includes(address.addressCountry), "country matches the Impressum");
const organization = organizationJsonLd();
ok(organization.name === "IKAT GmbH", "organization name");
ok(
  (organization.address as { streetAddress: string }).streetAddress === "Gartzenweg 1a",
  "organization street",
);

const product = JSON.stringify(productOfferJsonLd());
ok(product.includes('"priceCurrency":"EUR"'), "offers use EUR");
ok(product.includes('"price":"149.00"'), "setup net price");
ok(product.includes('"price":"49.00"'), "monthly net price");
ok(product.includes('"price":"198.00"'), "start net price");
ok(product.includes('"price":"177.31"'), "setup gross price");
ok(product.includes('"price":"58.31"'), "monthly gross price");
ok(product.includes('"price":"235.62"'), "start gross price");
ok(product.includes('"valueAddedTaxIncluded":false'), "net prices exclude VAT");
ok(product.includes('"valueAddedTaxIncluded":true'), "gross prices include VAT");
ok(grossCents(TODAY_EUR) === 23562, "198 € net is 235,62 € gross at 19 %");
ok(grossCents(SETUP_EUR) === 17731, "149 € net is 177,31 € gross at 19 %");
ok(grossCents(MONTHLY_EUR) === 5831, "49 € net is 58,31 € gross at 19 %");
ok(!/price_[A-Za-z0-9]|txr_|sk_live_|sk_test_/.test(product), "JSON-LD has no Stripe ids");

const entries = faqEntries(faq);
ok(entries.length >= 6, "FAQ JSON-LD uses the FAQ sections");
ok(entries.some((entry) => entry.question.includes("Zufriedenheitsgarantie")), "guarantee question");
ok(
  entries.some((entry) => entry.answer.includes("198 € zzgl. USt")),
  "FAQ answer is the markdown, not a second copy",
);
const faqLd = JSON.stringify(faqPageJsonLd(entries));
ok(faqLd.includes('"@type":"FAQPage"'), "FAQPage type");
ok(faqLd.includes(entries[0].question), "FAQPage question comes from the entries");

const crumbs = breadcrumbJsonLd([
  { name: "Startseite", path: "/" },
  { name: "FAQ", path: "/faq" },
]);
const crumbJson = JSON.stringify(crumbs);
ok(crumbJson.includes(`${origin}/faq`), "breadcrumb uses the canonical FAQ url");
ok(crumbJson.includes('"@type":"BreadcrumbList"'), "breadcrumb type");

async function checkSitemap() {
  const urls = (await sitemap()).map((entry) => entry.url);
  ok(urls.includes(`${origin}/llms.txt`), "sitemap lists /llms.txt");
  ok(urls.includes(`${origin}/faq`), "sitemap still lists /faq");
  console.log("check-llms-txt: ok");
}

checkSitemap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
