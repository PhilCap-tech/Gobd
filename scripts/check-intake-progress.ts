/**
 * The progress bar uses the same step count as „Schritt k von n“,
 * including conditional and skipped modules. Synthetic answers only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATALOG_STEPS,
  catalogStepApplies,
  intakeProgressSegments,
  intakeStepLabel,
  setCatalogValue,
} from "../lib/intake-catalog";
import { demoBeispielAnswers, demoBlankAnswers } from "../lib/demo-beispiel";
import { ensureGesamt, setCheckAntwort, setModulEintrag } from "../lib/module/status";
import { emptyAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function stepId(id: string): number {
  const index = CATALOG_STEPS.findIndex((step) => step.id === id);
  assert.ok(index >= 0, `Schritt ${id} fehlt`);
  return index;
}

function assertBarMatchesLabel(step: number, answers: ReturnType<typeof emptyAnswers>, message: string) {
  const label = intakeStepLabel(step, answers);
  const segments = intakeProgressSegments(step, answers);
  const match = /^Schritt (\d+) von (\d+)$/.exec(label);
  assert.ok(match, `${message}: Bezeichnung ${label}`);
  const current = Number(match[1]);
  const total = Number(match[2]);
  assert.equal(segments.length, total, `${message}: Balken hat ${segments.length}, Bezeichnung ${label}`);
  assert.equal(segments.filter((state) => state === "on").length, 1, `${message}: genau ein aktiver Abschnitt`);
  assert.equal(segments.indexOf("on"), current - 1, `${message}: aktiver Abschnitt ist Schritt ${current}`);
  assert.ok(
    segments.slice(0, current - 1).every((state) => state === "done"),
    `${message}: vorherige Abschnitte sind erledigt`,
  );
  assert.ok(
    segments.slice(current).every((state) => state === ""),
    `${message}: spätere Abschnitte sind offen`,
  );
  ok(true, `${message}: ${label}`);
}

function assertEtappe(step: number, answers: ReturnType<typeof emptyAnswers>, message: string) {
  const label = intakeStepLabel(step, answers);
  const segments = intakeProgressSegments(step, answers);
  const match = /^Etappe (\d+) von (\d+) · .+ · Abschnitt (\d+) von (\d+)$/.exec(label);
  assert.ok(match, `${message}: Bezeichnung ${label}`);
  const etappe = Number(match[1]);
  const etappen = Number(match[2]);
  assert.equal(segments.length, etappen, `${message}: Balken hat ${segments.length}, Bezeichnung ${label}`);
  assert.equal(segments.filter((state) => state === "on").length, 1, `${message}: genau eine aktive Etappe`);
  assert.equal(segments.indexOf("on"), etappe - 1, `${message}: aktive Etappe ist ${etappe}`);
  assert.ok(!label.includes("von 26"), `${message}: keine 26-Schritte-Zählung`);
  ok(true, `${message}: ${label}`);
}

const gesamt = ensureGesamt(emptyAnswers());
const modul21 = stepId("step-M21");
assertEtappe(modul21, gesamt, "Gesamt, Modul 21");
ok(
  intakeStepLabel(modul21, gesamt) === "Etappe 5 von 5 · Kontrollen und Pflege · Abschnitt 2 von 5",
  "Modul 21 ist Etappe 5, Abschnitt 2",
);
ok(intakeProgressSegments(modul21, gesamt).length === 5, "Gesamt zählt fünf Etappen");
ok(intakeProgressSegments(modul21, gesamt).indexOf("on") !== modul21, "aktiv ist nicht der rohe Katalogindex");

assertEtappe(stepId("step-BC"), gesamt, "Gesamt, Betriebs-Check");
ok(intakeStepLabel(stepId("step-BC"), gesamt) === "Etappe 1 von 5 · Ihr Betrieb · Abschnitt 1 von 1", "Betriebs-Check ist Etappe 1");
ok(intakeStepLabel(stepId("step-MO"), gesamt) === "Übersicht", "Modulübersicht ohne Schrittzählung");
ok(intakeProgressSegments(stepId("step-MO"), gesamt).every((state) => state === ""), "Übersicht markiert keine Etappe");
assertEtappe(stepId("step-M01"), gesamt, "Gesamt, Modul 1");
ok(
  intakeStepLabel(stepId("step-M01"), gesamt) === "Etappe 2 von 5 · Unternehmen · Abschnitt 1 von 5",
  "Modul 1 beginnt mit Abschnitt 1 von 5",
);
assertEtappe(stepId("step-M17"), gesamt, "Gesamt, Modul 17");

const withKasse = setCheckAntwort(gesamt, "bargeld", "ja");
assertEtappe(stepId("step-M08"), withKasse, "Gesamt, Kasse an");
ok(catalogStepApplies(CATALOG_STEPS[stepId("step-M08")], withKasse), "Kasse wird gefragt");
ok(intakeProgressSegments(stepId("step-M08"), withKasse).length === 5, "Kasse ändert die Etappenzahl nicht");

const kasseSkipped = setModulEintrag(withKasse, "m08", {
  status: "nicht_vorhanden",
  reason: "keine Kasse",
  ref: "",
  link: "",
});
ok(!catalogStepApplies(CATALOG_STEPS[stepId("step-M08")], kasseSkipped), "abgewähltes Modul wird übersprungen");
assertEtappe(stepId("step-M09"), kasseSkipped, "Gesamt, Kasse übersprungen");
ok(
  intakeProgressSegments(stepId("step-M09"), kasseSkipped).length ===
    intakeProgressSegments(stepId("step-M09"), withKasse).length,
  "übersprungenes Modul bleibt in denselben fünf Etappen",
);
ok(
  intakeStepLabel(stepId("step-M09"), kasseSkipped) !== intakeStepLabel(stepId("step-M09"), withKasse),
  "ein übersprungenes Modul verkürzt den Abschnitt in der Etappe",
);

const legacy = emptyAnswers();
assertBarMatchesLabel(stepId("step-A"), legacy, "Bereich, erster Schritt");
assertBarMatchesLabel(stepId("step-E"), legacy, "Bereich, Papier übersprungen");
ok(!catalogStepApplies(CATALOG_STEPS[stepId("step-D")], legacy), "ohne Papierweg entfällt der Scan-Schritt");

const withPaper = setCatalogValue(emptyAnswers(), "C01", "kanaele", ["Post/Papier"]);
ok(catalogStepApplies(CATALOG_STEPS[stepId("step-D")], withPaper), "Papierweg öffnet den Scan-Schritt");
assertBarMatchesLabel(stepId("step-D"), withPaper, "Bereich, Papierweg");
assertBarMatchesLabel(stepId("step-E"), withPaper, "Bereich, nach dem Papierweg");
ok(
  intakeStepLabel(stepId("step-E"), legacy) === intakeStepLabel(stepId("step-E"), withPaper),
  "der gezählte Papier-Schritt behält die Nummer, auch wenn er entfällt",
);

assertBarMatchesLabel(stepId("step-C"), demoBlankAnswers(), "Demo leer");
assertBarMatchesLabel(stepId("step-H"), demoBeispielAnswers(), "Demo Beispielbetrieb");
ok(
  intakeProgressSegments(stepId("step-A"), demoBlankAnswers()).length ===
    intakeProgressSegments(stepId("step-A"), demoBeispielAnswers()).length,
  "Demo und Beispielbetrieb nutzen dieselbe Segmentzahl",
);

const review = CATALOG_STEPS.length;
{
  const segments = intakeProgressSegments(review, gesamt);
  ok(segments.length === 5, "Gesamt: Prüfen zeigt fünf Etappen");
  ok(segments.every((state) => state === "done"), "Gesamt: auf der Prüfung sind alle Etappen erledigt");
  ok(!intakeStepLabel(review, gesamt).includes("von 26"), "Gesamt: Prüfung ohne 26-Schritte-Zählung");
}
for (const [name, answers] of [
  ["Bereich", legacy],
  ["Demo", demoBlankAnswers()],
] as const) {
  const segments = intakeProgressSegments(review, answers);
  const total = Number(intakeStepLabel(stepId("step-A"), answers).split(" von ")[1]);
  ok(segments.length === total, `${name}: Übersicht hat so viele Abschnitte wie die Bezeichnung`);
  ok(segments.every((state) => state === "done"), `${name}: auf der Übersicht sind alle Abschnitte erledigt`);
}

const form = readFileSync("app/intake/intake-form.tsx", "utf8");
const demo = readFileSync("app/steuerberater/demo/demo-walkthrough.tsx", "utf8");
const label = readFileSync("components/intake-questionnaire.tsx", "utf8");
ok(form.includes("<IntakeProgress "), "bezahltes Intake nutzt denselben Balken");
ok(demo.includes("<IntakeProgress "), "die Demo nutzt denselben Balken");
ok(!form.includes("Array.from({ length: INTAKE_STEPS.length + 1 }"), "das bezahlte Intake zählt den Balken nicht über alle Katalogschritte");
ok(!demo.includes("Array.from({ length: INTAKE_STEPS.length + 1 }"), "die Demo zählt den Balken nicht über alle Katalogschritte");
ok(label.includes("intakeStepLabel(step, answers)"), "die Schrittbezeichnung kommt aus derselben Zählung");

console.log("check-intake-progress: green");
