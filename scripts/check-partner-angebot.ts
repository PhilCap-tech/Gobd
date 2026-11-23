/**
 * Prebuild: /partner-angebot and /partner-danke are permanent 301 redirects
 * to /steuerberater. The promocode script and its browser storage are gone.
 *   npx tsx scripts/check-partner-angebot.ts
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import nextConfig from "../next.config";

function ok(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  console.log("ok:", message);
}

const REMOVED = [
  "app/partner-angebot/page.tsx",
  "app/partner-danke/page.tsx",
  "components/digistore-promocode.tsx",
  "lib/digistore-promocode.ts",
  "lib/partner-angebot.ts",
];

const NEEDLES = [
  "ds24c.v1",
  "ds24p.v1",
  "ds24s.v1",
  "digistorePromocode",
  "digistore24-scripts.com",
  "checkout-ds24.com",
  "buyHrefWithStoredAffiliate",
  "digistore-promocode",
];

function walk(dir: string, hits: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, hits);
      continue;
    }
    if (!/\.(ts|tsx|mjs|js|css)$/.test(entry.name)) continue;
    const text = readFileSync(full, "utf8");
    for (const needle of NEEDLES) {
      if (text.includes(needle)) hits.push(`${path.relative(process.cwd(), full)}: ${needle}`);
    }
  }
}

async function main(): Promise<void> {
  for (const file of REMOVED) {
    ok(!existsSync(file), `${file} is removed`);
  }

  if (!nextConfig.redirects) throw new Error("redirects missing");
  const redirects = await nextConfig.redirects();
  for (const source of ["/partner-angebot", "/partner-danke"]) {
    const rule = redirects.find((entry) => entry.source === source);
    ok(rule?.destination === "/steuerberater", `${source} redirects to /steuerberater`);
    ok(rule != null && "statusCode" in rule && rule.statusCode === 301, `${source} uses status 301`);
    ok(
      !redirects.some((entry) => entry.source === source && entry.destination === "/"),
      `${source} does not redirect to /`,
    );
  }

  const config = readFileSync("next.config.ts", "utf8");
  ok(!config.includes("https://www.digistore24-scripts.com"), "CSP does not allow the promocode script host");
  ok(!config.includes("https://www.checkout-ds24.com"), "CSP does not allow the promocode checkout host");

  const codeHits: string[] = [];
  for (const dir of ["app", "components", "lib"]) walk(dir, codeHits);
  for (const needle of NEEDLES) {
    if (config.includes(needle)) codeHits.push(`next.config.ts: ${needle}`);
  }
  ok(
    codeHits.length === 0,
    `no promocode script or storage in app code${codeHits.length ? ` (${codeHits.join("; ")})` : ""}`,
  );

  const agb = readFileSync("content/legal/agb-v3.md", "utf8");
  for (const term of ["§ 9a", "§ 15", "Digistore24", "Partnerseite", "Monatsabonnement"]) {
    ok(!agb.includes(term), `agb-v3.md has no ${term}`);
  }
  ok(agb.includes("(3) (weggefallen)"), "AGB § 12c Abs. 3 is marked weggefallen");
  ok(agb.includes("**Stand:** November 2026"), "AGB stand is November 2026");
  ok(agb.includes("## § 12d Schnellversion (Standard-PDF)"), "AGB § 12d stays");
  ok(agb.includes("<!-- if:schnellversion -->"), "AGB schnellversion markers stay");

  const privacy = readFileSync("content/legal/datenschutz-v3.md", "utf8");
  ok(privacy.includes("## 12. (weggefallen)"), "privacy section 12 is weggefallen");
  for (const term of ["Digistore", "ds24", "Partnerseite", "partner-angebot", "Monatsabonnement"]) {
    ok(!privacy.includes(term), `datenschutz-v3.md has no ${term}`);
  }
  ok(privacy.includes("Partneranfragen"), "privacy keeps the Steuerberater partner section");
  ok(
    privacy.includes(
      "Unsere eigenen Rechnungs- und Buchhaltungsunterlagen (z. B. Rechnungen und zahlungsrelevante Nachweise) unterliegen eigenen gesetzlichen Aufbewahrungsfristen",
    ),
    "privacy section 21 stays",
  );
  ok(
    !privacy.includes("Daten aus früheren Bestellungen über Digistore24"),
    "privacy section 21 has no extra order sentence",
  );

  const cookies = readFileSync("content/legal/cookies-v3.md", "utf8");
  for (const term of ["ds24c.v1", "ds24p.v1", "ds24s.v1", "Digistore", "partner-angebot", "Partnerseite"]) {
    ok(!cookies.includes(term), `cookies-v3.md has no ${term}`);
  }
  ok(
    cookies.includes("**Marketing-Dienste** (Google Ads / GA4 und Meta Pixel)"),
    "cookie intro names Google and Meta only",
  );
  ok(cookies.includes("**Stand:** November 2026"), "cookie stand is November 2026");

  const campaign = readFileSync("components/campaign-link.tsx", "utf8");
  ok(campaign.includes("campaignTargetHref("), "buy links still copy campaign params after consent");
  ok(!campaign.includes("buyHrefWithStoredAffiliate"), "buy links do not add a stored affiliate");

  console.log("check-partner-angebot: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
