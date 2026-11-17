/**
 * § 147 Abs. 3 AO (BEG IV): Buchungsbelege 8 Jahre.
 * Schlägt fehl, wenn in lib/ oder app/ "Buchungsbeleg" (Einzahl oder Mehrzahl)
 * im selben Satz mit "10 Jahre" oder "zehn Jahre" steht.
 *
 * Der gesetzliche Dreiklang darf in einem Satz stehen, wenn "10 Jahre" bzw.
 * "zehn Jahre" in einem anderen Teilsatz (Komma oder Semikolon) zu Büchern,
 * Abschlüssen, Aufzeichnungen oder Organisationsunterlagen gehört und
 * "Buchungsbeleg" im eigenen Teilsatz mit "8 Jahre" oder "acht Jahre" steht.
 * Steht die Jahreszahl im direkt vorherigen Komma-Teilsatz
 * ("8 Jahre, soweit Buchungsbeleg"), zählt sie zum Beleg-Teilsatz.
 * "Buchungsbelege 10 Jahre", "soweit Buchungsbeleg 10 Jahre" und
 * "10 Jahre, soweit Buchungsbeleg" fallen durch.
 * Usage: npx tsx scripts/check-belegfrist.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const TEN = /(?<!\d)(?:10|zehn) Jahre(?![\p{L}])/u;
const EIGHT = /(?<!\d)(?:8|acht) Jahre(?![\p{L}])/u;
const BELEG = /Buchungsbeleg\w*/u;

function mentionsBeleg(text: string): boolean {
  return BELEG.test(text);
}

const ABBREVIATIONS = ["z. B.", "z.B.", "d. h.", "d.h.", "u. a.", "u.a.", "i. d.", "i.d.", "Abs.", "Nr.", "Rz.", "Art.", "bzw.", "ggf.", "ca.", "Dr.", "Bd."];

export function sentences(line: string): string[] {
  let masked = line;
  for (const abbr of ABBREVIATIONS) masked = masked.replaceAll(abbr, abbr.replaceAll(".", "·"));
  return masked
    .split(/[.!?]+/)
    .map((part) => part.replaceAll("·", ".").trim())
    .filter((part) => part.length > 0);
}

/** Treffer, wenn "Buchungsbeleg" im Satz an "10 Jahre" oder "zehn Jahre" hängt. */
export function belegfristHit(sentence: string): string | null {
  if (!mentionsBeleg(sentence) || !TEN.test(sentence)) return null;
  const clauses = sentence.split(/[,;]/);
  for (const clause of clauses) {
    if (mentionsBeleg(clause) && TEN.test(clause)) {
      return `Buchungsbeleg mit 10/zehn Jahre: ${sentence.trim()}`;
    }
  }
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

function hitsIn(text: string): string[] {
  const found: string[] = [];
  for (const line of text.split("\n")) {
    for (const sentence of sentences(line)) {
      const hit = belegfristHit(sentence);
      if (hit) found.push(hit);
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

const repoRoot = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const scanRoots = ["lib", "app"].map((dir) => path.join(repoRoot, dir));

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.(ts|tsx|mts|mjs|js|cjs)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

const failures: string[] = [];
for (const root of scanRoots) {
  for (const file of files(root)) {
    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      for (const sentence of sentences(lines[index])) {
        const hit = belegfristHit(sentence);
        if (hit) failures.push(`${path.relative(repoRoot, file)}:${index + 1}: ${hit}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("check-belegfrist: Buchungsbeleg darf nicht mit 10/zehn Jahre im selben Satz stehen:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log("check-belegfrist: ok");
