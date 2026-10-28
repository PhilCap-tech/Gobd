import { existsSync } from "node:fs";
import path from "node:path";
import { readContentWithConditions } from "@/lib/legal-content";
import { markdownToPlain } from "@/lib/markdown-section";
import { isPricingV2 } from "@/lib/pricing-model";

export type FaqEntry = {
  question: string;
  answer: string;
};

/** Neues Modell: FAQ nur, wenn `content/faq-v3.md` existiert (CoS 28.10.). */
export const FAQ_V3_FILE = "faq-v3.md";

/**
 * Gibt es eine FAQ? Legacy: immer. Neues Modell: nur mit `content/faq-v3.md`;
 * `faq-v2.md` (alter v2-Stand) wird nirgends mehr gezeigt.
 */
export function faqAvailable(): boolean {
  return !isPricingV2() || existsSync(path.join(process.cwd(), "content", FAQ_V3_FILE));
}

/** FAQ-Markdown; im neuen Modell ohne faq-v3.md leer. */
export function readFaqMarkdown(): string {
  if (!isPricingV2()) return readContentWithConditions("faq.md");
  return faqAvailable() ? readContentWithConditions(FAQ_V3_FILE) : "";
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
