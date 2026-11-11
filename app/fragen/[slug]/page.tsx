import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CrumbJsonLd, JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BlogMarkdown } from "@/lib/blog-markdown";
import { formatBlogDate } from "@/lib/blog";
import {
  FRAGEN_INDEX_PATH,
  exactMetaDescription,
  fragenBodyForMarkdown,
  getFragenSeite,
  listFragenSeiten,
} from "@/lib/fragen";
import { fragenFaqJsonLd } from "@/lib/jsonld";
import { canonicalUrl } from "@/lib/seo";

export async function generateStaticParams() {
  const seiten = await listFragenSeiten();
  return seiten.map((seite) => ({ slug: seite.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seite = await getFragenSeite(slug);
  if (!seite) return { title: "Frage" };
  return {
    title: seite.frage,
    description: exactMetaDescription(seite.kurzantwort),
    robots: { index: true, follow: true },
    alternates: { canonical: canonicalUrl(seite.route) },
  };
}

export default async function FragenSeitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seite = await getFragenSeite(slug);
  if (!seite) notFound();

  return (
    <>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "Fragen", path: FRAGEN_INDEX_PATH },
          { name: seite.frage, path: seite.route },
        ]}
      />
      <JsonLd
        data={fragenFaqJsonLd({
          frage: seite.frage,
          antwort: seite.kurzantwort,
          dateModified: seite.stand,
          url: canonicalUrl(seite.route),
        })}
      />
      <SiteHeader backHref={FRAGEN_INDEX_PATH} backLabel="← Zu den Fragen" />
      <main className="wrap page blog">
        <p className="kicker">Fragen</p>
        <h1>{seite.frage}</h1>
        <BlogMarkdown source={fragenBodyForMarkdown(seite.body)} />
        <p className="doc-meta">Stand: {formatBlogDate(seite.stand)}</p>
        <p className="hint back-links">
          <Link href={FRAGEN_INDEX_PATH}>Alle Fragen</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
