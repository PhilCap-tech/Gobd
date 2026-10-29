/**
 * Prebuild: /partner-angebot buy CTAs go to Digistore24, only the allowlisted
 * query is appended encoded, and the page stays noindex and out of the sitemap.
 *
 *   npx tsx scripts/check-partner-angebot.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sitemap from "../app/sitemap";
import { LegalMarkdown } from "../lib/legal-markdown";
import { buildLlmsTxt } from "../lib/llms-txt";
import {
  DIGISTORE_PROMOCODE_SCRIPT_ID,
  DIGISTORE_PROMOCODE_SCRIPT_SRC,
  resetDigistorePromocodeForChecks,
  applyStoredAffiliateToBuyLinks,
  buyHrefWithStoredAffiliate,
  syncDigistorePromocode,
} from "../lib/digistore-promocode";
import {
  DIGISTORE24_FORWARDED_PARAMS,
  DIGISTORE24_PRODUCT_ID,
  DIGISTORE24_PRODUCT_URL,
  PARTNER_ANGEBOT_LEGAL_NOTICE,
  PARTNER_ANGEBOT_NOTICE_AFTER,
  PARTNER_ANGEBOT_NOTICE_HREF,
  PARTNER_ANGEBOT_NOTICE_LINK,
  PARTNER_ANGEBOT_PATH,
  PARTNER_ANGEBOT_ROBOTS_TAG,
  PARTNER_ANGEBOT_RUECKGABE_MICRO,
  digistore24BuyHref,
} from "../lib/partner-angebot";
import { saveConsent } from "../lib/tracking";
import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "../lib/pricing";
import { INDEXABLE_STATIC_PATHS, canonicalUrl } from "../lib/seo";

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function source(file: string): string {
  return readFileSync(file, "utf8");
}

ok(SETUP_EUR === 149 && MONTHLY_EUR === 49 && TODAY_EUR === 198, "homepage price constants are unchanged");
ok(DIGISTORE24_PRODUCT_ID === 751404, "product id is 751404");
ok(
  DIGISTORE24_PRODUCT_URL === "https://www.digistore24.com/product/751404",
  "product url is the Digistore24 offer",
);
ok(PARTNER_ANGEBOT_ROBOTS_TAG === "noindex, nofollow", "robots tag is noindex, nofollow");
ok(
  PARTNER_ANGEBOT_LEGAL_NOTICE.startsWith("Der Kauf läuft über Digistore24") &&
    PARTNER_ANGEBOT_LEGAL_NOTICE.includes(PARTNER_ANGEBOT_NOTICE_LINK) &&
    PARTNER_ANGEBOT_NOTICE_HREF === "/agb" &&
    !PARTNER_ANGEBOT_LEGAL_NOTICE.includes("PLATZHALTER") &&
    !PARTNER_ANGEBOT_LEGAL_NOTICE.includes("["),
  "partner notice is the approved Digistore24 sentence",
);
ok(
  PARTNER_ANGEBOT_LEGAL_NOTICE.includes(
    `${TODAY_EUR} € zum Start (Einrichtung ${SETUP_EUR} € + 1. Monat ${MONTHLY_EUR} €), danach ${MONTHLY_EUR} €/Monat`,
  ),
  "partner notice prices match pricing.ts",
);

function expectHref(search: Parameters<typeof digistore24BuyHref>[0], expected: string, label: string) {
  const href = digistore24BuyHref(search);
  ok(href === expected, label);
  const url = new URL(href);
  ok(
    `${url.origin}${url.pathname}` === DIGISTORE24_PRODUCT_URL,
    `${label} keeps the product host and path`,
  );
}

expectHref(undefined, DIGISTORE24_PRODUCT_URL, "empty query stays the product url");
expectHref("", DIGISTORE24_PRODUCT_URL, "blank string stays the product url");
expectHref({}, DIGISTORE24_PRODUCT_URL, "empty record stays the product url");
expectHref(
  { aff: "test123" },
  `${DIGISTORE24_PRODUCT_URL}?aff=test123`,
  "aff=test123 is passed through",
);
expectHref(
  "?aff=test123&cam=herbst",
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&cam=herbst`,
  "query string keeps aff and cam",
);
expectHref(
  { aff: "test123", cam: "a&b=c d" },
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&cam=a%26b%3Dc+d`,
  "reserved characters are encoded",
);
expectHref(
  { aff: ["test123", "second"] },
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&aff=second`,
  "repeated aff values are kept",
);
expectHref(
  `https://www.gobd-doku-erstellen.de${PARTNER_ANGEBOT_PATH}?aff=test123&cam=x`,
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&cam=x`,
  "a full page url contributes only its query",
);

ok(
  DIGISTORE24_FORWARDED_PARAMS.join(",") === "aff,cam",
  "the Digistore24 allowlist is only aff and cam",
);
const mixedQuery =
  "?utm_source=google&gclid=CLICK123&gbraid=GB1&wbraid=WB1&email=buyer%40example.com&e=other%40example.com&token=sekret&a=ANSWERCODE&ref=Kanzlei&aff=test123&cam=herbst&t=abc&kanzlei=Muster&next=%2Fintake&utm_campaign=ads&campaignkey=not-a-ds24-key&foo=drop#email=hidden@example.com&token=in-fragment";
const mixedHref = digistore24BuyHref(mixedQuery);
const mixedUrl = new URL(mixedHref);
ok(
  mixedHref === `${DIGISTORE24_PRODUCT_URL}?aff=test123&cam=herbst`,
  "utm, click ids, email, e, token, a, ref and the fragment stay off the Digistore24 link",
);
ok(mixedUrl.hash === "", "the Digistore24 link has no fragment");
ok(
  [...mixedUrl.searchParams.keys()].join(",") === "aff,cam",
  "the mixed query leaves only aff and cam",
);
for (const dropped of [
  "utm_source",
  "utm_campaign",
  "gclid",
  "gbraid",
  "wbraid",
  "email",
  "e",
  "token",
  "a",
  "ref",
  "t",
  "kanzlei",
  "next",
  "campaignkey",
  "foo",
]) {
  ok(!mixedUrl.searchParams.has(dropped), `the mixed query drops ${dropped}`);
}
ok(mixedUrl.searchParams.get("aff") === "test123" && mixedUrl.searchParams.get("cam") === "herbst", "the mixed query keeps aff and cam");
ok(
  !mixedHref.includes("google") &&
    !mixedHref.includes("CLICK123") &&
    !mixedHref.includes("GB1") &&
    !mixedHref.includes("WB1") &&
    !mixedHref.includes("sekret") &&
    !mixedHref.includes("buyer") &&
    !mixedHref.includes("other") &&
    !mixedHref.includes("ANSWERCODE") &&
    !mixedHref.includes("Kanzlei") &&
    !mixedHref.includes("hidden") &&
    !mixedHref.includes("utm_") &&
    !mixedHref.includes("#"),
  "dropped values and the fragment are absent from the Digistore24 link",
);
expectHref(
  {
    utm_source: "google",
    gclid: "CLICK123",
    gbraid: "GB1",
    wbraid: "WB1",
    email: "buyer@example.com",
    e: "other@example.com",
    token: "sekret",
    a: "ANSWERCODE",
    ref: "Kanzlei",
    aff: "test123",
    cam: "herbst",
  },
  `${DIGISTORE24_PRODUCT_URL}?aff=test123&cam=herbst`,
  "a searchParams record forwards only aff and cam",
);

const page = source("app/partner-angebot/page.tsx");
const buyTags = [...page.matchAll(/<BuyCta\b([^>]*)>/g)];
ok(buyTags.length >= 4, "the page has the buy buttons");
for (const tag of buyTags) {
  ok(tag[1].includes("href={buyHref}"), "each buy button receives the Digistore24 href");
}
ok(page.includes("ctaHref={buyHref}"), "the header buy button uses the same href");
ok(page.includes("data-partner-cta=\"digistore24\""), "buy anchors are marked");
ok(page.includes("digistore24BuyHref"), "the page builds the href from the helper");
ok(
  page.includes("{PARTNER_ANGEBOT_NOTICE_BEFORE}") &&
    page.includes("{PARTNER_ANGEBOT_NOTICE_LINK}") &&
    page.includes("{PARTNER_ANGEBOT_NOTICE_AFTER}") &&
    page.includes("PARTNER_ANGEBOT_NOTICE_HREF"),
  "the approved notice is rendered and AGB (§ 9a) links to /agb",
);
ok(page.includes("index: false") && page.includes("follow: false"), "metadata is noindex, nofollow");
ok(page.includes("SETUP_EUR") && page.includes("MONTHLY_EUR") && page.includes("TODAY_EUR"), "prices come from pricing.ts");
ok(page.includes("HERO_PRICE_BOX"), "price box is the homepage constant");
ok(
  page.includes("{PARTNER_ANGEBOT_RUECKGABE_MICRO}") && !page.includes("GELD_ZURUECK"),
  "the DS24 page shows the approved Rückgabe micro text, not the Stripe guarantee or its FAQ link",
);
ok(
  PARTNER_ANGEBOT_RUECKGABE_MICRO ===
    "14 Tage Rückgaberecht über Digistore24: Innerhalb von 14 Tagen nach dem Kauf können Sie Ihre Bestellung über Digistore24 zurückgeben (Link zur Soforthilfe in Ihrer Bestellbestätigung) und erhalten den vollen Kaufpreis zurück.",
  "the Rückgabe micro text is the approved first sentence verbatim",
);
{
  const danke = source("app/partner-danke/page.tsx").replace(/\s+/g, " ");
  ok(danke.includes(PARTNER_ANGEBOT_RUECKGABE_MICRO), "/partner-danke carries the same Rückgabe sentence");
  ok(danke.includes('<h2 id="rueckgabe">Rückgabe</h2>'), "/partner-danke Rückgabe heading has id rueckgabe");
  ok(!danke.includes("PLATZHALTER"), "/partner-danke has no placeholder");
  ok(!/href=[^>]*(checkout|stripe)/i.test(danke), "/partner-danke has no checkout or Stripe link");
  ok(danke.includes("index: false"), "/partner-danke is noindex");
}
ok(!page.includes("/checkout"), "the page does not link to /checkout");
ok(!/stripe/i.test(page), "the page does not mention Stripe");
ok(!page.includes('"198') && !page.includes("198 €"), "198 is not hardcoded on the page");
ok(!page.includes("149 €") && !/[^A-Z_]149[^0-9]/.test(page), "149 is not hardcoded on the page");

const home = source("app/page.tsx");
ok((home.match(/<CampaignLink\b[^>]*href="\/checkout"/g) ?? []).length >= 4, "the homepage checkout links stay");
ok(!/<a\b[^>]*href="\/checkout"/.test(home), "the homepage checkout links are not plain anchors");

const config = source("next.config.ts");
ok(config.includes("PARTNER_ANGEBOT_PATH"), "the robots header is bound to the partner path");
ok(config.includes("PARTNER_ANGEBOT_ROBOTS_TAG"), "the header uses the noindex tag");

const header = source("components/site-header.tsx");
const footer = source("components/site-footer.tsx");
ok(!header.includes(PARTNER_ANGEBOT_PATH), "the header does not link the partner page");
ok(!footer.includes(PARTNER_ANGEBOT_PATH), "the footer does not link the partner page");
ok(
  !(INDEXABLE_STATIC_PATHS as readonly string[]).includes(PARTNER_ANGEBOT_PATH),
  "the partner page is not an indexable path",
);

const agb = source("content/legal/agb.md");
ok(agb.includes("## § 9a Bestellungen über Digistore24 (Partner-Angebot)"), "AGB has § 9a");
ok(agb.includes("(4) Für Bestellungen über die Partnerseite https://www.gobd-doku-erstellen.de/partner-angebot, die über Digistore24 abgewickelt werden, gelten ergänzend und vorrangig die Regelungen in § 9a."), "AGB § 1 Abs. 4");
ok(
  agb.includes(
    `${TODAY_EUR} € zum Start (Einrichtung ${SETUP_EUR} € + 1. Monat ${MONTHLY_EUR} €), danach ${MONTHLY_EUR} € pro Monat`,
  ),
  "AGB § 9a prices match pricing.ts",
);
const privacy = source("content/legal/datenschutz.md");
ok(privacy.includes("## 12. Bestellungen über Digistore24 (Partner-Angebot)"), "privacy section 12");
ok(privacy.includes("## 13. Google Ads Conversion-Tracking und Google Analytics 4"), "Google Ads is section 13");
ok(privacy.includes("## 25. Änderungen"), "privacy sections run through 25");
ok(!privacy.includes("## 12. Google Ads"), "old section 12 heading is gone");
ok(privacy.includes("Käufe über Digistore24 melden wir nicht an Google."), "Google Ads sentence");
const faq = source("content/faq.md");
ok(
  faq.includes(
    "14 Tage Rückgaberecht über Digistore24: Innerhalb von 14 Tagen nach dem Kauf können Sie Ihre Bestellung über Digistore24 zurückgeben (Link zur Soforthilfe in Ihrer Bestellbestätigung) und erhalten den vollen Kaufpreis zurück. Bei Käufen über Digistore24 Inc. (USA) bzw. Digistore24 LTD (UK) gilt die im Bestellformular angezeigte Frist von 60 Tagen. Das gilt auch, wenn Sie bereits ein PDF erzeugt oder heruntergeladen haben. Die Erstattung wickelt Digistore24 ab. Die Regeln für Bestellungen über unsere Website gelten hier nicht (§ 9a Abs. 9 AGB). Nach der Rückgabe sperren wir Ihren Zugang; bereits heruntergeladene PDFs dürfen Sie dann nicht mehr nutzen.",
  ),
  "FAQ item 6 has the approved Digistore24 Rückgabe paragraph",
);
ok(!faq.includes("dieselben Erstattungsregeln"), "FAQ item 6 no longer says the same refund rules apply to Digistore24");
ok(
  agb.includes(
    "(9) **14 Tage Rückgaberecht über Digistore24.** Innerhalb von 14 Tagen nach dem Kauf können Sie Ihre Bestellung über Digistore24 zurückgeben (Link zur Soforthilfe in Ihrer Bestellbestätigung) und erhalten den vollen Kaufpreis zurück.",
  ),
  "AGB § 9a (9) has the approved Rückgabe wording",
);
ok(
  agb.includes("**Das gilt nicht, wenn der Vertrag durch eine Rückgabe nach § 9a Abs. 9 endet; dann sperren wir den Zugang mit der Rückgabe.**"),
  "AGB § 12 Abs. 4 has the approved Rückgabe exception",
);
ok(
  PARTNER_ANGEBOT_NOTICE_AFTER.endsWith(
    "monatlich kündbar, 14 Tage Rückgaberecht nach § 9a Abs. 9 AGB (bei Digistore24 USA/UK die im Bestellformular angezeigte Frist); Kündigung, Rückgabe und Erstattung laufen über Digistore24.",
  ) && !PARTNER_ANGEBOT_NOTICE_AFTER.includes("Zufriedenheitsgarantie"),
  "partner notice ends with the approved Rückgaberecht wording",
);
ok(
  faq.includes(
    "Haben Sie über unsere Partnerseite bei Digistore24 bestellt, richten Sie Rechnungsfragen bitte an Digistore24 (support@digistore24.com). Bei Bestellungen über unsere Website erreichen Sie uns für Rechnungsfragen unter der oben genannten Adresse.",
  ) && !faq.includes("\nRechnungsfragen richten Sie bitte an Digistore24"),
  "FAQ item 5 limits Rechnungsfragen an Digistore24 to partner orders",
);

function renderedHrefs(markdown: string): string[] {
  const html = renderToStaticMarkup(createElement(LegalMarkdown, { source: markdown }));
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

const agbHrefs = renderedHrefs(agb);
const privacyHrefs = renderedHrefs(privacy);
const faqHrefs = renderedHrefs(faq);
const exactHrefs = [
  "https://www.digistore24.com/page/privacy/1/de",
  "https://www.digistore24.com/page/terms/1/de",
  "https://www.gobd-doku-erstellen.de/partner-angebot",
];
for (const href of exactHrefs) {
  const hits = [...agbHrefs, ...privacyHrefs, ...faqHrefs].filter((value) => value === href || value.startsWith(href));
  ok(hits.includes(href), `autolink href is exactly ${href}`);
  ok(
    hits.every((value) => value === href),
    `no trailing punctuation in ${href}`,
  );
}
const privacyHtml = renderToStaticMarkup(createElement(LegalMarkdown, { source: privacy }));
const agbHtml = renderToStaticMarkup(createElement(LegalMarkdown, { source: agb }));
const faqHtml = renderToStaticMarkup(createElement(LegalMarkdown, { source: faq }));
ok(
  faqHtml.includes('<h2 id="erstattung">6. 14 Tage Geld zurück: Garantie und Rückgaberecht</h2>') &&
    faqHtml.split('id="erstattung"').length === 2,
  "/faq guarantee heading has the single id erstattung",
);
ok(
  privacyHtml.includes("https://www.digistore24.com/page/privacy/1/de</a>)."),
  "privacy URL keeps ').' outside the link",
);
ok(
  agbHtml.includes("https://www.digistore24.com/page/terms/1/de</a>)."),
  "AGB terms URL keeps ').' outside the link",
);
ok(
  faqHtml.includes("https://www.gobd-doku-erstellen.de/partner-angebot</a>,"),
  "FAQ partner URL keeps the comma outside the link",
);

const cookiesHtml = renderToStaticMarkup(
  createElement(LegalMarkdown, { source: source("content/legal/cookies.md") }),
);
const impressumHtml = renderToStaticMarkup(
  createElement(LegalMarkdown, { source: source("content/legal/impressum.md") }),
);
for (const name of ["ds24c.v1", "ds24p.v1", "ds24s.v1", "gobd_consent"]) {
  ok(cookiesHtml.includes(`<code class="legal-code">${name}</code>`), `cookies renders ${name} as code`);
  ok(!cookiesHtml.includes(`\`${name}\``), `cookies does not show literal backticks around ${name}`);
}
for (const name of ["ds24c.v1", "digistorePromocode", "gobd_session", "email"]) {
  ok(privacyHtml.includes(`<code class="legal-code">${name}</code>`), `privacy renders ${name} as code`);
}
ok(!privacyHtml.includes("`") && !cookiesHtml.includes("`"), "privacy and cookies html have no literal backticks");
ok(
  privacyHtml.includes("https://www.digistore24-scripts.com/service/digistore.js</code>"),
  "the script url stays inside the code element",
);
ok(!agbHtml.includes("<code") && !agbHtml.includes("`"), "AGB has no inline code");
ok(!faqHtml.includes("<code") && !faqHtml.includes("`"), "FAQ has no inline code");
ok(!impressumHtml.includes("<code") && !impressumHtml.includes("`"), "impressum has no inline code");
ok(agbHtml.includes("§ 9a") && faqHtml.includes("Digistore24") && impressumHtml.includes("IKAT"), "other legal pages keep their wording");

const llms = buildLlmsTxt();
ok(!llms.includes(PARTNER_ANGEBOT_PATH), "llms.txt omits the partner page");

ok(page.includes("<DigistorePromocode />"), "the sales page mounts the promocode");
ok(!page.includes("digistore24-scripts.com"), "the server page does not embed the script url");
ok(!source("app/success/page.tsx").includes("DigistorePromocode"), "the thank-you page has no promocode");
ok(!source("app/layout.tsx").includes("DigistorePromocode"), "the promocode is not site-wide");
const promocodeComponent = source("components/digistore-promocode.tsx");
ok(promocodeComponent.includes("syncDigistorePromocode()"), "the component syncs on mount");
ok(promocodeComponent.includes("applyStoredAffiliateToBuyLinks()"), "the component restores the stored aff on each visit");
ok(promocodeComponent.includes("useSearchParams()"), "a search change, including the aff strip, runs the sync again");
ok(promocodeComponent.includes('addEventListener("popstate"'), "back navigation runs the sync again");
ok(
  promocodeComponent.includes("subscribeConsent(sync)"),
  "the component follows the marketing consent event",
);
const promocodeLib = source("lib/digistore-promocode.ts");
ok(promocodeLib.includes(DIGISTORE_PROMOCODE_SCRIPT_SRC), "the script url is the official digistore.js");
ok(
  promocodeLib.includes("adjust_domain: true") && promocodeLib.includes("DIGISTORE24_PRODUCT_ID"),
  "the call matches the official promocode options",
);
ok(promocodeLib.includes("hasMarketingConsent()"), "the loader checks marketing consent");
const syncBody = promocodeLib.slice(promocodeLib.indexOf("export function syncDigistorePromocode"));
ok(
  syncBody.indexOf("guardDigistoreHistoryState()") !== -1 &&
    syncBody.indexOf("guardDigistoreHistoryState()") < syncBody.indexOf("appendChild"),
  "the history guard runs before the script node is inserted",
);
ok(
  config.includes("https://www.digistore24-scripts.com") &&
    config.includes("https://www.checkout-ds24.com") &&
    config.includes("https://www.digistore24.com"),
  "the report-only CSP allows the Digistore24 script, pixel and JSONP hosts",
);

type PromoOptions = { product_id: number; adjust_domain: boolean };
type PromoTag = {
  id: string;
  src: string;
  async: boolean;
  onload: null | (() => void);
};

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

function installPromoDom() {
  const scripts: PromoTag[] = [];
  const calls: PromoOptions[] = [];
  const listeners = new Map<string, Set<() => void>>();
  const win = {
    localStorage: memoryStorage(),
    location: { protocol: "https:", search: "" },
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
      return { id: "", src: "", async: false, onload: null } as PromoTag;
    },
    head: {
      appendChild(el: PromoTag) {
        scripts.push(el);
      },
    },
  };
  globalThis.window = win as unknown as Window & typeof globalThis;
  globalThis.document = doc as unknown as Document;
  resetDigistorePromocodeForChecks();
  return {
    scripts,
    calls,
    defineApi() {
      window.digistorePromocode = (options: PromoOptions) => {
        calls.push(options);
      };
    },
  };
}

{
  const denied = installPromoDom();
  syncDigistorePromocode();
  ok(denied.scripts.length === 0 && denied.calls.length === 0, "no promocode script without consent");
  saveConsent(false);
  syncDigistorePromocode();
  ok(
    denied.scripts.length === 0 && denied.calls.length === 0,
    "essential-only consent still loads no promocode script",
  );

  const granted = installPromoDom();
  saveConsent(true);
  syncDigistorePromocode();
  ok(granted.scripts.length === 1, "marketing consent inserts one script");
  ok(
    granted.scripts[0].id === DIGISTORE_PROMOCODE_SCRIPT_ID &&
      granted.scripts[0].src === DIGISTORE_PROMOCODE_SCRIPT_SRC &&
      granted.scripts[0].async === true,
    "the inserted script is the official async digistore.js",
  );
  ok(granted.calls.length === 0, "digistorePromocode waits until the script has loaded");
  granted.defineApi();
  granted.scripts[0].onload?.();
  ok(
    granted.calls.length === 1 &&
      granted.calls[0].product_id === 751404 &&
      granted.calls[0].adjust_domain === true,
    "onload calls digistorePromocode for product 751404",
  );
  syncDigistorePromocode();
  granted.scripts[0].onload?.();
  ok(granted.calls.length === 1 && granted.scripts.length === 1, "a second sync does not load the script again");

  const late = installPromoDom();
  saveConsent(true);
  syncDigistorePromocode();
  saveConsent(false);
  late.defineApi();
  late.scripts[0].onload?.();
  ok(late.calls.length === 0, "revoked consent before load does not call digistorePromocode");

  type HistoryCall = { method: "pushState" | "replaceState"; data: unknown };
  function installNextLikeHistory(): HistoryCall[] {
    const calls: HistoryCall[] = [];
    function make(method: HistoryCall["method"]) {
      return function (data: unknown) {
        if (data !== null && typeof data !== "object") {
          throw new TypeError(`Cannot create property '__NA' on ${typeof data} '${String(data)}'`);
        }
        calls.push({ method, data });
      };
    }
    Object.assign(window, {
      history: {
        state: { __NA: true },
        pushState: make("pushState"),
        replaceState: make("replaceState"),
      },
    });
    return calls;
  }

  const untouched = installPromoDom();
  const untouchedCalls = installNextLikeHistory();
  const originalPush = window.history.pushState;
  const originalReplace = window.history.replaceState;
  syncDigistorePromocode();
  saveConsent(false);
  syncDigistorePromocode();
  ok(
    window.history.pushState === originalPush && window.history.replaceState === originalReplace,
    "history stays untouched without marketing consent",
  );
  ok(untouched.scripts.length === 0 && untouchedCalls.length === 0, "declined consent still inserts no script");

  const guarded = installPromoDom();
  const guardedCalls = installNextLikeHistory();
  saveConsent(true);
  syncDigistorePromocode();
  ok(guarded.scripts.length === 1, "the history guard still allows the one promocode script");
  const wrappedPush = window.history.pushState;
  Object.assign(window, {
    location: {
      protocol: "https:",
      href: "https://www.gobd-doku-erstellen.de/partner-angebot?aff=test123",
      origin: "https://www.gobd-doku-erstellen.de",
      pathname: "/partner-angebot",
      search: "?aff=test123",
    },
  });
  const routerState = { __NA: true, tree: "keep" };
  const samePage = "https://www.gobd-doku-erstellen.de/partner-angebot";
  window.history.pushState("", "title", samePage);
  window.history.replaceState(false, "", samePage);
  window.history.pushState(routerState, "", "https://www.gobd-doku-erstellen.de/faq");
  window.history.pushState(null, "", samePage);
  syncDigistorePromocode();
  window.history.pushState("", "", "https://www.gobd-doku-erstellen.de/faq");
  ok(window.history.pushState === wrappedPush, "a second sync does not wrap history again");
  ok(
    guardedCalls[0]?.method === "replaceState" && guardedCalls[0]?.data === null,
    "digistore pushState(\"\", same page) becomes replaceState so history.length stays put",
  );
  ok(
    guardedCalls[1]?.method === "replaceState" && guardedCalls[1]?.data === null,
    "replaceState with a non-object state is normalized to null",
  );
  ok(guardedCalls[2]?.data === routerState && guardedCalls[2]?.method === "pushState", "Next router state objects still push");
  ok(guardedCalls[3]?.method === "pushState" && guardedCalls[3]?.data === null, "null state stays a push");
  ok(
    guardedCalls[4]?.method === "pushState" && guardedCalls[4]?.data === null,
    "an empty string for a different path still pushes",
  );
  ok(guardedCalls.length === 5, "the Next-like history patch received every guarded call");

  const product = "https://www.digistore24.com/product/751404";
  const checkout = "https://www.checkout-ds24.com/product/751404";
  function cookieJson(aff: string): string {
    return `ds24c.v1=${encodeURIComponent(JSON.stringify({ parameter: { aff } }))}`;
  }
  function sessionJson(aff: string): string {
    return JSON.stringify({ parameter: { aff }, can_store: true });
  }
  function installAnchors(hrefs: string[]) {
    const anchors = hrefs.map((href) => ({ href }));
    Object.assign(document, {
      querySelectorAll(selector: string) {
        return selector === "a[href]" ? anchors : [];
      },
    });
    Object.assign(window, { sessionStorage: memoryStorage() });
    return anchors;
  }

  installPromoDom();
  const deniedLinks = installAnchors([product, checkout, "https://www.gobd-doku-erstellen.de/faq"]);
  document.cookie = cookieJson("from-cookie");
  window.sessionStorage.setItem("ds24s.v1", sessionJson("from-session"));
  applyStoredAffiliateToBuyLinks();
  ok(
    deniedLinks.map((link) => link.href).join("|") === [product, checkout, "https://www.gobd-doku-erstellen.de/faq"].join("|"),
    "without consent the buy links stay on the URL aff and storage is not applied",
  );
  ok(
    buyHrefWithStoredAffiliate(`${product}?aff=from-url`) === `${product}?aff=from-url`,
    "without consent a product href is returned unchanged",
  );

  installPromoDom();
  saveConsent(true);
  Object.assign(window, {
    location: {
      protocol: "https:",
      href: "https://www.gobd-doku-erstellen.de/partner-angebot?aff=from-url",
      origin: "https://www.gobd-doku-erstellen.de",
      pathname: "/partner-angebot",
      search: "?aff=from-url",
    },
  });
  const urlWins = installAnchors([`${product}?aff=from-url`]);
  document.cookie = cookieJson("from-cookie");
  window.sessionStorage.setItem("ds24s.v1", sessionJson("from-session"));
  applyStoredAffiliateToBuyLinks();
  ok(urlWins[0].href === `${product}?aff=from-url`, "an aff still in the page address is left on the link");

  installPromoDom();
  saveConsent(true);
  Object.assign(window, {
    location: {
      protocol: "https:",
      href: "https://www.gobd-doku-erstellen.de/partner-angebot",
      origin: "https://www.gobd-doku-erstellen.de",
      pathname: "/partner-angebot",
      search: "",
    },
  });
  const cookieWins = installAnchors([product, `${checkout}?aff=old`, "https://www.gobd-doku-erstellen.de/agb"]);
  document.cookie = cookieJson("from-cookie");
  window.sessionStorage.setItem("ds24s.v1", sessionJson("from-session"));
  applyStoredAffiliateToBuyLinks();
  ok(cookieWins[0].href === `${product}?aff=from-cookie`, "ds24c.v1 aff is written onto digistore24.com");
  ok(cookieWins[1].href === `${checkout}?aff=from-cookie`, "ds24c.v1 wins over an old aff and over ds24s.v1");
  ok(cookieWins[2].href === "https://www.gobd-doku-erstellen.de/agb", "other links are left alone");
  applyStoredAffiliateToBuyLinks();
  ok(cookieWins[0].href === `${product}?aff=from-cookie`, "a second apply does not rewrite an aff that already matches");

  installPromoDom();
  saveConsent(true);
  const sessionOnly = installAnchors([`${product}?utm_source=ad`]);
  document.cookie = "";
  window.sessionStorage.setItem("ds24s.v1", sessionJson("from-session"));
  applyStoredAffiliateToBuyLinks();
  ok(
    sessionOnly[0].href.includes("aff=from-session") && sessionOnly[0].href.includes("utm_source=ad"),
    "ds24s.v1 supplies aff when the cookie is absent, and other params stay",
  );
}

async function main() {
  const urls = (await sitemap()).map((entry) => entry.url);
  ok(!urls.includes(canonicalUrl(PARTNER_ANGEBOT_PATH)), "sitemap omits the partner page");
  console.log("check-partner-angebot: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
