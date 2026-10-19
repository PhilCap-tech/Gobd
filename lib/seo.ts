import type { Metadata } from "next";
import { CANONICAL_PRODUCTION_APP_URL } from "@/lib/env";

/** Production origin for canonical links and the sitemap. No trailing slash. */
export const SITE_ORIGIN = CANONICAL_PRODUCTION_APP_URL;

/**
 * Homepage URL. `https://gobd-doku-erstellen.de` answers 308 with
 * `Location: https://www.gobd-doku-erstellen.de/` — the slash is part of
 * the target. Other paths stay without one (`/faq/` 308s to `/faq`).
 *
 * Next's metadata resolver rewrites a root URL to the bare origin, so the
 * homepage prints this string on a `<link rel="canonical">` and `og:url`
 * instead of `alternates.canonical` / `openGraph.url`.
 */
export const HOME_CANONICAL_URL = `${SITE_ORIGIN}/`;

export const SITE_NAME = "GoBD Verfahrensdoku";

/** Default document title. Same string the homepage has used as its title. */
export const HOME_TITLE =
  "GoBD-Verfahrensdokumentation online erstellen | GoBD Verfahrensdoku";

/** Default meta description. Same string the homepage has used. */
export const HOME_DESCRIPTION =
  "GoBD-Verfahrensdokumentation online erstellen: strukturierte digitale Dokumentation für KMU & Handwerk — PDF plus offene Punkte. Kein Steuerberatungsersatz.";

/** Static Open Graph image served by `app/opengraph-image.tsx` (1200×630). */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: HOME_TITLE,
} as const;

export function withOgImage(
  openGraph: NonNullable<Metadata["openGraph"]>,
): NonNullable<Metadata["openGraph"]> {
  return { ...openGraph, images: [OG_IMAGE] };
}

/** Shared fields for routes that do not set their own Open Graph block. */
export const ROOT_OPEN_GRAPH = withOgImage({
  siteName: SITE_NAME,
  locale: "de_DE",
  type: "website",
});

export const ROOT_TWITTER: NonNullable<Metadata["twitter"]> = {
  card: "summary_large_image",
};

/** Homepage share tags. Title and description match the document metadata. */
export const HOME_OPEN_GRAPH = withOgImage({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  siteName: SITE_NAME,
  locale: "de_DE",
  type: "website",
});

export const HOME_TWITTER: NonNullable<Metadata["twitter"]> = {
  card: "summary_large_image",
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  images: [OG_IMAGE.url],
};

/**
 * HTML routes that are index, follow.
 * Blog posts are appended in `app/sitemap.ts`.
 * Branch pages (`/verfahrensdokumentation-<slug>`) are not listed here.
 * `app/sitemap.ts` adds one only when its frontmatter `noindex` is false.
 * Left out on purpose: /steuerberater/muster, /steuerberater/demo,
 * confirmation, DOI and unsubscribe pages, /readiness, /checkout,
 * /intake, /login, and account/admin areas.
 */
export const INDEXABLE_STATIC_PATHS = [
  "/",
  "/blog",
  "/faq",
  "/ampel-check",
  "/ampel-check/quellen",
  "/kassen-check",
  "/resources/10-offene-punkte",
  "/resources/inhalt-verfahrensdokumentation",
  "/muster",
  "/steuerberater",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/cookies",
] as const;

/** Absolute production URL. "/" is `HOME_CANONICAL_URL` (trailing slash). */
export function canonicalUrl(path: string): string {
  if (path === "/" || path === "") return HOME_CANONICAL_URL;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
