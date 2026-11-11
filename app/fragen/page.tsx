import type { Metadata } from "next";
import Link from "next/link";
import { CrumbJsonLd, JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatBlogDate, listPublishedPosts } from "@/lib/blog";
import { listBranchenFooterLinks } from "@/lib/branchen";
import {
  FRAGEN_INDEX_H1,
  FRAGEN_INDEX_INTRO,
  FRAGEN_INDEX_PATH,
  exactMetaDescription,
  fragenZielLabel,
  groupFragenIndex,
  latestFragenStand,
  listFragenIndex,
  listFragenSeiten,
} from "@/lib/fragen";
import { fragenCollectionJsonLd } from "@/lib/jsonld";
import { canonicalUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: FRAGEN_INDEX_H1,
    description: exactMetaDescription(FRAGEN_INDEX_INTRO),
    robots: { index: true, follow: true },
    alternates: { canonical: canonicalUrl(FRAGEN_INDEX_PATH) },
  };
}

export default async function FragenIndexPage() {
  const [entries, seiten, posts] = await Promise.all([
    listFragenIndex(),
    listFragenSeiten(),
    listPublishedPosts(),
  ]);
  const stand = latestFragenStand(seiten);
  const blogTitles = new Map(posts.map((post) => [post.slug, post.title]));
  const branchenLabels = new Map(
    listBranchenFooterLinks().map((link) => [link.href, link.label]),
  );
  const groups = groupFragenIndex(entries);

  return (
    <>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "Fragen", path: FRAGEN_INDEX_PATH },
        ]}
      />
      <JsonLd
        data={fragenCollectionJsonLd({
          name: FRAGEN_INDEX_H1,
          dateModified: stand,
          url: canonicalUrl(FRAGEN_INDEX_PATH),
          items: entries.map((entry) => ({ name: entry.frage, path: entry.href })),
        })}
      />
      <SiteHeader backHref="/" backLabel="← Zurück zur Landing" />
      <main className="wrap page blog">
        <p className="kicker">Fragen</p>
        <h1>{FRAGEN_INDEX_H1}</h1>
        <p className="lead">{FRAGEN_INDEX_INTRO}</p>
        {stand ? <p className="doc-meta">Stand: {formatBlogDate(stand)}</p> : null}
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`fragen-${group.key}`}>
            <h2 id={`fragen-${group.key}`}>{group.title}</h2>
            <ul className="fragen-index">
              {group.entries.map((entry) => (
                <li key={entry.slug}>
                  <h3>
                    <Link href={entry.href}>{entry.frage}</Link>
                  </h3>
                  {entry.kurzantwort ? <p className="prose">{entry.kurzantwort}</p> : null}
                  {entry.moreHrefs.map((href) => (
                    <p className="hint" key={href}>
                      <Link href={href}>{fragenZielLabel(href, blogTitles, branchenLabels)}</Link>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
