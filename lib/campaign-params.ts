/**
 * Campaign parameters that must survive an in-page URL replace so a late
 * consent grant can still attribute the visit. Nothing here is stored.
 */

export const CLICK_ID_PARAMS = ["gclid", "gbraid", "wbraid"] as const;

const UTM_VALUE_MAX = 100;

export function isCampaignParam(key: string): boolean {
  const name = key.toLowerCase();
  return (CLICK_ID_PARAMS as readonly string[]).includes(name) || name.startsWith("utm_");
}

/** One line, capped. Empty when the value is not a string. */
export function sanitizeUtmValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, UTM_VALUE_MAX);
}

/**
 * Keep gclid, gbraid, wbraid and every utm_* value. Set or drop the named
 * internal keys. Every other key is left off the next URL.
 */
export function replaceCheckSearch(
  current: { entries(): Iterable<[string, string]> },
  internal: Record<string, string>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of current.entries()) {
    if (!value || !isCampaignParam(key)) continue;
    next.append(key, value);
  }
  for (const [key, value] of Object.entries(internal)) {
    if (!value) next.delete(key);
    else next.set(key, value);
  }
  return next.toString();
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
