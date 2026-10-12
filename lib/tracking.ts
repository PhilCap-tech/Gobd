/**
 * Consent-gated marketing tracking (Google tag + Meta Pixel).
 *
 * Google Consent Mode v2: ad_storage, ad_user_data and ad_personalization
 * (and analytics_storage for the shared GA4 tag) default to denied.
 * They are granted only after marketing consent. The gtag script is not
 * inserted before that grant, so no Ads request leaves without consent.
 *
 * NEXT_PUBLIC_GOOGLE_ADS_ID unset → no Ads config on pages.
 * NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO unset → no purchase conversion.
 * The purchase conversion is not the Readiness submit conversion.
 */

import { isStubCheckoutSessionId } from "@/lib/checkout-stub";

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

/** Consent Mode v2 defaults. analytics_storage follows the same marketing gate as GA4. */
export const GOOGLE_ADS_CONSENT_DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
} as const;

export const GOOGLE_ADS_CONSENT_GRANTED = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
} as const;

/** Agreed purchase conversion value. Not read from pricing. */
export const PURCHASE_CONVERSION_VALUE_EUR = 198;
export const PURCHASE_CONVERSION_CURRENCY = "EUR";
export const PURCHASE_CONVERSION_STORAGE_PREFIX = "gobd_ads_purchase:";

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
let consentDefaultSet = false;
let lastConsentGranted: boolean | null = null;

export function getMetaPixelId(): string {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
}

/** Google Ads account ID, e.g. AW-XXXXXXXXX. Unset → skip Ads config. */
export function getGoogleAdsId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";
}

/** Conversion label for ReadinessSubmit only. Unset → traffic/config, no conversion. */
export function getGoogleAdsReadinessLabel(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_READINESS_LABEL?.trim() || "";
}

/**
 * Full Google Ads purchase send_to, e.g. AW-586367190/LABEL.
 * Unset → the purchase conversion is not sent. Not the Readiness label.
 */
export function getGoogleAdsPurchaseSendTo(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO?.trim() || "";
}

/**
 * Stripe checkout session id only when the lookup is a real paid session.
 * Errors, stubs and mock_ ids yield nothing, so the conversion is not armed.
 */
export function purchaseSessionIdFromCheckout(
  resolved: { error: string } | { stub: boolean; stripeSessionId: string },
): string {
  if ("error" in resolved) return "";
  if (resolved.stub) return "";
  const id = resolved.stripeSessionId.trim();
  if (!id || isStubCheckoutSessionId(id) || !id.startsWith("cs_")) return "";
  return id;
}

/** GA4 measurement ID, e.g. G-XXXXXXXX. Unset → skip GA4 config. */
export function getGaMeasurementId(): string {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
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
  applyConsentDefaultDenied();
  if (!hasMarketingConsent()) {
    applyConsentUpdate(false);
    return;
  }
  enableMarketingScripts();
  trackPageView(pathname);
  trackGooglePageView(pathname);
  if (pathname === "/readiness") {
    trackReadinessStart();
  }
}

/**
 * Purchase conversion on the paid success page. Sends nothing unless
 * NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO is set, marketing consent is
 * granted, and this checkout session was not sent before. Does not use
 * the Readiness conversion label.
 */
export function trackPurchaseConversion(sessionId: string): void {
  const id = sessionId.trim();
  const sendTo = getGoogleAdsPurchaseSendTo();
  if (!id || !sendTo || !id.startsWith("cs_") || isStubCheckoutSessionId(id)) return;
  if (!hasMarketingConsent()) return;
  if (purchaseConversionAlreadySent(id)) return;
  const account = sendTo.split("/")[0]?.trim() ?? "";
  const loadId = getGoogleAdsId() || (account.startsWith("AW-") ? account : "");
  enableGoogleTag(loadId);
  if (typeof document === "undefined" || !document.getElementById("google-gtag")) return;
  if (!window.gtag) return;
  window.gtag("event", "conversion", {
    send_to: sendTo,
    value: PURCHASE_CONVERSION_VALUE_EUR,
    currency: PURCHASE_CONVERSION_CURRENCY,
    transaction_id: id,
  });
  markPurchaseConversionSent(id);
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
 * Google Ads: conversion only if NEXT_PUBLIC_GOOGLE_ADS_READINESS_LABEL is set.
 * The event sends no `value`. Google Ads keeps the conversion-action default
 * of 198 € net (setup + first month). Do not pass the gross total.
 * GA4: custom `readiness_submit` when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * This is not the purchase conversion.
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
  enableGoogleTag();
  const googleId = getGoogleAdsId();
  if (googleId) {
    const label = getGoogleAdsReadinessLabel();
    if (label) {
      window.gtag?.("event", "conversion", {
        send_to: `${googleId}/${label}`,
      });
    }
  }
  const gaId = getGaMeasurementId();
  if (gaId) {
    window.gtag?.("event", "readiness_submit", { send_to: gaId });
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

/** Shared gtag/dataLayer. Loads only after marketing consent, and only when an id exists. */
function enableGoogleTag(purchaseLoadId = ""): void {
  if (typeof window === "undefined") return;
  if (!hasMarketingConsent()) {
    applyConsentUpdate(false);
    return;
  }
  const adsId = getGoogleAdsId();
  const gaId = getGaMeasurementId();
  const loadId = adsId || gaId || purchaseLoadId;
  if (!loadId) return;
  applyConsentDefaultDenied();
  applyConsentUpdate(true);
  loadScript(
    "google-gtag",
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loadId)}`,
  );
  if (googleInitialized) return;
  window.gtag?.("js", new Date());
  if (adsId) window.gtag?.("config", adsId);
  if (gaId) window.gtag?.("config", gaId);
  googleInitialized = true;
}

function ensureGtagStub(): void {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
}

/** First Google command: Consent Mode v2 defaults denied. No network request. */
function applyConsentDefaultDenied(): void {
  if (typeof window === "undefined" || consentDefaultSet) return;
  ensureGtagStub();
  window.gtag?.("consent", "default", { ...GOOGLE_ADS_CONSENT_DENIED });
  consentDefaultSet = true;
}

function applyConsentUpdate(granted: boolean): void {
  if (typeof window === "undefined") return;
  applyConsentDefaultDenied();
  if (lastConsentGranted === granted) return;
  window.gtag?.("consent", "update", {
    ...(granted ? GOOGLE_ADS_CONSENT_GRANTED : GOOGLE_ADS_CONSENT_DENIED),
  });
  lastConsentGranted = granted;
}

function purchaseStorageKey(sessionId: string): string {
  return `${PURCHASE_CONVERSION_STORAGE_PREFIX}${sessionId}`;
}

function readStorageFlag(storage: Storage, key: string): boolean {
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStorageFlag(storage: Storage, key: string): void {
  try {
    storage.setItem(key, "1");
  } catch {
    /* private mode */
  }
}

function purchaseConversionAlreadySent(sessionId: string): boolean {
  const key = purchaseStorageKey(sessionId);
  return (
    readStorageFlag(window.localStorage, key) ||
    readStorageFlag(window.sessionStorage, key)
  );
}

function markPurchaseConversionSent(sessionId: string): void {
  const key = purchaseStorageKey(sessionId);
  writeStorageFlag(window.localStorage, key);
  writeStorageFlag(window.sessionStorage, key);
}

/** Clears in-memory guards so the prebuild check can replay consent cases. */
export function resetTrackingForChecks(): void {
  pixelInitialized = false;
  googleInitialized = false;
  lastPageViewPath = "";
  lastReadinessStartPath = "";
  lastGooglePagePath = "";
  consentDefaultSet = false;
  lastConsentGranted = null;
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
