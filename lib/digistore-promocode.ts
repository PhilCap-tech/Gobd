/**
 * Digistore24 promocode for /partner-angebot.
 *
 * Official snippet (product id from DIGISTORE24_PRODUCT_URL):
 * https://www.digistore24-scripts.com/service/digistore.js
 * digistorePromocode({ "product_id": 751404, "adjust_domain": true })
 *
 * The script sets a first-party cookie and storage and contacts Digistore24
 * when digistorePromocode runs. It is inserted only after marketing consent,
 * the same gate as GA4. No consent means this module inserts nothing.
 */

import { DIGISTORE24_PRODUCT_ID } from "@/lib/partner-angebot";
import { hasMarketingConsent } from "@/lib/tracking";

export const DIGISTORE_PROMOCODE_SCRIPT_ID = "digistore24-promocode";
export const DIGISTORE_PROMOCODE_SCRIPT_SRC =
  "https://www.digistore24-scripts.com/service/digistore.js";

declare global {
  interface Window {
    digistorePromocode?: (options: { product_id: number; adjust_domain: boolean }) => void;
  }
}

let promocodeCalled = false;
let historyGuarded = false;

export function resetDigistorePromocodeForChecks(): void {
  promocodeCalled = false;
  historyGuarded = false;
}

/**
 * digistore.js calls history.pushState("", document.title, url) while it
 * strips affiliate parameters from the address. Next's patched pushState
 * copies __NA onto that state. A string is not null, so the assignment throws
 * "Cannot create property '__NA' on string ''" and the history update never
 * runs. Null is the value Next already turns into a fresh object before it
 * copies __NA and the router tree, so back/forward stays an app-router entry.
 * Object state, including Next's own __NA payloads, is passed through.
 *
 * That same call is the only aff removal. It targets the current path, so
 * replaceState keeps the entry instead of growing history.length. A different
 * path, or any object state, still uses pushState.
 */
function normalizeHistoryState(state: unknown): unknown {
  return state !== null && typeof state === "object" ? state : null;
}

function isSameDocumentHistoryUrl(url: unknown): boolean {
  if (typeof url !== "string" && !(url instanceof URL)) return false;
  try {
    const next = new URL(url, window.location.href);
    return next.origin === window.location.origin && next.pathname === window.location.pathname;
  } catch {
    return false;
  }
}

function guardDigistoreHistoryState(): void {
  if (historyGuarded || typeof window === "undefined") return;
  const history = window.history;
  if (typeof history?.pushState !== "function" || typeof history.replaceState !== "function") {
    return;
  }
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  historyGuarded = true;
  history.pushState = function pushState(data, unused, url) {
    const state = normalizeHistoryState(data);
    if (data === "" && isSameDocumentHistoryUrl(url)) {
      return originalReplaceState.call(this, state, unused, url);
    }
    return originalPushState.call(this, state, unused, url);
  };
  history.replaceState = function replaceState(data, unused, url) {
    return originalReplaceState.call(this, normalizeHistoryState(data), unused, url);
  };
}

/** Cookie written by digistore.js. Its parameter object wins over session storage. */
export const DS24_AFFILIATE_COOKIE = "ds24c.v1";
/** Session copy. Used only when the cookie is missing or not the promocode JSON. */
export const DS24_AFFILIATE_SESSION = "ds24s.v1";

const BUY_HOSTS = new Set([
  "digistore24.com",
  "www.digistore24.com",
  "checkout-ds24.com",
  "www.checkout-ds24.com",
]);

function cleanAffiliate(value: unknown): string {
  if (typeof value !== "string" || value === "null") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || /[\s\u0000]/.test(trimmed)) return "";
  return trimmed;
}

function affiliateFromStoredJson(raw: string): { present: boolean; aff: string } {
  try {
    const parsed = JSON.parse(raw) as { parameter?: { aff?: unknown } } | null;
    if (!parsed || typeof parsed.parameter !== "object" || parsed.parameter === null) {
      return { present: false, aff: "" };
    }
    return { present: true, aff: cleanAffiliate(parsed.parameter.aff) };
  } catch {
    return { present: false, aff: "" };
  }
}

function readCookieValue(name: string): string {
  const raw = document.cookie;
  if (!raw) return "";
  for (const part of raw.split(";")) {
    const piece = part.trim();
    const eq = piece.indexOf("=");
    if (eq === -1 || piece.slice(0, eq) !== name) continue;
    const value = piece.slice(eq + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return "";
}

/**
 * Same order as digistore.js `O()`: the ds24c.v1 cookie overlays session
 * storage. A readable cookie is the source of truth even when its aff is
 * empty. Session storage is the fallback when the cookie is absent.
 */
export function readDigistoreAffiliate(): string {
  const cookie = affiliateFromStoredJson(readCookieValue(DS24_AFFILIATE_COOKIE));
  if (cookie.present) return cookie.aff;
  try {
    const session = affiliateFromStoredJson(window.sessionStorage.getItem(DS24_AFFILIATE_SESSION) ?? "");
    return session.present ? session.aff : "";
  } catch {
    return "";
  }
}

export function isDigistoreProductHref(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return BUY_HOSTS.has(url.hostname) && url.pathname === `/product/${DIGISTORE24_PRODUCT_ID}`;
  } catch {
    return false;
  }
}

function pageAffiliate(): string {
  try {
    return cleanAffiliate(new URL(window.location.href).searchParams.get("aff"));
  } catch {
    return "";
  }
}

/**
 * Product href plus the stored aff.
 * Without marketing consent the href is unchanged and Digistore storage is not read.
 * While the page address still has aff, that value wins, matching digistore.js.
 */
export function buyHrefWithStoredAffiliate(href: string): string {
  if (!isDigistoreProductHref(href) || !hasMarketingConsent()) return href;
  if (pageAffiliate()) return href;
  const aff = readDigistoreAffiliate();
  if (!aff) return href;
  const url = new URL(href, window.location.href);
  if (url.searchParams.get("aff") === aff) return href;
  url.searchParams.set("aff", aff);
  return url.toString();
}

/** Puts the stored aff on every Digistore product link. No-op without marketing consent. */
export function applyStoredAffiliateToBuyLinks(): void {
  if (typeof document === "undefined" || !hasMarketingConsent()) return;
  const aff = readDigistoreAffiliate();
  if (!aff) return;
  document.querySelectorAll("a[href]").forEach((node) => {
    const anchor = node as HTMLAnchorElement;
    if (typeof anchor.href !== "string") return;
    const next = buyHrefWithStoredAffiliate(anchor.href);
    if (next !== anchor.href) anchor.href = next;
  });
}

function callPromocode(): void {
  if (promocodeCalled || !hasMarketingConsent()) return;
  if (typeof window.digistorePromocode !== "function") return;
  promocodeCalled = true;
  window.digistorePromocode({
    product_id: DIGISTORE24_PRODUCT_ID,
    adjust_domain: true,
  });
}

/** Inserts the official script and calls it once, only with marketing consent. */
export function syncDigistorePromocode(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!hasMarketingConsent() || promocodeCalled) return;

  guardDigistoreHistoryState();

  let script = document.getElementById(DIGISTORE_PROMOCODE_SCRIPT_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = DIGISTORE_PROMOCODE_SCRIPT_ID;
    script.async = true;
    script.src = DIGISTORE_PROMOCODE_SCRIPT_SRC;
    script.onload = () => {
      callPromocode();
    };
    document.head.appendChild(script);
  }
  callPromocode();
}
