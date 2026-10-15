import { CrumbJsonLd, JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BlogMarkdown } from "@/lib/blog-markdown";
import {
  branchenBodyForMarkdown,
  branchenFaq,
  branchenPath,
  type BranchenSeite,
} from "@/lib/branchen";
import { faqPageJsonLd } from "@/lib/jsonld";
import { PRICE_MICRO, RESULT_PROMISE } from "@/lib/offer-copy";

export function BranchenPage({ seite }: { seite: BranchenSeite }) {
  const path = branchenPath(seite.slug);
  const faqs = branchenFaq(seite.body);
  return (
    <>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: seite.h1, path },
        ]}
      />
      {faqs.length > 0 ? <JsonLd data={faqPageJsonLd(faqs)} /> : null}
      <SiteHeader backHref="/" backLabel="← Zur Startseite" />
      <main className="wrap page blog">
        <p className="kicker">{seite.branche}</p>
        <h1>{seite.h1}</h1>
        <BlogMarkdown source={branchenBodyForMarkdown(seite.body)} />
        <aside className="branchen-abschluss">
          <p>{RESULT_PROMISE}</p>
          <p>{PRICE_MICRO}</p>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}
