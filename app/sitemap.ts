import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/blog";
import { branchenPath, listBranchenSeiten } from "@/lib/branchen";
import { MODULE } from "@/lib/module/katalog";
import {
  gesamtMusterPath,
  modulMusterFragebogenPath,
  MUSTER_VORLAGEN,
} from "@/lib/module-muster";
import { INDEXABLE_STATIC_PATHS, SITEMAP_LASTMOD, canonicalUrl } from "@/lib/seo";

function dated(url: string, lastModified = SITEMAP_LASTMOD): MetadataRoute.Sitemap[number] {
  return { url, lastModified };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedPosts();
  const staticPages: MetadataRoute.Sitemap = INDEXABLE_STATIC_PATHS.map((path) =>
    dated(canonicalUrl(path)),
  );
  const blogPosts: MetadataRoute.Sitemap = posts.map((post) => {
    const lastModified = /^\d{4}-\d{2}-\d{2}$/.test(post.date) ? post.date : SITEMAP_LASTMOD;
    return dated(canonicalUrl(`/blog/${post.slug}`), lastModified);
  });
  const gesamt: MetadataRoute.Sitemap = MUSTER_VORLAGEN.map((vorlage) =>
    dated(canonicalUrl(gesamtMusterPath(vorlage))),
  );
  const moduleFragebogen: MetadataRoute.Sitemap = MODULE.map((modul) =>
    dated(canonicalUrl(modulMusterFragebogenPath(modul.id))),
  );
  const branchen: MetadataRoute.Sitemap = (await listBranchenSeiten())
    .filter((seite) => !seite.noindex)
    .map((seite) => dated(canonicalUrl(branchenPath(seite.slug)), seite.stand));
  return [
    ...staticPages,
    ...gesamt,
    ...moduleFragebogen,
    ...blogPosts,
    ...branchen,
  ];
}
