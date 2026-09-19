import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatBlogDate, listPublishedPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Ratgeber zur GoBD-Verfahrensdokumentation für KMU und Handwerk. Arbeitshilfen, keine Steuerberatung.",
};

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zurück zur Landing" />
      <main className="wrap page blog">
        <p className="kicker">Ratgeber</p>
        <h1>Blog</h1>
        <p className="lead">
          Kurze Texte zur GoBD-Verfahrensdokumentation — als Arbeitshilfe, nicht
          als Steuerberatung.
        </p>
        {posts.length === 0 ? (
          <p className="prose">Noch keine Artikel.</p>
        ) : (
          <ul className="blog-index">
            {posts.map((post) => (
              <li key={post.slug}>
                <article>
                  <h2>
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  {post.date ? (
                    <p className="doc-meta">{formatBlogDate(post.date)}</p>
                  ) : null}
                  {post.description ? (
                    <p className="prose">{post.description}</p>
                  ) : null}
                  <p className="hint">
                    <Link href={`/blog/${post.slug}`}>Artikel lesen</Link>
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
