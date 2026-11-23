/**
 * Katalogfragen mit Status „unbekannt“ („Muss ich klären“) und Freitext:
 * die Notiz steht im Kapitel und in der Offene-Punkte-Liste des PDFs.
 * Leerer Freitext bleibt ohne Label.
 * Usage: npx tsx scripts/check-klaer-notiz.ts
 */
import { generatePdf } from "@/lib/delivery";
import {
  KLAER_NOTIZ_LABEL,
  bereichQuestionLines,
  catalogQuestionCanCarryKlaerNotiz,
  klaerNotizText,
} from "@/lib/bereich-chapter";
import { catalogOpenPoints, catalogSummary, CATALOG_STEPS } from "@/lib/intake-catalog";
import { UO } from "@/lib/module/fragen";
import { MODULE } from "@/lib/module/katalog";
import { betriebFacts, redactDenied } from "@/lib/module/aussagen";
import { ensureGesamt, setModulEintrag } from "@/lib/module/status";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";
import { FREITEXT_MAX_CHARS } from "@/lib/intake-payload";
import { orderedPageTexts } from "./pdf-text";

const LE01 = "R357A-Verkaufsprozess-Nordlicht";
const AW01 = "R357A-Archiv-Regal-Blau";
const UO04_RAW = "R357A-Vertretung-Modul-Eins äöü **fett** → Pfeil";
const UO04 = "R357A-Vertretung-Modul-Eins äöü fett -> Pfeil";
const GEPLANT = "R357A-GEPLANT-DARF-FEHLEN";
const KEEP = new Set(["m01", "m02", "m15"]);

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

function count(haystack: string, needle: string): number {
  let found = 0;
  let from = 0;
  while (from <= haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    found += 1;
    from = at + needle.length;
  }
  return found;
}

function fixture(): IntakeAnswers {
  let answers = ensureGesamt(emptyAnswers());
  for (const modul of MODULE) {
    if (KEEP.has(modul.id)) continue;
    answers = setModulEintrag(answers, modul.id, {
      status: "nicht_vorhanden",
      reason: "QA: Modul nicht Teil dieses Prüffalls.",
    });
  }
  return {
    ...answers,
    katalog: {
      LE01: { status: "unbekannt", values: { ablauf: LE01 } },
      AW01: { status: "unbekannt", values: { elektronisch: AW01 } },
      UO04: { status: "unbekannt", values: { vertretung: UO04_RAW } },
      LE03: { status: "unbekannt", values: { ablauf: " \n\t " } },
      LE04: { status: "geplant", values: { ablauf: GEPLANT } },
    },
  };
}

const affected = [
  ...new Set(
    CATALOG_STEPS.flatMap((step) => step.questions)
      .filter((question) => catalogQuestionCanCarryKlaerNotiz(question.fields))
      .map((question) => question.id),
  ),
].sort();
console.log(`check-klaer-notiz: Freitext-Katalogfragen ${affected.length}`);
console.log(affected.join(", "));
expect(affected.includes("LE01") && affected.includes("AW01") && affected.includes("UO04"), "LE01, AW01 und UO04 tragen Freitext");
expect(!affected.includes("D01") && !affected.includes("C01"), "reine Auswahlfragen bleiben ohne Notiz-Feld");

expect(klaerNotizText([{ key: "ablauf", type: "textarea" }], { ablauf: " \n\t " }) === "", "Whitespace ist leer");
expect(klaerNotizText([{ key: "ablauf", type: "textarea" }], { ablauf: "**" }) === "", "nur Markdown-Sternchen ist leer");
expect(
  klaerNotizText([{ key: "ablauf", type: "textarea" }], { ablauf: "A|B **fett** → x" }) === "A/B fett -> x",
  "Pipe, Sternchen und Pfeil wie andere Freitexte",
);
const long = "ä".repeat(FREITEXT_MAX_CHARS + 25);
expect(
  klaerNotizText([{ key: "ablauf", type: "textarea" }], { ablauf: long }).length === FREITEXT_MAX_CHARS,
  "Länge wie andere Freitextfelder",
);
expect(
  klaerNotizText(
    [{ key: "name", type: "repeat", item: { name: "text", stand: { type: "enum", options: ["ja"] } } }],
    { name: [{ name: "R357A-Gleich", stand: "ja" }, { name: "R357A-Gleich", stand: "nein" }] },
  ) === "R357A-Gleich",
  "gleiche Freitextstücke und Auswahlen nicht doppelt",
);

const uo04 = UO.questions.find((question) => question.id === "UO04");
expect(Boolean(uo04), "UO04 vorhanden");
if (uo04) {
  const line = bereichQuestionLines(uo04, {
    status: "unbekannt",
    values: { vertretung: "Die Kasse steht im Keller" },
  }).join("\n");
  const kept = redactDenied(line, betriebFacts(ensureGesamt(emptyAnswers())));
  expect(kept.includes("noch zu klären. Siehe offene Punkte."), "Kapitel-Satz bleibt");
  expect(kept.includes(`${KLAER_NOTIZ_LABEL} Die Kasse steht im Keller`), "Notiz mit verneintem Wort bleibt");
  const leer = bereichQuestionLines(uo04, { status: "unbekannt", values: { vertretung: "   " } }).join("\n");
  expect(leer === `**${uo04.title}:** noch zu klären. Siehe offene Punkte.`, "leerer Freitext ohne Label");
  const geplant = bereichQuestionLines(uo04, {
    status: "geplant",
    values: { vertretung: GEPLANT },
  }).join("\n");
  expect(!geplant.includes(KLAER_NOTIZ_LABEL) && !geplant.includes(GEPLANT), "geplant bleibt ohne Notiz");
}

const answers = fixture();
const summary = catalogSummary(answers);
expect(
  summary.some(([, value]) => value === `Muss ich klären · ${LE01}`),
  "Review zeigt den LE01-Freitext",
);

let h01 = ensureGesamt(emptyAnswers());
h01 = setModulEintrag(h01, "m20", { status: "tool" });
h01 = {
  ...h01,
  katalog: {
    H01: {
      status: "unbekannt",
      values: {
        kontrollen: [{ name: "R357A-Kontrolle-Doppelt", turnus: "R357A-Kontrolle-Doppelt", wer: " ", nachweis: "" }],
      },
    },
  },
};
const h01Points = catalogOpenPoints(h01).filter((point) => point.id === "op-h01");
expect(h01Points.length === 1, `op-h01 einmal (ist ${h01Points.length})`);
expect(count(h01Points[0]?.text ?? "", "R357A-Kontrolle-Doppelt") === 1, "dieselbe Notiz nicht doppelt am Punkt");
expect((h01Points[0]?.text ?? "").includes(`${KLAER_NOTIZ_LABEL} R357A-Kontrolle-Doppelt`), "H01-Punkt trägt die Notiz");

const cases = [
  {
    id: "LE01",
    chapter: `Auftragsänderungen und Nachträge: noch zu klären. Siehe offene Punkte. ${KLAER_NOTIZ_LABEL} ${LE01}`,
    point: `Erfassung und Bestätigung von Auftragsänderungen sind nicht angegeben. ${KLAER_NOTIZ_LABEL} ${LE01}`,
    marker: LE01,
  },
  {
    id: "AW01",
    chapter: `Archivsystem: noch zu klären. Siehe offene Punkte. ${KLAER_NOTIZ_LABEL} ${AW01}`,
    point: `Archivsystem und Ablage sind nicht angegeben. ${KLAER_NOTIZ_LABEL} ${AW01}`,
    marker: AW01,
  },
  {
    id: "UO04",
    chapter: `Vertretungsregelung: noch zu klären. Siehe offene Punkte. ${KLAER_NOTIZ_LABEL} ${UO04}`,
    point: `Die Vertretungsregelung ist nicht angegeben. ${KLAER_NOTIZ_LABEL} ${UO04}`,
    marker: UO04,
  },
];

async function main() {
  const { buffer } = await generatePdf({
    answers,
    identity: {
      email: "qa@example.com",
      company: "QA Katalog GmbH",
      stripeSessionId: "",
      stripeCustomerId: "",
      stub: true,
    },
    documentId: "qa-klaer-notiz",
    version: 1,
  });
  const text = orderedPageTexts(buffer).join("");
  console.log("check-klaer-notiz: PDF-Text");
  for (const item of cases) {
    expect(text.includes(item.chapter), `${item.id} Notiz im Kapitel`);
    expect(text.includes(item.point), `${item.id} Notiz in der Offene-Punkte-Liste`);
    expect(count(text, item.marker) === 2, `${item.id} Notiz genau zweimal (ist ${count(text, item.marker)})`);
    console.log(`Kapitel ${item.id}: ${item.chapter}`);
    console.log(`Punkt ${item.id}: ${item.point}`);
  }
  const emptyChapter = "Abnahmen (soweit vorhanden): noch zu klären. Siehe offene Punkte.";
  expect(text.includes(emptyChapter), "leerer Freitext behält den Kapitel-Satz");
  expect(!text.includes(`${emptyChapter} ${KLAER_NOTIZ_LABEL}`), "leerer Freitext ohne Notiz im Kapitel");
  expect(
    !text.includes(`Ablauf und Dokumentation von Abnahmen sind nicht angegeben. ${KLAER_NOTIZ_LABEL}`),
    "leerer Freitext ohne Notiz in der Liste",
  );
  expect(!text.includes(GEPLANT), "geplanter Freitext bleibt draußen");
  expect(count(text, `${KLAER_NOTIZ_LABEL} `) === 6, `Notiz-Label sechsmal (ist ${count(text, `${KLAER_NOTIZ_LABEL} `)})`);
  expect(!text.includes("**fett**") && !text.includes("→"), "Markdown und Pfeil nicht roh im PDF");

  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log("check-klaer-notiz: ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "check-klaer-notiz failed");
  process.exit(1);
});
