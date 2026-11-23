/**
 * Fragebogen: Modul 1 in Seiten, Etappen statt „Schritt n von 26“,
 * Speicherzeile, Modulübersicht nicht mehr vor Modul 1, alte Entwürfe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bereichQuestionLines } from "../lib/bereich-chapter";
import { draftSavedLineVisible } from "../lib/fetch-retry";
import { renderGesamtChapters } from "../lib/gesamt-document";
import {
  CATALOG_STEPS,
  MODUL_UEBERSICHT_STEP_ID,
  catalogOpenPoints,
  catalogStepApplies,
  catalogStepIssues,
  intakeStepLabel,
  nextApplicableStep,
  previousApplicableStep,
  setCatalogStatus,
  setCatalogValue,
} from "../lib/intake-catalog";
import { LEGACY_INTAKE_STEP_IDS, resumeIntakeStep } from "../lib/intake-draft-step";
import {
  M01_BEGINN_SATZ,
  M01_NOW_OPTIONAL,
  M01_OFFEN_SATZ,
  M01_PAGE_IDS,
  M01_PAGES,
  m01NeedsOpenPoint,
} from "../lib/intake-m01";
import { RECHTSFORM_FREITEXT } from "../lib/intake-present";
import { getGesamtMuster, MUSTER_VORLAGEN } from "../lib/module-muster";
import { ensureGesamt, setCheckAntwort, setModulEintrag } from "../lib/module/status";
import { emptyAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function stepIndex(id: string): number {
  const index = CATALOG_STEPS.findIndex((step) => step.id === id);
  assert.ok(index >= 0, id);
  return index;
}

const gesamt = ensureGesamt(emptyAnswers());

ok(M01_PAGES.length === 5, "Modul 1 hat fünf Seiten");
ok(M01_PAGE_IDS.join() === M01_PAGES.map((page) => page.id).join(), "Seiten-Ids stimmen");
const m01Questions = M01_PAGES.flatMap((page) => page.questionIds);
ok(
  m01Questions.join() === "A01,A04,UO01,UO02,UO03,UO04,UO05,UO06",
  "Modul 1 verteilt dieselben Fragen auf die Seiten",
);
for (const page of M01_PAGES) {
  const step = CATALOG_STEPS[stepIndex(page.id)];
  ok(step.questions.map((question) => question.id).join() === page.questionIds.join(), `${page.id} enthält ${page.questionIds.join()}`);
  ok(step.when?.modul?.[0] === "m01", `${page.id} gehört zu m01`);
  ok(catalogStepIssues(stepIndex(page.id), gesamt).length === 0, `${page.id} blockiert ohne Angabe nicht`);
}

for (const item of M01_NOW_OPTIONAL) {
  const step = CATALOG_STEPS.find(
    (candidate) => candidate.id.startsWith("step-M01") && candidate.questions.some((question) => question.id === item.questionId),
  );
  const field = step?.questions.find((question) => question.id === item.questionId)?.fields.find((entry) => entry.key === item.fieldKey);
  ok(field?.required === false, `${item.questionId}.${item.fieldKey} ist in Modul 1 optional`);
  ok(step?.questions.find((question) => question.id === item.questionId)?.statusOptional === true, `${item.questionId} Stand ist optional`);
}

const legacyA01 = CATALOG_STEPS[stepIndex("step-A")].questions.find((question) => question.id === "A01");
ok(legacyA01?.fields.find((field) => field.key === "company")?.required !== false, "Bereichsfragebogen: Unternehmen bleibt Pflicht");
ok(legacyA01?.statusOptional !== true, "Bereichsfragebogen: Stand von A01 bleibt Pflicht");
const legacyA04 = CATALOG_STEPS[stepIndex("step-A")].questions.find((question) => question.id === "A04");
ok(legacyA04?.fields.find((field) => field.key === "gueltigAb")?.required !== false, "Bereichsfragebogen: Beginn-Datum bleibt Pflicht");

let sonstige = setCatalogStatus(gesamt, "A01", "bestaetigt");
sonstige = setCatalogValue(sonstige, "A01", "rechtsform", RECHTSFORM_FREITEXT);
ok(
  catalogStepIssues(stepIndex("step-M01"), sonstige).some((issue) => issue.fieldKey === "rechtsformFreitext"),
  "gewählte sonstige Rechtsform braucht den Freitext",
);
ok(catalogStepIssues(stepIndex("step-A"), emptyAnswers()).length > 0, "leerer Bereichsfragebogen blockiert weiter");

const withOneStatus = setCatalogStatus(gesamt, "H01", "unbekannt");
const points = catalogOpenPoints(withOneStatus);
for (const id of ["op-a01", "op-a04", "op-uo01", "op-uo02", "op-uo03", "op-uo04", "op-uo05", "op-uo06"]) {
  ok(points.filter((point) => point.id === id).length === 1, `${id} genau einmal`);
}
ok(
  points.find((point) => point.id === "op-a04")?.text.includes("nicht angegeben"),
  "Beginn ohne Datum ist ein offener Punkt",
);
const dated = setCatalogValue(setCatalogStatus(gesamt, "A04", "bestaetigt"), "A04", "gueltigAb", "2024-03-01");
ok(!m01NeedsOpenPoint("A04", dated.katalog?.A04), "Beginn mit Datum ist kein zusätzlicher offener Punkt");
const checkboxOnly = setCatalogValue(
  setCatalogStatus(gesamt, "A04", "bestaetigt"),
  "A04",
  "keineRueckdatierungBestaetigt",
  true,
);
ok(m01NeedsOpenPoint("A04", checkboxOnly.katalog?.A04), "Bestätigung ohne Datum bleibt offen");
let filledA01 = setCatalogStatus(gesamt, "A01", "bestaetigt");
for (const key of ["company", "standort", "rechtsform", "gf"]) {
  filledA01 = setCatalogValue(filledA01, "A01", key, "Beispiel");
}
filledA01 = setCatalogValue(filledA01, "A01", "branchen", ["Handel"]);
ok(!m01NeedsOpenPoint("A01", filledA01.katalog?.A01), "gefülltes Unternehmen erzeugt keinen offenen Punkt");

const emptyChapters = renderGesamtChapters(gesamt, "", { onlyModul: "m01" });
const emptyBody = emptyChapters.map((chapter) => chapter.body).join("\n");
ok(emptyBody.includes(M01_OFFEN_SATZ), "leeres Unternehmen steht neutral im PDF");
ok(emptyBody.includes(M01_BEGINN_SATZ), "fehlender Beginn steht neutral im PDF");
ok(emptyBody.includes("Gesellschaften und Standorte"), "UO-Frage bleibt im Kapitel");
ok(emptyBody.includes("noch zu klären. Siehe offene Punkte."), "leere Modulfrage verweist auf offene Punkte");

const uoEmpty = bereichQuestionLines(
  {
    id: "UO05",
    title: "Zeichnungs- und Freigabebefugnisse",
    prompt: "",
    fields: [{ key: "befugnisse", type: "textarea", label: "Befugnis" }],
    open: "",
  },
  { status: "bestaetigt", values: {} },
);
ok(uoEmpty.join(" ").includes(M01_OFFEN_SATZ), "bestätigte leere Befugnis wird nicht als Angabe ausgegeben");

const muster = getGesamtMuster(MUSTER_VORLAGEN[0]);
ok(muster, "Muster vorhanden");
if (muster) {
  const body = renderGesamtChapters(muster.answers, "", { onlyModul: "m01" }).map((chapter) => chapter.body).join("\n");
  ok(!body.includes(M01_OFFEN_SATZ), "gefülltes Muster benutzt den Leersatz nicht");
  ok(!body.includes(M01_BEGINN_SATZ), "gefülltes Muster erfindet keinen Beginn-Satz");
  ok(body.includes(String(muster.answers.katalog?.A01?.values?.company ?? "fehlt")), "Muster behält den Firmennamen");
}

ok(CATALOG_STEPS[nextApplicableStep(stepIndex("step-BC"), gesamt)].id === "step-M01", "nach dem Betriebs-Check kommt Modul 1");
ok(CATALOG_STEPS[previousApplicableStep(stepIndex("step-M01"), gesamt)].id === "step-BC", "Zurück aus Modul 1 führt zum Betriebs-Check");
ok(CATALOG_STEPS[nextApplicableStep(stepIndex("step-M01e"), gesamt)].id === "step-M02", "nach Modul 1 kommt Modul 2");
ok(catalogStepApplies(CATALOG_STEPS[stepIndex(MODUL_UEBERSICHT_STEP_ID)], gesamt), "Modulübersicht bleibt erreichbar");
ok(intakeStepLabel(stepIndex("step-MO"), gesamt) === "Übersicht", "Übersicht ohne 26 Schritte");

ok(LEGACY_INTAKE_STEP_IDS[6] === "step-M01", "alte Nummer 6 war die eine Modul-1-Seite");
ok(LEGACY_INTAKE_STEP_IDS[7] === "step-M02", "alte Nummer 7 war Modul 2");
ok(LEGACY_INTAKE_STEP_IDS[26] === "step-M21", "alte Nummer 26 war Modul 21");
ok(CATALOG_STEPS[resumeIntakeStep({ step: 6, answers: gesamt })].id === "step-M01", "alter Modul-1-Entwurf ohne Stand startet auf der ersten Seite");
const partial = setCatalogStatus(setCatalogStatus(gesamt, "A01", "bestaetigt"), "A04", "unbekannt");
ok(
  CATALOG_STEPS[resumeIntakeStep({ step: 6, answers: partial })].id === "step-M01c",
  "alter Modul-1-Entwurf setzt auf der ersten Seite ohne Stand fort",
);
ok(CATALOG_STEPS[resumeIntakeStep({ step: 7, answers: gesamt })].id === "step-M02", "alter Entwurf in Modul 2 bleibt in Modul 2");
ok(CATALOG_STEPS[resumeIntakeStep({ step: 26, answers: gesamt })].id === "step-M21", "alter Entwurf in Modul 21 bleibt in Modul 21");
ok(CATALOG_STEPS[resumeIntakeStep({ step: 1, answers: gesamt })].id === "step-MO", "alter Entwurf auf der Übersicht bleibt dort");
ok(
  CATALOG_STEPS[resumeIntakeStep({ step: 0, stepId: "step-M01b", answers: gesamt })].id === "step-M01b",
  "gespeicherte Schritt-Id gewinnt gegen die alte Nummer",
);
const legacy = emptyAnswers();
ok(CATALOG_STEPS[resumeIntakeStep({ step: 30, answers: legacy })].id === "step-C", "alter Bereichsentwurf auf Schritt C bleibt auf Schritt C");
const kasseWeg = setModulEintrag(setCheckAntwort(gesamt, "bargeld", "nein"), "m08", {
  status: "nicht_vorhanden",
  reason: "keine Kasse",
});
ok(CATALOG_STEPS[resumeIntakeStep({ step: 13, answers: kasseWeg })].id !== "step-M08", "entfallenes Modul wird beim Fortsetzen übersprungen");
ok(CATALOG_STEPS[resumeIntakeStep({ step: 13, stepId: "step-M09", answers: kasseWeg })].id === "step-M09", "Schritt-Id Modul 9 bleibt Modul 9");

ok(!draftSavedLineVisible({ confirmed: false, failures: 0, finalSaveFailed: false }), "vor dem ersten Speichern keine Zeile");
ok(draftSavedLineVisible({ confirmed: true, failures: 0, finalSaveFailed: false }), "nach bestätigtem Speichern die Zeile");
ok(!draftSavedLineVisible({ confirmed: true, failures: 1, finalSaveFailed: false }), "bei Speicherfehler keine Erfolgszeile");
ok(!draftSavedLineVisible({ confirmed: true, failures: 0, finalSaveFailed: true }), "bei fehlgeschlagenem letzten Speichern keine Erfolgszeile");

const form = readFileSync("app/intake/intake-form.tsx", "utf8");
const progress = readFileSync("components/intake-progress.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
ok(!form.includes("Gesamtdokument mit 24 Modulen"), "das 24-Modul-Banner ist entfernt");
ok(form.includes("DRAFT_SAVED_LINE"), "der Fragebogen zeigt die Speicherzeile");
ok(form.includes("Zur Modulübersicht"), "die Übersicht bleibt verlinkt");
ok(form.includes("Weiter im Fragebogen"), "aus der Übersicht geht es in den Fragebogen zurück");
ok(progress.includes('className="etappen"'), "die Etappen sind die Fortschrittsanzeige");
ok(progress.includes("{etappe.label}"), "die Etappenbezeichnung steht sichtbar unter den Namen");
ok(css.includes(".save-stand") && css.includes("position: sticky") && !/\.save-stand\s*\{[^}]*position:\s*fixed/.test(css), "die Speicherzeile klebt oben und liegt nicht fest über den Buttons");
ok(!css.includes(".save-stand {\n  position: fixed"), "die Speicherzeile ist nicht fixiert");

console.log("check-intake-etappen: green");
