/**
 * Prebuild: /llms.txt is served from the route and states the public price
 * and the no-tax-advice note. Refund text must be the FAQ/AGB sections.
 *
 *   npx tsx scripts/check-llms-txt.ts
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
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
import { BRANCHEN_SLUGS, branchenPath, listBranchenSeiten } from "../lib/branchen";
import { buildLlmsTxt } from "../lib/llms-txt";
import { markdownH2Section } from "../lib/markdown-section";
import {
  MONTHLY_EUR,
  SETUP_EUR,
  TODAY_EUR,
  TODAY_GROSS_LABEL,
  grossCents,
} from "../lib/pricing";
import { CANONICAL_PRODUCTION_APP_URL } from "../lib/env";
import { canonicalUrl } from "../lib/seo";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const routePath = path.join(process.cwd(), "app/llms.txt/route.ts");
ok(existsSync(routePath), "app/llms.txt/route.ts exists");
const routeSource = readFileSync(routePath, "utf8");
ok(routeSource.includes("buildLlmsTxt"), "route serves buildLlmsTxt");
ok(routeSource.includes("text/plain"), "route content type is text/plain");

const origin = CANONICAL_PRODUCTION_APP_URL;
const text = buildLlmsTxt();
ok(text.startsWith("# GoBD-Verfahrensdokumentation"), "llms.txt has a title");
ok(text.includes("keine Steuerberatung"), "llms.txt contains keine Steuerberatung");
ok(
  text.includes(
    `${TODAY_EUR} € zum Start (Einrichtung + 1. Monat), danach ${MONTHLY_EUR} €/Monat, zzgl. USt. (brutto ${TODAY_GROSS_LABEL} €).`,
  ),
  "llms.txt contains the start price line",
);
ok(text.includes("Fragebogen mit 24 Modulen"), "llms.txt describes the intake");
ok(
  text.includes(
    `Über POST ${origin}/api/checkout starten Sie den Stripe-Checkout über den Ablauf der Website, und die Zahlung schließen Sie bei Stripe ab.`,
  ),
  "llms.txt names POST /api/checkout in one Sie sentence",
);
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
  faqGuarantee.includes("198 € zum Start (Einrichtung + 1. Monat), zzgl. USt.") &&
    text.includes("198 € zum Start (Einrichtung + 1. Monat), zzgl. USt."),
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
ok(allowList[0] === "/api/checkout", "Allow /api/checkout is the first allow");
ok(allowList.includes("/api/checkout"), "robots allows /api/checkout");
ok(
  allowList.filter((entry) => entry === "/api/checkout").length === 1,
  "robots allows /api/checkout once",
);
ok(
  !allowList.some((entry) => entry.startsWith("/api") && entry !== "/api/checkout"),
  "robots allows no other /api path",
);
ok(allowList.every((entry) => entry !== "/api/checkout/"), "checkout allow has no trailing slash");
ok(disallowList.includes("/api/"), "robots disallows /api/");
ok(
  disallowList.every((entry) => entry !== "/api/checkout"),
  "robots does not disallow /api/checkout itself",
);
ok(
  "/api/checkout".length > "/api/".length && "/api/checkout".startsWith("/api/"),
  "Allow /api/checkout is a longer path than Disallow /api/",
);

/** RFC 9309: longest matching path wins; an equal-length allow beats a disallow. */
function robotsDecision(path: string): "allow" | "disallow" {
  let best = -1;
  let decision: "allow" | "disallow" = "allow";
  const visit = (entries: string[], kind: "allow" | "disallow") => {
    for (const rule of entries) {
      if (!path.startsWith(rule)) continue;
      if (rule.length > best || (rule.length === best && kind === "allow")) {
        best = rule.length;
        decision = kind;
      }
    }
  };
  visit(allowList, "allow");
  visit(disallowList, "disallow");
  return decision;
}
ok(robotsDecision("/api/checkout") === "allow", "/api/checkout allow takes precedence");
ok(robotsDecision("/api/other") === "disallow", "another /api/ path stays disallowed");
ok(robotsDecision("/api/") === "disallow", "/api/ itself stays disallowed");
ok(robotsDecision("/faq") === "allow", "a public page stays allowed");
ok(
  robots().sitemap === `${origin}/sitemap.xml`,
  "robots references the sitemap",
);

const { resolveRobots } = createRequire(import.meta.url)(
  "next/dist/build/webpack/loaders/metadata/resolve-route-data.js",
) as {
  resolveRobots: (data: ReturnType<typeof robots>) => string;
};
const robotsTxt = resolveRobots(robots());
const checkoutAllowAt = robotsTxt.indexOf("Allow: /api/checkout\n");
const apiDisallowAt = robotsTxt.indexOf("Disallow: /api/\n");
ok(robotsTxt.startsWith("User-Agent: *\n"), "robots.txt is for every user agent");
ok(
  (robotsTxt.match(/^User-Agent:/gm) ?? []).length === 1,
  "allow and disallow share one user-agent group",
);
ok(checkoutAllowAt === robotsTxt.indexOf("Allow:"), "Allow /api/checkout is the first Allow line");
ok(
  checkoutAllowAt !== -1 && apiDisallowAt > checkoutAllowAt,
  "Disallow /api/ is ordered after Allow /api/checkout",
);
ok(!robotsTxt.includes("Allow: /api/\n"), "robots.txt does not allow every /api/ path");
ok(!robotsTxt.includes("Allow: /api/checkout/\n"), "robots.txt checkout allow has no trailing slash");

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
  entries.some((entry) =>
    entry.answer.includes("198 € zum Start (Einrichtung + 1. Monat), zzgl. USt."),
  ),
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
  ok(!urls.includes(`${origin}/llms.txt`), "sitemap omits /llms.txt");
  ok(urls.includes(`${origin}/faq`), "sitemap still lists /faq");
  const branchen = await listBranchenSeiten();
  ok(branchen.length >= 2, "branch pages are loaded");
  for (const slug of BRANCHEN_SLUGS) {
    ok(text.includes(canonicalUrl(branchenPath(slug))), `llms.txt links ${branchenPath(slug)}`);
  }
  for (const seite of branchen) {
    const url = canonicalUrl(branchenPath(seite.slug));
    if (seite.noindex) {
      ok(!urls.includes(url), `sitemap omits noindex ${branchenPath(seite.slug)}`);
    } else {
      ok(urls.includes(url), `sitemap lists ${branchenPath(seite.slug)}`);
    }
  }
  console.log("check-llms-txt: ok");
}

checkSitemap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
