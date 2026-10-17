import Link from "next/link";
import { KassenCheckTeaser, kassenTeaserSplit } from "@/components/kassen-check-teaser";
import { CrumbJsonLd, JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BlogMarkdown } from "@/lib/blog-markdown";
import { HANDEL_MUSTER_HREF, HANDEL_MUSTER_LABEL } from "@/lib/branchen-links";
import {
  branchenBodyForMarkdown,
  branchenFaq,
  branchenPath,
  listBranchenFooterLinks,
  type BranchenSeite,
} from "@/lib/branchen";
import { faqPageJsonLd, productOfferJsonLd } from "@/lib/jsonld";
import { PRICE_MICRO, RESULT_PROMISE } from "@/lib/offer-copy";

export function BranchenPage({ seite }: { seite: BranchenSeite }) {
  const path = branchenPath(seite.slug);
  const faqs = branchenFaq(seite.body);
  const others = listBranchenFooterLinks().filter((item) => item.slug !== seite.slug);
  return (
    <>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: seite.h1, path },
        ]}
      />
      {faqs.length > 0 ? <JsonLd data={faqPageJsonLd(faqs)} /> : null}
      <JsonLd data={productOfferJsonLd()} />
      <SiteHeader backHref="/" backLabel="← Zur Startseite" />
      <main className="wrap page blog">
        <p className="kicker">{seite.branche}</p>
        <h1>{seite.h1}</h1>
        <BranchenBody slug={seite.slug} body={seite.body} />
        <nav className="related-links" aria-label="Weitere Branchenseiten">
          {others.map((item) => (
            <Link key={item.slug} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href={HANDEL_MUSTER_HREF}>{HANDEL_MUSTER_LABEL}</Link>
        </nav>
        <aside className="branchen-abschluss">
          <p>{RESULT_PROMISE}</p>
          <p>{PRICE_MICRO}</p>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}

function BranchenBody({ slug, body }: { slug: string; body: string }) {
  const teaser = kassenTeaserSplit(slug, body);
  if (!teaser) return <BlogMarkdown source={branchenBodyForMarkdown(body)} />;
  return (
    <>
      <BlogMarkdown source={branchenBodyForMarkdown(teaser.before)} />
      <KassenCheckTeaser variant={teaser.variant} />
      {teaser.after.trim() ? <BlogMarkdown source={branchenBodyForMarkdown(teaser.after)} /> : null}
    </>
  );
}
