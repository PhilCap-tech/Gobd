import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BlogMarkdown } from "@/lib/blog-markdown";
import {
  formatBlogDate,
  getPublishedPost,
  listPublishedPosts,
} from "@/lib/blog";

export async function generateStaticParams() {
  const posts = await listPublishedPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) {
    return { title: "Artikel" };
  }
  return {
    title: { absolute: post.metaTitle },
    description: post.metaDescription,
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  return (
    <>
      <SiteHeader backHref="/blog" backLabel="← Zum Blog" />
      <main className="wrap page blog">
        <p className="kicker">Blog</p>
        <h1>{post.h1}</h1>
        {post.date ? (
          <p className="doc-meta">{formatBlogDate(post.date)}</p>
        ) : null}
        <BlogMarkdown source={post.body} />
        <p className="hint back-links">
          <Link href="/blog">Alle Artikel</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
