import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API routes are not documents. Leave noindex pages crawlable
      // (/checkout, /login, /readiness, /account) so the meta robots tag is visible.
      disallow: "/api/",
    },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
