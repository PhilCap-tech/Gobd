import { CANONICAL_PRODUCTION_APP_URL } from "@/lib/env";

/** Production origin for canonical links and the sitemap. No trailing slash. */
export const SITE_ORIGIN = CANONICAL_PRODUCTION_APP_URL;

/**
 * HTML routes that are index, follow.
 * Blog posts are appended in `app/sitemap.ts`.
 * Left out on purpose: /steuerberater (noindex), /readiness, /checkout,
 * /intake, /login, and account/admin areas.
 */
export const INDEXABLE_STATIC_PATHS = [
  "/",
  "/blog",
  "/faq",
  "/resources/10-offene-punkte",
  "/resources/inhalt-verfahrensdokumentation",
  "/muster",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/cookies",
] as const;

/** Absolute production URL. "/" is the origin without a trailing slash. */
export function canonicalUrl(path: string): string {
  if (path === "/" || path === "") return SITE_ORIGIN;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
