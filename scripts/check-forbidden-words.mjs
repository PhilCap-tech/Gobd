// Fails the build when public legal copy still contains draft markers.
// Scope is the legal pages, the FAQ that restates them, and the modules that
// render that copy. Generator templates keep the word Platzhalter for unfilled
// PDF fields; those files are outside this check.
import { globSync, readFileSync } from "node:fs";

const forbidden =
  /\b(TODO|Counsel|Variante B|Platzhalter|Go-Live|Soft-CTA|Primär-CTA|Pillar)\b|\[klären/i; // allow-forbidden

const patterns = [
  "content/legal/**/*.{md,mdx}",
  "content/faq.md",
  "lib/legal-content.ts",
  "lib/legal-markdown.tsx",
  "lib/offer-copy.ts",
  "app/datenschutz/**/*.{ts,tsx}",
  "app/agb/**/*.{ts,tsx}",
  "app/cookies/**/*.{ts,tsx}",
  "app/impressum/**/*.{ts,tsx}",
  "app/faq/**/*.{ts,tsx}",
];

const files = patterns.flatMap((pattern) => globSync(pattern));
let failed = false;

if (files.length === 0) {
  console.error("check-forbidden-words: no files matched");
  process.exit(1);
}

for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (forbidden.test(line) && !line.includes("// allow-forbidden")) {
        console.error(`${file}:${index + 1}: ${line.trim()}`);
        failed = true;
      }
    });
}

if (failed) {
  process.exit(1);
}

console.log(`check-forbidden-words: ok (${files.length} files)`);
