import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { LegalPage } from "@/components/legal-page";
import { BRANCHEN_LINKS } from "@/lib/branchen-links";
import { faqEntries, readFaqMarkdown } from "@/lib/faq-entries";
import { faqPageJsonLd } from "@/lib/jsonld";
import { LegalMarkdown } from "@/lib/legal-markdown";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Antworten zu Lieferumfang, Ablauf, Updates, Support und Disclaimer der GoBD-Verfahrensdokumentation. Keine Steuerberatung und keine Rechtsberatung.",
  alternates: { canonical: canonicalUrl("/faq") },
};

export default function FaqPage() {
  const source = readFaqMarkdown();
  return (
    <>
      <JsonLd data={faqPageJsonLd(faqEntries(source))} />
      <LegalPage title="FAQ" crumbPath="/faq">
        <LegalMarkdown source={source} />
        <p className="related-links">
          Branchenseiten:{" "}
          {BRANCHEN_LINKS.map((item, index) => (
            <span key={item.slug}>
              {index > 0 ? " · " : null}
              <Link href={item.href}>{item.label}</Link>
            </span>
          ))}
        </p>
      </LegalPage>
    </>
  );
}
