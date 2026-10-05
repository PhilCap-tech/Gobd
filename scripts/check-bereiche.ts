/**
 * Multi-Bereich checks: Belegfluss unchanged, area documents get their own chapter.
 * Usage: npx tsx scripts/check-bereiche.ts
 */
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { BEREICHE, bereichById } from "@/lib/bereiche";
import { BEREICH_MUSTER } from "@/lib/bereich-muster";
import { generatePdf } from "@/lib/delivery";
import { demoBeispielAnswers } from "@/lib/demo-beispiel";
import type { MusterFall } from "@/lib/bereich-muster";
import { getMuster, fragebogenMarkdown, MUSTER_BEREICH_IDS } from "@/lib/muster";
import {
  answersForNewBereich,
  CATALOG_STEPS,
  BEREICH_RAHMEN_STEP_ID,
  catalogFragebogen,
  catalogStepError,
  visibleCatalogQuestions,
} from "@/lib/intake-catalog";
import { PARTNER_MUSTER_ANSWERS, PARTNER_MUSTER_IDENTITY } from "@/lib/partner-muster";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

let failed = 0;
function expect(ok: boolean, label: string) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${label}`);
  } else console.log(`ok   ${label}`);
}

function asked(answers: IntakeAnswers): string[] {
  const ids: string[] = [];
  for (let step = 0; step < CATALOG_STEPS.length; step += 1) {
    for (const question of visibleCatalogQuestions(step, answers)) ids.push(question.id);
  }
  return ids;
}

const ids = new Set<string>();
for (const bereich of BEREICHE) {
  for (const question of bereich.questions) {
    expect(!ids.has(question.id), `${question.id} unique`);
    ids.add(question.id);
    for (const id of bereich.sections.flatMap((section) => section.questions)) {
      expect(bereich.questions.some((item) => item.id === id), `${bereich.id} section question ${id} exists`);
    }
  }
}

const beleg = asked(emptyAnswers());
expect(beleg.includes("A02") && beleg.includes("C01") && beleg.includes("F01"), "Belegfluss asks A02, C01, F01");
expect(!beleg.some((id) => /^(KA|WW|LO)\d/.test(id)), "Belegfluss asks no area questions");

const kasseAsked = asked({ ...emptyAnswers(), bereich: "kasse" });
expect(kasseAsked.includes("KA01") && kasseAsked.includes("KA08"), "Kasse asks KA questions");
expect(!kasseAsked.includes("A02") && !kasseAsked.includes("C01") && !kasseAsked.includes("F01"), "Kasse skips Belegfluss steps");
expect(kasseAsked.includes("A01") && kasseAsked.includes("G06") && kasseAsked.includes("I04"), "Kasse keeps the general part");
expect(!kasseAsked.includes("WW01"), "Kasse does not ask Warenwirtschaft");

const brIndex = CATALOG_STEPS.findIndex((step) => step.id === "step-BR");
expect(
  catalogStepError(brIndex, { ...emptyAnswers(), bereich: "kasse" }).length > 0,
  "area step requires statuses",
);

// Belegfluss render stays Belegfluss
const belegDoc = renderDeliveryDocument({
  identity: PARTNER_MUSTER_IDENTITY,
  answers: PARTNER_MUSTER_ANSWERS,
  documentId: "check",
  version: 1,
});
expect(belegDoc.cover.startsWith("# Verfahrensdokumentation zur Belegablage"), "Belegfluss cover title");
expect(belegDoc.chapters.some((c) => c.id === "05-eingang-erechnung"), "Belegfluss has chapter 5");
expect(!belegDoc.chapters.some((c) => c.id.startsWith("bereich-")), "Belegfluss has no area chapter");

// Kasse render
const kasse: IntakeAnswers = {
  ...answersForNewBereich(PARTNER_MUSTER_ANSWERS, "kasse", PARTNER_MUSTER_IDENTITY.company),
};
kasse.katalog = {
  ...kasse.katalog,
  KA00: { status: "bestaetigt", values: { verantwortlich: "Filialleitung", vertretung: "Inhaberin" } },
  KA01: { status: "bestaetigt", values: { kassenart: "Elektronisches Kassensystem mit TSE", system: "Beispielkasse X" } },
  KA02: { status: "unbekannt", values: {} },
  KA03: { status: "geplant", values: { beleg: ["Papierbon"] } },
  KA05: { status: "nicht_zutreffend", reason: "keine Gutscheine, keine Entnahmen", values: {} },
};
const kasseDoc = renderDeliveryDocument({
  identity: PARTNER_MUSTER_IDENTITY,
  answers: kasse,
  documentId: "check",
  version: 1,
});
const chapterIds = kasseDoc.chapters.map((c) => c.id);
console.log(chapterIds.join(", "));
expect(kasseDoc.cover.startsWith("# Verfahrensdokumentation Kasse und Kassensystem"), "Kasse cover title");
expect(chapterIds.includes("bereich-kasse"), "Kasse chapter present");
expect(!chapterIds.some((id) => /^0[4-8]-/.test(id) || id === "A-prozessmatrix"), "Belegfluss chapters omitted");
expect(chapterIds.indexOf("bereich-kasse") === chapterIds.indexOf("03-systeme-datenfluss") + 1, "Kasse chapter after 3");
const titles = kasseDoc.chapters.map((c) => c.title);
console.log(titles.join(" | "));
expect(titles.some((t) => t.startsWith("5 Ablage")), "chapter 9 renumbered to 5");
expect(titles.some((t) => t.startsWith("10 Offene")), "chapter 14 renumbered to 10");
const area = kasseDoc.chapters.find((c) => c.id === "bereich-kasse")!;
expect(area.body.includes("Beispielkasse X"), "bestätigt value printed");
expect(area.body.includes("**Belegausgabe:** vorgesehen"), "geplant not present tense");
expect(area.body.includes("entfällt. Grund: keine Gutscheine"), "nicht_zutreffend reason printed");
const opIds = kasseDoc.openPoints.map((p) => p.id);
expect(opIds.includes("op-ka02") && opIds.includes("op-ka03"), "unbekannt/geplant become open points");
expect(!opIds.includes("op-eingangsbelege") && !opIds.includes("op-c02-sichtung"), "no Belegfluss rules");
expect(kasseDoc.cover.includes("Filialleitung"), "Bereichsverantwortung on cover");

for (const bereich of BEREICHE) {
  const doc = renderDeliveryDocument({
    identity: PARTNER_MUSTER_IDENTITY,
    answers: { ...emptyAnswers(), bereich: bereich.id },
    documentId: "check",
    version: 1,
  });
  const text = [doc.cover, ...doc.chapters.map((c) => c.body)].join("\n");
  expect(!text.includes("{{") && !text.includes("undefined"), `${bereich.id} renders without placeholders`);
}

// Area frame step and IDs
expect(CATALOG_STEPS.some((step) => step.id === BEREICH_RAHMEN_STEP_ID), "frame step present");
for (const bereich of BEREICHE) {
  if (bereich.id === "belegfluss") continue;
  const frame = bereich.questions.filter((question) => question.rahmen);
  expect(frame.length === 7, `${bereich.id} has 7 frame questions`);
  expect(bereich.prozess.length >= 5, `${bereich.id} has >= 5 process steps`);
  expect(bereich.kontrollen.length >= 5, `${bereich.id} has >= 5 controls`);
  expect(bereich.aufbewahrung.length >= 3, `${bereich.id} has retention rows`);
  for (const row of bereich.aufbewahrung) {
    expect(row.frist.trim().length > 0 && /§|Art\./.test(row.grundlage), `${bereich.id} retention ${row.unterlage} has period and basis`);
    const plain = row.frist.match(/^(\d+) Jahre$/);
    if (plain && /§ 147 Abs\. 1/.test(row.grundlage)) {
      const expected: Record<string, RegExp> = { "10": /Nr\. 1\b/, "8": /Nr\. 4\b/, "6": /Nr\. [235]\b/ };
      expect(Boolean(expected[plain[1]]?.test(row.grundlage)), `${bereich.id} ${row.unterlage}: ${row.frist} matches § 147 Abs. 1 (${row.grundlage})`);
    }
  }
  for (const step of bereich.prozess) {
    if (!step.rolle) continue;
    const [qid, key] = step.rolle.split(".");
    const question = bereich.questions.find((item) => item.id === qid);
    expect(Boolean(question?.fields.some((field) => field.key === key)), `${bereich.id} role ref ${step.rolle} exists`);
  }
}

async function measureMuster(fall: MusterFall) {
  const doc = renderDeliveryDocument({
    identity: fall.identity,
    answers: fall.answers,
    documentId: fall.documentId,
    version: fall.version,
    versionMeta: fall.versionMeta,
    versionHistory: fall.versionHistory,
  });
  const text = [doc.cover, ...doc.chapters.map((c) => c.body)].join("\n");
  const { buffer } = await generatePdf({
    answers: fall.answers,
    identity: fall.identity,
    documentId: fall.documentId,
    version: fall.version,
    versionMeta: fall.versionMeta,
    versionHistory: fall.versionHistory,
  });
  const pages = (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  return { doc, text, words: text.split(/\s+/).length, pages, asked: asked(fall.answers).length };
}

async function checkMuster() {
  const belegDemoAsked = asked(demoBeispielAnswers()).length;
  const base = await measureMuster(getMuster("belegfluss")!);
  console.log(`Belegfluss: ${belegDemoAsked} Fragen (Demo), ${base.words} Wörter, ${base.pages} Seiten`);
  expect(MUSTER_BEREICH_IDS.length === BEREICHE.length, "every area has a Muster");
  for (const id of MUSTER_BEREICH_IDS) {
    const fall = getMuster(id)!;
    const fb = fragebogenMarkdown(fall);
    expect(fb.length > 2000 && !fb.includes("undefined"), `${id} Muster-Fragebogen rendered`);
    expect(catalogFragebogen(fall.answers).length > 0, `${id} catalogFragebogen has steps`);
    if (id === "belegfluss") continue;
    const m = await measureMuster(fall);
    console.log(`${id}: ${m.asked} Fragen, ${m.words} Wörter, ${m.pages} Seiten`);
    expect(m.asked >= belegDemoAsked, `${id} asks >= Belegfluss questions (${m.asked} >= ${belegDemoAsked})`);
    expect(m.words >= base.words, `${id} output words >= Belegfluss (${m.words} >= ${base.words})`);
    expect(m.pages >= base.pages, `${id} PDF pages >= Belegfluss (${m.pages} >= ${base.pages})`);
    expect(fall.identity.company.includes("Muster"), `${id} Muster company labelled`);
    expect(m.doc.chapters.some((c) => c.id === `bereich-${id}-matrix`), `${id} Prozessmatrix present`);
    expect(!m.text.includes("{{") && !m.text.includes("undefined") && !m.text.includes("→"), `${id} clean output`);
    expect(m.text.includes("| 1.0 | 01.01.2026 | 30.06.2026 |") && m.text.includes("| Gültig ab | 01.07.2026 |"), `${id} history row and Gültig ab rendered`);
    const bereich = bereichById(id);
    for (const [qid, answer] of Object.entries(fall.answers.katalog ?? {})) {
      if (!/^[A-Z]{2}\d{2}$/.test(qid) || /^[A-I]\d/.test(qid)) continue;
      const question = bereich.questions.find((item) => item.id === qid);
      expect(Boolean(question), `${id} Muster answer ${qid} is an area question`);
      for (const key of Object.keys(answer.values ?? {})) {
        expect(Boolean(question?.fields.some((field) => field.key === key)), `${id} Muster ${qid}.${key} is a field`);
      }
    }
  }
  expect(Object.keys(BEREICH_MUSTER).length === BEREICHE.length - 1, "area Muster count");
}

async function main() {
  await checkMuster();

  
  if (process.argv[2] === "--print") {
    console.log(kasseDoc.cover);
    for (const chapter of kasseDoc.chapters) console.log(`\n----- ${chapter.id}\n${chapter.body}`);
  }
  
  if (failed) {
    console.error(`${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("all bereich checks passed");
}

void main();
