// Public legal pages read these files. The leading blockquote is an
// internal draft banner and is stripped at render time.
import { readFileSync } from "node:fs";
import path from "node:path";

function readLegal(filename: string): string {
  return readFileSync(
    path.join(process.cwd(), "content", "legal", filename),
    "utf8",
  );
}

export const impressumMarkdown = readLegal("impressum.md");
export const datenschutzMarkdown = readLegal("datenschutz.md");
export const agbMarkdown = readLegal("agb.md");
export const cookiesMarkdown = readLegal("cookies.md");
export const produktDisclaimerMarkdown = readLegal("produkt-disclaimer.md");
