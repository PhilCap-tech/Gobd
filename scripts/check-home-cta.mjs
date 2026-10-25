/**
 * Homepage checkout CTAs are CampaignLinks. The server render is still an
 * anchor with the plain href, and the consent banner does not take the
 * sticky bar's pixels on the first tap.
 */
import { readFileSync } from "node:fs";

function fail(message) {
  console.error(`home-cta: ${message}`);
  process.exit(1);
}

const page = readFileSync("app/page.tsx", "utf8");
const header = readFileSync("components/site-header.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const tracking = readFileSync("lib/tracking.ts", "utf8");
const banner = readFileSync("components/consent-banner.tsx", "utf8");

const plainCheckout = page.match(/<a\b[^>]*href="\/checkout"[^>]*>/g) ?? [];
if (plainCheckout.length !== 0) {
  fail(`plain href="/checkout" remains on the homepage (${plainCheckout.length})`);
}
const checkoutLinks = page.match(/<CampaignLink\b[^>]*href="\/checkout"[^>]*>/g) ?? [];
if (checkoutLinks.length < 4) {
  fail(`expected at least 4 checkout CampaignLinks, found ${checkoutLinks.length}`);
}
if (/<Link\b[^>]*href="\/checkout"/.test(page)) {
  fail("homepage checkout CTA uses next/link directly");
}
if (page.includes("preventDefault") || header.includes("preventDefault")) {
  fail("homepage header must not cancel CTA navigation");
}
if (!/<CampaignLink\b[^>]*className="btn hide-sm"[^>]*href=\{ctaHref\}>/.test(header)) {
  fail("header CTA does not use CampaignLink");
}
if (/<a\b[^>]*className="btn hide-sm"/.test(header)) {
  fail("header CTA is still a plain anchor");
}
if (/<Link\b[^>]*className="btn hide-sm"/.test(header)) {
  fail("header CTA still uses next/link");
}

if (!tracking.includes('CONSENT_STORAGE_KEY = "gobd_consent"')) {
  fail("consent storage key changed; update the layout boot script");
}
if (!layout.includes('localStorage.getItem("gobd_consent")') || !layout.includes("consent-pending")) {
  fail("layout does not hide the sticky CTA before paint when consent is unset");
}
if (!banner.includes('classList.toggle("consent-pending"')) {
  fail("consent banner does not clear consent-pending after a choice");
}
if (!/html\.consent-pending \.sticky-cta/.test(css) || !/body\.consent-open \.sticky-cta/.test(css)) {
  fail("sticky CTA is not hidden while the consent banner is open");
}
if (/html\.consent-pending \.sticky-cta,\s*body\.consent-open \.sticky-cta\s*\{[^}]*display:\s*block/.test(css)) {
  fail("sticky CTA is shown while the consent banner is open");
}
if (/bottom:\s*74px/.test(css)) {
  fail("consent banner is still offset to sit above the sticky CTA");
}
if (banner.includes("<aside") || !banner.includes('role="dialog"')) {
  fail("consent dialog must be a div with role=dialog");
}
if (banner.includes("aria-modal")) {
  fail("consent dialog must not set aria-modal; the page stays operable");
}
if (!banner.includes('aria-labelledby="consent-title"') || !banner.includes('aria-describedby="consent-text"')) {
  fail("consent dialog is missing aria-labelledby or aria-describedby");
}

function mediaBlocks(source) {
  const blocks = [];
  const re = /@media\s*([^{]+)\{/g;
  let match;
  while ((match = re.exec(source))) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
      i += 1;
    }
    blocks.push({ query: match[1], body: source.slice(start, i - 1) });
  }
  return blocks;
}

function matchesViewport(query, width, height) {
  const parts = query
    .replace(/^\s*only\s+screen\s+and\s+/i, "")
    .replace(/^\s*screen\s+and\s+/i, "")
    .split(/\s+and\s+/i);
  for (const raw of parts) {
    const part = raw.replace(/[()]/g, "").trim();
    if (!part || part === "screen" || part === "only screen") continue;
    const feature = part.match(/^(min|max)-(width|height):\s*(\d+(?:\.\d+)?)px$/);
    if (!feature) return false;
    const value = Number(feature[3]);
    const size = feature[2] === "width" ? width : height;
    if (feature[1] === "max" && size > value) return false;
    if (feature[1] === "min" && size < value) return false;
  }
  return true;
}

const blocks = mediaBlocks(css);
function clearanceCovers(selector, width, height) {
  return blocks.some(
    (block) =>
      matchesViewport(block.query, width, height) &&
      block.body.includes("html.consent-pending") &&
      block.body.includes(selector),
  );
}

const shortPhones = [
  [360, 640],
  [375, 667],
];
for (const [width, height] of shortPhones) {
  if (!clearanceCovers('a[href="#muster"]', width, height)) {
    fail(`Dokumentation erstellen clearance does not apply at ${width}×${height}`);
  }
  if (!clearanceCovers('a[href="#anfrage"]', width, height)) {
    fail(`Partneranfrage clearance does not apply at ${width}×${height}`);
  }
}
if (!clearanceCovers('a[href="#muster"]', 390, 844)) {
  fail("Dokumentation erstellen clearance no longer applies at 390×844");
}

console.log("home-cta: checkout links forward campaign params and the banner does not cover them");
