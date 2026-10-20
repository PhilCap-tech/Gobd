/**
 * Campaign parameters that must survive an in-page URL replace so a late
 * consent grant can still attribute the visit. Nothing here is stored.
 */

export const CLICK_ID_PARAMS = ["gclid", "gbraid", "wbraid"] as const;

const UTM_VALUE_MAX = 100;
const VARIANT_VALUE_MAX = 20;
const VARIANT_VALUE = /^[a-z0-9_-]{1,20}$/;
const VARIANT_QUERY_KEYS = ["src", "v"] as const;

export function isCampaignParam(key: string): boolean {
  const name = key.toLowerCase();
  return (CLICK_ID_PARAMS as readonly string[]).includes(name) || name.startsWith("utm_");
}

/** Homepage funnel markers. Exact names only, so an unrelated key is not kept. */
export function isVariantQueryParam(key: string): boolean {
  return (VARIANT_QUERY_KEYS as readonly string[]).includes(key);
}

/** One line, capped. Empty when the value is not a string. */
export function sanitizeUtmValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, UTM_VALUE_MAX);
}

/**
 * Short funnel marker: 1–20 characters from [a-z0-9_-].
 * Anything else, including a click id, is dropped.
 */
export function sanitizeVariantValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  if (cleaned.length > VARIANT_VALUE_MAX || !VARIANT_VALUE.test(cleaned)) return "";
  return cleaned;
}

/**
 * Keep gclid, gbraid, wbraid, every utm_* value, and src/v.
 * Set or drop the named internal keys. Every other key is left off the next URL.
 */
export function replaceCheckSearch(
  current: { entries(): Iterable<[string, string]> },
  internal: Record<string, string>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of current.entries()) {
    if (!value || !(isCampaignParam(key) || isVariantQueryParam(key))) continue;
    next.append(key, value);
  }
  for (const [key, value] of Object.entries(internal)) {
    if (!value) next.delete(key);
    else next.set(key, value);
  }
  return next.toString();
}

/**
 * Copy gclid, gbraid, wbraid and every utm_* from a page search onto an href.
 * Existing href keys win. The result is only a URL string. Nothing is stored.
 * An empty search returns `href` unchanged, which is the server render.
 */
export function hrefWithCampaignParams(href: string, search: string): string {
  const incoming = new URLSearchParams(search);
  const campaign = new URLSearchParams();
  for (const [key, value] of incoming.entries()) {
    if (!value || !isCampaignParam(key)) continue;
    campaign.append(key, value);
  }
  if ([...campaign.keys()].length === 0) return href;

  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = beforeHash.indexOf("?");
  const path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const query = new URLSearchParams(queryAt >= 0 ? beforeHash.slice(queryAt + 1) : "");
  for (const [key, value] of campaign.entries()) {
    if (query.has(key)) continue;
    query.append(key, value);
  }
  const rendered = query.toString();
  return `${path}${rendered ? `?${rendered}` : ""}${hash}`;
}

/** utm_source and utm_campaign from the current URL. Click ids are not read. */
export function submitUtmFields(search: string): { utm_source?: string; utm_campaign?: string } {
  const params = new URLSearchParams(search);
  const source = sanitizeUtmValue(params.get("utm_source") ?? "");
  const campaign = sanitizeUtmValue(params.get("utm_campaign") ?? "");
  return {
    ...(source ? { utm_source: source } : {}),
    ...(campaign ? { utm_campaign: campaign } : {}),
  };
}

/** src and v from the current URL, whitelisted. Click ids are not read. */
export function submitVariantFields(search: string): { src?: string; v?: string } {
  const params = new URLSearchParams(search);
  const src = sanitizeVariantValue(params.get("src"));
  const variant = sanitizeVariantValue(params.get("v"));
  return {
    ...(src ? { src } : {}),
    ...(variant ? { v: variant } : {}),
  };
}
