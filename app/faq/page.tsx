import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { LegalPage } from "@/components/legal-page";
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
      </LegalPage>
    </>
  );
}
