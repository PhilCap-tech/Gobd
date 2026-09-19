import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LegalMarkdown } from "@/lib/legal-markdown";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Antworten zu Lieferumfang, Ablauf, Updates, Support und Disclaimer der GoBD-Verfahrensdokumentation. Keine Steuerberatung und keine Rechtsberatung.",
};

async function faqMarkdown() {
  return readFile(path.join(process.cwd(), "content", "faq.md"), "utf8");
}

export default async function FaqPage() {
  const source = await faqMarkdown();
  return (
    <LegalPage title="FAQ">
      <LegalMarkdown source={source} />
    </LegalPage>
  );
}
