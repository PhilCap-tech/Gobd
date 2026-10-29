import type { NextConfig } from "next";
import { AMPEL_ADMIN_CACHE_CONTROL, AMPEL_ADMIN_ROBOTS_TAG } from "./lib/ampel-admin-headers";
import { PARTNER_ANGEBOT_PATH, PARTNER_ANGEBOT_ROBOTS_TAG } from "./lib/partner-angebot";
import {
  branchenInternalPath,
  branchenPath,
  listBranchenRoutes,
} from "./lib/branchen-routes";
import { tokenLandingHeaderRules } from "./lib/token-pages";

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
];

/**
 * Report-Only so a missing Google or Meta host cannot block the consent-gated
 * tag, Meta Pixel, the Stripe Checkout redirect, or magic-link fetch.
 * preload is omitted on purpose.
 * `upgrade-insecure-requests` is omitted: browsers ignore it in a report-only
 * policy and log an error. Enforcing it would upgrade `http://localhost`
 * during `next dev` and `next start`. Production already sends HSTS.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com https://connect.facebook.net https://js.stripe.com https://www.digistore24-scripts.com https://www.checkout-ds24.com https://www.digistore24.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com https://ssl.google-analytics.com https://www.googletagmanager.com https://www.google.com https://www.google.de https://googleads.g.doubleclick.net https://www.googleadservices.com https://stats.g.doubleclick.net https://www.facebook.com https://www.checkout-ds24.com https://www.digistore24.com",
  "font-src 'self'",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.google.com https://www.google.de https://www.googleadservices.com https://pagead2.googlesyndication.com https://ad.doubleclick.net https://www.facebook.com https://connect.facebook.net https://api.stripe.com https://www.checkout-ds24.com https://www.digistore24.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://td.doubleclick.net",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy,
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  },
];

const ampelAdminHeaders = [
  { key: "Cache-Control", value: AMPEL_ADMIN_CACHE_CONTROL },
  { key: "X-Robots-Tag", value: AMPEL_ADMIN_ROBOTS_TAG },
];

const BRANCHEN_ROBOTS_TAG = "noindex, follow";

/** Public hyphen URLs rewrite to the one dynamic page. Direct /branchen/* redirects back. */
function branchenRewrites() {
  return listBranchenRoutes().map((route) => ({
    source: branchenPath(route.slug),
    destination: branchenInternalPath(route.slug),
  }));
}

function branchenRedirects() {
  return listBranchenRoutes().map((route) => ({
    source: branchenInternalPath(route.slug),
    destination: branchenPath(route.slug),
    permanent: true,
  }));
}

function branchenNoindexHeaders() {
  const header = { key: "X-Robots-Tag", value: BRANCHEN_ROBOTS_TAG };
  return listBranchenRoutes()
    .filter((route) => route.noindex)
    .flatMap((route) => [
      { source: branchenPath(route.slug), headers: [header] },
      { source: branchenInternalPath(route.slug), headers: [header] },
    ]);
}

const nextConfig: NextConfig = {
  // Neues Preismodell: Client-Komponenten (Hinweis je Frage) sehen nur, ob es aktiv ist. Kein Secret.
  env: {
    GOBD_PRICING_NEW_MODEL: ["v2", "v3"].includes((process.env.PRICING_MODEL ?? "").trim().toLowerCase()) ? "1" : "",
  },
  // The black “N” badge is the Next.js dev route indicator (dev hot-reloader
  // only). Production builds do not ship it; this also hides it in `next dev`.
  devIndicators: false,
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/blog": ["./content/blog/**/*"],
    "/blog/[slug]": ["./content/blog/**/*"],
    "/api/intake": ["./content/delivery-templates/**/*", "./public/brand/**/*"],
    "/api/delivery": ["./content/delivery-templates/**/*", "./public/brand/**/*"],
    "/api/document": ["./content/delivery-templates/**/*", "./public/brand/**/*"],
    "/api/docs/[id]/download": [
      "./content/delivery-templates/**/*",
      "./public/brand/**/*",
    ],
    "/api/internal/blob-smoke": [
      "./content/delivery-templates/**/*",
      "./public/brand/**/*",
    ],
    "/steuerberater": ["./content/delivery-templates/**/*"],
    "/steuerberater/muster": [
      "./content/delivery-templates/**/*",
      "./public/brand/**/*",
    ],
    "/steuerberater/muster/pdf": [
      "./content/delivery-templates/**/*",
      "./public/brand/**/*",
    ],
    "/muster": ["./content/delivery-templates/**/*"],
    "/muster/[bereich]": ["./content/delivery-templates/**/*"],
    "/muster/[bereich]/pdf": [
      "./content/delivery-templates/**/*",
      "./public/brand/**/*",
    ],
    "/muster/[bereich]/fragebogen": ["./public/brand/**/*"],
    "/resources/10-offene-punkte/download": ["./public/brand/**/*"],
    "/resources/inhalt-verfahrensdokumentation/download": ["./public/brand/**/*"],
    "/llms.txt": ["./content/faq.md", "./content/legal/**/*"],
    "/partner-angebot": ["./content/delivery-templates/**/*", "./public/brand/**/*"],
    "/branchen/[slug]": [
      "./content/branchen/**/*",
      "./content/blog/**/*",
      "./content/readiness/**/*",
    ],
  },
  async headers() {
    return [
      { source: "/portal", headers: noStoreHeaders },
      { source: "/billing", headers: noStoreHeaders },
      { source: "/account", headers: noStoreHeaders },
      { source: "/account/:path*", headers: noStoreHeaders },
      { source: "/checkout", headers: noStoreHeaders },
      { source: "/login", headers: noStoreHeaders },
      { source: "/admin/ampel", headers: ampelAdminHeaders },
      { source: "/api/admin/ampel-stats", headers: ampelAdminHeaders },
      // `:path+` is one or more segments. `:path*` also matches /kassen-check and would noindex the page.
      { source: "/kassen-check/:path+", headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }] },
      {
        source: PARTNER_ANGEBOT_PATH,
        headers: [
          { key: "X-Robots-Tag", value: PARTNER_ANGEBOT_ROBOTS_TAG },
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      ...branchenNoindexHeaders(),
      { source: "/api/stripe/portal", headers: noStoreHeaders },
      { source: "/:path*", headers: securityHeaders },
      // After the catch-all so Referrer-Policy no-referrer replaces strict-origin on token landings.
      ...tokenLandingHeaderRules(),
    ];
  },
  async redirects() {
    return [
      {
        source: "/partner",
        destination: "/steuerberater",
        permanent: true,
      },
      {
        source: "/konto",
        destination: "/login?next=/account",
        permanent: false,
      },
      // Neues Preismodell (CoS 28.10.): /partner-angebot leitet auf die Startseite (307).
      // Seite und Code bleiben; unter legacy (Rollback) bleibt die Seite erreichbar.
      ...(["v2", "v3"].includes(process.env.PRICING_MODEL?.trim().toLowerCase() ?? "")
        ? [{ source: PARTNER_ANGEBOT_PATH, destination: "/", permanent: false }]
        : []),
      ...branchenRedirects(),
    ];
  },
  async rewrites() {
    // Not a redirect to /account (that would skip Stripe). Only used if the
    // App Router page is missing from the production build, before the 404.
    // Branch pages: redirects run before rewrites, so /branchen/:slug sends
    // the browser to the hyphen URL, and that URL is rewritten back to the page.
    return {
      beforeFiles: branchenRewrites(),
      fallback: [
        { source: "/portal", destination: "/api/stripe/portal" },
        { source: "/billing", destination: "/api/stripe/portal" },
      ],
    };
  },
};

export default nextConfig;
