import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { datenschutzMarkdown } from "@/lib/legal-content";
import { LegalMarkdown, legalTitle } from "@/lib/legal-markdown";

export const metadata: Metadata = {
  title: "Datenschutz",
  robots: { index: false, follow: false },
};

export default function DatenschutzPage() {
  return (
    <LegalPage title={legalTitle(datenschutzMarkdown) || "Datenschutz"}>
      <LegalMarkdown source={datenschutzMarkdown} />
    </LegalPage>
  );
}
