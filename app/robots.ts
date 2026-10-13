import type { MetadataRoute } from "next";
import { INDEXABLE_STATIC_PATHS, canonicalUrl } from "@/lib/seo";

/**
 * `/` keeps every public page allowed, including ones added later.
 * The extra Allow lines name /llms.txt, the sitemap, checkout, and the
 * indexable pages so a crawler can see them without guessing.
 * `/api/` stays disallowed. There is no public order API.
 */
const ALLOW = [
  "/",
  "/llms.txt",
  "/sitemap.xml",
  "/checkout",
  ...INDEXABLE_STATIC_PATHS.filter((path) => path !== "/"),
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ALLOW,
      // API routes are not documents. Leave noindex pages crawlable
      // (/checkout, /login, /readiness, /account) so the meta robots tag is visible.
      disallow: "/api/",
    },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
