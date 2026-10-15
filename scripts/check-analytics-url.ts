/**
 * Prebuild: Vercel Web Analytics stays cookieless and consent-free.
 * Page URLs must not carry magic-link, unsubscribe, or email query values.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeAnalyticsEvent, sanitizeAnalyticsUrl } from "../lib/analytics-url";

function cleaned(url: string) {
  const result = sanitizeAnalyticsUrl(url);
  assert.ok(result, url);
  assert.equal(result.includes("token="), false, url);
  assert.equal(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(result), false, url);
  assert.equal(result.includes("session_id="), false, url);
  return result;
}

assert.equal(
  cleaned("https://www.gobd-doku-erstellen.de/auth/verify?token=magic&next=%2Fintake"),
  "https://www.gobd-doku-erstellen.de/auth/verify?next=%2Fintake",
);
assert.equal(
  cleaned("/ampel-check/abmelden?token=unsubscribe-token"),
  "/ampel-check/abmelden",
);
assert.equal(
  cleaned("/api/ampel/abmelden?token=one-click"),
  "/api/ampel/abmelden",
);
assert.equal(cleaned("/login?email=person@example.com"), "/login");
assert.equal(cleaned("/intake?email=person%40example.com"), "/intake");
assert.equal(
  cleaned(
    "/auth/verify?token=abc&next=%2Fintake%3Fsession_id%3Dcs_test_123%26email%3Dperson%2540example.com",
  ),
  "/auth/verify",
);
assert.equal(cleaned("/success?session_id=cs_live_123"), "/success");
assert.equal(
  cleaned("/blog/artikel?utm_source=newsletter&utm_medium=email"),
  "/blog/artikel?utm_source=newsletter&utm_medium=email",
);
assert.equal(cleaned("/auth/verify#token=hidden"), "/auth/verify");
assert.equal(sanitizeAnalyticsUrl(""), null);

const pageview = sanitizeAnalyticsEvent({
  type: "pageview",
  url: "https://www.gobd-doku-erstellen.de/auth/invite?token=invite-secret",
});
assert.deepEqual(pageview, {
  type: "pageview",
  url: "https://www.gobd-doku-erstellen.de/auth/invite",
});
assert.equal(
  sanitizeAnalyticsEvent({
    type: "event",
    url: "https://www.gobd-doku-erstellen.de/",
  }),
  null,
);

const layout = readFileSync("app/layout.tsx", "utf8");
assert.ok(layout.includes("<VercelAnalytics />"));
assert.equal(layout.includes("hasMarketingConsent"), false);
assert.equal(layout.includes("@vercel/analytics"), false);

const component = readFileSync("components/vercel-analytics.tsx", "utf8");
assert.ok(component.includes("<Analytics"));
assert.ok(component.includes("beforeSend={sanitizeAnalyticsEvent}"));
assert.equal(component.includes("useSearchParams"), false);
assert.equal(component.includes("localStorage"), false);
assert.equal(component.includes("document.cookie"), false);
assert.equal(component.includes("track("), false);
assert.equal(component.includes("consent"), false);
assert.equal(component.includes("Consent"), false);

const banner = readFileSync("components/consent-banner.tsx", "utf8");
assert.equal(banner.includes("@vercel/analytics"), false);
assert.equal(banner.includes("VercelAnalytics"), false);

const allowed = new Set(["components/vercel-analytics.tsx"]);
const hits: string[] = [];
const stack = ["app", "components", "lib"].map((root) => path.join(process.cwd(), root));
while (stack.length) {
  const dir = stack.pop()!;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      stack.push(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const rel = path.relative(process.cwd(), full);
    const text = readFileSync(full, "utf8");
    if (text.includes("@vercel/analytics") && !allowed.has(rel)) hits.push(rel);
    if (rel !== "lib/analytics-url.ts" && text.includes("sanitizeAnalyticsEvent") && rel !== "components/vercel-analytics.tsx") {
      hits.push(`${rel}:event`);
    }
  }
}
assert.deepEqual(hits, []);

const privacy = readFileSync("content/legal/datenschutz.md", "utf8");
const section = privacy.split("## 6. Vercel Web Analytics")[1]?.split("## 7. Server-Logfiles")[0] ?? "";
assert.ok(section.length > 0, "Abschnitt Vercel Web Analytics fehlt");
assert.ok(section.includes("Vercel Inc."));
assert.ok(section.includes("cookielos"));
assert.ok(section.includes("ohne Speicherung auf Ihrem Endgerät"));
assert.ok(section.includes("aggregierte, anonymisierte Nutzungsstatistik"));
assert.ok(section.includes("Seitenaufrufe, Referrer, Gerätetyp, Land"));
assert.ok(section.includes("Eine Profilbildung findet nicht statt."));
assert.ok(section.includes("Art. 6 Abs. 1 lit. f DSGVO"));
assert.ok(section.includes("berechtigtes Interesse an der Reichweitenmessung und an der Verbesserung des Angebots"));
assert.ok(section.includes("Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO"));
assert.equal(/lösch/i.test(section), false, "Abschnitt sagt keine Löschfrist zu");
assert.ok(privacy.includes("Die Einzelheiten stehen in Abschnitt 10."));

console.log("check-analytics-url: ok");
