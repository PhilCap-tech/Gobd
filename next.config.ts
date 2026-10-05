import type { NextConfig } from "next";

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
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com https://connect.facebook.net https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com https://ssl.google-analytics.com https://www.googletagmanager.com https://www.google.com https://www.google.de https://googleads.g.doubleclick.net https://www.googleadservices.com https://stats.g.doubleclick.net https://www.facebook.com",
  "font-src 'self'",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.google.com https://www.google.de https://www.googleadservices.com https://pagead2.googlesyndication.com https://ad.doubleclick.net https://www.facebook.com https://connect.facebook.net https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://td.doubleclick.net",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
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

const nextConfig: NextConfig = {
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
    "/steuerberater": ["./content/delivery-templates/**/*"],
    "/steuerberater/muster": [
      "./content/delivery-templates/**/*",
      "./public/brand/**/*",
    ],
    "/steuerberater/muster/pdf": [
      "./content/delivery-templates/**/*",
      "./public/brand/**/*",
    ],
    "/resources/10-offene-punkte/download": ["./public/brand/**/*"],
    "/resources/inhalt-verfahrensdokumentation/download": ["./public/brand/**/*"],
  },
  async headers() {
    return [
      { source: "/portal", headers: noStoreHeaders },
      { source: "/billing", headers: noStoreHeaders },
      { source: "/api/stripe/portal", headers: noStoreHeaders },
      { source: "/:path*", headers: securityHeaders },
    ];
  },
  async redirects() {
    return [
      {
        source: "/partner",
        destination: "/steuerberater",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // Not a redirect to /account (that would skip Stripe). Only used if the
    // App Router page is missing from the production build, before the 404.
    return {
      fallback: [
        { source: "/portal", destination: "/api/stripe/portal" },
        { source: "/billing", destination: "/api/stripe/portal" },
      ],
    };
  },
};

export default nextConfig;
