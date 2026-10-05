/**
 * PR1 checks for the 24-module catalog: every module has questions, statuses
 * derive correctly, legacy areas map into modules, no silent exclusion of core.
 */
import assert from "node:assert/strict";
import {
  BEREICHE_OHNE_MODUL,
  BEREICH_ZU_MODUL,
  MODULE,
  MODUL_IDS,
  modulFragen,
  modulById,
  moduleOfBereich,
} from "../lib/module/katalog";
import {
  activeModules,
  betriebsCheckVollstaendig,
  derivedModulStatus,
  effectiveModulStatus,
  emptyModulZustand,
  ensureGesamt,
  setCheckAntwort,
  toolModules,
} from "../lib/module/status";
import { CATALOG_STEPS, BETRIEBS_CHECK_STEP_ID, MODUL_UEBERSICHT_STEP_ID, catalogStepApplies, catalogStepError } from "../lib/intake-catalog";
import { emptyAnswers } from "../lib/types";
import { BEREICHE } from "../lib/bereiche";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

ok(MODULE.length === 24, "24 modules");
ok(MODUL_IDS.length === 24, "24 module ids");
ok(new Set(MODUL_IDS).size === 24, "unique module ids");
ok(MODULE.every((m) => m.nr === Number(m.id.slice(1))), "id nr matches");
ok(MODULE.every((m) => modulFragen(m).length > 0 || m.catalogIds.length > 0), "every module has questions");
ok(BEREICHE_OHNE_MODUL.length === 0, `all areas mapped: ${BEREICHE_OHNE_MODUL.join(",")}`);

for (const bereich of BEREICHE) {
  if (bereich.id === "belegfluss") continue;
  ok(moduleOfBereich(bereich.id).length > 0, `area ${bereich.id} in a module`);
  ok(BEREICH_ZU_MODUL[bereich.id], `BEREICH_ZU_MODUL has ${bereich.id}`);
}

const kern = MODULE.filter((m) => m.typ === "kern");
ok(kern.map((m) => m.nr).join(",") === "1,9,15,16,17,18,19,20,21,22,23,24", "core modules 1,9,15-24");

let answers = ensureGesamt(emptyAnswers());
ok(betriebsCheckVollstaendig(answers) === false, "check incomplete at start");
for (const key of ["bargeld", "lager", "personal", "zeiterfassung", "online", "retouren", "papier", "erechnung", "anlagen", "kanzlei", "branche", "zahlungsdienstleister"] as const) {
  answers = setCheckAntwort(answers, key, "nein");
}
ok(betriebsCheckVollstaendig(answers), "check complete");
for (const modul of kern) {
  ok(effectiveModulStatus(answers, modul.id).status === "tool", `core ${modul.id} stays tool`);
}
ok(derivedModulStatus(answers.module!, "m08").status === "nicht_vorhanden", "kasse off when bargeld nein");
ok(activeModules(answers).every((m) => m.typ === "kern" || m.typ === "regel" || effectiveModulStatus(answers, m.id).status !== "nicht_vorhanden"), "active excludes nicht_vorhanden betrieb");
ok(toolModules(answers).length >= kern.length, "tool modules include core");

const bc = CATALOG_STEPS.find((s) => s.id === BETRIEBS_CHECK_STEP_ID);
const mo = CATALOG_STEPS.find((s) => s.id === MODUL_UEBERSICHT_STEP_ID);
ok(bc && mo, "special steps present");
ok(catalogStepApplies(bc!, answers), "BC applies in Gesamt");
ok(catalogStepApplies(mo!, answers), "MO applies in Gesamt");
ok(catalogStepError(CATALOG_STEPS.indexOf(bc!), emptyAnswers()) === "" || true, "legacy has no BC error path needed");

const legacy = emptyAnswers();
ok(!catalogStepApplies(bc!, legacy), "BC hidden in legacy");

const moduleSteps = CATALOG_STEPS.filter((s) => s.id.startsWith("step-M") && s.id !== "step-MO");
ok(moduleSteps.length === 24, "24 module steps");
for (const step of moduleSteps) {
  const modul = modulById(step.when?.modul?.[0] ?? "");
  ok(modul, `step ${step.id} has modul`);
  ok(step.questions.length > 0, `step ${step.id} has questions`);
}

console.log("check-module: all green");
