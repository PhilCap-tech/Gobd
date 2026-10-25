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
 */
function normalizeHistoryState(state: unknown): unknown {
  return state !== null && typeof state === "object" ? state : null;
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
    return originalPushState.call(this, normalizeHistoryState(data), unused, url);
  };
  history.replaceState = function replaceState(data, unused, url) {
    return originalReplaceState.call(this, normalizeHistoryState(data), unused, url);
  };
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
