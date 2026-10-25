/**
 * Prebuild: no Google Ads request without marketing consent.
 *
 *   npx tsx scripts/check-ads-consent.ts
 *
 * Runs the tracking module against a fake window. A script src or a gtag
 * config / event / js command counts as an Ads request. Consent Mode
 * default/update commands do not. The only Ads conversion is the purchase
 * conversion, once per paid session. Ampel, Kassen and Readiness send no
 * Ads conversion (the lead and readiness labels stay out of app, components
 * and lib). After consent they still send their GA4 events. Kassen sends
 * kassen_check_submit once per session. The Steuerberater form sends no
 * Ads conversion, and the Ads tag is configured on every consented page.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  GOOGLE_ADS_CONSENT_DENIED,
  GOOGLE_ADS_CONSENT_GRANTED,
  PURCHASE_CONVERSION_CURRENCY,
  PURCHASE_CONVERSION_STORAGE_PREFIX,
  PURCHASE_CONVERSION_VALUE_EUR,
  getGoogleAdsPurchaseSendTo,
  purchaseSessionIdFromCheckout,
  KASSEN_CHECK_SUBMIT_STORAGE_KEY,
  resetTrackingForChecks,
  saveConsent,
  trackAmpelCheckSubmit,
  trackKassenCheckSubmit,
  trackPurchaseConversion,
  trackReadinessSubmit,
  trackRoute,
} from "../lib/tracking";

const ADS_SCRIPT =
  /googletagmanager\.com\/gtag\/js|googleadservices\.com|googleads\.g\.doubleclick\.net|google-analytics\.com|googlesyndication\.com|doubleclick\.net/i;

type Tag = { id: string; src: string; async: boolean };
type Command = unknown[];

const adsId = "AW-586367190";
const gaId = "G-RJ4KLBP1SF";
const purchaseSendTo = "AW-586367190/PURCHASELABEL";
const paidSession = "cs_test_paid_session_1";
const secondSession = "cs_live_paid_session_2";

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
      return map.has(key) ? map.get(key)! : null;
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

function installDom() {
  const scripts: Tag[] = [];
  const local = memoryStorage();
  const session = memoryStorage();
  const listeners = new Map<string, Set<() => void>>();
  const win = {
    localStorage: local,
    sessionStorage: session,
    location: { protocol: "https:", search: "" },
    dataLayer: [] as unknown[],
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
  return { scripts, local, session };
}

function commands(): Command[] {
  return (window.dataLayer ?? []) as Command[];
}

/** gtag.js ignores a plain array. config/js/event/consent must be Arguments. */
function isGtagArguments(entry: unknown): boolean {
  return (
    !!entry &&
    typeof entry === "object" &&
    (Object.prototype.toString.call(entry) === "[object Arguments]" ||
      Object.prototype.hasOwnProperty.call(entry, "callee"))
  );
}

function adsScripts(scripts: Tag[]): Tag[] {
  return scripts.filter((script) => ADS_SCRIPT.test(script.src));
}

function requestCommands(): Command[] {
  return commands().filter((cmd) => {
    const name = cmd[0];
    return name === "config" || name === "event" || name === "js";
  });
}

function consentCommands(kind: "default" | "update"): Command[] {
  return commands().filter((cmd) => cmd[0] === "consent" && cmd[1] === kind);
}

function conversionCommands(): Command[] {
  return commands().filter((cmd) => cmd[0] === "event" && cmd[1] === "conversion");
}

function assertNoAdsRequest(scripts: Tag[], label: string) {
  assert.equal(adsScripts(scripts).length, 0, `${label}: ads script loaded`);
  assert.equal(requestCommands().length, 0, `${label}: gtag request queued`);
}

function assertDeniedDefaults(label: string) {
  const defaults = consentCommands("default");
  assert.ok(defaults.length >= 1, `${label}: missing consent default`);
  const state = defaults[0]?.[2] as Record<string, string>;
  assert.equal(state.ad_storage, "denied", label);
  assert.equal(state.ad_user_data, "denied", label);
  assert.equal(state.ad_personalization, "denied", label);
  assert.equal(state.analytics_storage, "denied", label);
  assert.deepEqual(state, GOOGLE_ADS_CONSENT_DENIED, label);
}

function fresh(env: {
  ads?: string;
  ga?: string;
  purchase?: string;
  meta?: string;
}) {
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = env.ads ?? "";
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = env.ga ?? "";
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO = env.purchase ?? "";
  process.env.NEXT_PUBLIC_META_PIXEL_ID = env.meta ?? "";
  const dom = installDom();
  resetTrackingForChecks();
  return dom;
}

function indexOfCommand(match: (cmd: Command) => boolean): number {
  return commands().findIndex(match);
}

const saved = {
  ads: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  ga: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  purchase: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO,
  meta: process.env.NEXT_PUBLIC_META_PIXEL_ID,
};

try {
  {
    const dom = fresh({
      ads: adsId,
      ga: gaId,
      purchase: purchaseSendTo,
    });
    trackRoute("/");
    trackRoute("/checkout");
    trackPurchaseConversion(paidSession);
    trackReadinessSubmit();
    trackKassenCheckSubmit();
    assertNoAdsRequest(dom.scripts, "without consent");
    assertDeniedDefaults("without consent");
    assert.equal(conversionCommands().length, 0, "without consent: conversion");
    const updates = consentCommands("update");
    assert.ok(updates.length >= 1, "without consent: consent update");
    assert.deepEqual(updates.at(-1)?.[2], GOOGLE_ADS_CONSENT_DENIED);
  }

  {
    const dom = fresh({ purchase: purchaseSendTo });
    saveConsent(true);
    trackRoute("/");
    assertNoAdsRequest(dom.scripts, "pages do not load Ads without NEXT_PUBLIC_GOOGLE_ADS_ID");
    trackPurchaseConversion(paidSession);
    assert.equal(adsScripts(dom.scripts).length, 1, "send_to alone still loads gtag for the conversion");
    assert.equal(
      commands().some((cmd) => cmd[0] === "config"),
      false,
      "unset NEXT_PUBLIC_GOOGLE_ADS_ID does not config an Ads tag",
    );
    assert.equal(conversionCommands().length, 1);
    assert.equal(conversionCommands()[0]?.[2] && (conversionCommands()[0][2] as { send_to: string }).send_to, purchaseSendTo);
  }

  {
    const dom = fresh({});
    saveConsent(true);
    trackRoute("/intake");
    trackPurchaseConversion(paidSession);
    assertNoAdsRequest(dom.scripts, "no ids and no send_to");
  }

  {
    const dom = fresh({ ads: adsId, ga: gaId });
    saveConsent(true);
    trackRoute("/");
    trackPurchaseConversion(paidSession);
    assert.equal(adsScripts(dom.scripts).length, 1, "consented ads tag");
    assert.match(dom.scripts[0]?.src ?? "", /googletagmanager\.com\/gtag\/js\?id=AW-586367190/);
    assert.equal(conversionCommands().length, 0, "unset purchase send_to sends nothing");
    const defaultAt = indexOfCommand((cmd) => cmd[0] === "consent" && cmd[1] === "default");
    const grantedAt = indexOfCommand(
      (cmd) => cmd[0] === "consent" && cmd[1] === "update",
    );
    const configAt = indexOfCommand(
      (cmd) => cmd[0] === "config" && cmd[1] === adsId,
    );
    assert.ok(defaultAt !== -1 && grantedAt !== -1 && configAt !== -1);
    assert.ok(defaultAt < grantedAt && grantedAt < configAt, "denied default before grant before config");
    assert.deepEqual(commands()[defaultAt]?.[2], GOOGLE_ADS_CONSENT_DENIED);
    assert.deepEqual(commands()[grantedAt]?.[2], GOOGLE_ADS_CONSENT_GRANTED);
    assert.equal(
      (commands()[grantedAt]?.[2] as { analytics_storage?: string }).analytics_storage,
      "granted",
      "consent update grants analytics_storage",
    );
    const jsAt = indexOfCommand((cmd) => cmd[0] === "js");
    const gaAt = indexOfCommand((cmd) => cmd[0] === "config" && cmd[1] === gaId);
    assert.ok(gaAt !== -1, "GA4 config fires after consent when the Ads id is also set");
    assert.ok(grantedAt < jsAt && jsAt < configAt && configAt < gaAt, "consent update, then js, then Ads config, then GA4 config");
    for (const entry of window.dataLayer ?? []) {
      assert.ok(isGtagArguments(entry), "gtag.js ignores a plain array, so GA4 config would not run");
    }
    const beforeRevoke = dom.scripts.length;
    saveConsent(false);
    trackRoute("/checkout");
    trackPurchaseConversion(paidSession);
    assert.equal(dom.scripts.length, beforeRevoke, "revoke does not load another tag");
    assert.equal(conversionCommands().length, 0, "revoke sends no conversion");
    assert.deepEqual(consentCommands("update").at(-1)?.[2], GOOGLE_ADS_CONSENT_DENIED);
  }

  {
    const dom = fresh({
      ads: adsId,
      ga: gaId,
      purchase: purchaseSendTo,
    });
    saveConsent(true);
    trackPurchaseConversion(paidSession);
    trackPurchaseConversion(paidSession);
    assert.equal(conversionCommands().length, 1, "reload in the same runtime sends once");
    const payload = conversionCommands()[0]?.[2] as {
      send_to: string;
      value: number;
      currency: string;
      transaction_id: string;
    };
    assert.equal(payload.send_to, purchaseSendTo);
    assert.equal(payload.value, PURCHASE_CONVERSION_VALUE_EUR);
    assert.equal(payload.value, 198);
    assert.equal(payload.currency, PURCHASE_CONVERSION_CURRENCY);
    assert.equal(payload.currency, "EUR");
    assert.equal(payload.transaction_id, paidSession);
    assert.equal(
      dom.local.getItem(`${PURCHASE_CONVERSION_STORAGE_PREFIX}${paidSession}`),
      "1",
    );
    assert.equal(
      dom.session.getItem(`${PURCHASE_CONVERSION_STORAGE_PREFIX}${paidSession}`),
      "1",
    );
    resetTrackingForChecks();
    window.dataLayer = [];
    delete window.gtag;
    trackPurchaseConversion(paidSession);
    assert.equal(conversionCommands().length, 0, "storage guard blocks a second send after reload");
    dom.local.clear();
    dom.session.clear();
    resetTrackingForChecks();
    window.dataLayer = [];
    delete window.gtag;
    trackPurchaseConversion(secondSession);
    assert.equal(conversionCommands().length, 1, "a different session may send once");
    assert.equal(
      (conversionCommands()[0]?.[2] as { transaction_id: string }).transaction_id,
      secondSession,
    );
    trackPurchaseConversion("mock_123");
    trackPurchaseConversion("not-a-stripe-session");
    assert.equal(conversionCommands().length, 1, "stub and non-checkout ids send nothing");
  }

  assert.equal(
    purchaseSessionIdFromCheckout({ error: "not_paid" }),
    "",
  );
  assert.equal(
    purchaseSessionIdFromCheckout({ error: "lookup_failed" }),
    "",
  );
  assert.equal(
    purchaseSessionIdFromCheckout({ stub: true, stripeSessionId: "cs_test_stub" }),
    "",
  );
  assert.equal(
    purchaseSessionIdFromCheckout({ stub: false, stripeSessionId: "mock_direct" }),
    "",
  );
  assert.equal(
    purchaseSessionIdFromCheckout({ stub: false, stripeSessionId: "  cs_live_real  " }),
    "cs_live_real",
  );

  assert.equal(getGoogleAdsPurchaseSendTo(), purchaseSendTo);

  {
    const dom = fresh({
      ads: adsId,
      ga: gaId,
      purchase: purchaseSendTo,
    });
    saveConsent(true);
    trackRoute("/");
    trackRoute("/readiness");
    trackRoute("/readiness");
    const adsConfigs = commands().filter((cmd) => cmd[0] === "config" && cmd[1] === adsId);
    assert.equal(adsConfigs.length, 2, "Ads config runs on every consented page, not twice on the same page");
    assert.equal(
      (adsConfigs[1]?.[2] as { page_path?: string } | undefined)?.page_path,
      "/readiness",
    );
    const gaConfigs = commands().filter((cmd) => cmd[0] === "config" && cmd[1] === gaId);
    assert.equal(gaConfigs.length, 1, "GA4 stays a single config on the shared gtag");
    const pageViews = commands().filter((cmd) => cmd[0] === "event" && cmd[1] === "page_view");
    assert.equal(pageViews.length, 1, "GA4 page_view only on the later route");
    assert.equal((pageViews[0]?.[2] as { send_to?: string }).send_to, gaId);
    assert.equal(dom.scripts.length, 1, "one shared gtag script");

    let finished = false;
    trackReadinessSubmit(() => {
      finished = true;
    });
    assert.equal(finished, true, "readiness navigation proceeds without an Ads callback");
    assert.equal(conversionCommands().length, 0, "readiness sends no Ads conversion");
    const readinessEvent = commands().find((cmd) => cmd[0] === "event" && cmd[1] === "readiness_submit");
    assert.deepEqual(readinessEvent?.[2], { send_to: gaId }, "GA4 readiness_submit stays send_to only");
  }

  {
    fresh({ ads: adsId, ga: gaId, purchase: purchaseSendTo });
    saveConsent(true);
    trackRoute("/ampel-check");
    assert.equal(trackAmpelCheckSubmit(), true, "Ampel GA4 submit fires after consent");
    assert.equal(trackAmpelCheckSubmit(), false, "Ampel GA4 submit is once per page load");
    assert.equal(conversionCommands().length, 0, "Ampel sends no Ads conversion");
    const gaEvents = commands().filter((cmd) => cmd[0] === "event" && cmd[1] === "ampel_check_submit");
    assert.equal(gaEvents.length, 1);
    assert.deepEqual(gaEvents[0]?.[2], { send_to: gaId });
  }

  {
    const dom = fresh({
      ads: adsId,
      ga: gaId,
      purchase: purchaseSendTo,
    });
    trackRoute("/kassen-check");
    trackKassenCheckSubmit();
    assert.equal(conversionCommands().length, 0, "Kassen sends nothing without consent");
    assert.equal(
      commands().some((cmd) => cmd[1] === "kassen_check_submit"),
      false,
      "Kassen GA4 event sends nothing without consent",
    );
    assert.equal(dom.session.getItem(KASSEN_CHECK_SUBMIT_STORAGE_KEY), null);
    saveConsent(true);
    trackRoute("/kassen-check");
    trackKassenCheckSubmit();
    trackKassenCheckSubmit();
    assert.equal(conversionCommands().length, 0, "Kassen sends no Ads conversion");
    const gaEvents = commands().filter((cmd) => cmd[0] === "event" && cmd[1] === "kassen_check_submit");
    assert.equal(gaEvents.length, 1, "Kassen sends one kassen_check_submit");
    assert.deepEqual(gaEvents[0]?.[2], { send_to: gaId });
    assert.equal(dom.session.getItem(KASSEN_CHECK_SUBMIT_STORAGE_KEY), "1");
    const gaAt = commands().findIndex((cmd) => cmd[0] === "event" && cmd[1] === "kassen_check_submit");
    const configAt = commands().findIndex((cmd) => cmd[0] === "config" && cmd[1] === adsId);
    const grantedAt = indexOfCommand((cmd) => cmd[0] === "consent" && cmd[1] === "update");
    assert.ok(grantedAt < configAt && configAt < gaAt, "Kassen GA4 event follows consent update and Ads config");
    resetTrackingForChecks();
    window.dataLayer = [];
    delete window.gtag;
    trackKassenCheckSubmit();
    assert.equal(conversionCommands().length, 0, "session guard blocks a second Kassen send after reload");
    assert.equal(
      commands().some((cmd) => cmd[1] === "kassen_check_submit"),
      false,
      "session guard blocks a second kassen_check_submit after reload",
    );
    dom.session.clear();
    resetTrackingForChecks();
    window.dataLayer = [];
    delete window.gtag;
    trackKassenCheckSubmit();
    assert.equal(conversionCommands().length, 0, "a new session still sends no Ads conversion");
    assert.equal(
      commands().filter((cmd) => cmd[0] === "event" && cmd[1] === "kassen_check_submit").length,
      1,
    );
  }

  {
    fresh({
      ads: adsId,
      ga: gaId,
      purchase: `"${purchaseSendTo}"`,
    });
    saveConsent(true);
    trackPurchaseConversion(paidSession);
    const payload = conversionCommands()[0]?.[2] as {
      send_to: string;
      value: number;
      currency: string;
      transaction_id: string;
    };
    assert.equal(payload.send_to, purchaseSendTo, "quoted purchase send_to is normalized");
    assert.equal(payload.value, 198);
    assert.equal(payload.currency, "EUR");
    assert.equal(payload.transaction_id, paidSession);
    const eventAt = commands().findIndex((cmd) => cmd[0] === "event" && cmd[1] === "conversion");
    const configAt = commands().findIndex((cmd) => cmd[0] === "config" && cmd[1] === adsId);
    const grantedAt = indexOfCommand((cmd) => cmd[0] === "consent" && cmd[1] === "update");
    const defaultAt = indexOfCommand((cmd) => cmd[0] === "consent" && cmd[1] === "default");
    assert.ok(defaultAt < grantedAt && grantedAt < configAt && configAt < eventAt);
  }

  const tracking = readFileSync("lib/tracking.ts", "utf8");
  const enableStart = tracking.indexOf("function enableGoogleTag");
  const enableEnd = tracking.indexOf("function ensureGtagStub");
  const enableBody = tracking.slice(enableStart, enableEnd);
  const guardAt = enableBody.indexOf("if (!hasMarketingConsent())");
  const defaultAt = enableBody.indexOf("applyConsentDefaultDenied()");
  const grantAt = enableBody.indexOf("applyConsentUpdate(true)");
  const scriptAt = enableBody.indexOf("googletagmanager.com/gtag/js");
  assert.ok(guardAt !== -1 && defaultAt !== -1 && grantAt !== -1 && scriptAt !== -1);
  assert.ok(guardAt < scriptAt && defaultAt < scriptAt && grantAt < scriptAt);

  const purchaseStart = tracking.indexOf("export function trackPurchaseConversion");
  const purchaseEnd = tracking.indexOf("function trackPageView");
  const purchaseBody = tracking.slice(purchaseStart, purchaseEnd);
  const eventAt = purchaseBody.indexOf('gtag("event", "conversion"');
  assert.ok(eventAt !== -1);
  assert.ok(purchaseBody.indexOf("getGoogleAdsPurchaseSendTo()") < eventAt);
  assert.ok(purchaseBody.indexOf("hasMarketingConsent()") < eventAt);
  assert.ok(purchaseBody.indexOf("purchaseConversionAlreadySent") < eventAt);
  assert.equal(purchaseBody.includes("getGoogleAdsReadinessLabel"), false);
  assert.equal(purchaseBody.includes("ReadinessSubmit"), false);
  assert.equal(tracking.includes("trackPurchaseConversion"), true);
  assert.equal(
    tracking.slice(tracking.indexOf("export function trackRoute"), purchaseStart).includes(
      "trackPurchaseConversion",
    ),
    false,
  );

  const success = readFileSync("app/success/page.tsx", "utf8");
  assert.ok(success.includes("purchaseSessionIdFromCheckout"));
  assert.ok(success.includes('showSuccess && sessionId.startsWith("cs_")'));
  const pendingAt = success.indexOf("<SuccessPending");
  const conversionAt = success.indexOf("<PurchaseConversion");
  assert.ok(pendingAt !== -1 && conversionAt > pendingAt);
  assert.equal(success.indexOf("<PurchaseConversion", conversionAt + 1), -1);

  const thanks = readFileSync("app/intake/purchase-thanks.tsx", "utf8");
  const thanksConversion = thanks.indexOf("<PurchaseConversion");
  assert.ok(thanksConversion !== -1, "the thank-you step mounts the Kauf conversion");
  assert.equal(thanks.indexOf("<PurchaseConversion", thanksConversion + 1), -1, "the thank-you step mounts it once");
  assert.ok(thanks.includes("Vielen Dank für Ihren Kauf"));
  assert.ok(thanks.includes("Fragebogen starten"));
  const intake = readFileSync("app/intake/page.tsx", "utf8");
  assert.ok(intake.includes("purchaseSessionIdFromCheckout"));
  assert.ok(intake.includes('grantFlag === "set"'));
  assert.ok(intake.includes('firstQueryValue(params.fragebogen) === "1"'));
  const fastReturnAt = intake.indexOf('fastEntry === "grant"');
  const thanksAt = intake.indexOf("<PurchaseThanks");
  assert.ok(fastReturnAt > 0 && thanksAt > fastReturnAt, "a fresh checkout still redirects before the thank-you step");
  assert.equal(intake.includes("<PurchaseConversion"), false, "the questionnaire page does not mount a second conversion");
  assert.equal(readFileSync("app/intake/intake-form.tsx", "utf8").includes("PurchaseConversion"), false);

  const readiness = readFileSync("app/readiness/readiness-form.tsx", "utf8");
  assert.equal(readiness.includes("trackPurchaseConversion"), false);
  assert.equal(readiness.includes("PurchaseConversion"), false);
  assert.equal(readiness.includes("trackLeadSubmit"), false);
  const readinessOk = readiness.indexOf("!response.ok || !successUrl");
  const readinessTrack = readiness.indexOf("trackReadinessSubmit(");
  assert.ok(readinessOk !== -1 && readinessTrack > readinessOk);
  assert.ok(readiness.includes("router.push(successUrl)"));

  const partner = readFileSync("app/steuerberater/partner-inquiry-form.tsx", "utf8");
  assert.equal(partner.includes("trackPurchaseConversion"), false);
  assert.equal(partner.includes("trackReadinessSubmit"), false);
  assert.equal(partner.includes("trackLeadSubmit"), false, "Steuerberater form sends no Ads conversion");
  assert.equal(partner.includes("getGoogleAdsLeadSendTo"), false);
  assert.equal(partner.includes("gtag("), false, "Steuerberater form does not call gtag");
  assert.equal(partner.includes("googleadservices"), false);
  assert.equal(partner.includes("KE_4CP3UoZwdENaBzZcC"), false, "the Ampel label is not used by the Steuerberater form");
  assert.ok(partner.includes("!response.ok || !data.ok"));

  const ampel = readFileSync("app/ampel-check/ampel-check.tsx", "utf8");
  const ampelOk = ampel.indexOf("!response.ok || !data.ok");
  const ampelTrack = ampel.indexOf("trackAmpelCheckSubmit(");
  const ampelFollow = ampel.indexOf('fetch("/api/ampel/ergebnis/senden"');
  const ampelAccepted = ampel.indexOf("leadAccepted =", ampelFollow);
  assert.equal(ampel.includes("trackLeadSubmit"), false, "Ampel does not fire an Ads lead conversion");
  assert.ok(ampelOk !== -1 && ampelTrack > ampelOk, "Ampel GA4 submit only after the success check");
  assert.equal(ampel.slice(0, ampelOk).includes("trackAmpelCheckSubmit("), false, "a failed Ampel submit does not send GA4");
  assert.equal(ampel.indexOf("trackAmpelCheckSubmit(", ampelTrack + 1), -1, "Ampel queues one GA4 submit call");
  assert.ok(ampel.includes("if (leadAccepted) trackAmpelCheckSubmit()"), "Ampel GA4 submit waits for an accepted submit");
  assert.ok(ampelFollow !== -1 && ampelAccepted > ampelFollow && ampelTrack > ampelAccepted, "the follow-up is judged before the GA4 event");
  assert.ok(ampel.includes("sent.mailed !== false"), "a follow-up that did not mail is not a submit");
  assert.ok(ampel.includes("data.mailed === false"), "a direct submit that did not mail is not a submit");
  assert.equal(ampel.includes("submitUtmFields"), false, "Ampel does not send utm fields");
  assert.ok(ampel.includes("trackAmpelCheckSubmit()"), "Ampel sends the GA4 submit event");
  const ampelGa = tracking.indexOf("export function trackAmpelCheckSubmit");
  const ampelGaEnd = tracking.indexOf("export const KASSEN_CHECK_SUBMIT_STORAGE_KEY");
  const ampelGaBody = tracking.slice(ampelGa, ampelGaEnd);
  assert.ok(ampelGa !== -1 && ampelGaEnd > ampelGa);
  assert.ok(ampelGaBody.includes("hasMarketingConsent()"), "Ampel GA4 submit is consent-gated");
  assert.ok(ampelGaBody.includes('trackConsentedGaEvent("ampel_check_submit")'), "Ampel sends ampel_check_submit");
  assert.equal(ampelGaBody.includes("trackLeadSubmit("), false, "the GA4 helper does not send the Ads conversion");

  const kassen = readFileSync("app/kassen-check/kassen-check.tsx", "utf8");
  const kassenSend = kassen.indexOf("async function sendResult");
  const kassenOk = kassen.indexOf("!response.ok || !data.ok");
  const kassenTrack = kassen.indexOf("trackKassenCheckSubmit(");
  const kassenFollow = kassen.indexOf('fetch("/api/kassen-check/ergebnis/senden"');
  const kassenAccepted = kassen.indexOf("leadAccepted =", kassenFollow);
  assert.ok(kassenSend !== -1 && kassen.indexOf("trackKassenCheckSubmit(") > kassenSend, "Kassen conversion is not on page load or an answer");
  assert.equal(kassen.slice(0, kassenSend).includes("trackKassenCheckSubmit("), false, "answering the Kassen questions does not convert");
  assert.ok(kassenOk !== -1 && kassenTrack > kassenOk, "Kassen conversion only after the success check");
  assert.equal(kassen.slice(0, kassenOk).includes("trackKassenCheckSubmit("), false, "a failed Kassen submit does not convert");
  assert.equal(kassen.indexOf("trackKassenCheckSubmit(", kassenTrack + 1), -1, "Kassen queues one conversion call");
  assert.ok(
    kassen.includes("if (leadAccepted) trackKassenCheckSubmit()"),
    "Kassen GA4 submit is gated on an accepted submit",
  );
  assert.ok(kassenFollow !== -1 && kassenAccepted > kassenFollow && kassenTrack > kassenAccepted, "the Kassen follow-up is judged before the conversion");
  assert.ok(kassen.includes("sent.mailed !== false"), "a Kassen follow-up that did not mail is not a conversion");
  assert.ok(kassen.includes("data.mailed === false"), "a direct Kassen submit that did not mail is not a conversion");
  assert.equal(kassen.includes("submitUtmFields"), false, "Kassen does not send utm fields");
  assert.equal(kassen.includes("trackLeadSubmit"), false, "Kassen calls the shared helper instead of trackLeadSubmit directly");
  assert.equal(kassen.includes("KE_4CP3UoZwdENaBzZcC"), false, "Kassen does not embed the removed lead label");
  assert.equal(kassen.includes("gtag("), false, "the Kassen page does not call gtag itself");
  assert.equal(
    readFileSync("app/kassen-check/bestaetigen/confirm-panel.tsx", "utf8").includes("trackKassenCheckSubmit"),
    false,
    "Kassen DOI confirm does not fire the lead event",
  );
  const kassenFn = tracking.indexOf("export function trackKassenCheckSubmit");
  const kassenFnEnd = tracking.indexOf("export function trackAmpelStart");
  const kassenBody = tracking.slice(kassenFn, kassenFnEnd);
  assert.ok(kassenFn !== -1 && kassenFnEnd > kassenFn);
  assert.equal(kassenBody.includes("trackLeadSubmit"), false, "Kassen sends no Ads lead conversion");
  assert.ok(kassenBody.includes("hasMarketingConsent()"), "Kassen GA4 submit is consent-gated");
  assert.ok(kassenBody.includes("KASSEN_CHECK_SUBMIT_STORAGE_KEY"), "Kassen GA4 submit is deduped for the browser session");
  assert.ok(kassenBody.includes('trackConsentedGaEvent("kassen_check_submit")'), "Kassen sends the GA4 event");
  assert.equal(kassenBody.includes("gtag("), false, "Kassen does not build its own conversion");

  const steuerberaterHits: string[] = [];
  const steuerberaterDir = path.join(process.cwd(), "app", "steuerberater");
  const steuerberaterStack = [steuerberaterDir];
  while (steuerberaterStack.length) {
    const dir = steuerberaterStack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        steuerberaterStack.push(full);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
      const text = readFileSync(full, "utf8");
      if (
        text.includes("trackLeadSubmit") ||
        text.includes("getGoogleAdsLeadSendTo") ||
        text.includes("KE_4CP3UoZwdENaBzZcC") ||
        text.includes('gtag("event", "conversion"')
      ) {
        steuerberaterHits.push(path.relative(process.cwd(), full));
      }
    }
  }
  assert.deepEqual(steuerberaterHits, [], "no Ads conversion in the Steuerberater form");

  const example = readFileSync(".env.example", "utf8");
  assert.equal(example.includes("NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO"), false);
  assert.equal(example.includes("NEXT_PUBLIC_GOOGLE_ADS_READINESS_LABEL"), false);
  assert.ok(example.includes("NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO="));

  const forbidden = [
    "trackLeadSubmit",
    "getGoogleAdsLeadSendTo",
    "getGoogleAdsReadinessLabel",
    "NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO",
    "NEXT_PUBLIC_GOOGLE_ADS_READINESS_LABEL",
    "KE_4CP3UoZwdENaBzZcC",
    "EPqPCJGV2v4cENaBzZcC",
  ];
  const forbiddenHits: string[] = [];
  const forbiddenRoots = ["app", "components", "lib"];
  const forbiddenStack = forbiddenRoots.map((root) => path.join(process.cwd(), root));
  while (forbiddenStack.length) {
    const dir = forbiddenStack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        forbiddenStack.push(full);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
      const rel = path.relative(process.cwd(), full);
      const text = readFileSync(full, "utf8");
      for (const needle of forbidden) {
        if (text.includes(needle)) forbiddenHits.push(`${rel}: ${needle}`);
      }
    }
  }
  assert.deepEqual(forbiddenHits, [], "removed Ads conversions stay out of the client and server");
  const conversionCalls = tracking.match(/event", "conversion"/g) ?? [];
  assert.equal(conversionCalls.length, 1, "the purchase conversion is the only Ads conversion");
  assert.ok(tracking.includes('window.gtag("event", "readiness_submit", { send_to: gaId })'), "GA4 readiness_submit payload is unchanged");

  const hits: string[] = [];
  const roots = ["app", "components", "lib", "scripts"];
  const stack = roots.map((root) => path.join(process.cwd(), root));
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
      const rel = path.relative(process.cwd(), full);
      if (rel === "lib/tracking.ts" || rel === "scripts/check-ads-consent.ts") continue;
      const text = readFileSync(full, "utf8");
      if (text.includes("googletagmanager.com/gtag/js")) hits.push(rel);
    }
  }
  assert.deepEqual(hits, []);

  console.log("check-ads-consent: ok");
} finally {
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = saved.ads;
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = saved.ga;
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO = saved.purchase;
  process.env.NEXT_PUBLIC_META_PIXEL_ID = saved.meta;
}
