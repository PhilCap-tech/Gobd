import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), "utf8");

const schema = JSON.parse(read("chapter-schema.json"));
const openPointsRules = JSON.parse(read("open-points-rules.json"));
const disclaimer = read("disclaimer.txt").trim();
const version = read("VERSION").trim();
const coverMarkdown = read("chapters/00-cover.md");

const chapters = schema.chapters
  .filter((chapter) => chapter.role !== "cover" && chapter.id !== "00-cover")
  .map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    file: chapter.templateFile,
    markdown: read(chapter.templateFile),
  }));

const bundle = {
  version,
  disclaimer,
  coverFile: "chapters/00-cover.md",
  coverMarkdown,
  chapters,
  openPointsRules,
};

writeFileSync(join(root, "bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`bundle.json geschrieben (${chapters.length} Kapitel, v${version})`);
