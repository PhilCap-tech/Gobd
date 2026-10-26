import { readContentWithConditions } from "@/lib/legal-content";
import { markdownToPlain } from "@/lib/markdown-section";
import { isPricingV2 } from "@/lib/pricing-model";

export type FaqEntry = {
  question: string;
  answer: string;
};

/** Preismodell v2: FAQ-Fassung von Legal (`content/faq-v2.md`); Löschtexte nur mit RETENTION_DELETE_ENABLED. */
export function readFaqMarkdown(): string {
  return readContentWithConditions(isPricingV2() ? "faq-v2.md" : "faq.md");
}

/** H2 sections of `content/faq.md`, heading text included as written. */
export function faqEntries(markdown: string): FaqEntry[] {
  const lines = markdown.split(/\r?\n/);
  const entries: FaqEntry[] = [];
  let question = "";
  let body: string[] = [];

  const flush = () => {
    const answer = markdownToPlain(body.join("\n"));
    if (question && answer) entries.push({ question, answer });
    question = "";
    body = [];
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      question = line.slice(3).trim();
      continue;
    }
    if (line.trim() === "---") {
      flush();
      continue;
    }
    if (question) body.push(line);
  }
  flush();
  return entries;
}
