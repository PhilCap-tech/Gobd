import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { impressumMarkdown } from "@/lib/legal-content";
import { LegalMarkdown, legalTitle } from "@/lib/legal-markdown";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Impressum",
  robots: { index: true, follow: true },
  alternates: { canonical: canonicalUrl("/impressum") },
};

export default function ImpressumPage() {
  return (
    <LegalPage title={legalTitle(impressumMarkdown) || "Impressum"}>
      <LegalMarkdown source={impressumMarkdown} />
    </LegalPage>
  );
}
