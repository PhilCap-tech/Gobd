/**
 * Prebuild: token landings do not load Google or Meta, the address bar drops
 * `token` and `t` before any tag, gtag page_location is allowlisted, and those
 * responses send Referrer-Policy: no-referrer.
 *
 *   npx tsx scripts/check-token-pages.ts
 *
 * No network, no mail, no production writes.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import nextConfig from "../next.config";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match.js";
import { sanitizeAnalyticsUrl } from "../lib/analytics-url";
import { ampelConfirmUrl } from "../lib/ampel-mail";
import { kanzleiConfirmUrl } from "../lib/kanzlei-mail";
import { kassenConfirmUrl } from "../lib/kassen-check-mail";
import { isOpaqueMailLinkToken, newOpaqueMailLinkToken } from "../lib/mail-link-token-store";
import {
  ADDRESS_BAR_SECRET_KEYS,
  TAG_QUERY_ALLOWLIST,
  allowlistedSearch,
  isAllowlistedTagQuery,
  searchWithoutSecrets,
  stripSensitiveQueryFromAddressBar,
  tagHitFields,
} from "../lib/tag-page-url";
import { KASSEN_CHECK_PATH } from "../lib/kassen-check-questions";
import {
  TOKEN_LANDING_PREFIXES,
  TOKEN_REFERRER_POLICY,
  isTokenLandingPath,
  matchesTokenPrefix,
  tokenLandingHeaderRules,
} from "../lib/token-pages";
import {
  enableMarketingScripts,
  resetTrackingForChecks,
  saveConsent,
  trackAmpelCheckSubmit,
  trackAmpelResult,
  trackAmpelStart,
  trackKassenCheckSubmit,
  trackPurchaseConversion,
  trackReadinessSubmit,
  trackRoute,
} from "../lib/tracking";

/** Pixel id from the build environment, before this file's own test overrides. */
const metaPixelIdFromEnvironment = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

const REQUIRED_PREFIXES = [
  "/ampel-check/bestaetigen",
  "/ampel-check/abmelden",
  "/kassen-check/bestaetigen",
  "/kassen-check/abmelden",
  "/steuerberater/merkblatt/bestaetigen",
  "/steuerberater/merkblatt/abmelden",
  "/auth/abgelaufen",
  "/auth/invite",
  "/auth/verify",
  "/steuerberater/toolbox/",
  "/vorlagen/bestaetigen",
  "/vorlagen/erneut",
  "/vorlagen/datei",
  "/readiness/success",
  "/api/readiness/",
  "/api/ampel/abmelden",
  "/api/kanzlei-merkblatt/abmelden",
];

function ok(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  console.log("ok:", message);
}

for (const prefix of REQUIRED_PREFIXES) {
  ok(
    (TOKEN_LANDING_PREFIXES as readonly string[]).includes(prefix),
    `prefix list includes ${prefix}`,
  );
  ok(isTokenLandingPath(prefix), `${prefix} is a token landing`);
}

const opaqueId = newOpaqueMailLinkToken();
ok(isOpaqueMailLinkToken(opaqueId), "the mail-link sample is an opaque id");
const mailLinkFiles = ["lib/ampel-mail.ts", "lib/kassen-check-mail.ts", "lib/kanzlei-mail.ts"];
const mailLinkRe =
  /\$\{getAppUrl\(\)\}(?:\$\{KASSEN_CHECK_PATH\})?(\/[a-z0-9\-/]+)\?([A-Za-z0-9_]+)=\$\{encodeURIComponent\(token\)\}/g;
const mailLinks: Array<{ file: string; path: string; key: string }> = [];
for (const file of mailLinkFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(mailLinkRe)) {
    const route = match[1] === "/bestaetigen" ? `${KASSEN_CHECK_PATH}/bestaetigen` : match[1];
    mailLinks.push({ file, path: route, key: match[2] });
  }
}
ok(mailLinks.length >= 6, "confirm, unsubscribe, and one-click links were found");
for (const link of mailLinks) {
  ok(isTokenLandingPath(link.path), `${link.file} ${link.path} is a token landing`);
  ok(
    (ADDRESS_BAR_SECRET_KEYS as readonly string[]).includes(link.key),
    `${link.file} query ${link.key} is stripped from the address bar`,
  );
  ok(!isAllowlistedTagQuery(link.key), `${link.key} is not sent as a tag query`);
}
for (const url of [ampelConfirmUrl(opaqueId), kassenConfirmUrl(opaqueId), kanzleiConfirmUrl(opaqueId)]) {
  const parsed = new URL(url);
  ok(isTokenLandingPath(parsed.pathname), `${parsed.pathname} confirm URL is a token landing`);
  assert.deepEqual([...parsed.searchParams.keys()], ["token"]);
  const stripped = searchWithoutSecrets(parsed.search);
  ok(stripped.changed && stripped.search === "", `${parsed.pathname} drops the opaque id from the address bar`);
  ok(!stripped.search.includes(opaqueId), `${parsed.pathname} does not keep the opaque id`);
}
ok(isTokenLandingPath(`${KASSEN_CHECK_PATH}/bestaetigen`), "Kassen confirm link is a token landing");
ok(isTokenLandingPath("/api/ampel/abmelden"), "Ampel one-click unsubscribe is a token landing");
ok(isTokenLandingPath("/ampel-check/abmelden"), "Ampel unsubscribe page is a token landing");
ok(isTokenLandingPath("/vorlagen/mandant/datei"), "a nested Vorlagen file page is a token landing");
ok(isTokenLandingPath("/vorlagen/x/erneut"), "a nested Vorlagen resend page is a token landing");
ok(isTokenLandingPath("/steuerberater/toolbox/link"), "toolbox pages are token landings");
ok(isTokenLandingPath("/api/readiness/lead/download"), "readiness download is a token landing");
ok(!isTokenLandingPath("/kassen-check"), "the Kassen check itself still tracks");
ok(!isTokenLandingPath("/ampel-check"), "the Ampel check itself still tracks");
ok(!isTokenLandingPath("/"), "the homepage still tracks");
ok(!isTokenLandingPath("/readiness"), "the readiness form still tracks");

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(full);
  }
}

function routeFromAppFile(rel: string): string | null {
  const match = rel.match(/^app\/(.+)\/(?:page|route)\.tsx?$/);
  if (!match) return null;
  return `/${match[1]}`;
}

function readsTokenSearchParam(source: string): boolean {
  return (
    /searchParams\.get\(\s*["']token["']\s*\)/.test(source) ||
    /firstQueryValue\(\s*params\.token\s*\)/.test(source) ||
    /searchParams\.token\b/.test(source) ||
    /searchParams\s*:\s*Promise<\{[^}]*\btoken\?/.test(source)
  );
}

const appFiles: string[] = [];
walk(path.join(process.cwd(), "app"), appFiles);
const uncovered: string[] = [];
for (const full of appFiles) {
  const rel = path.relative(process.cwd(), full).replaceAll("\\", "/");
  const route = routeFromAppFile(rel);
  if (!route) continue;
  const source = readFileSync(full, "utf8");
  const segments = route.split("/").filter(Boolean);
  const tokenAction = segments.some((segment) => segment === "bestaetigen" || segment === "abmelden");
  if (!tokenAction && !readsTokenSearchParam(source)) continue;
  const sample = route.replace(/\[[^\]]+\]/g, "id");
  if (!TOKEN_LANDING_PREFIXES.some((prefix) => matchesTokenPrefix(sample, prefix))) {
    uncovered.push(`${rel} → ${sample}`);
  }
}
assert.deepEqual(uncovered, [], `token routes missing from TOKEN_LANDING_PREFIXES:\n${uncovered.join("\n")}`);
ok(true, "every confirm, unsubscribe, and token search page is in the prefix list");

const pathLiterals = new Set<string>();
const literalFiles: string[] = [];
walk(path.join(process.cwd(), "lib"), literalFiles);
walk(path.join(process.cwd(), "app"), literalFiles);
const literalRe = /["'`](\/[a-z0-9[\]\-./]*\/(?:bestaetigen|abmelden))\b/g;
for (const full of literalFiles) {
  const source = readFileSync(full, "utf8");
  for (const match of source.matchAll(literalRe)) pathLiterals.add(match[1]);
}
const literalMisses = [...pathLiterals].filter(
  (literal) => !TOKEN_LANDING_PREFIXES.some((prefix) => matchesTokenPrefix(literal, prefix)),
);
assert.deepEqual(literalMisses, [], `path literals not covered: ${literalMisses.join(", ")}`);
ok(pathLiterals.size > 0, "mail and route literals were scanned");

for (const panel of [
  "app/ampel-check/bestaetigen/confirm-panel.tsx",
  "app/ampel-check/abmelden/unsubscribe-panel.tsx",
  "app/kassen-check/bestaetigen/confirm-panel.tsx",
  "app/steuerberater/merkblatt/bestaetigen/confirm-panel.tsx",
  "app/steuerberater/merkblatt/abmelden/unsubscribe-panel.tsx",
  "app/auth/invite/accept-form.tsx",
]) {
  const source = readFileSync(panel, "utf8");
  ok(source.includes("token"), `${panel} still receives the token`);
  ok(!source.includes("useSearchParams"), `${panel} does not read the address bar for the token`);
}

const pixel = readFileSync("components/marketing-pixel.tsx", "utf8");
const effect = pixel.slice(pixel.indexOf("useEffect("));
const clearAt = effect.indexOf("removeLegacyFirstTouchUtm()");
const stripAt = effect.indexOf("stripSensitiveQueryFromAddressBar()");
const inviteAt = effect.indexOf('pathname.startsWith("/auth/invite")');
ok(clearAt !== -1 && stripAt > clearAt && inviteAt > stripAt, "the pixel strips the query before the invite return");
ok(effect.includes("isTokenLandingPath(pathname)"), "the pixel skips every token landing");
ok(!effect.slice(0, clearAt).includes("hasMarketingConsent"), "UTM removal still does not wait for consent");

const layout = readFileSync("app/layout.tsx", "utf8");
ok(layout.indexOf("<SensitiveQueryStrip />") !== -1, "the layout strips the query on every page");
ok(
  layout.indexOf("<SensitiveQueryStrip />") < layout.indexOf("<VercelAnalytics />"),
  "the query strip is mounted before Vercel Analytics",
);
ok(layout.includes("<MarketingPixel />"), "the marketing pixel stays in the layout");

const urlLib = readFileSync("lib/tag-page-url.ts", "utf8");
ok(urlLib.includes("History.prototype.replaceState"), "the address bar uses the native replaceState");
ok(
  urlLib.includes('export const ADDRESS_BAR_SECRET_KEYS = ["token", "t"]'),
  "only token and t leave the address bar",
);

const analytics = readFileSync("components/vercel-analytics.tsx", "utf8");
ok(analytics.includes("beforeSend={sanitizeAnalyticsEvent}"), "Vercel Analytics still uses beforeSend");
assert.equal(
  sanitizeAnalyticsUrl(
    "/kassen-check?a=JJJJ&ref=Kanzlei&kanzlei=1&token=secret&t=1&src=partner&utm_source=google&gclid=CLICK&gbraid=GB&wbraid=WB&utm_id=99#frag",
  ),
  "/kassen-check?utm_source=google&gclid=CLICK&gbraid=GB&wbraid=WB&utm_id=99",
);
assert.equal(sanitizeAnalyticsUrl("/kassen-check?a=ONLY&ref=Kanzlei"), "/kassen-check");
for (const key of TAG_QUERY_ALLOWLIST) ok(isAllowlistedTagQuery(key), `${key} stays on the hit`);
ok(!isAllowlistedTagQuery("a") && !isAllowlistedTagQuery("ref") && !isAllowlistedTagQuery("token"), "answers, ref, and token are not allowlisted");
assert.equal(
  allowlistedSearch("?a=JJ&utm_term=gobd&wbraid=WB&t=1&utm_extra=kept"),
  "?utm_term=gobd&wbraid=WB&utm_extra=kept",
);

function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/**
 * True only when code, not a comment, keeps `?a=` off location.href before
 * fbevents.js can load. The gtag page_location allowlist does not count:
 * Meta reads the address bar itself.
 */
function metaAnswerQueryFilteredBeforePixel(): boolean {
  const pixelFn = stripJsComments(readFileSync("lib/tracking.ts", "utf8"));
  const start = pixelFn.indexOf("function enableMetaPixel");
  const end = pixelFn.indexOf("function enableGoogleTag");
  const body = start === -1 ? "" : pixelFn.slice(start, end === -1 ? undefined : end);
  const loadAt = body.indexOf("fbevents.js");
  const beforeLoad = loadAt === -1 ? "" : body.slice(0, loadAt);
  if (
    /["']a["']/.test(beforeLoad) ||
    beforeLoad.includes("isAllowlistedTagQuery") ||
    beforeLoad.includes("allowlistedSearch")
  ) {
    return true;
  }
  const urls = stripJsComments(readFileSync("lib/tag-page-url.ts", "utf8"));
  const pixel = stripJsComments(readFileSync("components/marketing-pixel.tsx", "utf8"));
  const dropsAnswer = /ADDRESS_BAR_SECRET_KEYS\s*=\s*\[[^\]]*["']a["']/.test(urls);
  const stripAt = pixel.indexOf("stripSensitiveQueryFromAddressBar()");
  const trackAt = pixel.indexOf("trackRoute(");
  return dropsAnswer && stripAt !== -1 && trackAt !== -1 && stripAt < trackAt;
}

const tracking = readFileSync("lib/tracking.ts", "utf8");
ok(
  /location\.href[\s\S]{0,500}\?a=[\s\S]{0,400}NEXT_PUBLIC_META_PIXEL_ID/.test(tracking),
  "tracking warns that Meta reads location.href, so ?a= must be filtered before the pixel id is set",
);
ok(
  !metaPixelIdFromEnvironment || metaAnswerQueryFilteredBeforePixel(),
  "NEXT_PUBLIC_META_PIXEL_ID stays unset until ?a= is filtered from location.href",
);
const fbqCalls = tracking.match(/fbq\?\.\(\s*"track(?:Custom)?"[\s\S]*?\)/g) ?? [];
ok(fbqCalls.length > 0, "Meta events are still in tracking");
for (const call of fbqCalls) {
  ok(!call.includes("utm_") && !call.includes("search"), `Meta event has no query payload: ${call}`);
}

const rules = tokenLandingHeaderRules();

async function main() {
const configured = (await nextConfig.headers?.()) ?? [];
const catchAllAt = configured.findIndex(
  (rule) =>
    rule.source === "/:path*" &&
    rule.headers.some((header) => header.key === "Referrer-Policy" && header.value === "strict-origin-when-cross-origin"),
);
ok(catchAllAt !== -1, "the sitewide referrer policy is still strict-origin-when-cross-origin");
for (const rule of rules) {
  const at = configured.findIndex((item) => item.source === rule.source);
  ok(at > catchAllAt, `${rule.source} is applied after the catch-all`);
  ok(
    configured[at]?.headers.some((header) => header.key === "Referrer-Policy" && header.value === TOKEN_REFERRER_POLICY),
    `${rule.source} sets no-referrer`,
  );
}

function referrerPolicy(pathname: string): string | null {
  let value: string | null = null;
  for (const rule of configured) {
    if (!getPathMatch(rule.source)(pathname)) continue;
    for (const header of rule.headers) {
      if (header.key.toLowerCase() === "referrer-policy") value = header.value;
    }
  }
  return value;
}

ok(referrerPolicy("/") === "strict-origin-when-cross-origin", "the homepage keeps the sitewide referrer policy");
ok(referrerPolicy("/kassen-check") === "strict-origin-when-cross-origin", "the Kassen check keeps the sitewide referrer policy");
for (const prefix of TOKEN_LANDING_PREFIXES) {
  const sample = prefix.endsWith("/") ? `${prefix.slice(0, -1)}/child` : prefix;
  ok(referrerPolicy(sample) === "no-referrer", `${sample} referrer policy is no-referrer`);
}
ok(referrerPolicy("/api/readiness/lead/download") === "no-referrer", "readiness download referrer policy is no-referrer");
ok(referrerPolicy("/auth/invite/angenommen") === "no-referrer", "invite follow-up pages are no-referrer");

type Tag = { id: string; src: string };
type Command = { 0?: unknown; 1?: unknown; 2?: Record<string, unknown> };

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function install(href: string, referrer = "") {
  const parsed = new URL(href);
  const scripts: Tag[] = [];
  const calls: string[] = [];
  const location = {
    protocol: parsed.protocol,
    origin: parsed.origin,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    href: parsed.href,
  };
  const dataLayer: unknown[] = [];
  const push: unknown[]["push"] = function push(this: unknown[], ...items: unknown[]) {
    const entry = items[0] as Command | undefined;
    calls.push(`layer:${String(entry?.[0] ?? "")}:${location.search}`);
    return Array.prototype.push.apply(this, items as never[]);
  };
  dataLayer.push = push;
  const history = {
    state: { __NA: true },
    replaceState(_data: unknown, _title: string, next: string) {
      calls.push(`replace:${next}`);
      const updated = new URL(next, parsed.origin);
      location.pathname = updated.pathname;
      location.search = updated.search;
      location.hash = updated.hash;
      location.href = updated.href;
    },
  };
  const listeners = new Map<string, Set<() => void>>();
  const win = {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    location,
    history,
    dataLayer,
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((fn) => fn());
      return true;
    },
    addEventListener(type: string, fn: () => void) {
      const set = listeners.get(type) ?? new Set<() => void>();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn);
    },
  };
  const doc = {
    cookie: "",
    referrer,
    getElementById(id: string) {
      return scripts.find((script) => script.id === id) ?? null;
    },
    createElement() {
      return { id: "", src: "", async: false };
    },
    head: {
      appendChild(el: Tag) {
        scripts.push(el);
      },
    },
  };
  globalThis.window = win as unknown as Window & typeof globalThis;
  globalThis.document = doc as unknown as Document;
  resetTrackingForChecks();
  delete window.gtag;
  delete window.fbq;
  return { scripts, calls, location, dataLayer };
}

function commands(dataLayer: unknown[]): Command[] {
  return dataLayer as Command[];
}

const saved = {
  ads: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  ga: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  purchase: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO,
  meta: process.env.NEXT_PUBLIC_META_PIXEL_ID,
};

process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-586367190";
process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TESTTOKEN";
process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO = "AW-586367190/PURCHASELABEL";
process.env.NEXT_PUBLIC_META_PIXEL_ID = "1234567890";

try {
  {
    const dom = install(
      "https://www.gobd-doku-erstellen.de/?utm_source=x&token=abc&t=secret&gclid=CLICK&a=JJ#section",
    );
    saveConsent(true);
    trackRoute("/");
    const replaceAt = dom.calls.findIndex((call) => call.startsWith("replace:"));
    const configAt = dom.calls.findIndex((call) => call.startsWith("layer:config:"));
    ok(replaceAt !== -1 && configAt !== -1 && replaceAt < configAt, "token leaves the address bar before gtag config");
    ok(!dom.calls[configAt]?.includes("token") && !dom.calls[configAt]?.includes("t=secret"), "config runs against the stripped query");
    assert.equal(dom.location.search, "?utm_source=x&gclid=CLICK&a=JJ");
    assert.equal(dom.location.hash, "#section");
    const configs = commands(dom.dataLayer).filter((cmd) => cmd[0] === "config");
    ok(configs.length >= 2, "Ads and GA4 config both run on the homepage");
    for (const cmd of configs) {
      assert.equal(cmd[2]?.page_location, "https://www.gobd-doku-erstellen.de/?utm_source=x&gclid=CLICK");
      ok(!("page_referrer" in (cmd[2] ?? {})), "an empty referrer stays on the tag default");
      const location = String(cmd[2]?.page_location ?? "");
      ok(!location.includes("token") && !location.includes("a=JJ") && !location.includes("#"), "page_location drops token, answers, and the fragment");
    }
    const gtagScript = ["googletagmanager", "com/gtag/js"].join(".");
    ok(
      dom.scripts.some((script) => script.src.includes(gtagScript)),
      "a normal page still loads gtag after consent",
    );
    console.log("ok: homepage keeps utm and gclid, drops token before config");
  }

  {
    const dom = install(
      "https://www.gobd-doku-erstellen.de/kassen-check?a=JJJJ&ref=Kanzlei&kanzlei=1&utm_campaign=landing&utm_source=google",
      "https://www.gobd-doku-erstellen.de/ampel-check/bestaetigen?token=secret&a=1#mail",
    );
    saveConsent(true);
    trackRoute("/kassen-check");
    trackRoute("/kassen-check");
    const config = commands(dom.dataLayer).find((cmd) => cmd[0] === "config" && cmd[1] === "G-TESTTOKEN");
    assert.equal(
      config?.[2]?.page_location,
      "https://www.gobd-doku-erstellen.de/kassen-check?utm_campaign=landing&utm_source=google",
    );
    assert.equal(config?.[2]?.page_referrer, "https://www.gobd-doku-erstellen.de/ampel-check/bestaetigen");
    assert.equal(dom.location.search, "?a=JJJJ&ref=Kanzlei&kanzlei=1&utm_campaign=landing&utm_source=google");
    trackRoute("/readiness");
    const pageView = commands(dom.dataLayer).find((cmd) => cmd[0] === "event" && cmd[1] === "page_view");
    assert.equal(
      pageView?.[2]?.page_location,
      "https://www.gobd-doku-erstellen.de/readiness?utm_campaign=landing&utm_source=google",
    );
    assert.equal(pageView?.[2]?.page_path, "/readiness");
    assert.equal(pageView?.[2]?.send_to, "G-TESTTOKEN");
    assert.equal(pageView?.[2]?.page_referrer, "https://www.gobd-doku-erstellen.de/ampel-check/bestaetigen");
    console.log("ok: Kassen answers stay in the bar and stay out of page_location and page_view");
  }

  {
    const dom = install(
      "https://www.gobd-doku-erstellen.de/checkout?utm_source=x",
      "https://news.example/story?utm_source=newsletter",
    );
    saveConsent(true);
    trackRoute("/checkout");
    const config = commands(dom.dataLayer).find((cmd) => cmd[0] === "config");
    ok(config && !("page_referrer" in (config[2] ?? {})), "a cross-origin referrer is left to the tag default");
    console.log("ok: cross-origin referrer is not rewritten");
  }

  const tokenUrls = [
    "https://www.gobd-doku-erstellen.de/ampel-check/bestaetigen?token=dummy&utm_source=x",
    "https://www.gobd-doku-erstellen.de/kassen-check/bestaetigen?token=dummy",
    "https://www.gobd-doku-erstellen.de/auth/abgelaufen?token=dummy&next=%2Faccount",
    "https://www.gobd-doku-erstellen.de/auth/invite?token=dummy",
    "https://www.gobd-doku-erstellen.de/steuerberater/merkblatt/abmelden?token=dummy",
    "https://www.gobd-doku-erstellen.de/readiness/success?lead_id=1&token=dummy",
  ];
  for (const href of tokenUrls) {
    const dom = install(href);
    saveConsent(true);
    const pathname = new URL(href).pathname;
    let finished = false;
    trackRoute(pathname);
    enableMarketingScripts(pathname);
    trackPurchaseConversion("cs_live_should_not_send");
    trackReadinessSubmit(() => {
      finished = true;
    });
    trackAmpelStart();
    trackAmpelResult();
    trackAmpelCheckSubmit();
    trackKassenCheckSubmit();
    stripSensitiveQueryFromAddressBar();
    const hits = commands(dom.dataLayer).filter((cmd) => cmd[0] === "config" || cmd[0] === "event" || cmd[0] === "js" || cmd[0] === "consent");
    assert.deepEqual(hits, [], `${pathname} queues no gtag call`);
    ok(
      dom.scripts.every((script) => !/googletagmanager|facebook|google-analytics|doubleclick/i.test(script.src)),
      `${pathname} loads no Google or Meta script`,
    );
    ok(!window.fbq, `${pathname} does not install fbq`);
    ok(!dom.location.search.includes("token="), `${pathname} drops token from the address bar`);
    if (href.includes("utm_source=x")) assert.equal(dom.location.search, "?utm_source=x");
    if (href.includes("next=")) ok(dom.location.search.includes("next="), `${pathname} keeps next`);
    ok(finished, `${pathname} still finishes a readiness callback`);
    console.log("ok: no tag on", pathname);
  }

  const fields = tagHitFields("");
  assert.deepEqual(fields, {});
} finally {
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = saved.ads;
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = saved.ga;
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO = saved.purchase;
  process.env.NEXT_PUBLIC_META_PIXEL_ID = saved.meta;
}

console.log("check-token-pages: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
