import { isHomeCtaId, type HomeCtaId } from "@/lib/home-cta-event";

const HOME_CTA_URL = "/api/home/cta";
const POINTER_CLICK_GAP_MS = 700;

export type HomeCtaGesture = {
  pointerDown: (send: () => void) => void;
  click: (send: () => void) => void;
};

/**
 * Primary press sends immediately. The click that follows the same press
 * does not send again. A keyboard click has no primary press, so it sends.
 */
export function createHomeCtaGesture(
  schedule: (release: () => void) => void = (release) => {
    setTimeout(release, POINTER_CLICK_GAP_MS);
  },
): HomeCtaGesture {
  let fromPointer = false;
  return {
    pointerDown(send) {
      fromPointer = true;
      send();
      schedule(() => {
        fromPointer = false;
      });
    },
    click(send) {
      if (fromPointer) {
        fromPointer = false;
        return;
      }
      send();
    },
  };
}

function isHomePath(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/";
}

/** Beacon first. fetch keepalive covers browsers that refuse the beacon. */
export function sendHomeCta(cta: HomeCtaId): void {
  try {
    if (!isHomeCtaId(cta) || !isHomePath()) return;
    const payload = JSON.stringify({ cta });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(HOME_CTA_URL, blob)) return;
    }
    void fetch(HOME_CTA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // The click still navigates when the beacon cannot be sent.
  }
}

let sentForEntry = false;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/** One view for this entry. A strict-mode remount cancels the release. */
export function sendHomeView(): void {
  if (!isHomePath()) return;
  if (releaseTimer != null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (sentForEntry) return;
  sentForEntry = true;
  sendHomeCta("home_view");
}

/** Arms the next entry after the page has actually gone. */
export function releaseHomeView(): void {
  if (releaseTimer != null) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    sentForEntry = false;
  }, 0);
}

export function resetHomeViewForTest(): void {
  if (releaseTimer != null) clearTimeout(releaseTimer);
  releaseTimer = null;
  sentForEntry = false;
}
