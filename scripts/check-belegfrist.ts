/**
 * § 147 Abs. 3 AO (BEG IV): Buchungsbelege 8 Jahre.
 * Schlägt fehl, wenn in lib/, app/, components/*.tsx, content/ oder
 * public/llms.txt "Buchungsbeleg" (Einzahl oder Mehrzahl) im selben Satz mit
 * "10 Jahre", "10 Jahren", "zehn Jahre" oder "zehnjährig" steht. Ein Satz darf
 * über bis zu zwei Folgezeilen weitergehen. Verneinungen („nicht mehr 10,
 * sondern 8“, „8 statt 10“) sind kein Treffer. „demselben Kreis“ gilt nur
 * zusammen mit der HGB-Ausnahme (§ 257 oder HGB).
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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { hitsIn, locatedHits } from "@/lib/belegfrist";
import { BELEGFRIST_SAETZE } from "./fixtures/belegfrist-saetze";
import { bereichQuestionLines } from "@/lib/bereich-chapter";
import { AF } from "@/lib/module/fragen";

/**
 * Lesbare Ersetzungsquellen. Der Altsatz steht im Quelltext, damit die
 * Ersetzung nachvollziehbar bleibt, und wird nicht ins PDF übernommen.
 * Jeder Eintrag nennt Datei, exakten Text und die Begründung.
 * Dieselbe Zeichenfolge in einer anderen Datei bleibt ein Treffer.
 */
export const BELEGFRIST_ALLOWLIST: ReadonlyArray<{ file: string; text: string; reason: string }> = [
  {
    file: "lib/schnellversion-neutral.ts",
    text: "Buchungsbelege 10 Jahre",
    reason:
      "Migrationsquelle in neutralizeStandardText: ältere Vorlagen werden auf „Buchungsbelege 8 Jahre“ umgeschrieben. Der Altsatz erscheint nicht im PDF.",
  },
];

function allowlistedLine(rel: string, line: string): boolean {
  return BELEGFRIST_ALLOWLIST.some(
    (entry) => entry.file === rel && entry.reason.trim().length > 0 && line.includes(entry.text),
  );
}

/** Treffer nach Allowlist. Zeilen der Liste zählen in dieser Datei nicht. */
export function belegfristFileHits(rel: string, source: string): string[] {
  const cleaned = source
    .split("\n")
    .map((line) => (allowlistedLine(rel, line) ? "" : line))
    .join("\n");
  return locatedHits(cleaned).map((item) => item.hit);
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
  ["nach 10 Jahren", "Buchungsbelege werden nach 10 Jahren gelöscht."],
  ["Zeilenumbruch", "Aufbewahrung der Buchungsbelege\n10 Jahre."],
  ["Verneinung", "Für Buchungsbelege gelten 10 statt 8 Jahre."],
  ["drei Zeilen", "Aufbewahrung der\nBuchungsbelege\n10 Jahre."],
  ["demselben Kreis", "In demselben Kreis gelten für Buchungsbelege 10 Jahre."],
];

const POSITIV: Array<[string, string]> = [
  ["Verneinung nicht mehr", "Buchungsbelege werden nicht mehr 10 Jahre, sondern 8 Jahre aufbewahrt."],
  ["Verneinung statt", "Für Buchungsbelege gelten 8 statt 10 Jahre."],
  [
    "drei Zeilen erlaubt",
    "Bücher und Aufzeichnungen\n10 Jahre, Buchungsbelege\n8 Jahre.",
  ],
  [
    "demselben Kreis HGB",
    "Handelsrechtlich sind Buchungsbelege bei demselben Kreis nach § 257 Abs. 4 Satz 2 HGB zehn Jahre aufzubewahren.",
  ],
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

console.log("check-belegfrist: Positiv-Tests");
for (const [name, text] of POSITIV) {
  const found = hitsIn(text);
  if (found.length > 0) {
    console.error(`positiv ${name}: falscher Treffer, erwartet grün:\n${found.join("\n")}`);
    process.exit(1);
  }
  console.log(`positiv ${name}: grün`);
}

console.log("check-belegfrist: 21 Testsätze");
for (const satz of BELEGFRIST_SAETZE) {
  const found = hitsIn(satz.text);
  const hit = found.length > 0;
  if (hit !== satz.hit) {
    console.error(
      `Fixture ${satz.name}: erwartet ${satz.hit ? "Treffer" : "keinen Treffer"}, ist ${hit ? "Treffer" : "kein Treffer"}: ${satz.text}`,
    );
    process.exit(1);
  }
  console.log(`fixture ${satz.name}: ${satz.hit ? "zählt" : "zählt nicht"}`);
}

if (!belegfristScanPath("components/site-header.tsx") || !belegfristScanPath("public/llms.txt")) {
  console.error("check-belegfrist: components/**/*.tsx oder public/llms.txt werden nicht gescannt");
  process.exit(1);
}
if (belegfristScanPath("components/helper.ts") || belegfristScanPath("public/robots.txt") || belegfristScanPath("scripts/check-belegfrist.ts")) {
  console.error("check-belegfrist: der Scan umfasst Dateien außerhalb von components/*.tsx und public/llms.txt");
  process.exit(1);
}
console.log("positiv Scan components und llms.txt: grün");
console.log("negativ Scan ohne components/*.ts, public/robots.txt, scripts: grün");

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
function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (belegfristScanPath(path.relative(repoRoot, full))) out.push(full);
  }
  return out;
}

/** true für die Dateien, die der Scan prüfen soll. */
export function belegfristScanPath(rel: string): boolean {
  const norm = rel.replaceAll("\\", "/");
  if (norm === "public/llms.txt") return true;
  if (norm.startsWith("components/") && norm.endsWith(".tsx")) return true;
  if (/^(?:lib|app)\//.test(norm) && /\.(?:ts|tsx|mts|mjs|js|cjs)$/.test(norm) && !norm.endsWith(".d.ts")) return true;
  if (norm.startsWith("content/") && /\.(?:md|mdx|txt|json)$/.test(norm)) return true;
  return false;
}

const migrationLine = 'next = next.replaceAll("Buchungsbelege 10 Jahre", "Buchungsbelege 8 Jahre");';
if (BELEGFRIST_ALLOWLIST.some((entry) => !entry.file.trim() || !entry.text.trim() || !entry.reason.trim())) {
  console.error("check-belegfrist: Allowlist-Eintrag ohne Datei, Text oder Begründung");
  process.exit(1);
}
if (belegfristFileHits("lib/schnellversion-neutral.ts", migrationLine).length !== 0) {
  console.error("check-belegfrist: die dokumentierte Ersetzungsquelle wird nicht ausgenommen");
  process.exit(1);
}
if (belegfristFileHits("lib/bereiche.ts", migrationLine).length === 0) {
  console.error("check-belegfrist: dieselbe Zeichenfolge außerhalb der Allowlist muss rot bleiben");
  process.exit(1);
}
const neutralSource = readFileSync(path.join(repoRoot, "lib/schnellversion-neutral.ts"), "utf8");
const altSatz = (neutralSource.match(/Buchungsbelege 10 Jahre/g) ?? []).length;
if (altSatz !== 1 || neutralSource.includes('["Buchungsbelege", "10", "Jahre"].join')) {
  console.error("check-belegfrist: die Ersetzungsquelle muss einmal, lesbar und ohne String-Zerlegung stehen");
  process.exit(1);
}
console.log("check-belegfrist: Allowlist mit Begründung, Negativfall außerhalb der Datei bleibt rot");

const failures: string[] = [];
for (const dir of ["lib", "app", "components", "content", "public"]) {
  const root = path.join(repoRoot, dir);
  if (!existsSync(root)) continue;
  for (const file of files(root)) {
    const rel = path.relative(repoRoot, file);
    const source = readFileSync(file, "utf8");
    for (const hit of belegfristFileHits(rel, source)) {
      failures.push(`${rel}: ${hit}`);
    }
  }
}

if (failures.length > 0) {
  console.error("check-belegfrist: Buchungsbeleg darf nicht mit 10/zehn Jahre im selben Satz stehen:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log("check-belegfrist: ok");
