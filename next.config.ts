import type { NextConfig } from "next";

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  async headers() {
    return [
      { source: "/portal", headers: noStoreHeaders },
      { source: "/billing", headers: noStoreHeaders },
      { source: "/api/stripe/portal", headers: noStoreHeaders },
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
