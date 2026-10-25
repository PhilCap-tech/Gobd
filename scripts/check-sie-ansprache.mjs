// Fails the build when covered customer copy still addresses the customer with du,
// and when that copy uses the colloquial shortenings listed in COLLOQUIAL.
// COVERED is the entry path plus transactional mails, account, intake, and legal pages.
// Du-forms in blog and lead magnets stay in check-forbidden-words.mjs. The colloquial
// blocklist also scans those customer-facing files, plus lib/home-faq.ts, because
// that is where the shortened forms are written. Branch pages in content/branchen
// are checked here as well. Leave the du matchers as they are.
//
// Only user-visible copy is checked: markdown as written, and in TS/TSX the
// string literals plus text nodes. Code identifiers such as `dir` are ignored.
// Partner and Steuerberater templates in lib/ops.ts are Sie and pass as written.
// A line marked with `allow-du` is skipped (same idea as allow-forbidden).
// A line marked with `allow-umgang` skips the colloquial blocklist.
// Legal texts stay in the du scan and are left out of the colloquial scan.
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

/** @type {string[]} */
const COVERED = [
  "app/page.tsx",
  "app/partner-angebot/**/*.tsx",
  "lib/partner-angebot.ts",
  "app/steuerberater/page.tsx",
  "app/steuerberater/partner-inquiry-form.tsx",
  "app/steuerberater/merkblatt-form.tsx",
  "app/steuerberater/merkblatt/**/*.tsx",
  "app/api/kanzlei-merkblatt/**/*.ts",
  "lib/kanzlei-copy.ts",
  "lib/kanzlei-mail.ts",
  "app/faq/**/*.{ts,tsx}",
  "content/faq.md",
  "app/readiness/**/*.{ts,tsx}",
  "app/ampel-check/**/*.{ts,tsx}",
  "app/kassen-check/**/*.{ts,tsx}",
  "app/vorlagen/**/*.{ts,tsx}",
  "app/api/ampel/**/*.ts",
  "app/api/kassen-check/**/*.ts",
  "app/api/magnet/**/*.ts",
  "components/ampel-result.tsx",
  "components/kassen-check-teaser.tsx",
  "components/vorlagen-gate.tsx",
  "components/vorlagen-shell.tsx",
  "components/kostenrechner.tsx",
  "lib/vorlagen/**/*.ts",
  "lib/ampel-questions.ts",
  "lib/kassen-check-questions.ts",
  "lib/kassen-check-mail.ts",
  "lib/ampel-mail.ts",
  "lib/ampel-pdf.ts",
  "lib/ampel-result-send.ts",
  "lib/ampel-confirm.ts",
  "app/checkout/**/*.{ts,tsx}",
  "app/api/checkout/route.ts",
  "app/muster/**/*.{ts,tsx}",
  "lib/offer-copy.ts",
  "components/consent-banner.tsx",
  "components/site-header.tsx",
  "components/site-footer.tsx",
  "content/readiness/**/*.md",
  "content/branchen/**/*.md",
  "lib/readiness.ts",
  "content/legal/**/*.md",
  "app/datenschutz/**/*.{ts,tsx}",
  "app/agb/**/*.{ts,tsx}",
  "app/cookies/**/*.{ts,tsx}",
  "app/impressum/**/*.{ts,tsx}",
  "lib/legal.ts",
  "lib/llms-txt.ts",
  "lib/jsonld.ts",
  "components/json-ld.tsx",
  "lib/legal-content.ts",
  "lib/legal-markdown.tsx",
  "components/legal-page.tsx",
  "lib/ops.ts",
  "lib/kuendigung-mail.ts",
  "lib/kuendigung.ts",
  "lib/membership-mail.ts",
  "lib/membership-copy.ts",
  "lib/membership-invite.ts",
  "app/account/**/*.{ts,tsx}",
  "app/not-found.tsx",
  "app/login/**/*.{ts,tsx}",
  "app/auth/**/*.{ts,tsx}",
  "app/intake/**/*.{ts,tsx}",
  "app/success/**/*.{ts,tsx}",
  "app/billing/**/*.{ts,tsx}",
  "app/portal/**/*.{ts,tsx}",
  "components/account-abo.tsx",
  "components/account-billing.tsx",
  "lib/account-labels.ts",
  "components/account-company-card.tsx",
  "components/pdf-download-link.tsx",
  "components/account-free.tsx",
  "components/account-profile-form.tsx",
  "components/logout-button.tsx",
  "app/login/login-form.tsx",
  "components/success-status.tsx",
  "components/betriebs-check.tsx",
  "components/bereich-select.tsx",
  "components/intake-questionnaire.tsx",
  "components/intake-p1-fields.tsx",
  "components/freitext-alert.tsx",
  "lib/intake-payload.ts",
  "components/firma-select.tsx",
  "components/document-revision.tsx",
  "components/version-change-fields.tsx",
  "lib/module/status.ts",
  "lib/stripe.ts",
  "lib/session-write.ts",
  "lib/checkout-session.ts",
  "lib/subscription-coverage.ts",
  "lib/sheets-outage.ts",
  "lib/sheets-unavailable.ts",
  "lib/fetch-retry.ts",
];

const PRONOUNS =
  "du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure|euren|eurem|eurer|eures";
// Du-imperatives actually replaced on these surfaces. "bestätige" is separate
// so the first-person "Ich bestätige" on the checkout checkbox stays allowed.
const IMPERATIVES = "mach|schau|starte|öffne|schreib|melde|hake|nutze|fülle|nenne|klär|erfasse|beschreibe|geh|nimm";

const PRONOUN_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])(?:${PRONOUNS})(?![\p{L}\p{N}_])`,
  "iu",
);
const IMPERATIVE_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])(?:${IMPERATIVES})(?![\p{L}\p{N}_])`,
  "iu",
);
const DU_BESTAETIGE_RE =
  /(?<![\p{L}\p{N}_])(?<!Ich )(?<!ich )bestätige(?![\p{L}\p{N}_])/iu;

function findDu(text) {
  return (
    text.match(PRONOUN_RE)?.[0] ||
    text.match(IMPERATIVE_RE)?.[0] ||
    text.match(DU_BESTAETIGE_RE)?.[0] ||
    null
  );
}

// Shortenings and colloquialisms. "Infos" stays case-sensitive so the noun
// "Infos" is caught and slugs such as kanzlei-infos are not. "soft Vergleich"
// is two words; a hyphenated "Soft-Vergleich" is a different spelling and is
// not this token. Apostrophes: ASCII ' and the typographic ’ / ʼ.
const COLLOQUIAL = [
  {
    name: "brauch ich",
    re: /(?<![\p{L}\p{N}_])brauch ich(?![\p{L}\p{N}_])/giu,
  },
  {
    name: "geht’s",
    re: /(?<![\p{L}\p{N}_])geht['’ʼ]s(?![\p{L}\p{N}_])/giu,
  },
  {
    name: "läuft’s",
    re: /(?<![\p{L}\p{N}_])läuft['’ʼ]s(?![\p{L}\p{N}_])/giu,
  },
  {
    name: "rauskommt",
    re: /(?<![\p{L}\p{N}_])rauskommt(?![\p{L}\p{N}_])/giu,
  },
  {
    name: "okay",
    re: /(?<![\p{L}\p{N}_])okay(?![\p{L}\p{N}_])/giu,
  },
  {
    name: "nochmal",
    re: /(?<![\p{L}\p{N}_])nochmal(?![\p{L}\p{N}_])/giu,
  },
  {
    name: "Infos",
    re: /(?<![\p{L}\p{N}_])Infos(?![\p{L}\p{N}_])/gu,
  },
  {
    name: "Hype",
    re: /(?<![\p{L}\p{N}_])hype(?![\p{L}\p{N}_])/giu,
  },
  {
    name: "soft Vergleich",
    re: /(?<![\p{L}\p{N}_])soft\s+vergleich(?![\p{L}\p{N}_])/giu,
  },
  {
    name: "briefed",
    re: /(?<![\p{L}\p{N}_])briefed(?![\p{L}\p{N}_])/giu,
  },
];

const COLLOQUIAL_EXTRA = [
  "lib/home-faq.ts",
  "content/blog/**/*.{md,mdx}",
  "lib/lead-magnet.ts",
  "lib/lead-magnet-inhalt.ts",
];

// Intentional quotations are listed here. A blocked token is ignored only
// while it sits inside the phrase. Set `file` when the exception is local.
// Empty until a quotation needs to stay.
const COLLOQUIAL_ALLOW = [];

function colloquialMatches(text) {
  /** @type {{ term: string, index: number }[]} */
  const hits = [];
  for (const { re } of COLLOQUIAL) {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      hits.push({ term: match[0], index: match.index ?? 0 });
    }
  }
  return hits;
}

function isLegalCopy(file) {
  const normalized = file.replaceAll("\\", "/");
  return (
    normalized.includes("content/legal/") ||
    /(?:^|\/)app\/(?:datenschutz|agb|cookies|impressum)\//.test(normalized) ||
    /(?:^|\/)lib\/legal(?:-content|-markdown)?\.tsx?$/.test(normalized) ||
    normalized.endsWith("components/legal-page.tsx")
  );
}

function allowCovers(file, text, index, length, allow = COLLOQUIAL_ALLOW) {
  const normalized = file.replaceAll("\\", "/");
  for (const entry of allow) {
    if (entry.file && !normalized.endsWith(entry.file)) continue;
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(entry.phrase, from);
      if (at === -1) break;
      if (index >= at && index + length <= at + entry.phrase.length) return true;
      from = at + 1;
    }
  }
  return false;
}

function lineAllowsUmgang(source, index) {
  const start = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const end = source.indexOf("\n", index);
  const line = source.slice(start, end === -1 ? source.length : end);
  return line.includes("allow-umgang");
}

function assertMatcher() {
  const samples = [
    ["Dirk leitet die Durchführung direkt im Verzeichnis.", false],
    ["directory und duration", false],
    ["Modul für dich und deinen Steuerberater.", true],
    ["Entwurf für Sie und Ihren Steuerberater.", false],
    ["Mach den Check", true],
    ["Machen Sie den Check", false],
    ["Schau zuerst Muster.", true],
    ["Schauen Sie zuerst Muster.", false],
    ["Öffne den Link aus der E-Mail.", true],
    ["Öffnen Sie den Link aus der E-Mail.", false],
    ["Bitte bestätige, dass du als Unternehmer bestellst.", true],
    ["Ich bestätige: keine Steuerberatung.", false],
    ["Bitte bestätigen Sie, dass Sie als Unternehmer bestellen.", false],
    ["du@firma.de", true],
    ["name@firma.de", false],
    ["eure Belegwege und euch im Team", true],
    ["Ihre Belegwege", false],
    ["Beispiel öffnen", false],
  ];
  for (const [sample, expectHit] of samples) {
    const hit = Boolean(findDu(sample));
    if (hit !== expectHit) {
      console.error(
        `check-sie-ansprache: matcher self-test failed for ${JSON.stringify(sample)} (hit=${hit}, expected=${expectHit})`,
      );
      process.exit(1);
    }
  }
}

function looksLikeCode(text) {
  return (
    /=>|&&|\|\||\b(const|let|var|return|function|import|export|await|if|else|type|interface|className)\b/.test(
      text,
    )
  );
}

function proseParts(text) {
  return text
    .split(/\{[^{}]*\}/g)
    .map((part) => part.trim())
    .filter((part) => part && !looksLikeCode(part));
}

function closesTag(source, gtIndex) {
  let i = gtIndex - 1;
  while (i >= 0 && source[i] !== "<" && source[i] !== ">") i -= 1;
  if (i < 0 || source[i] !== "<") return false;
  const tag = source.slice(i + 1, gtIndex).trim();
  return /^\/?[A-Za-z][\w.-]*(\s[\s\S]*)?$/.test(tag);
}

/** @returns {{ start: number, text: string }[]} */
function uiRegions(source) {
  /** @type {{ start: number, text: string }[]} */
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

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

function lineAllows(source, index) {
  const start = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const end = source.indexOf("\n", index);
  const line = source.slice(start, end === -1 ? source.length : end);
  return line.includes("allow-du");
}

/** @returns {{ line: number, match: string, text: string }[]} */
function scan(source, file) {
  /** @type {{ line: number, match: string, text: string }[]} */
  const hits = [];
  if (file.endsWith(".md") || file.endsWith(".mdx")) {
    source.split("\n").forEach((line, index) => {
      if (line.includes("allow-du")) return;
      const match = findDu(line);
      if (match) hits.push({ line: index + 1, match, text: line.trim() });
    });
    return hits;
  }
  for (const region of uiRegions(source)) {
    if (lineAllows(source, region.start)) continue;
    for (const part of proseParts(region.text)) {
      const match = findDu(part);
      if (match) {
        hits.push({
          line: lineAt(source, region.start),
          match,
          text: part.replace(/\s+/g, " ").slice(0, 180),
        });
      }
    }
  }
  return hits;
}

/** @returns {{ line: number, match: string, text: string }[]} */
function scanColloquial(source, file, allow = COLLOQUIAL_ALLOW) {
  /** @type {{ line: number, match: string, text: string }[]} */
  const hits = [];
  const keep = (line, text, match) => {
    if (allowCovers(file, text, match.index, match.term.length, allow)) return;
    hits.push({
      line,
      match: match.term,
      text: text.replace(/\s+/g, " ").trim().slice(0, 180),
    });
  };
  if (file.endsWith(".md") || file.endsWith(".mdx")) {
    source.split("\n").forEach((line, index) => {
      if (line.includes("allow-umgang")) return;
      const visible = line.replace(/https?:\/\/\S+/g, " ");
      for (const match of colloquialMatches(visible)) keep(index + 1, visible, match);
    });
    return hits;
  }
  for (const region of uiRegions(source)) {
    if (lineAllowsUmgang(source, region.start)) continue;
    for (const part of proseParts(region.text)) {
      const visible = part.replace(/https?:\/\/\S+/g, " ");
      for (const match of colloquialMatches(visible)) {
        keep(lineAt(source, region.start), visible, match);
      }
    }
  }
  return hits;
}

function assertScan() {
  const dirty = `
    export function Demo() {
      const dir = "pdfs";
      return (
        <p className="lead">
          Entwurf für dich und deinen Steuerberater.
        </p>
      );
    }
  `;
  const dirtyHits = scan(dirty, "demo.tsx");
  if (dirtyHits.length !== 1 || !/dich|deinen/.test(dirtyHits[0].match)) {
    console.error("check-sie-ansprache: scan self-test missed JSX du-form", dirtyHits);
    process.exit(1);
  }
  const clean = `
    export function Demo() {
      const dir = "pdfs";
      // du in a comment is not customer copy
      return <p>Entwurf für Sie und Ihren Steuerberater. placeholder name@firma.de</p>;
    }
  `;
  const cleanHits = scan(clean, "demo.tsx");
  if (cleanHits.length !== 0) {
    console.error("check-sie-ansprache: scan self-test false positive", cleanHits);
    process.exit(1);
  }
  const mail = 'placeholder="du@firma.de"';
  const mailHits = scan(mail, "demo.tsx");
  if (mailHits.length !== 1) {
    console.error("check-sie-ansprache: scan self-test missed placeholder", mailHits);
    process.exit(1);
  }
}

function assertColloquial() {
  const cases = [
    ["Brauch ich eine Verfahrensdokumentation?", true],
    ["Brauche ich eine Verfahrensdokumentation?", false],
    ["So läuft’s ab", true],
    ["So läuft's ab", true],
    ["So läuft es ab", false],
    ["So läuft es heute", false],
    ["Später geht’s über Magic Link", true],
    ["Später geht's ins Konto", true],
    ["Was rauskommt: kurze Einschätzung", true],
    ["Was herauskommt, bleibt", false],
    ["Das ist okay — solange", true],
    ["Das ist Okay.", true],
    ["Das ist zulässig, solange", false],
    ["Readiness nochmal ansehen", true],
    ["nochmals prüfen", false],
    ["nicht genug Infos", true],
    ["Kanzlei-Infos mehr", true],
    ["genügend Informationen", false],
    ["value kanzlei-infos", false],
    ["Prozessinfos bleiben", false],
    ["ohne Hype?", true],
    ["ein Hyperlink", false],
    ["hier ein soft Vergleich", true],
    ["## Soft-Vergleich: worauf Sie achten können", false],
    ["sachlicher Vergleich", false],
    ["wenn gut briefed", true],
    ["ein Brief und Briefe", false],
  ];
  for (const [sample, expectHit] of cases) {
    const hit = colloquialMatches(sample).length > 0;
    if (hit !== expectHit) {
      console.error(
        `check-sie-ansprache: colloquial self-test failed for ${JSON.stringify(sample)} (hit=${hit}, expected=${expectHit})`,
      );
      process.exit(1);
    }
  }

  const jsx = `export function Demo(){ return <h2>So läuft’s ab</h2>; }\n`;
  if (scanColloquial(jsx, "app/page.tsx").length !== 1) {
    console.error("check-sie-ansprache: colloquial self-test missed JSX");
    process.exit(1);
  }
  const comment = `// So läuft’s ab\nexport const label = "So läuft es ab";\n`;
  if (scanColloquial(comment, "app/page.tsx").length !== 0) {
    console.error("check-sie-ansprache: colloquial self-test flagged a comment");
    process.exit(1);
  }
  const ident = `const okay = true;\nexport const label = "Weiter";\n`;
  if (scanColloquial(ident, "app/page.tsx").length !== 0) {
    console.error("check-sie-ansprache: colloquial self-test flagged an identifier");
    process.exit(1);
  }
  const slug = `export const field = "kanzlei-infos";\n`;
  if (scanColloquial(slug, "app/steuerberater/merkblatt-form.tsx").length !== 0) {
    console.error("check-sie-ansprache: colloquial self-test flagged kanzlei-infos");
    process.exit(1);
  }
  const hypeLine =
    "Dieses Modul hilft Ihnen, den Ist-Stand zu erfassen — ohne Hype und ohne Konformitätsversprechen.\n";
  if (scanColloquial(hypeLine, "content/readiness/allgemein.md").length !== 1) {
    console.error("check-sie-ansprache: empty allowlist should still flag ohne Hype");
    process.exit(1);
  }
  const quoted = `Die Haltung „okay“ bleibt stehen.\n`;
  const quoteAllow = [{ phrase: "„okay“" }];
  if (scanColloquial(quoted, "content/blog/x.md", quoteAllow).length !== 0) {
    console.error("check-sie-ansprache: quotation allowlist did not cover „okay“");
    process.exit(1);
  }
  if (scanColloquial(quoted, "content/blog/x.md").length !== 1) {
    console.error("check-sie-ansprache: quotation without allowlist should still fail");
    process.exit(1);
  }
  const marked = `export const label = "nochmal"; // allow-umgang\n`;
  if (scanColloquial(marked, "components/account-free.tsx").length !== 0) {
    console.error("check-sie-ansprache: allow-umgang did not skip the line");
    process.exit(1);
  }
  if (!isLegalCopy("content/legal/datenschutz.md") || !isLegalCopy("lib/legal.ts")) {
    console.error("check-sie-ansprache: legal paths were not recognized");
    process.exit(1);
  }
  if (isLegalCopy("content/blog/x.md") || isLegalCopy("app/page.tsx")) {
    console.error("check-sie-ansprache: non-legal path classified as legal");
    process.exit(1);
  }
}

assertMatcher();
assertScan();
assertColloquial();

const files = [...new Set(COVERED.flatMap((pattern) => globSync(pattern)))].sort();
if (files.length === 0) {
  console.error("check-sie-ansprache: no files matched");
  process.exit(1);
}
if (!files.some((file) => file.includes(`${path.sep}branchen${path.sep}`))) {
  console.error("check-sie-ansprache: no branchen files matched");
  process.exit(1);
}

const colloquialFiles = [
  ...new Set([
    ...files,
    ...COLLOQUIAL_EXTRA.flatMap((pattern) => globSync(pattern)),
  ]),
]
  .filter((file) => !isLegalCopy(file))
  .sort();
if (colloquialFiles.length === 0) {
  console.error("check-sie-ansprache: no colloquial files matched");
  process.exit(1);
}
if (!files.some(isLegalCopy)) {
  console.error("check-sie-ansprache: expected legal files in the du scan");
  process.exit(1);
}
if (colloquialFiles.some(isLegalCopy)) {
  console.error("check-sie-ansprache: legal file included in the colloquial scan");
  process.exit(1);
}
if (!colloquialFiles.some((file) => file.endsWith("lib/home-faq.ts"))) {
  console.error("check-sie-ansprache: lib/home-faq.ts is not in the colloquial scan");
  process.exit(1);
}
if (!colloquialFiles.some((file) => file.includes(`${path.sep}blog${path.sep}`))) {
  console.error("check-sie-ansprache: no blog files in the colloquial scan");
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const hit of scan(source, file)) {
    console.error(`${file}:${hit.line}: du-form „${hit.match}“ in: ${hit.text}`);
    failed = true;
  }
}
for (const file of colloquialFiles) {
  const source = readFileSync(file, "utf8");
  for (const hit of scanColloquial(source, file)) {
    console.error(`${file}:${hit.line}: umgangssprachlich „${hit.match}“ in: ${hit.text}`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log(
  `check-sie-ansprache: ok (${files.length} files, ${colloquialFiles.length} colloquial)`,
);
