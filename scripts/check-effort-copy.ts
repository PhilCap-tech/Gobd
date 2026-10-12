/**
 * Öffentliche Texte dürfen die Verfahrensdokumentation nicht mehr als
 * kurzen Minuten-Einstieg verkaufen. Blogartikel dürfen die alte Formulierung
 * im Markdown noch enthalten: rewriteLegacyEffortClaims ersetzt sie beim Rendern.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  INTAKE_EFFORT_LINE,
  INTAKE_EFFORT_RANGE,
  PARTNER_EFFORT_LINE,
  READINESS_EFFORT_NOTE,
  rewriteLegacyEffortClaims,
} from "../lib/offer-copy";

const SHORT_PROMISE = /5\s*[–-]\s*8\s*Minuten|kurzes Intake/;
const GUARANTEE =
  "14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde.";

function fail(message: string): never {
  console.error(`check-effort-copy: ${message}`);
  process.exit(1);
}

function assertRewrites(sample: string, extra?: string): void {
  const out = rewriteLegacyEffortClaims(sample);
  if (SHORT_PROMISE.test(out) || /wenige Minuten/.test(out) || /oft schnell/.test(out)) {
    fail(`rewrite left a short promise in ${JSON.stringify(out)}`);
  }
  if (!out.includes(INTAKE_EFFORT_LINE) && !extra) {
    fail(`rewrite dropped the effort line for ${JSON.stringify(sample)}`);
  }
  if (extra && !out.includes(extra)) {
    fail(`rewrite dropped ${JSON.stringify(extra)}`);
  }
  if (rewriteLegacyEffortClaims(out) !== out) {
    fail(`rewrite is not idempotent for ${JSON.stringify(sample)}`);
  }
}

assertRewrites("Ca. 5–8 Minuten für den Einstieg.");
assertRewrites("Ca. 5–8 Minuten Einstieg.");
assertRewrites("Ca. 5-8 Minuten für den Einstieg.");
assertRewrites("nur 5–8 Minuten.");
assertRewrites(
  `kurzes Intake, dann PDF. Ca. 5–8 Minuten für den Einstieg. Keine Steuerberatung. ${GUARANTEE}`,
);
if (!rewriteLegacyEffortClaims(`x. ${GUARANTEE}`).includes(GUARANTEE)) {
  fail("guarantee sentence was altered");
}

const table = rewriteLegacyEffortClaims(
  "Einstieg typischerweise wenige Minuten, Nacharbeit bleibt",
);
if (/wenige Minuten/.test(table) || /5\s*[–-]\s*8/.test(table)) {
  fail("table cell still promises minutes");
}
const tool = rewriteLegacyEffortClaims("oft schnell, Fragen führen");
if (tool !== "Fragen führen, Ausfüllen in Etappen") {
  fail(`tool comparison cell is ${JSON.stringify(tool)}`);
}

for (const line of [INTAKE_EFFORT_LINE, INTAKE_EFFORT_RANGE, READINESS_EFFORT_NOTE, PARTNER_EFFORT_LINE]) {
  if (SHORT_PROMISE.test(line) || /\d+\s*[–-]\s*\d+\s*Minuten/.test(line)) {
    fail(`public effort constant still promises minutes: ${line}`);
  }
}
if (!INTAKE_EFFORT_RANGE.includes("2–3 Stunden") || !INTAKE_EFFORT_RANGE.includes("1,5 bis 5 Stunden")) {
  fail("total range must stay the QA span of about 2–3 hours, 1.5–5 hours");
}
if (!INTAKE_EFFORT_LINE.includes("Der Zwischenstand wird gespeichert")) {
  fail("effort line must say the draft is saved");
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

const blogFiles = walk("content/blog").filter(
  (file) => file.endsWith(".md") || file.endsWith(".mdx"),
);
if (blogFiles.length === 0) fail("no blog files");
for (const file of blogFiles) {
  const rendered = rewriteLegacyEffortClaims(readFileSync(file, "utf8"));
  if (SHORT_PROMISE.test(rendered) || /wenige Minuten/.test(rendered)) {
    fail(`${file} still promises a short full documentation after rewrite`);
  }
}

const rawFiles = [
  ...walk("app").filter((file) => file.endsWith(".ts") || file.endsWith(".tsx")),
  ...walk("components").filter((file) => file.endsWith(".ts") || file.endsWith(".tsx")),
  "content/faq.md",
  "lib/ops.ts",
  "lib/lead-magnet.ts",
  "lib/lead-magnet-inhalt.ts",
  "lib/login-mail.ts",
];
for (const file of rawFiles) {
  const text = readFileSync(file, "utf8");
  if (SHORT_PROMISE.test(text)) {
    fail(`${file} contains a short-documentation promise`);
  }
}

const faq = readFileSync("content/faq.md", "utf8");
if (!faq.includes(INTAKE_EFFORT_LINE) || !faq.includes(INTAKE_EFFORT_RANGE)) {
  fail("FAQ must include the shared effort line and the QA range");
}
if (!faq.includes("fertig abgeschlossenem Intake liegt die Dokumentation meist innerhalb weniger Minuten digital vor")) {
  fail("FAQ delivery time after a finished intake was dropped");
}

console.log(`check-effort-copy: ok (${blogFiles.length} blog files)`);
