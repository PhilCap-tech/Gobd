/**
 * Multi-Bereich checks: Belegfluss unchanged, area documents get their own chapter.
 * Usage: npx tsx scripts/check-bereiche.ts
 */
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { BEREICHE } from "@/lib/bereiche";
import {
  answersForNewBereich,
  CATALOG_STEPS,
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

if (process.argv[2] === "--print") {
  console.log(kasseDoc.cover);
  for (const chapter of kasseDoc.chapters) console.log(`\n----- ${chapter.id}\n${chapter.body}`);
}

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("all bereich checks passed");
