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

const gesamt = ensureGesamt(emptyAnswers());
const modul21 = stepId("step-M21");
assertBarMatchesLabel(modul21, gesamt, "Gesamt, Modul 21");
ok(intakeStepLabel(modul21, gesamt) === "Schritt 23 von 26", "Modul 21 ist Schritt 23 von 26");
ok(
  intakeProgressSegments(modul21, gesamt).length !== CATALOG_STEPS.length + 1,
  "der Balken zählt nicht jeden Katalogindex",
);
ok(intakeProgressSegments(modul21, gesamt).indexOf("on") !== modul21, "aktiv ist nicht der rohe Katalogindex");

assertBarMatchesLabel(stepId("step-BC"), gesamt, "Gesamt, Betriebs-Check");
assertBarMatchesLabel(stepId("step-MO"), gesamt, "Gesamt, Modulübersicht");
assertBarMatchesLabel(stepId("step-M01"), gesamt, "Gesamt, Modul 1");
assertBarMatchesLabel(stepId("step-M17"), gesamt, "Gesamt, Modul 17");

const withKasse = setCheckAntwort(gesamt, "bargeld", "ja");
assertBarMatchesLabel(stepId("step-M08"), withKasse, "Gesamt, Kasse an");
ok(catalogStepApplies(CATALOG_STEPS[stepId("step-M08")], withKasse), "Kasse wird gefragt");
ok(intakeProgressSegments(stepId("step-M08"), withKasse).length === 26, "Kasse ändert die Segmentzahl nicht");

const kasseSkipped = setModulEintrag(withKasse, "m08", {
  status: "nicht_vorhanden",
  reason: "keine Kasse",
  ref: "",
  link: "",
});
ok(!catalogStepApplies(CATALOG_STEPS[stepId("step-M08")], kasseSkipped), "abgewähltes Modul wird übersprungen");
assertBarMatchesLabel(stepId("step-M09"), kasseSkipped, "Gesamt, Kasse übersprungen");
ok(
  intakeProgressSegments(stepId("step-M09"), kasseSkipped).length ===
    intakeProgressSegments(stepId("step-M09"), withKasse).length,
  "übersprungenes Modul bleibt in derselben Zählung wie die Bezeichnung",
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
for (const [name, answers] of [
  ["Gesamt", gesamt],
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
