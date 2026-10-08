// Fails the build when public copy still contains draft markers.
// Legal scope: legal pages, the FAQ that restates them, and the modules that
// render that copy. Generator templates keep the word Platzhalter for unfilled
// PDF fields; those files are outside this check.
// Blog scope: visible article copy only (rendered frontmatter plus body).
// Internal labels there fail the build. Ordinary prose does not.
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

const blogPatterns = ["content/blog/**/*.{md,mdx}"];

const visibleFrontmatter = new Set([
  "title",
  "h1",
  "description",
  "metaTitle",
  "metaDescription",
]);

// Token markers use a word boundary so they do not fire inside ordinary words
// (Soft-Vergleich, Platzhaltertext, klären). Platzhalter as a German noun inside
// a sentence is editorial copy; only a label form is a draft marker.
const blogToken =
  /\b(?:Soft(?:[-\s]+)?CTA|Hard(?:[-\s]+)?CTA|TODO|FIXME|TBD|TBA|XXX|WIP|DRAFT|PLACEHOLDER|CHANGEME|NOCOMMIT)\b|\[\s*(?:klären|TODO|FIXME|TBD|TBA|XXX|WIP|DRAFT|Platzhalter|PLACEHOLDER)\s*\]|\{\{\s*(?:Platzhalter|PLACEHOLDER)\s*\}\}|\bLorem\s+ipsum\b/i;

function stripUrls(line) {
  return line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/<https?:\/\/[^>\s]+>/g, "")
    .replace(/https?:\/\/\S+/g, "");
}

function platzhalterLabel(visible) {
  const plain = visible
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/[*_~`]/g, "")
    .trim();
  if (/^Platzhalters?\s*[:.!?…\-–—]*\s*$/i.test(plain)) return true;
  if (/^Platzhalter\s*[:\-–—]\s*\S/i.test(plain)) return true;
  return false;
}

function isBlogMarker(visible) {
  if (!visible.trim()) return false;
  if (blogToken.test(visible)) return true;
  return platzhalterLabel(visible);
}

function fenceChar(line) {
  const match = line.match(/^\s*(`{3,}|~{3,})/);
  return match ? match[1][0] : null;
}

function isCodeComment(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*/") ||
    /^\*(?:\s|$)/.test(trimmed) ||
    /^#(?:\s|$)/.test(trimmed) ||
    trimmed.startsWith("#!") ||
    /^--(?:\s|$)/.test(trimmed)
  );
}

function visibleFromComments(line, state) {
  let out = "";
  let rest = line;
  while (rest.length) {
    if (state.inComment) {
      const end = rest.indexOf("-->");
      if (end === -1) return out;
      state.inComment = false;
      rest = rest.slice(end + 3);
      continue;
    }
    const start = rest.indexOf("<!--");
    if (start === -1) return out + rest;
    out += rest.slice(0, start);
    state.inComment = true;
    rest = rest.slice(start + 4);
  }
  return out;
}

function blogMarkerHits(raw) {
  const lines = raw.split("\n");
  const hits = [];
  let inFrontmatter = lines[0]?.replace(/\r$/, "").trim() === "---";
  let fence = null;
  const comment = { inComment: false };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/\r$/, "");
    if (inFrontmatter) {
      if (index > 0 && line.trim() === "---") {
        inFrontmatter = false;
        continue;
      }
      if (index === 0) continue;
      const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (!kv || !visibleFrontmatter.has(kv[1])) continue;
      if (isBlogMarker(stripUrls(kv[2]))) {
        hits.push({ line: index + 1, text: line.trim() });
      }
      continue;
    }

    const opened = fenceChar(line);
    if (!fence && opened) {
      fence = opened;
      continue;
    }
    if (fence) {
      if (opened === fence) {
        fence = null;
        continue;
      }
      if (isCodeComment(line)) continue;
      if (isBlogMarker(stripUrls(line))) {
        hits.push({ line: index + 1, text: line.trim() });
      }
      continue;
    }

    const visible = stripUrls(visibleFromComments(line, comment));
    if (isBlogMarker(visible)) {
      hits.push({ line: index + 1, text: line.trim() });
    }
  }
  return hits;
}

function assertSelfTest() {
  const cases = [
    ["soft heading", "## Soft-CTA: Readiness-Check\n\nAbsatz.\n", true],
    ["soft space h3", "### Soft CTA\n", true],
    ["hard heading", "## Hard-CTA: Checkout\n", true],
    ["soft vergleich", "## Soft-Vergleich: worauf du achten kannst\n", false],
    ["readiness sentence", "Mach den [Readiness-Check](/readiness).\n", false],
    ["platzhalter sentence", "- oder nur Platzhalter?\n", false],
    ["platzhalter compound", "Platzhaltertexte streichen.\n", false],
    ["platzhaltertext", "nicht mit Platzhaltertext.\n", false],
    ["platzhalter heading", "## Platzhalter\n", true],
    ["platzhalter label", "Platzhalter: Firmenname\n", true],
    ["klaeren prose", "klären Sie das mit Ihrer Steuerberatung.\n", false],
    ["klaeren bracket", "Offen: [klären]\n", true],
    ["todo", "TODO: Abschnitt fehlt\n", true],
    ["fixme", "FIXME\n", true],
    ["tbd", "Stand: TBD\n", true],
    ["lorem", "Lorem ipsum dolor sit amet\n", true],
    ["xxx", "Wert XXX einsetzen\n", true],
    ["pillar prose", "Details im Pillar nachlesen.\n", false],
    // Published section heading, not a draft token. Flagging it would fail
    // articles this check is meant to leave green.
    ["primaer heading", "## Primär-CTA: Verfahrensdokumentation erstellen\n", false],
    [
      "frontmatter hidden",
      '---\ntitle: "Artikel"\nctaSoft: "/readiness"\nstatus: "ready-for-publish"\n---\n\nAbsatz.\n',
      false,
    ],
    ["title marker", '---\ntitle: "TODO Artikel"\n---\n\nAbsatz.\n', true],
    ["html comment", "<!-- TODO: intern -->\n\nAbsatz ohne Marker.\n", false],
    ["fence comment", "```\n// TODO: not article copy\nconst ready = true;\n```\n", false],
    ["fence visible", "```\nTODO\n```\n", true],
    ["fence heading", "```\n## Soft-CTA: Readiness-Check\n```\n", true],
    ["url only", "Siehe [Artikel](https://example.com/todo-liste).\n", false],
    ["link text", "Siehe [TODO](/intern).\n", true],
  ];

  for (const [name, source, expectHit] of cases) {
    const hit = blogMarkerHits(source).length > 0;
    if (hit !== expectHit) {
      console.error(
        `check-forbidden-words: self-test failed (${name}, expected ${expectHit ? "hit" : "clean"})`,
      );
      process.exit(1);
    }
  }
}

assertSelfTest();

const files = patterns.flatMap((pattern) => globSync(pattern));
const blogFiles = blogPatterns.flatMap((pattern) => globSync(pattern));
let failed = false;

if (files.length === 0) {
  console.error("check-forbidden-words: no files matched");
  process.exit(1);
}

if (blogFiles.length === 0) {
  console.error("check-forbidden-words: no blog files matched");
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

for (const file of blogFiles) {
  for (const hit of blogMarkerHits(readFileSync(file, "utf8"))) {
    console.error(`${file}:${hit.line}: ${hit.text}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `check-forbidden-words: ok (${files.length + blogFiles.length} files)`,
);
