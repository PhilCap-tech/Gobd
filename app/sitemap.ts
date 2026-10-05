import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/blog";
import { BEREICHE } from "@/lib/bereiche";
import { musterPath } from "@/lib/bereich-muster";
import { MODULE } from "@/lib/module/katalog";
import {
  gesamtMusterPath,
  modulMusterFragebogenPath,
  MUSTER_VORLAGEN,
} from "@/lib/module-muster";
import { INDEXABLE_STATIC_PATHS, canonicalUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedPosts();
  const staticPages: MetadataRoute.Sitemap = INDEXABLE_STATIC_PATHS.map((path) => ({
    url: canonicalUrl(path),
  }));
  const blogPosts: MetadataRoute.Sitemap = posts.map((post) => {
    const lastModified = /^\d{4}-\d{2}-\d{2}$/.test(post.date) ? post.date : undefined;
    return {
      url: canonicalUrl(`/blog/${post.slug}`),
      ...(lastModified ? { lastModified } : {}),
    };
  });
  const gesamt: MetadataRoute.Sitemap = MUSTER_VORLAGEN.map((vorlage) => ({
    url: canonicalUrl(gesamtMusterPath(vorlage)),
  }));
  const legacy: MetadataRoute.Sitemap = BEREICHE.map((bereich) => ({
    url: canonicalUrl(musterPath(bereich.id)),
  }));
  const moduleFragebogen: MetadataRoute.Sitemap = MODULE.map((modul) => ({
    url: canonicalUrl(modulMusterFragebogenPath(modul.id)),
  }));
  return [...staticPages, ...gesamt, ...legacy, ...moduleFragebogen, ...blogPosts];
}
