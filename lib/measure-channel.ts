/**
 * Aggregate channel class for Messlücken. Only the class is kept.
 * Click ids and the raw referrer are not returned and must not be stored.
 *
 * Paid is only utm_medium cpc/paid or a non-empty gclid, gbraid or wbraid.
 * Organic is a search-engine referrer without that paid signal. A Google
 * referrer alone cannot separate organic from paid when no click id and no
 * paid utm_medium are present; those visits still count as organic.
 * Direct is no referrer and no utm_* parameter. Everything else is unknown.
 *
 * The class is not written to a cookie, localStorage or sessionStorage.
 * A later page that no longer carries the landing signals stays unknown,
 * except for the in-memory class of that same page view (organic, direct
 * or unknown). A client-supplied "paid" is ignored: paid has to be visible
 * on the request URL.
 */

export const MEASURE_CHANNELS = ["organic", "paid", "direct", "unknown"] as const;

export type MeasureChannel = (typeof MEASURE_CHANNELS)[number];

const PAID_MEDIUMS = new Set(["cpc", "paid"]);
const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid"] as const;

const GOOGLE_PRODUCTS = new Set([
  "mail",
  "accounts",
  "docs",
  "drive",
  "ads",
  "adwords",
  "maps",
  "news",
  "play",
  "calendar",
  "translate",
  "myaccount",
  "support",
  "about",
  "blog",
  "cloud",
  "business",
  "workspace",
  "adservice",
  "clients",
  "optimize",
  "tagmanager",
  "analytics",
  "admanager",
]);

const SEARCH_SUFFIXES = [
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "ecosia.org",
  "qwant.com",
  "startpage.com",
  "search.brave.com",
  "mojeek.com",
  "swisscows.com",
  "metager.de",
  "baidu.com",
  "yandex.com",
  "yandex.ru",
  "yandex.by",
];

export function isMeasureChannel(value: unknown): value is MeasureChannel {
  return typeof value === "string" && (MEASURE_CHANNELS as readonly string[]).includes(value);
}

function entries(search: string): Array<[string, string]> {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const list: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    list.push([key.toLowerCase(), value.trim()]);
  }
  return list;
}

export function hasPaidSignal(search: string): boolean {
  for (const [key, value] of entries(search)) {
    if (!value) continue;
    if (key === "utm_medium" && PAID_MEDIUMS.has(value.toLowerCase())) return true;
    if ((CLICK_ID_KEYS as readonly string[]).includes(key)) return true;
  }
  return false;
}

export function hasUtmParameter(search: string): boolean {
  return entries(search).some(([key, value]) => key.startsWith("utm_") && value !== "");
}

function hostnameOf(referrer: string): string {
  const trimmed = referrer.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

function isGoogleSearchHost(host: string): boolean {
  if (host === "googleweblight.com" || host.endsWith(".googleweblight.com")) return true;
  const parts = host.split(".");
  const at = parts.lastIndexOf("google");
  if (at < 0 || at === parts.length - 1) return false;
  const prefix = parts.slice(0, at);
  if (prefix.some((label) => GOOGLE_PRODUCTS.has(label))) return false;
  if (prefix.length === 0) return true;
  if (prefix.length === 1 && (prefix[0] === "www" || prefix[0] === "ipv6" || prefix[0] === "encrypted")) {
    return true;
  }
  return false;
}

export function isSearchEngineReferrer(referrer: string): boolean {
  const host = hostnameOf(referrer);
  if (!host) return false;
  if (isGoogleSearchHost(host)) return true;
  return SEARCH_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function isFirstPartyHost(host: string): boolean {
  const name = host.toLowerCase().replace(/\.$/, "");
  if (!name) return false;
  if (name === "localhost" || name === "127.0.0.1" || name === "[::1]") return true;
  if (name === "gobd-doku-erstellen.de" || name.endsWith(".gobd-doku-erstellen.de")) return true;
  if (name === "vercel.app" || name.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * Class from one referrer and one query string. `search` is the landing
 * query (utm / click ids). `referrer` is the external page, or empty.
 */
export function classifyMeasureChannel(input: { referrer?: string | null; search?: string | null }): MeasureChannel {
  const referrer = (input.referrer ?? "").trim();
  const search = input.search ?? "";
  if (hasPaidSignal(search)) return "paid";
  if (referrer && isSearchEngineReferrer(referrer)) return "organic";
  if (!referrer && !hasUtmParameter(search)) return "direct";
  return "unknown";
}

function pageOf(referrerHeader: string | null): { host: string; search: string; raw: string } | null {
  const raw = (referrerHeader ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return { host: url.hostname.toLowerCase().replace(/\.$/, ""), search: url.search, raw };
  } catch {
    return { host: "", search: "", raw };
  }
}

function clientClass(value: unknown): MeasureChannel | null {
  if (!isMeasureChannel(value) || value === "paid") return null;
  return value;
}

/**
 * Server view of the request Referer, then the in-memory class from the
 * page when the request itself has no external signal. Client "paid" is
 * never accepted on its own. A first-party Referer is not "direct": the
 * browser did send a referrer, it is just our own page.
 */
export function resolveMeasureChannel(input: {
  referrerHeader?: string | null;
  clientChannel?: unknown;
}): MeasureChannel {
  const page = pageOf(input.referrerHeader ?? null);
  if (!page) return classifyMeasureChannel({ referrer: "", search: "" });
  if (!page.host) return "unknown";
  if (hasPaidSignal(page.search)) return "paid";
  if (!isFirstPartyHost(page.host)) {
    return classifyMeasureChannel({ referrer: page.raw, search: page.search });
  }
  if (hasUtmParameter(page.search)) return "unknown";
  return clientClass(input.clientChannel) ?? "unknown";
}
