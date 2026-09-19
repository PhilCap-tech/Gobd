import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { cookiesMarkdown } from "@/lib/legal-content";
import { LegalMarkdown, legalTitle } from "@/lib/legal-markdown";

export const metadata: Metadata = {
  title: "Cookies",
  robots: { index: false, follow: false },
};

export default function CookiesPage() {
  return (
    <LegalPage title={legalTitle(cookiesMarkdown) || "Cookies"}>
      <LegalMarkdown source={cookiesMarkdown} />
    </LegalPage>
  );
}
