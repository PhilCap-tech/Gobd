// Fails the build when public copy still contains draft markers.
// Legal scope: legal pages, the FAQ that restates them, and the modules that
// render that copy. Generator templates keep the word Platzhalter for unfilled
// PDF fields; those files are outside this check.
// Blog scope: visible article copy only (rendered frontmatter plus body).
// Branch pages in content/branchen use the same rules, plus a short block list
// (rechtssicher, GoBD-konform, 5–8 Minuten, kurzes Intake, Stripe).
// Internal labels and informal du/ihr address there fail the build.
// Ordinary prose, formal "Sie/Ihnen/Ihr", comments, and hidden frontmatter keys
// such as ctaSoft do not. PR #94 (entry path) is still open, so this check
// stays here and reuses the blog walker instead of a second COVERED list.
// Lead magnets live in TypeScript string literals. Those files are scanned
// for the same du-forms, comments and code identifiers excluded.
// Rendered UI (app and components TSX): the word Legacy must not appear in
// customer-visible text or prose strings. Comments and lowercase machine
// tokens (ids, paths, slugs) are ignored. A line marked allow-legacy is skipped.
import { spawnSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const forbidden =
  /\b(TODO|Counsel|Variante B|Platzhalter|Go-Live|Soft-CTA|Primär-CTA|Pillar)\b|\[klären/i; // allow-forbidden

const patterns = [
  "content/legal/**/*.{md,mdx}",
  "content/faq.md",
  "lib/legal-content.ts",
  "lib/legal-markdown.tsx",
  "lib/offer-copy.ts",
  "lib/kanzlei-copy.ts",
  "app/datenschutz/**/*.{ts,tsx}",
  "app/agb/**/*.{ts,tsx}",
  "app/cookies/**/*.{ts,tsx}",
  "app/impressum/**/*.{ts,tsx}",
  "app/faq/**/*.{ts,tsx}",
];

const blogPatterns = [
  "content/blog/**/*.{md,mdx}",
  "content/branchen/**/*.{md,mdx}",
];

const BRANCHEN_SPERRE =
  /rechtssicher|gobd-konform|5\s*[–—-]\s*8\s*minuten|kurzes\s+intake|(?<![\p{L}\p{N}_])stripe(?![\p{L}\p{N}_])/iu;

const resourceDuPatterns = [
  "lib/lead-magnet.ts",
  "lib/lead-magnet-inhalt.ts",
  "lib/kassen-check-questions.ts",
  "lib/kassen-check-mail.ts",
  "app/resources/**/*.{ts,tsx}",
  "app/kassen-check/**/*.{ts,tsx}",
];

const uiPatterns = ["app/**/*.tsx", "components/**/*.tsx"];

const LEGACY_WORD = /(?<![\p{L}\p{N}_])legacy(?![\p{L}\p{N}_])/iu;

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

// Informal address. Formal "Sie/Ihnen/Ihr" is a different spelling and is
// not matched. Lowercase "ihr" is flagged next to an unambiguous
// 2nd-person-plural verb (könnt, solltet, müsst, habt, seid, wollt, dürft),
// and after wo/wie/ob/wenn/dass/bevor/falls/sobald when the next word is
// lowercase ("wo ihr steht"). Possessive "wo ihr Steuerberater" and
// "Aus ihr müssen" stay clean.
const DU_PRONOUN_RE =
  /(?<![\p{L}\p{N}_])(?:[Dd]u|[Dd]ich|[Dd]ir|[Dd]ein(?:en|em|er|es|e|s)?|[Ee]uch|[Ee]u(?:ren|rem|rer|res|er|re))(?![\p{L}\p{N}_])/u;
const DU_IMPERATIVE_RE =
  /(?<![\p{L}\p{N}_])(?<!ich )(?<!Ich )(?:Mach|mach|Schau|schau|Starte|starte|Lies|lies|Prüfe|prüfe|Prüf|prüf|Dokumentiere|dokumentiere|Schreibe|schreibe|Nenne|nenne|Aktualisiere|aktualisiere|Nutze|nutze|Kopiere|kopiere|Halte|halte|Übernimm|übernimm|Orientiere|orientiere|Vermeide|vermeide|Beschreibe|beschreibe|Drucke|drucke|Notiere|notiere)(?![\p{L}\p{N}_])/u;
const IHR_2PL_RE =
  /(?<![\p{L}\p{N}_])(?:ihr(?![\p{L}\p{N}_])(?:\s+[^\s]+){0,8}?\s+(?:könnt|solltet|müsst|habt|seid|wollt|dürft)(?![\p{L}\p{N}_])|(?:könnt|solltet|müsst|habt|seid|wollt|dürft)(?![\p{L}\p{N}_])\s+ihr(?![\p{L}\p{N}_])|(?:wo|wie|ob|wenn|dass|bevor|falls|sobald)\s+ihr(?![\p{L}\p{N}_])\s+\p{Ll})/u

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

function branchenSperreHits(raw) {
  const hits = [];
  raw.split("\n").forEach((line, index) => {
    const match = line.match(BRANCHEN_SPERRE);
    if (match) hits.push({ line: index + 1, text: line.trim(), match: match[0] });
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

function resourceDuHits(raw) {
  const hits = [];
  let i = 0;
  let line = 1;
  while (i < raw.length) {
    if (raw[i] === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (raw.startsWith("//", i)) {
      while (i < raw.length && raw[i] !== "\n") i += 1;
      continue;
    }
    if (raw.startsWith("/*", i)) {
      i += 2;
      while (i < raw.length && !raw.startsWith("*/", i)) {
        if (raw[i] === "\n") line += 1;
        i += 1;
      }
      i += 2;
      continue;
    }
    const quote = raw[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      const startLine = line;
      i += 1;
      let text = "";
      while (i < raw.length) {
        if (raw[i] === "\\") {
          const next = raw[i + 1] ?? "";
          text += next;
          if (next === "\n") line += 1;
          i += 2;
          continue;
        }
        if (raw[i] === "\n") line += 1;
        if (raw[i] === quote) break;
        text += raw[i];
        i += 1;
      }
      const match = findBlogDu(text);
      if (match) {
        hits.push({ line: startLine, text: text.trim().slice(0, 180), match });
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return hits;
}

function isMachineToken(text) {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return (
    trimmed === trimmed.toLowerCase() &&
    /^[\p{L}\p{N}_./:#?=&%+\-]+$/u.test(trimmed)
  );
}

function legacyInRegion(text) {
  const trimmed = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").trim();
  if (!trimmed || isMachineToken(trimmed) || !LEGACY_WORD.test(trimmed)) return null;
  return trimmed.match(LEGACY_WORD)?.[0] ?? null;
}

function lineAllowsLegacy(source, index) {
  const start = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const end = source.indexOf("\n", index);
  const line = source.slice(start, end === -1 ? source.length : end);
  return line.includes("allow-legacy");
}

function closesTag(source, gtIndex) {
  let i = gtIndex - 1;
  while (i >= 0 && source[i] !== "<" && source[i] !== ">") i -= 1;
  if (i < 0 || source[i] !== "<") return false;
  const tag = source.slice(i + 1, gtIndex).trim();
  return /^\/?[A-Za-z][\w.-]*(\s[\s\S]*)?$/.test(tag);
}

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

/** String literals and JSX text. Comments are skipped. */
function uiRegions(source) {
  const regions = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (source[i] === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    const quote = source[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      const start = i + 1;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === quote) break;
        i += 1;
      }
      regions.push({ start, text: source.slice(start, i) });
      i += 1;
      continue;
    }
    if (source[i] === ">" && source[i - 1] !== "=" && closesTag(source, i)) {
      const start = i + 1;
      i += 1;
      let text = "";
      while (i < source.length && source[i] !== "<") {
        text += source[i];
        i += 1;
      }
      if (text.trim()) regions.push({ start, text });
      continue;
    }
    i += 1;
  }
  return regions;
}

function uiLegacyHits(source) {
  const hits = [];
  for (const region of uiRegions(source)) {
    if (lineAllowsLegacy(source, region.start)) continue;
    const match = legacyInRegion(region.text);
    if (match) {
      hits.push({
        line: lineAt(source, region.start),
        match,
        text: region.text.replace(/\s+/g, " ").trim().slice(0, 180),
      });
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
    ["wo ihr steht", "Unsicher, wo ihr steht?\n", true],
    ["wo ihr noun", "wo ihr Steuerberater zustimmt.\n", false],
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

  const resourceCases = [
    ["resource ihr", 'export const t = "Unsicher, wo ihr steht?";\n', true],
    ["resource sie", 'export const t = "Unsicher, wo Sie stehen?";\n', false],
    ["resource dir code", 'const dir = "Pfad zur Datei";\n', false],
    [
      "resource comment",
      '// eure interne Notiz\nexport const t = "Machen Sie den Check.";\n',
      false,
    ],
    ["resource eure", 'body: "in eurer Sprache",\n', true],
  ];

  const sperreCases = [
    ["rechtssicher", "Das ist rechtssicher.\n", true],
    ["gobd-konform", "Angabe „GoBD-konform“.\n", true],
    ["minutes en", "Ca. 5–8 Minuten.\n", true],
    ["minutes hyphen", "nur 5-8 Minuten.\n", true],
    ["kurzes intake", "ein kurzes Intake.\n", true],
    ["stripe", "Zahlung über Stripe.\n", true],
    ["striped", "ein striped Muster.\n", false],
    ["hours", "etwa 2–3 Stunden.\n", false],
    ["steuerberatung", "Keine Steuerberatung.\n", false],
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

  for (const [name, source, expectHit] of sperreCases) {
    const hit = branchenSperreHits(source).length > 0;
    if (hit !== expectHit) {
      console.error(
        `check-forbidden-words: branchen sperre self-test failed (${name}, expected ${expectHit ? "hit" : "clean"})`,
      );
      process.exit(1);
    }
  }

  for (const [name, source, expectHit] of resourceCases) {
    const hit = resourceDuHits(source).length > 0;
    if (hit !== expectHit) {
      console.error(
        `check-forbidden-words: resource self-test failed (${name}, expected ${expectHit ? "hit" : "clean"})`,
      );
      process.exit(1);
    }
  }

  const legacyCases = [
    [
      "jsx sentence",
      "export function A(){ return <p>Weiteren Legacy-Bereich dokumentieren</p> }\n",
      true,
    ],
    [
      "hint",
      "export function A(){ return <p>Legacy-Bereiche bleiben lesbar.</p> }\n",
      true,
    ],
    [
      "string label",
      'const label = "Weiteren Legacy-Bereich dokumentieren";\n',
      true,
    ],
    [
      "template",
      "const label = `Legacy-Bereich`;\n",
      true,
    ],
    [
      "id attr",
      'export function A(){ return <section id="legacy" /> }\n',
      false,
    ],
    ['slug', 'const reference = "legacy-url";\n', false],
    [
      "comment",
      '// Legacy-Bereich intern\nexport const x = "Gesamtdokument";\n',
      false,
    ],
    [
      "jsx comment",
      "export function A(){ return <p>{/* Legacy */}Gesamtdokument</p> }\n",
      false,
    ],
    [
      "clean",
      "export function A(){ return <p>Weiteren Bereich dokumentieren</p> }\n",
      false,
    ],
    ['allow', 'const label = "Legacy"; // allow-legacy\n', false],
  ];

  for (const [name, source, expectHit] of legacyCases) {
    const hit = uiLegacyHits(source).length > 0;
    if (hit !== expectHit) {
      console.error(
        `check-forbidden-words: legacy self-test failed (${name}, expected ${expectHit ? "hit" : "clean"})`,
      );
      process.exit(1);
    }
  }
}

assertSelfTest();

const files = patterns.flatMap((pattern) => globSync(pattern));
const blogFiles = blogPatterns.flatMap((pattern) => globSync(pattern));
const resourceFiles = resourceDuPatterns.flatMap((pattern) => globSync(pattern));
const uiFiles = [...new Set(uiPatterns.flatMap((pattern) => globSync(pattern)))].sort();
let failed = false;

if (files.length === 0) {
  console.error("check-forbidden-words: no files matched");
  process.exit(1);
}

if (blogFiles.length === 0) {
  console.error("check-forbidden-words: no blog files matched");
  process.exit(1);
}

const branchenFiles = blogFiles.filter((file) => file.includes(`${path.sep}branchen${path.sep}`));
if (branchenFiles.length === 0) {
  console.error("check-forbidden-words: no branchen files matched");
  process.exit(1);
}

if (resourceFiles.length === 0) {
  console.error("check-forbidden-words: no resource files matched");
  process.exit(1);
}

if (uiFiles.length === 0) {
  console.error("check-forbidden-words: no UI files matched");
  process.exit(1);
}

// Preismodell v2 (Draft-PR): [TODO-GROWTH] / [TODO-LEGAL] sind erlaubte
// Marker, solange lib/plan-copy.ts PLAN_COPY_DRAFT = true setzt. Sie werden
// gelistet. Mit false (vor dem Merge) gelten sie wie jedes andere TODO.
const planCopyDraft = /export const PLAN_COPY_DRAFT = true;/.test(
  readFileSync("lib/plan-copy.ts", "utf8"),
);
const planMarker = /\[TODO-(?:GROWTH|LEGAL)\]/g;
let planMarkers = 0;
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (!forbidden.test(line) || line.includes("// allow-forbidden")) return;
      if (planCopyDraft && planMarker.test(line)) {
        planMarker.lastIndex = 0;
        if (!forbidden.test(line.replace(planMarker, ""))) {
          planMarkers += 1;
          console.warn(`check-forbidden-words: v2-Marker (Merge-Sperre) ${file}:${index + 1}`);
          return;
        }
      }
      planMarker.lastIndex = 0;
      console.error(`${file}:${index + 1}: ${line.trim()}`);
      failed = true;
    });
}
if (planMarkers > 0) {
  console.warn(`check-forbidden-words: ${planMarkers} v2-Marker offen (PLAN_COPY_DRAFT = true, nicht mergen)`);
}

// Legal pages must not carry the internal draft notice. A plain
// "**Stand:** <date>" line is fine; "Entwurf einer Verfahrensdokumentation"
// in the body is product wording, not this notice.
const draftNotice =
  /Interner Entwurf|Vor Veröffentlichung juristisch prüfen|juristisch prüfen/;
const legalNoticeFiles = [
  ...globSync("content/legal/**/*.{md,mdx}"),
  ...globSync("app/agb/**/*.{ts,tsx}"),
  ...globSync("app/datenschutz/**/*.{ts,tsx}"),
  ...globSync("app/impressum/**/*.{ts,tsx}"),
  ...globSync("app/cookies/**/*.{ts,tsx}"),
  ...globSync("app/widerruf/**/*.{ts,tsx}"),
  ...globSync("components/legal-page.tsx"),
  ...globSync("lib/legal-content.ts"),
  ...globSync("lib/legal-markdown.tsx"),
].sort();
if (legalNoticeFiles.length === 0) {
  console.error("check-forbidden-words: no legal files for the draft-notice check");
  failed = true;
}
const draftNoticeSample =
  "> **Interner Entwurf · Stand 20.10.2026** · Keine Rechtsberatung. Vor Veröffentlichung juristisch prüfen.\n";
if (!draftNotice.test(draftNoticeSample)) {
  console.error("check-forbidden-words: draft-notice self-test missed the banner");
  failed = true;
}
if (
  draftNotice.test(
    "**Stand:** 20.10.2026\nEntwurf einer Verfahrensdokumentation\njuristische Person\n",
  )
) {
  console.error("check-forbidden-words: draft-notice self-test false positive");
  failed = true;
}
for (const file of legalNoticeFiles) {
  const raw = readFileSync(file, "utf8");
  // Same leading-blockquote strip the legal pages apply before render.
  const rendered = raw.replace(/^(?:>.*\n)+/m, "");
  for (const text of [raw, rendered]) {
    const match = text.match(draftNotice);
    if (!match) continue;
    console.error(`${file}: Entwurfs-Hinweis „${match[0]}“`);
    failed = true;
    break;
  }
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

for (const file of branchenFiles) {
  for (const hit of branchenSperreHits(readFileSync(file, "utf8"))) {
    console.error(`${file}:${hit.line}: gesperrt „${hit.match}“ in ${hit.text}`);
    failed = true;
  }
}

for (const file of resourceFiles) {
  for (const hit of resourceDuHits(readFileSync(file, "utf8"))) {
    console.error(`${file}:${hit.line}: du-Anrede „${hit.match}“ in ${hit.text}`);
    failed = true;
  }
}

for (const file of uiFiles) {
  for (const hit of uiLegacyHits(readFileSync(file, "utf8"))) {
    console.error(`${file}:${hit.line}: Legacy in rendered UI „${hit.match}“ in ${hit.text}`);
    failed = true;
  }
}

// Price lines that already end with "USt." must not gain another "."
// ({PRICE_MICRO}. renders as USt.<!-- -->.).
function ustEndingConstants() {
  const source = readFileSync("lib/offer-copy.ts", "utf8");
  const values = new Map();
  const literal =
    /export const ([A-Z0-9_]+) = ("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`);/g;
  for (const match of source.matchAll(literal)) {
    values.set(match[1], match[2].slice(1, -1));
  }
  // Preismodell v2: `export const X = V2\n  ? …\n  : LEGACY_X;` prüft die alte Fassung.
  for (const match of source.matchAll(/export const ([A-Z0-9_]+) = V2\s*\?[\s\S]*?:\s*(LEGACY_[A-Z0-9_]+);/g)) {
    if (!values.has(match[1]) && values.has(match[2])) values.set(match[1], values.get(match[2]));
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const match of source.matchAll(/export const ([A-Z0-9_]+) = ([A-Z0-9_]+);/g)) {
      if (!values.has(match[1]) && values.has(match[2])) {
        values.set(match[1], values.get(match[2]));
        grew = true;
      }
    }
  }
  return [...values.entries()].filter(([, value]) => value.endsWith("USt."));
}

function expandUstSentences(source, constants) {
  let text = source;
  for (const [name, value] of constants) {
    text = text.split(`{${name}}`).join(value);
    text = text.split("${" + name + "}").join(value);
  }
  return text.replace(/<!--\s*-->/g, "");
}

const ustConsts = ustEndingConstants();
if (ustConsts.length === 0) {
  console.error("check-forbidden-words: no price line ending in USt.");
  failed = true;
} else {
  const broken = "{PRICE_MICRO}.";
  const clean = "{PRICE_MICRO} ";
  if (!expandUstSentences(broken, ustConsts).includes("USt..")) {
    console.error("check-forbidden-words: USt.. self-test missed the extra period");
    failed = true;
  }
  if (expandUstSentences(clean, ustConsts).includes("USt..")) {
    console.error("check-forbidden-words: USt.. self-test false positive");
    failed = true;
  }
  const ustFiles = [
    ...new Set([
      ...files,
      ...blogFiles,
      ...resourceFiles,
      ...uiFiles,
      ...globSync("lib/**/*.{ts,tsx}"),
      ...globSync("content/**/*.md"),
    ]),
  ].sort();
  for (const file of ustFiles) {
    const rendered = expandUstSentences(readFileSync(file, "utf8"), ustConsts);
    if (!rendered.includes("USt..")) continue;
    rendered.split("\n").forEach((line, index) => {
      if (line.includes("USt..")) {
        console.error(`${file}:${index + 1}: doppelter Punkt nach USt. in ${line.trim()}`);
        failed = true;
      }
    });
  }
}

if (failed) {
  process.exit(1);
}

const tsxBin = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  ".bin",
  "tsx",
);
const effort = spawnSync(
  process.execPath,
  ["--disable-warning=ExperimentalWarning", tsxBin, "scripts/check-effort-copy.ts"],
  { stdio: "inherit", env: process.env },
);
if (effort.status !== 0) {
  if (effort.error) console.error(effort.error);
  process.exit(effort.status ?? 1);
}

console.log(
  `check-forbidden-words: ok (${files.length + blogFiles.length + resourceFiles.length + uiFiles.length} files)`,
);
