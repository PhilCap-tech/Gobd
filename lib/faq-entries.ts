import { readFileSync } from "node:fs";
import path from "node:path";
import { markdownToPlain } from "@/lib/markdown-section";

export type FaqEntry = {
  question: string;
  answer: string;
};

export function readFaqMarkdown(): string {
  return readFileSync(path.join(process.cwd(), "content", "faq.md"), "utf8");
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
