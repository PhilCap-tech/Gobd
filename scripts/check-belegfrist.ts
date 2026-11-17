/**
 * § 147 Abs. 3 AO (BEG IV): Buchungsbelege 8 Jahre.
 * Schlägt fehl, wenn in lib/, app/ oder content/ "Buchungsbeleg" (Einzahl oder
 * Mehrzahl) im selben Satz mit "10 Jahre", "10 Jahren", "zehn Jahre" oder
 * "zehnjährig" steht. Ein Satz darf über die nächste Zeile weitergehen.
 *
 * Der gesetzliche Dreiklang darf in einem Satz stehen, wenn "10 Jahre" bzw.
 * "zehn Jahre" in einem anderen Teilsatz (Komma, Semikolon oder "und") zu
 * Büchern, Abschlüssen, Aufzeichnungen oder Organisationsunterlagen gehört und
 * "Buchungsbeleg" im eigenen Teilsatz mit "8 Jahre" oder "acht Jahre" steht.
 * Steht die Jahreszahl im direkt vorherigen Komma-Teilsatz
 * ("8 Jahre, soweit Buchungsbeleg"), zählt sie zum Beleg-Teilsatz.
 * "Buchungsbelege 10 Jahre", "soweit Buchungsbeleg 10 Jahre",
 * "10 Jahre, soweit Buchungsbeleg", "zehnjährig" und "10 Jahren" fallen durch.
 * Usage: npx tsx scripts/check-belegfrist.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { bereichQuestionLines } from "@/lib/bereich-chapter";
import { AF } from "@/lib/module/fragen";

const TEN = /(?<![\p{L}\d])(?:(?:10|zehn)[\s-]*jährig\w*|(?:10|zehn)\s+Jahren?)(?![\p{L}])/iu;
const EIGHT = /(?<![\p{L}\d])(?:(?:8|acht)[\s-]*jährig\w*|(?:8|acht)\s+Jahren?)(?![\p{L}])/iu;
const BELEG = /Buchungsbeleg\w*/u;

function mentionsBeleg(text: string): boolean {
  return BELEG.test(text);
}

const ABBREVIATIONS = ["z. B.", "z.B.", "d. h.", "d.h.", "u. a.", "u.a.", "i. d.", "i.d.", "Abs.", "Nr.", "Rz.", "Art.", "bzw.", "ggf.", "ca.", "Dr.", "Bd."];

function maskAbbr(line: string): string {
  let masked = line;
  for (const abbr of ABBREVIATIONS) masked = masked.replaceAll(abbr, abbr.replaceAll(".", "·"));
  return masked;
}

export function sentences(line: string): string[] {
  return maskAbbr(line)
    .split(/[.!?]+/)
    .map((part) => part.replaceAll("·", ".").trim())
    .filter((part) => part.length > 0);
}

/** Historie bis 2024, Institutsausnahme und ausdrücklich verneinte Pauschalfrist. */
function statedAsPastOrException(sentence: string): boolean {
  if (/≠\s+pauschal\s+10\s+Jahre/u.test(sentence)) return true;
  if (/31\. Dezember 2024/.test(sentence) || /Dezember 2024 standen Buchungsbelege/.test(sentence)) return true;
  if (/noch mit zehn Jahren angesetzt/.test(sentence)) return true;
  if (/bleiben dort also bei zehn Jahren/.test(sentence)) return true;
  if (/demselben Kreis/.test(sentence)) return true;
  return false;
}

function clausesOf(sentence: string): string[] {
  return sentence.split(/[,;]|\sund\s/u);
}

/** Treffer, wenn "Buchungsbeleg" im Satz an 10/zehn Jahre(n) oder zehnjährig hängt. */
export function belegfristHit(sentence: string): string | null {
  if (!mentionsBeleg(sentence) || !TEN.test(sentence)) return null;
  if (statedAsPastOrException(sentence)) return null;
  const clauses = clausesOf(sentence);
  for (let index = 0; index < clauses.length; index += 1) {
    const clause = clauses[index];
    if (!mentionsBeleg(clause)) continue;
    if (EIGHT.test(clause)) continue;
    const previous = index > 0 ? clauses[index - 1] : "";
    if (EIGHT.test(previous) && !TEN.test(previous)) continue;
    return `Buchungsbeleg im selben Satz wie 10/zehn Jahre: ${sentence.trim()}`;
  }
  return null;
}

function endsSentence(line: string): boolean {
  return /[.!?]["')\]]*$/.test(maskAbbr(line).trim());
}

function proseContinuation(current: string, next: string): boolean {
  const following = next.trim();
  const last = current.trim();
  if (!last || !following) return false;
  if (endsSentence(last)) return false;
  if (/^(?:[|#>]|[-*]\s|\d+\.\s|```)/.test(following) || /^(?:[|#>]|[-*]\s|\d+\.\s|```)/.test(last)) return false;
  return true;
}

function sentenceHits(chunk: string): string[] {
  const found: string[] = [];
  for (const sentence of sentences(chunk)) {
    const hit = belegfristHit(sentence);
    if (hit) found.push(hit);
  }
  return found;
}

/** Einzelsätze und genau ein über die nächste Zeile gebrochener Satz. */
function hitsIn(text: string): string[] {
  const lines = text.split("\n");
  const found: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    found.push(...sentenceHits(line));
    const next = lines[index + 1];
    if (next !== undefined && proseContinuation(line, next)) {
      const alone = new Set([...sentenceHits(line), ...sentenceHits(next)]);
      for (const hit of sentenceHits(`${line.trim()} ${next.trim()}`)) {
        if (!alone.has(hit)) found.push(hit);
      }
    }
  }
  return found;
}

function assertCase(text: string, shouldFail: boolean): void {
  const found = hitsIn(text);
  if (shouldFail && found.length === 0) {
    console.error(`check-belegfrist: erwartet Treffer, keiner für: ${text}`);
    process.exit(1);
  }
  if (!shouldFail && found.length > 0) {
    console.error(`check-belegfrist: falscher Treffer für erlaubten Satz:\n${found.join("\n")}`);
    process.exit(1);
  }
}

assertCase("Buchungsbelege 10 Jahre, Handelsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO)", true);
assertCase("Buchungsbelege und Abschlussunterlagen 10 Jahre, Handels- und Geschäftsbriefe 6 Jahre.", true);
assertCase("Aufbewahrung Buchungsbelege 10 Jahre (§ 147 Abs. 3 AO).", true);
assertCase("Aufbewahrung der Buchungsbelege 10 Jahre (§ 147 Abs. 3 AO).", true);
assertCase("Aufbewahrung der Buchungsbelege zehn Jahre.", true);
assertCase("10 Jahre (§ 147 Abs. 3 AO), soweit Buchungsbelege.", true);
assertCase("soweit Buchungsbeleg 10 Jahre", true);
assertCase("10 Jahre, soweit Buchungsbeleg", true);
assertCase(
  "Bücher und Abschlüsse 10 Jahre, Buchungsbelege 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO)",
  false,
);
assertCase(
  "Bücher und Abschlussunterlagen 10 Jahre, Buchungsbelege 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO). Empfangene und abgesandte Handelsbriefe 6 Jahre; soweit Buchungsbeleg 8 Jahre.",
  false,
);
assertCase("Aufbewahrung der Buchungsbelege 8 Jahre (§ 147 Abs. 3 AO).", false);
assertCase(
  "Bücher, Jahresabschlüsse und Organisationsunterlagen werden 10 Jahre aufbewahrt. Für Buchungsbelege gilt seit 2025 eine Frist von 8 Jahren, Handels- und Geschäftsbriefe 6 Jahre.",
  false,
);
assertCase(
  "Bücher, Jahresabschlüsse und Organisationsunterlagen zehn Jahre, Buchungsbelege acht Jahre, Handels- und Geschäftsbriefe sechs Jahre.",
  false,
);
assertCase("8 Jahre als Buchungsbeleg; als Aufzeichnung 10 Jahre, im Zweifel die längere Frist", false);
assertCase(
  "8 Jahre, soweit Buchungsbeleg; soweit Aufzeichnung (z. B. Transaktionsliste) 10 Jahre; im Zweifel die längere Frist (§ 147 Abs. 1 Nr. 1, 4, Abs. 3 AO)",
  false,
);
assertCase("10 Jahre als Aufzeichnung; als Buchungsbeleg 8 Jahre, im Zweifel die längere Frist", false);
assertCase("Für Bücher und Aufzeichnungen gelten in der Regel zehn Jahre (§ 147 AO).", false);
assertCase(
  "Daneben stehen die allgemeinen Fristen, etwa acht Jahre für Buchungsbelege und zehn Jahre für Bücher.",
  false,
);

const NEGATIV: Array<[string, string]> = [
  ["Einzahl", "Der Buchungsbeleg wird 10 Jahre aufbewahrt."],
  ["zehnjährig", "Für Buchungsbelege gilt eine zehnjährige Frist."],
  ["10 Jahren", "Buchungsbelege sind 10 Jahren aufzubewahren."],
  ["Zeilenumbruch", "Aufbewahrung der Buchungsbelege\n10 Jahre."],
];

console.log("check-belegfrist: Negativ-Tests");
for (const [name, text] of NEGATIV) {
  const found = hitsIn(text);
  if (found.length === 0) {
    console.error(`negativ ${name}: kein Treffer, erwartet rot, für: ${JSON.stringify(text)}`);
    process.exit(1);
  }
  console.log(`negativ ${name}: rot — ${found[0]}`);
}

const af01 = AF.questions.find((question) => question.id === "AF01");
if (!af01) {
  console.error("check-belegfrist: AF01 fehlt in lib/module/fragen.ts");
  process.exit(1);
}
const af01Keys = af01.fields.map((field) => field.key);
if (af01Keys.includes("zuordnung") || af01Keys.join(",") !== "ablauf,liste") {
  console.error(`check-belegfrist: AF01 rendert unerwartete Felder: ${af01Keys.join(", ")}`);
  process.exit(1);
}
const rendered = bereichQuestionLines(af01, {
  status: "bestaetigt",
  values: {
    zuordnung: "Buchungsbelege 10 Jahre ALTENTEXT",
    ablauf: "Bücher und Abschlüsse 10 Jahre, Buchungsbelege 8 Jahre",
  },
}).join("\n");
if (rendered.includes("ALTENTEXT")) {
  console.error("check-belegfrist: AF01.zuordnung wird gerendert:\n" + rendered);
  process.exit(1);
}
if (!rendered.includes("Buchungsbelege 8 Jahre")) {
  console.error("check-belegfrist: AF01.ablauf fehlt in der Ausgabe:\n" + rendered);
  process.exit(1);
}
console.log("check-belegfrist: AF01.zuordnung ungerendert");

const repoRoot = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const scanRoots = [
  { dir: "lib", prose: false },
  { dir: "app", prose: false },
  { dir: "content", prose: true },
].map((item) => ({ ...item, root: path.join(repoRoot, item.dir) }));

function files(dir: string, prose: boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, prose, out);
    else if (prose ? /\.(md|mdx|txt|json)$/.test(entry.name) : /\.(ts|tsx|mts|mjs|js|cjs)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function locatedHits(text: string): { line: number; hit: string }[] {
  const lines = text.split("\n");
  const found: { line: number; hit: string }[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const hit of sentenceHits(line)) found.push({ line: index + 1, hit });
    const next = lines[index + 1];
    if (next !== undefined && proseContinuation(line, next)) {
      const alone = new Set([...sentenceHits(line), ...sentenceHits(next)]);
      for (const hit of sentenceHits(`${line.trim()} ${next.trim()}`)) {
        if (!alone.has(hit)) found.push({ line: index + 1, hit });
      }
    }
  }
  return found;
}

const failures: string[] = [];
for (const root of scanRoots) {
  for (const file of files(root.root, root.prose)) {
    const source = readFileSync(file, "utf8");
    for (const item of locatedHits(source)) {
      failures.push(`${path.relative(repoRoot, file)}:${item.line}: ${item.hit}`);
    }
  }
}

if (failures.length > 0) {
  console.error("check-belegfrist: Buchungsbeleg darf nicht mit 10/zehn Jahre im selben Satz stehen:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log("check-belegfrist: ok");
