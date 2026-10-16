/**
 * Prebuild: homepage FAQ JSON-LD matches the visible FAQ, branch pages
 * carry the unchanged net offers, the sitemap has lastmod, and share
 * tags point at the 1200×630 image.
 *
 *   npx tsx scripts/check-seo.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import sitemap from "../app/sitemap";
import openGraphImage, { size as ogSize } from "../app/opengraph-image";
import {
  branchenAnchorLabel,
  listBranchenFooterLinks,
  listBranchenSeiten,
} from "../lib/branchen";
import { HANDEL_MUSTER_HREF, HANDEL_MUSTER_LABEL } from "../lib/branchen-links";
import { HOME_CRUMBS, HOME_FAQ } from "../lib/home-faq";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  productOfferJsonLd,
  type JsonLdNode,
} from "../lib/jsonld";
import { MONTHLY_EUR, SETUP_EUR } from "../lib/pricing";
import {
  HOME_DESCRIPTION,
  HOME_OPEN_GRAPH,
  HOME_TITLE,
  HOME_TWITTER,
  OG_IMAGE,
  ROOT_OPEN_GRAPH,
  ROOT_TWITTER,
  canonicalUrl,
} from "../lib/seo";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

/** Same serialization the JSON-LD script tag uses. */
function parseJsonLd(data: JsonLdNode): JsonLdNode {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");
  return JSON.parse(payload) as JsonLdNode;
}

const root = process.cwd();
function source(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const ANCHOR_SPERRE = /rechtssicher|gobd-konform|prüfungssicher/i;

function checkAnchors(seiten: Awaited<ReturnType<typeof listBranchenSeiten>>) {
  const published = seiten.filter((seite) => !seite.noindex);
  ok(published.length >= 2, "at least two indexable branch pages");
  for (const seite of published) {
    const label = branchenAnchorLabel(seite.h1);
    const fromH1 = seite.h1.split(":")[0]?.trim();
    ok(label === fromH1 && label.length > 0, `anchor for ${seite.slug} is the H1 up to the colon`);
    ok(!ANCHOR_SPERRE.test(label), `anchor for ${seite.slug} has no blocked claim`);
    ok(seite.route.endsWith(`-${seite.slug}`), `anchor href matches ${seite.route}`);
  }
  ok(!ANCHOR_SPERRE.test(HANDEL_MUSTER_LABEL), "handel muster anchor has no blocked claim");
  ok(HANDEL_MUSTER_HREF === "/muster/gesamt/handel", "handel muster path");
}

function checkFaqJsonLd() {
  const parsed = parseJsonLd(faqPageJsonLd(HOME_FAQ));
  ok(parsed["@type"] === "FAQPage", "homepage JSON-LD is FAQPage");
  const entities = parsed.mainEntity as Array<{
    "@type": string;
    name: string;
    acceptedAnswer: { "@type": string; text: string };
  }>;
  ok(entities.length === HOME_FAQ.length, "FAQPage has one question per visible item");
  for (let index = 0; index < HOME_FAQ.length; index += 1) {
    const visible = HOME_FAQ[index];
    const entity = entities[index];
    ok(entity["@type"] === "Question", `FAQ item ${index + 1} is a Question`);
    ok(entity.name === visible.question, `FAQ question ${index + 1} matches the visible text`);
    ok(entity.acceptedAnswer["@type"] === "Answer", `FAQ item ${index + 1} has an Answer`);
    ok(
      entity.acceptedAnswer.text === visible.answer,
      `FAQ answer ${index + 1} matches the visible text`,
    );
  }
  const page = source("app/page.tsx");
  ok(page.includes("faqPageJsonLd(HOME_FAQ)"), "homepage renders FAQPage from HOME_FAQ");
  ok(page.includes("<h3>{item.question}</h3>"), "visible FAQ question is item.question");
  ok(page.includes("<p>{item.answer}</p>"), "visible FAQ answer is item.answer");
  ok(page.includes("HOME_FAQ.map"), "visible FAQ iterates HOME_FAQ");
}

function checkBreadcrumb() {
  const parsed = parseJsonLd(breadcrumbJsonLd(HOME_CRUMBS));
  ok(parsed["@type"] === "BreadcrumbList", "homepage JSON-LD includes BreadcrumbList");
  const items = parsed.itemListElement as Array<{
    position: number;
    name: string;
    item: string;
  }>;
  ok(items.length === 1, "homepage breadcrumb has the start page");
  ok(items[0]?.name === "Startseite", "homepage breadcrumb name");
  ok(items[0]?.item === canonicalUrl("/"), "homepage breadcrumb canonical");
  ok(source("app/page.tsx").includes("CrumbJsonLd items={HOME_CRUMBS}"), "homepage renders HOME_CRUMBS");
}

function checkOffers() {
  const parsed = parseJsonLd(productOfferJsonLd());
  const offers = parsed.offers as Array<{
    "@type": string;
    price: string;
    priceCurrency: string;
    priceSpecification: Array<{ price: string; priceCurrency: string; valueAddedTaxIncluded: boolean }>;
  }>;
  const setup = offers.find((offer) => offer.price === `${SETUP_EUR}.00`);
  const monthly = offers.find((offer) => offer.price === `${MONTHLY_EUR}.00`);
  ok(setup?.["@type"] === "Offer", "setup offer type");
  ok(setup?.price === "149.00" && setup.priceCurrency === "EUR", "setup offer is 149.00 EUR");
  ok(monthly?.["@type"] === "Offer", "monthly offer type");
  ok(monthly?.price === "49.00" && monthly.priceCurrency === "EUR", "monthly offer is 49.00 EUR");
  ok(
    setup?.priceSpecification.some(
      (spec) => spec.price === "149.00" && spec.priceCurrency === "EUR" && spec.valueAddedTaxIncluded === false,
    ),
    "setup net price specification is 149.00 EUR",
  );
  ok(
    monthly?.priceSpecification.some(
      (spec) => spec.price === "49.00" && spec.priceCurrency === "EUR" && spec.valueAddedTaxIncluded === false,
    ),
    "monthly net price specification is 49.00 EUR",
  );
  const branchen = source("components/branchen-page.tsx");
  ok(branchen.includes("productOfferJsonLd()"), "branch pages render the product offers");
}

function checkShareMeta() {
  const homeOg = HOME_OPEN_GRAPH;
  const images = homeOg.images as Array<{ url: string; width: number; height: number; alt: string }>;
  ok(homeOg.title === HOME_TITLE, "homepage og:title matches the document title");
  ok(homeOg.description === HOME_DESCRIPTION, "homepage og:description matches the document description");
  ok(homeOg.url === canonicalUrl("/"), "homepage og:url is the canonical origin");
  ok(
    homeOg.locale === "de_DE" && "type" in homeOg && homeOg.type === "website",
    "homepage og locale and type",
  );
  ok(images[0]?.url === "/opengraph-image", "homepage og:image url");
  ok(images[0]?.width === 1200 && images[0]?.height === 630, "homepage og:image is 1200x630");
  ok(images[0]?.alt === HOME_TITLE, "homepage og:image alt is the existing title");
  ok(
    "card" in HOME_TWITTER && HOME_TWITTER.card === "summary_large_image",
    "homepage twitter card",
  );
  ok(HOME_TWITTER.title === HOME_TITLE, "homepage twitter title");
  ok(HOME_TWITTER.description === HOME_DESCRIPTION, "homepage twitter description");
  ok(
    Array.isArray(HOME_TWITTER.images) && HOME_TWITTER.images[0] === OG_IMAGE.url,
    "homepage twitter image",
  );
  const rootImages = ROOT_OPEN_GRAPH.images as Array<{ width: number; height: number }>;
  ok(
    ROOT_OPEN_GRAPH.locale === "de_DE" && "type" in ROOT_OPEN_GRAPH && ROOT_OPEN_GRAPH.type === "website",
    "global og locale and type",
  );
  ok(rootImages[0]?.width === 1200 && rootImages[0]?.height === 630, "global og:image is 1200x630");
  ok(
    "card" in ROOT_TWITTER && ROOT_TWITTER.card === "summary_large_image",
    "global twitter card",
  );
  ok(ogSize.width === 1200 && ogSize.height === 630, "opengraph-image size export");
  const layout = source("app/layout.tsx");
  const page = source("app/page.tsx");
  ok(layout.includes("openGraph: ROOT_OPEN_GRAPH"), "root layout sets global Open Graph");
  ok(layout.includes("twitter: ROOT_TWITTER"), "root layout sets global Twitter");
  ok(page.includes("openGraph: HOME_OPEN_GRAPH"), "homepage sets its Open Graph");
  ok(page.includes("twitter: HOME_TWITTER"), "homepage sets its Twitter tags");
}

function pngSize(buffer: Buffer): { width: number; height: number } {
  ok(buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", "og image is a PNG");
  ok(buffer.subarray(12, 16).toString("ascii") === "IHDR", "og image has an IHDR chunk");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function checkImage() {
  const response = await openGraphImage();
  ok(response.headers.get("content-type")?.startsWith("image/png"), "og image content type");
  const bytes = Buffer.from(await response.arrayBuffer());
  const { width, height } = pngSize(bytes);
  ok(width === 1200 && height === 630, `generated og image is ${width}x${height}`);
}

async function checkSitemapLastmod() {
  const entries = await sitemap();
  ok(entries.length > 0, "sitemap has urls");
  for (const entry of entries) {
    assert.ok(entry.lastModified, `lastmod for ${entry.url}`);
    const value =
      entry.lastModified instanceof Date
        ? entry.lastModified.toISOString()
        : String(entry.lastModified);
    assert.ok(/^\d{4}-\d{2}-\d{2}/.test(value), `lastmod date for ${entry.url}`);
  }
  ok(true, `lastmod on all ${entries.length} sitemap urls`);
  const branchen = entries.filter((entry) => entry.url.includes("/verfahrensdokumentation-"));
  ok(branchen.length >= 2, "sitemap lists the branch pages");
  ok(
    entries.some((entry) => entry.url.includes("/verfahrensdokumentation-taxi")),
    "sitemap lists /verfahrensdokumentation-taxi",
  );
  ok(
    entries.some((entry) => entry.url.includes("/verfahrensdokumentation-kiosk")),
    "sitemap lists /verfahrensdokumentation-kiosk",
  );
  ok(
    !entries.some((entry) => entry.url.includes("/verfahrensdokumentation-verein")),
    "sitemap omits noindex /verfahrensdokumentation-verein",
  );
  ok(
    !entries.some((entry) => entry.url.includes("/verfahrensdokumentation-apotheke")),
    "sitemap omits noindex /verfahrensdokumentation-apotheke",
  );
  ok(
    entries.some((entry) => entry.url === canonicalUrl("/steuerberater")),
    "sitemap lists /steuerberater",
  );
  for (const path of [
    "/steuerberater/muster",
    "/steuerberater/demo",
    "/steuerberater/merkblatt/bestaetigen",
    "/steuerberater/merkblatt/abmelden",
    "/ampel-check/bestaetigen",
    "/ampel-check/abmelden",
    "/success",
    "/readiness/success",
  ]) {
    ok(!entries.some((entry) => entry.url === canonicalUrl(path)), `sitemap omits noindex ${path}`);
  }
}

async function main() {
  const seiten = await listBranchenSeiten();
  checkAnchors(seiten);
  checkFaqJsonLd();
  checkBreadcrumb();
  checkOffers();
  checkShareMeta();
  await checkImage();
  await checkSitemapLastmod();
  const footer = source("components/site-footer.tsx");
  const header = source("components/site-header.tsx");
  const home = source("app/page.tsx");
  const faq = source("app/faq/page.tsx");
  const muster = source("app/muster/page.tsx");
  const branchen = source("components/branchen-page.tsx");
  ok(
    source("lib/branchen.ts").includes(
      '["friseure", "einzelhandel", "taxi", "kiosk", "verein", "apotheke"]',
    ),
    "BRANCHEN_SLUGS includes verein and apotheke",
  );
  ok(footer.includes("listBranchenFooterLinks"), "footer reads content/branchen");
  ok(footer.includes(">Branchen<"), "footer column is titled Branchen");
  ok(!footer.includes("BRANCHEN_LINKS"), "footer branch list is not hardcoded");
  const footerLinks = listBranchenFooterLinks();
  const bySlug = [...seiten]
    .map((seite) => seite.slug)
    .sort((a, b) => a.localeCompare(b, "de"));
  ok(footerLinks.length === seiten.length, "footer lists every industry page");
  ok(
    footerLinks.map((item) => item.slug).join(",") === bySlug.join(","),
    "footer lists industry pages alphabetically by slug",
  );
  for (const seite of seiten) {
    const link = footerLinks.find((item) => item.slug === seite.slug);
    ok(link?.label === branchenAnchorLabel(seite.h1), `footer anchor for ${seite.slug}`);
    ok(link?.href === seite.route, `footer href for ${seite.slug}`);
  }
  for (const slug of ["taxi", "kiosk"] as const) {
    const seite = seiten.find((item) => item.slug === slug);
    ok(seite?.noindex === false, `${slug} is indexable`);
  }
  for (const slug of ["verein", "apotheke"] as const) {
    const seite = seiten.find((item) => item.slug === slug);
    ok(seite?.noindex === true, `${slug} stays noindex`);
  }
  ok(
    !branchen.includes("item.slug !== seite.slug"),
    "other-industries block lists every industry page",
  );
  ok(
    !header.includes("BRANCHEN_LINKS") && !header.includes("Branchenseiten"),
    "header has no branch navigation",
  );
  ok(!home.includes("BRANCHEN_LINKS") && !home.includes("branchenNav"), "homepage has no branch links");
  ok(!faq.includes("BRANCHEN_LINKS") && !faq.includes("Branchenseiten"), "faq has no branch links");
  ok(!muster.includes("BRANCHEN_LINKS"), "muster has no branch links");
  ok(branchen.includes("listBranchenFooterLinks"), "branch pages cross-link from content");
  ok(branchen.includes("Weitere Branchenseiten"), "branch pages cross-link");
  ok(branchen.includes("HANDEL_MUSTER_HREF"), "branch pages link the handel muster");
  console.log("check-seo: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
