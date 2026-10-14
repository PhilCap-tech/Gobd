import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { AMPEL_PRIVACY_PARAGRAPHS, AMPEL_PRIVACY_TITLE } from "@/lib/ampel-questions";
import { datenschutzMarkdown } from "@/lib/legal-content";
import { LegalMarkdown, legalTitle } from "@/lib/legal-markdown";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Datenschutz",
  robots: { index: true, follow: true },
  alternates: { canonical: canonicalUrl("/datenschutz") },
};

function AmpelPrivacyParagraph({ paragraph }: { paragraph: string }) {
  const label = "Interne Auswertung:";
  if (paragraph.startsWith(label)) {
    return (
      <p>
        <strong>Interne Auswertung:</strong>
        {paragraph.slice(label.length)}
      </p>
    );
  }
  return <p>{paragraph}</p>;
}

export default function DatenschutzPage() {
  return (
    <LegalPage
      title={legalTitle(datenschutzMarkdown) || "Datenschutz"}
      crumbPath="/datenschutz"
    >
      <LegalMarkdown source={datenschutzMarkdown} />
      <section>
        <h2>{AMPEL_PRIVACY_TITLE}</h2>
        {AMPEL_PRIVACY_PARAGRAPHS.map((paragraph) => (
          <AmpelPrivacyParagraph key={paragraph.slice(0, 24)} paragraph={paragraph} />
        ))}
      </section>
    </LegalPage>
  );
}
