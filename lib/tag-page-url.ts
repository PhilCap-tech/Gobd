/**
 * Query keys Google and Vercel Web Analytics may see.
 * Everything else (`a`, `token`, `t`, `ref`, `kanzlei`, …) and the fragment stay off the hit.
 */
export const TAG_QUERY_ALLOWLIST = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

const ALLOWED_EXACT = new Set<string>(["gclid", "gbraid", "wbraid"]);

/** `utm_*` plus the three click ids. */
export function isAllowlistedTagQuery(key: string): boolean {
  return key.startsWith("utm_") || ALLOWED_EXACT.has(key);
}

/**
 * Address-bar keys that carry a mail-link id. Confirm and unsubscribe links
 * use `token` (opaque id since the signed tokens were replaced). `t` is the
 * older key. Other params stay, including `utm_*`, `a`, and `next`.
 */
export const ADDRESS_BAR_SECRET_KEYS = ["token", "t"] as const;

const ADDRESS_BAR_DROP = new Set<string>(ADDRESS_BAR_SECRET_KEYS);

export function allowlistedSearch(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return "";
  const params = new URLSearchParams(raw);
  const kept = new URLSearchParams();
  for (const [key, value] of params) {
    if (!isAllowlistedTagQuery(key) || !value || kept.has(key)) continue;
    kept.append(key, value);
  }
  const qs = kept.toString();
  return qs ? `?${qs}` : "";
}

export function searchWithoutSecrets(search: string): { search: string; changed: boolean } {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  let changed = false;
  for (const key of [...params.keys()]) {
    if (!ADDRESS_BAR_DROP.has(key)) continue;
    params.delete(key);
    changed = true;
  }
  const qs = params.toString();
  return { search: qs ? `?${qs}` : "", changed };
}

/**
 * Same-origin referrer as origin + path. Cross-origin and empty referrers are
 * omitted so the tag keeps its default.
 */
export function sanitizedSameOriginReferrer(referrer: string, origin: string): string {
  if (!referrer || !origin) return "";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "";
  }
  if (url.origin !== origin) return "";
  return `${url.origin}${url.pathname}`;
}

/** Fields for gtag config and page_view. No fragment. No non-allowlisted query. */
export function tagHitFields(pathname: string): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!pathname) return fields;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  fields.page_path = path;
  if (typeof window === "undefined") return fields;
  const origin = window.location?.origin;
  if (typeof origin === "string" && origin) {
    const search = typeof window.location.search === "string" ? window.location.search : "";
    fields.page_location = `${origin}${path}${allowlistedSearch(search)}`;
    const referrer = sanitizedSameOriginReferrer(
      typeof document !== "undefined" && typeof document.referrer === "string" ? document.referrer : "",
      origin,
    );
    if (referrer) fields.page_referrer = referrer;
  }
  return fields;
}

function urlWithoutSensitiveQuery(url: string): string {
  if (typeof window === "undefined") return url;
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return url;
  }
  const { search, changed } = searchWithoutSecrets(parsed.search);
  if (!changed) return url;
  const next = `${parsed.pathname}${search}${parsed.hash}`;
  return /^https?:\/\//i.test(url) ? `${parsed.origin}${next}` : next;
}

/**
 * Next.js replaces `history.replaceState` and would restore the server URL,
 * including `token`. The native method only changes the address bar.
 * A wrapper installed before that patch still strips `token` and `t` from
 * later Next.js history writes. Router state keeps the original query, so
 * server-rendered token props stay valid.
 */
let replaceStateWrapped = false;

export function installSensitiveQueryStrip(): void {
  if (typeof window === "undefined" || replaceStateWrapped) return;
  const history = window.history;
  const current = history?.replaceState;
  if (!history || typeof current !== "function") return;
  replaceStateWrapped = true;
  history.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null) {
    const nextUrl = typeof url === "string" ? urlWithoutSensitiveQuery(url) : url;
    return current.call(history, data, unused, nextUrl as string);
  };
}

/** Drops `token` and `t` from the address bar. Hash and every other param stay. */
export function stripSensitiveQueryFromAddressBar(): void {
  if (typeof window === "undefined") return;
  const location = window.location;
  if (!location || typeof location.pathname !== "string") return;
  const current = typeof location.search === "string" ? location.search : "";
  const { search, changed } = searchWithoutSecrets(current);
  if (!changed) return;
  const hash = typeof location.hash === "string" ? location.hash : "";
  const next = `${location.pathname}${search}${hash}`;
  const history = window.history;
  const native = typeof History === "function" ? History.prototype.replaceState : undefined;
  try {
    if (native && history) {
      native.call(history, history.state, "", next);
      return;
    }
    if (history && typeof history.replaceState === "function") {
      history.replaceState(history.state, "", next);
    }
  } catch {
    /* private mode or a locked history entry */
  }
}
