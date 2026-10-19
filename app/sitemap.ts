import type { MetadataRoute } from "next";
import { listPublishedPosts, type BlogPost } from "@/lib/blog";
import { branchenPath, listBranchenSeiten } from "@/lib/branchen";
import { MODULE } from "@/lib/module/katalog";
import {
  gesamtMusterPath,
  modulMusterFragebogenPath,
  MUSTER_VORLAGEN,
} from "@/lib/module-muster";
import { INDEXABLE_STATIC_PATHS, canonicalUrl } from "@/lib/seo";
import { isIsoDate, sourceLastmod } from "@/lib/source-date";

/**
 * One source file per static URL. lastmod is that file's last commit.
 * `/blog` prefers the newest article modification (the index changes
 * when an article does).
 */
const STATIC_SOURCES: Record<(typeof INDEXABLE_STATIC_PATHS)[number], string> = {
  "/": "app/page.tsx",
  "/blog": "app/blog/page.tsx",
  "/faq": "content/faq.md",
  "/ampel-check": "app/ampel-check/page.tsx",
  "/ampel-check/quellen": "lib/ampel-questions.ts",
  "/kassen-check": "app/kassen-check/page.tsx",
  "/resources/10-offene-punkte": "lib/lead-magnet.ts",
  "/resources/inhalt-verfahrensdokumentation": "lib/lead-magnet-inhalt.ts",
  "/muster": "app/muster/page.tsx",
  "/steuerberater": "app/steuerberater/page.tsx",
  "/impressum": "content/legal/impressum.md",
  "/datenschutz": "content/legal/datenschutz.md",
  "/agb": "content/legal/agb.md",
  "/cookies": "content/legal/cookies.md",
};

const MUSTER_SOURCE = "lib/module-muster-dense.ts";
const MODULE_SOURCE = "lib/module/katalog.ts";

function dated(url: string, lastModified: string): MetadataRoute.Sitemap[number] {
  return { url, lastModified };
}

function laterDate(current: string, candidate: string): string {
  if (!isIsoDate(candidate)) return current;
  if (!isIsoDate(current)) return candidate;
  return candidate > current ? candidate : current;
}

function blogIndexLastmod(posts: BlogPost[]): string {
  return posts.reduce(
    (latest, post) => laterDate(latest, post.dateModified),
    sourceLastmod(STATIC_SOURCES["/blog"]),
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedPosts();
  const staticPages: MetadataRoute.Sitemap = INDEXABLE_STATIC_PATHS.map((path) =>
    dated(
      canonicalUrl(path),
      path === "/blog" ? blogIndexLastmod(posts) : sourceLastmod(STATIC_SOURCES[path]),
    ),
  );
  const blogPosts: MetadataRoute.Sitemap = posts.map((post) =>
    dated(
      canonicalUrl(`/blog/${post.slug}`),
      isIsoDate(post.dateModified)
        ? post.dateModified
        : sourceLastmod(post.sourceFile, post.date),
    ),
  );
  const musterLastmod = sourceLastmod(MUSTER_SOURCE);
  const moduleLastmod = sourceLastmod(MODULE_SOURCE);
  const gesamt: MetadataRoute.Sitemap = MUSTER_VORLAGEN.map((vorlage) =>
    dated(canonicalUrl(gesamtMusterPath(vorlage)), musterLastmod),
  );
  const moduleFragebogen: MetadataRoute.Sitemap = MODULE.map((modul) =>
    dated(canonicalUrl(modulMusterFragebogenPath(modul.id)), moduleLastmod),
  );
  const branchen: MetadataRoute.Sitemap = (await listBranchenSeiten())
    .filter((seite) => !seite.noindex)
    .map((seite) =>
      dated(
        canonicalUrl(branchenPath(seite.slug)),
        sourceLastmod(`content/branchen/${seite.slug}.md`, seite.stand),
      ),
    );
  return [
    ...staticPages,
    ...gesamt,
    ...moduleFragebogen,
    ...blogPosts,
    ...branchen,
  ];
}
