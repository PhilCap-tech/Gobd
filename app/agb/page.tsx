import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { agbMarkdown } from "@/lib/legal-content";
import { LegalMarkdown, legalTitle } from "@/lib/legal-markdown";

export const metadata: Metadata = {
  title: "AGB",
  robots: { index: false, follow: false },
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
