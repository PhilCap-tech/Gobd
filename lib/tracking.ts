/**
 * Consent-gated ads tracking (Google tag + Meta Pixel).
 * Stripe stays TEST — never fire Purchase or InitiateCheckout
 * (neither Meta nor Google checkout conversions).
 */

export type ConsentChoice = {
  essential: true;
  marketing: boolean;
};

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const CONSENT_STORAGE_KEY = "gobd_consent";
export const CONSENT_COOKIE = "gobd_consent";
export const CONSENT_EVENT = "gobd-consent";
export const UTM_STORAGE_KEY = "gobd_utm_first";

const CONSENT_MAX_AGE_SEC = 60 * 60 * 24 * 180;
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

let pixelInitialized = false;
let googleInitialized = false;
let lastPageViewPath = "";
let lastReadinessStartPath = "";
let lastGooglePagePath = "";

export function getMetaPixelId(): string {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
}

/** Google Ads account ID, e.g. AW-XXXXXXXXX. Unset → skip Ads config/conversions. */
export function getGoogleAdsId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";
}

/** GA4 measurement ID, e.g. G-XXXXXXXX. Unset → skip GA4. */
export function getGaMeasurementId(): string {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
}

/** Conversion label for ReadinessSubmit only. Unset → traffic/config, no conversion. */
export function getGoogleAdsReadinessLabel(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_READINESS_LABEL?.trim() || "";
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    /* private mode */
  }
  return parseConsent(readCookie(CONSENT_COOKIE));
}

let bannerForceOpen = false;
const bannerListeners = new Set<() => void>();

function emitBanner() {
  bannerListeners.forEach((listener) => listener());
}

export function saveConsent(marketing: boolean): ConsentChoice {
  const choice: ConsentChoice = { essential: true, marketing };
  const raw = JSON.stringify(choice);
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, raw);
  } catch {
    /* private mode */
  }
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(raw)}; Path=/; Max-Age=${CONSENT_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  bannerForceOpen = false;
  if (!marketing) {
    lastPageViewPath = "";
    lastReadinessStartPath = "";
    lastGooglePagePath = "";
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
  emitBanner();
  return choice;
}

export function hasMarketingConsent(): boolean {
  return readConsent()?.marketing === true;
}

export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

export function subscribeBanner(onChange: () => void): () => void {
  bannerListeners.add(onChange);
  const unsubConsent = subscribeConsent(onChange);
  return () => {
    bannerListeners.delete(onChange);
    unsubConsent();
  };
}

export function getBannerOpen(): boolean {
  return bannerForceOpen || readConsent() === null;
}

export function openConsentBanner(): void {
  bannerForceOpen = true;
  emitBanner();
}

export function captureFirstTouchUtms(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(UTM_STORAGE_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key)?.trim();
      if (value) utm[key] = value;
    }
    if (Object.keys(utm).length === 0) return;
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    /* ignore */
  }
}

export function readFirstTouchUtms(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function eventParams(): Record<string, string> | undefined {
  return readFirstTouchUtms() || undefined;
}

export function enableMarketingScripts(): void {
  if (!hasMarketingConsent()) return;
  const pixelId = getMetaPixelId();
  if (pixelId) enableMetaPixel(pixelId);
  enableGoogleTag();
}

/** PageView on all consented routes; custom ReadinessStart only on `/readiness`. */
export function trackRoute(pathname: string): void {
  if (pathname !== "/readiness") {
    lastReadinessStartPath = "";
  }
  if (!hasMarketingConsent()) return;
  enableMarketingScripts();
  trackPageView(pathname);
  trackGooglePageView(pathname);
  if (pathname === "/readiness") {
    trackReadinessStart();
  }
}

function trackPageView(pathname: string): void {
  const pixelId = getMetaPixelId();
  if (!pixelId) return;
  enableMetaPixel(pixelId);
  if (lastPageViewPath === pathname) return;
  lastPageViewPath = pathname;
  window.fbq?.("track", "PageView", eventParams());
}

/** Custom event on `/readiness` (not `/readiness/success`). Standard PageView is fired separately. */
function trackReadinessStart(): void {
  const pixelId = getMetaPixelId();
  if (!pixelId) return;
  enableMetaPixel(pixelId);
  if (lastReadinessStartPath === "/readiness") return;
  lastReadinessStartPath = "/readiness";
  window.fbq?.("trackCustom", "ReadinessStart", eventParams());
}

/**
 * After a successful readiness POST — before navigating to success.
 * Meta: CompleteRegistration + ReadinessSubmit.
 * Google: conversion only if NEXT_PUBLIC_GOOGLE_ADS_READINESS_LABEL is set.
 * Does not fire Purchase / InitiateCheckout (Meta or Google).
 */
export function trackReadinessSubmit(): void {
  if (!hasMarketingConsent()) return;
  const params = eventParams();
  const pixelId = getMetaPixelId();
  if (pixelId) {
    enableMetaPixel(pixelId);
    window.fbq?.("track", "CompleteRegistration", params);
    window.fbq?.("trackCustom", "ReadinessSubmit", params);
  }
  const googleId = getGoogleAdsId();
  if (googleId) {
    enableGoogleTag();
    const label = getGoogleAdsReadinessLabel();
    if (label) {
      window.gtag?.("event", "conversion", {
        send_to: `${googleId}/${label}`,
      });
    }
  }
}

function enableMetaPixel(pixelId: string): void {
  if (typeof window === "undefined" || !pixelId) return;
  ensureFbq();
  loadScript("meta-pixel", "https://connect.facebook.net/en_US/fbevents.js");
  if (pixelInitialized) return;
  window.fbq?.("init", pixelId);
  pixelInitialized = true;
}

function enableGoogleTag(): void {
  if (typeof window === "undefined") return;
  const adsId = getGoogleAdsId();
  const gaId = getGaMeasurementId();
  const loadId = adsId || gaId;
  if (!loadId) return;
  loadScript(
    "google-gtag",
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loadId)}`,
  );
  if (googleInitialized) return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
  window.gtag("js", new Date());
  if (adsId) window.gtag("config", adsId);
  if (gaId) window.gtag("config", gaId);
  googleInitialized = true;
}

function trackGooglePageView(pathname: string): void {
  if (!getGoogleAdsId() && !getGaMeasurementId()) return;
  enableGoogleTag();
  if (lastGooglePagePath === pathname) return;
  const first = lastGooglePagePath === "";
  lastGooglePagePath = pathname;
  if (first) return;
  window.gtag?.("event", "page_view", { page_path: pathname });
}

function ensureFbq(): void {
  if (typeof window === "undefined" || window.fbq) return;
  const fbq: Fbq = function fbqImpl(...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue.push(args);
    }
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
}

function loadScript(id: string, src: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function parseConsent(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { marketing?: unknown };
    if (typeof parsed.marketing === "boolean") {
      return { essential: true, marketing: parsed.marketing };
    }
  } catch {
    if (raw === "marketing") return { essential: true, marketing: true };
    if (raw === "essential") return { essential: true, marketing: false };
  }
  return null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) !== name) continue;
    return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}
