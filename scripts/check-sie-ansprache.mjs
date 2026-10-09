// Fails the build when covered customer copy still addresses the customer with du.
// COVERED is the entry path plus transactional mails, account, and intake.
// Blog and lead magnets stay in check-forbidden-words.mjs. Leave the matchers
// as they are.
//
// Only user-visible copy is checked: markdown as written, and in TS/TSX the
// string literals plus text nodes. Code identifiers such as `dir` are ignored.
// Partner and Steuerberater templates in lib/ops.ts are Sie and pass as written.
// A line marked with `allow-du` is skipped (same idea as allow-forbidden).
import { globSync, readFileSync } from "node:fs";

/** @type {string[]} */
const COVERED = [
  "app/page.tsx",
  "app/faq/**/*.{ts,tsx}",
  "content/faq.md",
  "app/readiness/**/*.{ts,tsx}",
  "app/checkout/**/*.{ts,tsx}",
  "app/api/checkout/route.ts",
  "app/muster/**/*.{ts,tsx}",
  "lib/offer-copy.ts",
  "components/consent-banner.tsx",
  "components/site-header.tsx",
  "components/site-footer.tsx",
  "content/readiness/**/*.md",
  "lib/readiness.ts",
  "lib/ops.ts",
  "app/account/**/*.{ts,tsx}",
  "app/login/**/*.{ts,tsx}",
  "app/intake/**/*.{ts,tsx}",
  "app/success/**/*.{ts,tsx}",
  "app/billing/**/*.{ts,tsx}",
  "app/portal/**/*.{ts,tsx}",
  "components/account-abo.tsx",
  "components/account-billing.tsx",
  "components/account-free.tsx",
  "components/account-profile-form.tsx",
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

assertMatcher();
assertScan();

const files = [...new Set(COVERED.flatMap((pattern) => globSync(pattern)))].sort();
if (files.length === 0) {
  console.error("check-sie-ansprache: no files matched");
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

if (failed) process.exit(1);

console.log(`check-sie-ansprache: ok (${files.length} files)`);
