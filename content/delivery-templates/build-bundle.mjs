import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), "utf8");

const schema = JSON.parse(read("chapter-schema.json"));
const openPointsRules = JSON.parse(read("open-points-rules.json"));
const disclaimer = read("disclaimer.txt").trim();
const coverMarkdown = read("cover.md");

const chapters = schema.chapters
  .filter((chapter) => chapter.id !== "cover")
  .map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    file: chapter.templateFile,
    shortFile: chapter.shortFile,
    markdown: read(chapter.templateFile),
    markdownShort: chapter.shortFile ? read(chapter.shortFile) : undefined,
  }));

const bundle = {
  version: "2.0.0",
  outline: "v2",
  disclaimer,
  coverFile: "cover.md",
  coverMarkdown,
  chapters,
  openPointsRules,
};

writeFileSync(join(root, "bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`bundle.json geschrieben (${chapters.length} Kapitel, Outline ${bundle.outline})`);
