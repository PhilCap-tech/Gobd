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
  fail("sticky CTA is not hidden while the banner owns the bottom of a tall screen");
}
if (!/max-height:\s*820px/.test(css) || !/bottom:\s*74px/.test(css)) {
  fail("short screens do not keep the sticky CTA above the banner");
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

console.log("home-cta: checkout links forward campaign params and the banner does not cover them");
