import type { MetadataRoute } from "next";
import { INDEXABLE_STATIC_PATHS, canonicalUrl } from "@/lib/seo";

/**
 * `/` keeps every public page allowed, including ones added later.
 * The extra Allow lines name /llms.txt, the sitemap, checkout, and the
 * indexable pages so a crawler can see them without guessing.
 * `/api/` stays disallowed. `/api/checkout` is the only exception.
 *
 * Precedence is the longest matching path (RFC 9309), not file order.
 * `/api/checkout` is longer than `/api/` and has no trailing slash, so it
 * matches POST /api/checkout and wins. A trailing slash would miss that URL.
 * The line is first in this group: Next emits every Allow before Disallow,
 * and a first-match crawler then hits it before `Allow: /`.
 * There is no other public order API.
 */
const ALLOW = [
  "/api/checkout",
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
