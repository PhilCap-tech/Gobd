import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { agbMarkdown } from "@/lib/legal-content";
import { LegalMarkdown, legalTitle } from "@/lib/legal-markdown";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AGB",
  robots: { index: true, follow: true },
  alternates: { canonical: canonicalUrl("/agb") },
};

export default function AgbPage() {
  return (
    <LegalPage
      title={
        legalTitle(agbMarkdown) || "Allgemeine Geschäftsbedingungen"
      }
    >
      <LegalMarkdown source={agbMarkdown} />
    </LegalPage>
  );
}
