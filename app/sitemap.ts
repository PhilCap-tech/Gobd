import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/blog";
import { INDEXABLE_STATIC_PATHS, canonicalUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedPosts();
  const staticPages: MetadataRoute.Sitemap = INDEXABLE_STATIC_PATHS.map(
    (path) => ({
      url: canonicalUrl(path),
    }),
  );
  const blogPosts: MetadataRoute.Sitemap = posts.map((post) => {
    const lastModified = /^\d{4}-\d{2}-\d{2}$/.test(post.date)
      ? post.date
      : undefined;
    return {
      url: canonicalUrl(`/blog/${post.slug}`),
      ...(lastModified ? { lastModified } : {}),
    };
  });
  return [...staticPages, ...blogPosts];
}
