/**
 * Offline-Check: leere Karten bei B01 und den gleichen Listen B04, B05, G01.
 * Eine volle plus eine leere Karte geht durch. Eine teilweise ausgefüllte Karte
 * blockiert. Ein Entwurf mit leerer Karte wird beim Laden und Speichern bereinigt.
 * Usage: npx tsx scripts/check-b01-systemkarten.ts
 */
import { CATALOG_STEPS, catalogStepIssues } from "@/lib/intake-catalog";
import { demoBeispielAnswers } from "@/lib/demo-beispiel";
import {
  ANBIETER_UNTERLAGEN,
  normalizeIntakeAnswers,
  p1FieldError,
  stripEmptyIntakeCards,
} from "@/lib/intake-present";
import { ensureGesamt } from "@/lib/module/status";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

function stepId(id: string): number {
  const index = CATALOG_STEPS.findIndex((step) => step.id === id);
  if (index < 0) throw new Error(`Schritt ${id} fehlt`);
  return index;
}

function messages(step: string, questionId: string, answers: IntakeAnswers): string[] {
  return catalogStepIssues(stepId(step), answers)
    .filter((issue) => issue.questionId === questionId)
    .map((issue) => issue.message);
}

function legacy(katalog: NonNullable<IntakeAnswers["katalog"]>): IntakeAnswers {
  return { ...emptyAnswers(), fibu: ["DATEV"], katalog };
}

function paid(katalog: NonNullable<IntakeAnswers["katalog"]>): IntakeAnswers {
  return ensureGesamt(legacy(katalog));
}

const fullSystem = {
  name: "DATEV",
  funktion: "FiBu und Belegablage",
  typ: "fibu",
  nutzer: "Geschäftsführung und Buchhaltung",
  belegeRein: ["Eingangsrechnungen", "Ausgangsrechnungen"],
  uebergabe: "Ablage in DATEV Unternehmen online",
  originalOrt: "DATEV Unternehmen online",
  hostingArt: "Anbieter-Cloud",
};

const whitespaceSystem = {
  name: "  ",
  funktion: "\n",
  typ: "",
  nutzer: "",
  belegeRein: [] as string[],
  uebergabe: " ",
  originalOrt: "",
  hostingArt: "",
};

const partialSystem = { name: "lexoffice", funktion: "", typ: "" };

const fullWeg = { belegweg: "E-Mail-PDF", originalBeschreibung: "empfangene PDF" };
const partialWeg = { belegweg: "Portal", originalBeschreibung: "" };
const emptyWeg = { belegweg: " ", originalBeschreibung: "  " };
const flaggedWeg = { belegweg: "", originalBeschreibung: "", andererWeg: true };

const stand = Object.fromEntries(ANBIETER_UNTERLAGEN.map((name) => [name, "vorhanden"]));
const fullProvider = { name: "DATEV Unternehmen online", unterlagenStand: stand, unterlagenVorhanden: "ja" };
const partialProvider = { name: "lexoffice", unterlagenStand: {} };
const standOnlyProvider = { name: "  ", unterlagenStand: { Vertrag: "vorhanden" } };
const emptyProvider = { name: " ", unterlagenStand: { Vertrag: "  " }, unterlagenVorhanden: "" };

const fullAblage = { art: "Eingangsrechnungen", ort: "DATEV Unternehmen online", suche: "Belegdatum und Lieferant" };
const partialAblage = { art: "Kassenbelege", ort: "", suche: " " };
const emptyAblage = { art: "  ", ort: "", suche: "" };

const b01Name = "Bitte Name, Zweck und Art je System nennen.";
const b04Partial = "Bitte je Eingangsweg den Weg und das Original nennen.";
const b05Name = "Bitte das System beim Anbieter benennen.";
const g01Partial = "Bitte je Belegart Ablageort und Suchmerkmale angeben.";

function b01(rows: unknown[], status = "bestaetigt"): IntakeAnswers {
  return legacy({
    B01: {
      status: status as "bestaetigt",
      responsible: "Kim Prüfer",
      date: "2026-11-01",
      values: {
        systeme: rows,
        it: "Geschäftsführung",
        weitereFreitext: "NAS im Büro",
        hosting: "Anbieter-Cloud",
      },
    },
  });
}

expect(p1FieldError("B01", "bestaetigt", { systeme: [fullSystem, {}] }) === "", "B01 volle plus leere Karte");
expect(
  p1FieldError("B01", "bestaetigt", { systeme: [fullSystem, whitespaceSystem] }) === "",
  "B01 Whitespace-Karte zählt als leer",
);
expect(
  p1FieldError("B01", "bestaetigt", { systeme: [partialSystem] }) === b01Name,
  "B01 nur Name blockiert",
);
expect(
  p1FieldError("B01", "bestaetigt", { systeme: [fullSystem, partialSystem] }) === b01Name,
  "B01 volle plus teilweise Karte blockiert",
);
expect(
  p1FieldError("B01", "bestaetigt", { systeme: [{}] }) === "Bitte mindestens ein System nennen.",
  "B01 ohne System bleibt Pflicht",
);
expect(p1FieldError("B01", "unbekannt", { systeme: [fullSystem, {}] }) === "", "B01 ungeklärt prüft die Karten nicht");
expect(messages("step-B", "B01", b01([fullSystem, {}])).length === 0, "Demo-Schritt lässt volle plus leere Karte durch");
expect(messages("step-B", "B01", b01([fullSystem, partialSystem])).includes(b01Name), "Demo-Schritt blockiert die teilweise Karte");
expect(
  messages("step-M17", "B01", paid(b01([fullSystem, {}]).katalog ?? {})).length === 0,
  "Modul 17 lässt volle plus leere Karte durch",
);
expect(
  messages("step-M17", "B01", paid(b01([partialSystem]).katalog ?? {})).includes(b01Name),
  "Modul 17 blockiert die teilweise Karte",
);

const demo = demoBeispielAnswers();
const demoSystems = [...((demo.katalog?.B01?.values?.systeme as unknown[]) ?? []), {}];
const demoWithEmpty: IntakeAnswers = {
  ...demo,
  katalog: {
    ...demo.katalog,
    B01: {
      ...demo.katalog?.B01,
      values: { ...demo.katalog?.B01?.values, systeme: demoSystems },
    },
  },
};
expect(
  messages("step-B", "B01", demoWithEmpty).length === 0,
  "Beispielbetrieb plus leere zweite Karte kommt im Demo-Schritt durch",
);

expect(
  p1FieldError("B04", "bestaetigt", { originalJeWeg: [fullWeg, emptyWeg] }) === "",
  "B04 volle plus leere Karte",
);
expect(
  p1FieldError("B04", "bestaetigt", { originalJeWeg: [fullWeg, partialWeg] }) === b04Partial,
  "B04 teilweise Karte blockiert",
);
expect(
  p1FieldError("B04", "bestaetigt", { originalJeWeg: [fullWeg, flaggedWeg] }) === b04Partial,
  "B04 nur gesetztes „anderer Weg“ blockiert",
);
expect(
  messages("step-B", "B04", legacy({ B04: { status: "bestaetigt", values: { originalJeWeg: [fullWeg, {}] } } })).length ===
    0,
  "Demo-Schritt lässt den leeren Eingangsweg durch",
);

expect(
  p1FieldError("B05", "bestaetigt", { anbieter: "ja", externeSysteme: [fullProvider, emptyProvider] }) === "",
  "B05 volle plus leere Karte",
);
expect(
  p1FieldError("B05", "bestaetigt", { anbieter: "ja", externeSysteme: [fullProvider, partialProvider] }).includes(
    "Unterlage",
  ),
  "B05 Name ohne Unterlagen blockiert",
);
expect(
  p1FieldError("B05", "bestaetigt", { anbieter: "ja", externeSysteme: [fullProvider, standOnlyProvider] }) === b05Name,
  "B05 Unterlage ohne Name blockiert",
);
expect(
  messages("step-M17", "B05", paid({
    B05: { status: "bestaetigt", values: { anbieter: "ja", externeSysteme: [fullProvider, {}] } },
  })).length === 0,
  "Modul 17 lässt das leere Anbietersystem durch",
);

expect(
  p1FieldError("G01", "bestaetigt", { ablageJeArt: [fullAblage, emptyAblage] }) === "",
  "G01 volle plus leere Karte",
);
expect(
  p1FieldError("G01", "bestaetigt", { ablageJeArt: [fullAblage, partialAblage] }) === g01Partial,
  "G01 teilweise Karte blockiert",
);
expect(
  messages("step-G", "G01", legacy({
    G01: {
      status: "bestaetigt",
      values: {
        ablageJeArt: [fullAblage, {}],
        ablage: "DATEV Unternehmen online",
        ordnung: "Eingangsrechnungen: Belegdatum und Lieferant",
      },
    },
  })).length === 0,
  "Demo-Schritt lässt die leere Belegart durch",
);
expect(
  messages("step-M15", "G01", paid({ G01: { status: "bestaetigt", values: { ablageJeArt: [fullAblage, partialAblage] } } })).includes(
    g01Partial,
  ),
  "Modul 15 blockiert die teilweise Belegart",
);

const h01Values = {
  keineKontrolle: true,
  kontrollen: [{ name: "Stichprobe", turnus: "monatlich", wer: "A", nachweis: "Liste" }],
};
const a01 = { status: "bestaetigt" as const, values: { gf: "Anna Beispiel", standort: "Hamburg" } };
const dirty = b01([fullSystem, {}, whitespaceSystem, partialSystem]);
dirty.katalog = {
  ...dirty.katalog,
  A01: a01,
  B04: {
    status: "bestaetigt",
    values: { originalJeWeg: [fullWeg, emptyWeg, flaggedWeg] },
  },
  B05: {
    status: "bestaetigt",
    values: { anbieter: "ja", externeSysteme: [fullProvider, emptyProvider, standOnlyProvider] },
  },
  G01: {
    status: "bestaetigt",
    values: { ablageJeArt: [fullAblage, emptyAblage, partialAblage] },
  },
  H01: { status: "bestaetigt", values: h01Values },
};
dirty.systeme = [{ name: "DATEV", funktion: "FiBu" }];
dirty.module = { version: 1, check: { papier: "nein" }, status: {} };

const loaded = stripEmptyIntakeCards(dirty);
const loadedSystems = loaded.katalog?.B01?.values?.systeme as unknown[];
const loadedWege = loaded.katalog?.B04?.values?.originalJeWeg as unknown[];
const loadedProvider = loaded.katalog?.B05?.values?.externeSysteme as unknown[];
const loadedAblage = loaded.katalog?.G01?.values?.ablageJeArt as unknown[];

expect(Array.isArray(loadedSystems) && loadedSystems.length === 2, "Laden behält volles und teilweises System");
expect(loadedSystems[0] === fullSystem, "Das volle System bleibt dasselbe Objekt");
expect(loadedSystems[1] === partialSystem, "Die teilweise Karte bleibt erhalten");
expect(loaded.katalog?.B01?.values?.it === "Geschäftsführung", "IT-Verantwortung bleibt");
expect(loaded.katalog?.B01?.values?.weitereFreitext === "NAS im Büro", "Freitext weitere Systeme bleibt");
expect(loaded.katalog?.B01?.values?.hosting === "Anbieter-Cloud", "Hosting-Text bleibt");
expect(loaded.katalog?.B01?.status === "bestaetigt", "Status bleibt");
expect(loaded.katalog?.B01?.responsible === "Kim Prüfer", "Verantwortung bleibt");
expect(loaded.katalog?.B01?.date === "2026-11-01", "Datum bleibt");
expect(loaded.katalog?.A01 === a01, "andere Frage bleibt dasselbe Objekt");
expect(loaded.katalog?.H01?.values === h01Values, "Laden fasst H01 nicht an");
expect(loaded.fibu === dirty.fibu, "oberes fibu-Feld bleibt");
expect(loaded.systeme === dirty.systeme, "oberes systeme-Feld bleibt");
expect(loaded.module === dirty.module, "Modulzustand bleibt");
expect(
  Array.isArray(loadedWege) && loadedWege.length === 2 && loadedWege[0] === fullWeg && loadedWege[1] === flaggedWeg,
  "Laden entfernt nur den leeren Eingangsweg",
);
expect(
  Array.isArray(loadedProvider) &&
    loadedProvider.length === 2 &&
    loadedProvider[0] === fullProvider &&
    loadedProvider[1] === standOnlyProvider,
  "Laden entfernt nur das leere Anbietersystem",
);
expect(
  Array.isArray(loadedAblage) &&
    loadedAblage.length === 2 &&
    loadedAblage[0] === fullAblage &&
    loadedAblage[1] === partialAblage,
  "Laden entfernt nur die leere Belegart",
);
expect(stripEmptyIntakeCards(loaded) === loaded, "Laden ist idempotent");

const saved = normalizeIntakeAnswers(dirty);
expect(
  JSON.stringify(saved.katalog?.B01?.values?.systeme) === JSON.stringify(loadedSystems),
  "Speichern entfernt dieselben leeren Systemkarten",
);
expect(
  JSON.stringify(saved.katalog?.B04?.values?.originalJeWeg) === JSON.stringify(loadedWege),
  "Speichern entfernt denselben leeren Eingangsweg",
);
expect(
  JSON.stringify(saved.katalog?.B05?.values?.externeSysteme) === JSON.stringify(loadedProvider),
  "Speichern entfernt dasselbe leere Anbietersystem",
);
expect(
  JSON.stringify(saved.katalog?.G01?.values?.ablageJeArt) === JSON.stringify(loadedAblage),
  "Speichern entfernt dieselbe leere Belegart",
);
expect(saved.katalog?.B01?.values?.it === "Geschäftsführung", "Speichern lässt die übrigen B01-Felder");
expect(normalizeIntakeAnswers(saved) === saved, "Speichern ist idempotent");

const clean = b01([fullSystem]);
expect(stripEmptyIntakeCards(clean) === clean, "Entwurf ohne leere Karte bleibt beim Laden dasselbe Objekt");
expect(normalizeIntakeAnswers(clean) === clean, "Entwurf ohne leere Karte bleibt beim Speichern dasselbe Objekt");
expect(stripEmptyIntakeCards(demo) === demo, "Beispielbetrieb ohne leere Karte bleibt unverändert");

const demoLoaded = stripEmptyIntakeCards(demoWithEmpty);
const demoLeft = demoLoaded.katalog?.B01?.values?.systeme as Array<{ name?: string }>;
expect(demoLeft.length === 1 && demoLeft[0]?.name === "DATEV", "Beispielbetrieb verliert nur die leere Karte");
expect(demoLoaded.katalog?.B04 === demo.katalog?.B04, "übrige Demo-Fragen bleiben");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("check-b01-systemkarten: ok");
