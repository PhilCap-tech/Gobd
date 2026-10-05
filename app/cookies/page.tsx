import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { cookiesMarkdown } from "@/lib/legal-content";
import { LegalMarkdown, legalTitle } from "@/lib/legal-markdown";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Cookies",
  robots: { index: true, follow: true },
  alternates: { canonical: canonicalUrl("/cookies") },
};

export default function CookiesPage() {
  return (
    <LegalPage title={legalTitle(cookiesMarkdown) || "Cookies"}>
      <LegalMarkdown source={cookiesMarkdown} />
    </LegalPage>
  );
}
