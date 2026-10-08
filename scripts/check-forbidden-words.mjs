// Fails the build when public copy still contains draft markers.
// Legal scope: legal pages, the FAQ that restates them, and the modules that
// render that copy. Generator templates keep the word Platzhalter for unfilled
// PDF fields; those files are outside this check.
// Blog scope: visible article copy only (rendered frontmatter plus body).
// Internal labels and informal du/ihr address there fail the build.
// Ordinary prose, formal "Sie/Ihnen/Ihr", comments, and hidden frontmatter keys
// such as ctaSoft do not. PR #94 (entry path) is still open, so this check
// stays here and reuses the blog walker instead of a second COVERED list.
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
// CTA labels: hyphen, space, and the ae spelling. "CTA:" is the bare label.
const ctaLabel =
  "(?:Soft|Hard|Primär|Primaer|Sekundär|Sekundaer)(?:[-\\s–—]+)?CTA";
const blogToken = new RegExp(
  String.raw`\b(?:${ctaLabel}|TODO|FIXME|TBD|TBA|XXX|WIP|DRAFT|PLACEHOLDER|CHANGEME|NOCOMMIT)\b|\bCTA\s*:|\[\s*(?:klären|TODO|FIXME|TBD|TBA|XXX|WIP|DRAFT|Platzhalter|PLACEHOLDER)\s*\]|\{\{\s*(?:Platzhalter|PLACEHOLDER)\s*\}\}|\bLorem\s+ipsum\b`,
  "i",
);

// Informal blog address. Formal "Sie/Ihnen/Ihr" is a different spelling and
// is not matched. Lowercase "ihr" is only flagged next to an unambiguous
// 2nd-person-plural verb (könnt, solltet, müsst, habt, seid, wollt, dürft),
// so possessive "ihr Steuerberater" and "Aus ihr müssen" stay clean.
const DU_PRONOUN_RE =
  /(?<![\p{L}\p{N}_])(?:[Dd]u|[Dd]ich|[Dd]ir|[Dd]ein(?:en|em|er|es|e|s)?|[Ee]uch|[Ee]u(?:ren|rem|rer|res|er|re))(?![\p{L}\p{N}_])/u;
const DU_IMPERATIVE_RE =
  /(?<![\p{L}\p{N}_])(?<!ich )(?<!Ich )(?:Mach|mach|Schau|schau|Starte|starte|Lies|lies|Prüfe|prüfe|Prüf|prüf|Dokumentiere|dokumentiere|Schreibe|schreibe|Nenne|nenne|Aktualisiere|aktualisiere|Nutze|nutze|Kopiere|kopiere|Halte|halte|Übernimm|übernimm|Orientiere|orientiere|Vermeide|vermeide|Beschreibe|beschreibe|Drucke|drucke|Notiere|notiere)(?![\p{L}\p{N}_])/u;
const IHR_2PL_RE =
  /(?<![\p{L}\p{N}_])(?:ihr(?![\p{L}\p{N}_])(?:\s+[^\s]+){0,8}?\s+(?:könnt|solltet|müsst|habt|seid|wollt|dürft)(?![\p{L}\p{N}_])|(?:könnt|solltet|müsst|habt|seid|wollt|dürft)(?![\p{L}\p{N}_])\s+ihr(?![\p{L}\p{N}_]))/u;

function findBlogDu(visible) {
  return (
    visible.match(DU_PRONOUN_RE)?.[0] ||
    visible.match(DU_IMPERATIVE_RE)?.[0] ||
    visible.match(IHR_2PL_RE)?.[0] ||
    null
  );
}

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

function forEachVisibleBlog(raw, visit) {
  const lines = raw.split("\n");
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
      visit(index + 1, line.trim(), stripUrls(kv[2]));
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
      visit(index + 1, line.trim(), stripUrls(line));
      continue;
    }

    visit(index + 1, line.trim(), stripUrls(visibleFromComments(line, comment)));
  }
}

function blogMarkerHits(raw) {
  const hits = [];
  forEachVisibleBlog(raw, (line, text, visible) => {
    if (isBlogMarker(visible)) hits.push({ line, text });
  });
  return hits;
}

function blogDuHits(raw) {
  const hits = [];
  forEachVisibleBlog(raw, (line, text, visible) => {
    const match = findBlogDu(visible);
    if (match) hits.push({ line, text, match });
  });
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
    ["primaer heading", "## Primär-CTA: Verfahrensdokumentation erstellen\n", true],
    ["primaer space", "## Primär CTA: Entwurf\n", true],
    ["primaer ae", "## Primaer-CTA Entwurf\n", true],
    ["sekundaer heading", "## Sekundär-CTA: Readiness\n", true],
    ["sekundaer space", "### Sekundaer CTA\n", true],
    ["cta colon", "CTA: jetzt lesen\n", true],
    ["cta colon space", "CTA : Checkout\n", true],
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
    ["cta in url", "Siehe [Text](https://example.com/CTA:box).\n", false],
    ["cta in comment", "<!-- Primär-CTA: intern -->\n\nAbsatz.\n", false],
  ];

  const duCases = [
    ["du pronoun", "fragst du dich, ob dein Entwurf dir hilft.\n", true],
    ["dein forms", "aus deinen Angaben für dich und deinen Berater.\n", true],
    ["euch euer", "Unsicher, ob euer Scope greifbar ist und euch fehlt.\n", true],
    ["ihr 2pl", "klären, wie ihr Prüfungsdaten bereitstellen könnt.\n", true],
    ["ihr inverted", "Intern solltet ihr Änderungen nachhalten.\n", true],
    ["mach imperative", "Mach den kostenlosen Readiness-Check.\n", true],
    ["schau", "Schau zuerst die Checkliste.\n", true],
    ["starte", "Starte mit dem Ist-Zustand.\n", true],
    ["lies", "Lies die Fassung gegen.\n", true],
    ["pruefe", "Prüfe die Version.\n", true],
    ["dirk", "Dirk leitet die Durchführung direkt.\n", false],
    ["deinstallation", "Die Deinstallation ändert den Ablauf nicht.\n", false],
    ["ihr formal", "Entwurf für Sie und Ihren Steuerberater.\n", false],
    ["ihr possessive", "die Firma und ihr Steuerberater.\n", false],
    ["aus ihr", "Aus ihr müssen Inhalt und Ablauf ersichtlich sein.\n", false],
    ["machen sie", "Machen Sie den kostenlosen Readiness-Check.\n", false],
    ["pruefung", "bei der Prüfung und beim Prüfer.\n", false],
    ["ich starte", "ich starte nicht mit einer leeren Datei.\n", false],
    ["du in url", "Siehe [Artikel](https://example.com/du-form).\n", false],
    ["du in comment", "<!-- du intern -->\n\nAbsatz in der Sie-Form.\n", false],
    [
      "ctaSoft hidden",
      '---\ntitle: "Artikel"\nctaSoft: "/readiness"\n---\n\nMachen Sie den Check.\n',
      false,
    ],
    [
      "meta du",
      '---\nmetaDescription: "was du vorbereiten kannst"\n---\n\nAbsatz.\n',
      true,
    ],
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

  for (const [name, source, expectHit] of duCases) {
    const hit = blogDuHits(source).length > 0;
    if (hit !== expectHit) {
      console.error(
        `check-forbidden-words: du self-test failed (${name}, expected ${expectHit ? "hit" : "clean"})`,
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
  const raw = readFileSync(file, "utf8");
  for (const hit of blogMarkerHits(raw)) {
    console.error(`${file}:${hit.line}: ${hit.text}`);
    failed = true;
  }
  for (const hit of blogDuHits(raw)) {
    console.error(`${file}:${hit.line}: du-Anrede „${hit.match}“ in ${hit.text}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `check-forbidden-words: ok (${files.length + blogFiles.length} files)`,
);
