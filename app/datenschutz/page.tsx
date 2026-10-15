import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { AMPEL_PRIVACY_PARAGRAPHS, AMPEL_PRIVACY_TITLE } from "@/lib/ampel-questions";
import { KANZLEI_PRIVACY_PARAGRAPHS, KANZLEI_PRIVACY_TITLE } from "@/lib/kanzlei-copy";
import { datenschutzMarkdown } from "@/lib/legal-content";
import { LegalMarkdown, legalTitle } from "@/lib/legal-markdown";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Datenschutz",
  robots: { index: true, follow: true },
  alternates: { canonical: canonicalUrl("/datenschutz") },
};

const BOLD_LABELS = ["Interne Auswertung:", "Speicherdauer:", "Widerruf und Ihre Rechte:"] as const;

function PrivacyParagraph({ paragraph }: { paragraph: string }) {
  const label = BOLD_LABELS.find((item) => paragraph.startsWith(item));
  if (!label) return <p>{paragraph}</p>;
  return (
    <p>
      <strong>{label}</strong>
      {paragraph.slice(label.length)}
    </p>
  );
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
          <PrivacyParagraph key={paragraph.slice(0, 48)} paragraph={paragraph} />
        ))}
      </section>
      <section>
        <h2 id="kanzlei-merkblatt">{KANZLEI_PRIVACY_TITLE}</h2>
        {KANZLEI_PRIVACY_PARAGRAPHS.map((paragraph) => (
          <PrivacyParagraph key={paragraph.slice(0, 48)} paragraph={paragraph} />
        ))}
      </section>
    </LegalPage>
  );
}
