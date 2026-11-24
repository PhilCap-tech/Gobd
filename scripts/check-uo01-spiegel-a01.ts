/**
 * V-2: UO01.gesellschaften and UO01.standorte follow A01 while untouched.
 * The check drives the same function as IntakeQuestionnaire.commitValue,
 * keystroke by keystroke.
 *   npx tsx scripts/check-uo01-spiegel-a01.ts
 */
import assert from "node:assert/strict";
import {
  catalogAnswerLine,
  catalogFieldVisibleText,
  listFieldDisplay,
  prefillKnownFacts,
  setCatalogStatus,
  setCatalogValue,
} from "@/lib/intake-catalog";
import { applyAnswerFieldChange } from "@/lib/intake-field-change";
import { ensureGesamt } from "@/lib/module/status";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

function typeField(
  answers: IntakeAnswers,
  questionId: string,
  key: string,
  text: string,
  firm?: Parameters<typeof applyAnswerFieldChange>[4],
): IntakeAnswers {
  let next = answers;
  let typed = "";
  for (const char of Array.from(text)) {
    typed += char;
    next = applyAnswerFieldChange(next, questionId, key, typed, firm);
  }
  return next;
}

function uo01(answers: IntakeAnswers, key: "gesellschaften" | "standorte"): string {
  return listFieldDisplay(answers.katalog?.UO01?.values?.[key]).trim();
}

function start(): IntakeAnswers {
  return ensureGesamt(emptyAnswers());
}

{
  let answers = start();
  answers = typeField(answers, "A01", "company", "Muster GmbH");
  assert.equal(uo01(answers, "gesellschaften"), "Muster GmbH", "Firma Zeichen für Zeichen spiegelt den vollen Namen nach UO01");
}

{
  let answers = start();
  answers = applyAnswerFieldChange(answers, "A01", "rechtsform", "GmbH");
  assert.equal(uo01(answers, "gesellschaften"), "Rechtsform: GmbH", "Rechtsform vor dem Namen steht allein in UO01");
  answers = typeField(answers, "A01", "company", "Muster");
  assert.equal(
    uo01(answers, "gesellschaften"),
    "Muster\nRechtsform: GmbH",
    "Name nach gewählter Rechtsform ergänzt Name und Rechtsform",
  );
}

{
  let answers = start();
  answers = typeField(answers, "A01", "standort", "duesseldorf");
  assert.equal(uo01(answers, "standorte"), "duesseldorf", "Standort Zeichen für Zeichen wird vollständig nachgezogen");
  assert.notEqual(uo01(answers, "standorte"), "d", "Standort bleibt nicht auf dem ersten Buchstaben stehen");
}

{
  const firm = { name: "Konto GmbH" };
  let answers = prefillKnownFacts(start(), firm);
  assert.equal(uo01(answers, "gesellschaften"), "Konto GmbH", "Kontoname ist nach UO01 gespiegelt");
  answers = applyAnswerFieldChange(answers, "A01", "company", "Muster GmbH", firm);
  assert.equal(uo01(answers, "gesellschaften"), "Muster GmbH", "Änderung des vorbelegten Kontonamens zieht UO01 nach");
}

{
  let answers = typeField(start(), "A01", "company", "Muster GmbH");
  answers = applyAnswerFieldChange(answers, "UO01", "gesellschaften", "Eigene Fassung");
  answers = typeField(answers, "A01", "company", "Muster GmbH Neu");
  assert.equal(uo01(answers, "gesellschaften"), "Eigene Fassung", "selbst geänderter UO01-Wert bleibt beim Weiter-Tippen in A01");
}

{
  let answers = typeField(start(), "A01", "company", "Muster GmbH");
  answers = applyAnswerFieldChange(answers, "UO01", "gesellschaften", "");
  answers = typeField(answers, "A01", "company", "Muster GmbH und Partner");
  assert.equal(uo01(answers, "gesellschaften"), "", "vom Kunden geleertes UO01 bleibt leer");
  assert.ok(answers.katalog?.UO01?.cleared?.includes("gesellschaften"), "Leeren wird als cleared gemerkt");
}

{
  let answers = setCatalogValue(start(), "A01", "company", "Tischlerei Nord GmbH");
  answers = setCatalogValue(answers, "UO01", "gesellschaften", "T");
  answers = prefillKnownFacts(answers);
  assert.equal(uo01(answers, "gesellschaften"), "Tischlerei Nord GmbH", "Ladereparatur ersetzt das Präfix T durch den Spiegelwert");
}

{
  let answers = setCatalogValue(start(), "A01", "company", "Muster");
  answers = setCatalogValue(answers, "A01", "rechtsform", "GmbH");
  answers = setCatalogValue(answers, "UO01", "gesellschaften", "Rechtsform: GmbH");
  answers = prefillKnownFacts(answers);
  assert.equal(
    uo01(answers, "gesellschaften"),
    "Muster\nRechtsform: GmbH",
    "Ladereparatur ergänzt den Namen, wenn nur der Rechtsform-Teil gespeichert ist",
  );
}

{
  let answers = setCatalogValue(start(), "A01", "company", "Tischlerei Nord GmbH");
  answers = setCatalogValue(answers, "UO01", "gesellschaften", "Eigene Holding");
  answers = prefillKnownFacts(answers);
  assert.equal(uo01(answers, "gesellschaften"), "Eigene Holding", "Kundenwert, der kein kurzes Präfix ist, bleibt unverändert");
}

{
  let answers = typeField(start(), "A01", "company", "Muster GmbH");
  answers = typeField(answers, "A01", "standort", "duesseldorf");
  const visible = catalogFieldVisibleText(
    "UO01",
    "gesellschaften",
    answers.katalog?.UO01?.values?.gesellschaften,
    "textarea",
  );
  assert.equal(visible, "Muster GmbH", "sichtbarer UO01-Wert ist der volle Spiegelwert");
  answers = setCatalogStatus(answers, "UO01", "bestaetigt");
  const line = catalogAnswerLine("UO01", answers);
  assert.ok(line, "Generator-Zeile für UO01 existiert");
  const details = (line?.details ?? []).join(" ");
  assert.ok(details.includes("Muster GmbH"), "Generator/PDF enthält den sichtbaren Firmennamen");
  assert.ok(details.includes("duesseldorf"), "Generator/PDF enthält den sichtbaren Standort");
  assert.ok(!/\bM\b/.test(details) || details.includes("Muster GmbH"), "Generator enthält nicht nur das Artefakt");
}


{
  let answers = typeField(start(), "A01", "company", "Muster GmbH");
  answers = applyAnswerFieldChange(answers, "A01", "rechtsform", "GmbH");
  assert.equal(uo01(answers, "gesellschaften"), "Muster GmbH\nRechtsform: GmbH", "Rechtsform nach dem Namen wird nachgezogen");
  answers = applyAnswerFieldChange(answers, "A01", "rechtsform", "UG");
  assert.equal(uo01(answers, "gesellschaften"), "Muster GmbH\nRechtsform: UG", "Änderung der Rechtsform zieht UO01 nach");
}

{
  let answers = typeField(start(), "A01", "standort", "koeln");
  answers = typeField(answers, "A01", "standort", "duesseldorf");
  assert.equal(uo01(answers, "standorte"), "duesseldorf", "Änderung des Standorts zieht UO01 nach");
}

{
  const firm = { name: "Konto GmbH" };
  let answers = prefillKnownFacts(start(), firm);
  answers = applyAnswerFieldChange(answers, "A01", "company", "", firm);
  assert.equal(uo01(answers, "gesellschaften"), "", "Leeren von A01 räumt den unberührten Spiegel ohne cleared");
  assert.ok(!answers.katalog?.UO01?.cleared?.includes("gesellschaften"), "Spiegel-Leere setzt kein cleared");
  answers = typeField(answers, "A01", "company", "Muster GmbH", firm);
  assert.equal(uo01(answers, "gesellschaften"), "Muster GmbH", "Neuer Name nach geleertem A01 wird wieder gespiegelt");
}

{
  let answers = setCatalogValue(start(), "A01", "standort", "duesseldorf");
  answers = setCatalogValue(answers, "UO01", "standorte", "d");
  answers = prefillKnownFacts(answers);
  assert.equal(uo01(answers, "standorte"), "duesseldorf", "Ladereparatur ersetzt das Standort-Präfix d");
}

{
  let answers = setCatalogValue(start(), "A01", "company", "Tischlerei Nord GmbH");
  answers = setCatalogValue(answers, "UO01", "gesellschaften", "Tis");
  answers = prefillKnownFacts(answers);
  assert.equal(uo01(answers, "gesellschaften"), "Tischlerei Nord GmbH", "Ladereparatur gilt für 1–3 Zeichen");
  answers = setCatalogValue(answers, "UO01", "gesellschaften", "Tischlerei");
  answers = prefillKnownFacts(answers);
  assert.equal(uo01(answers, "gesellschaften"), "Tischlerei", "vier und mehr Zeichen bleiben unangetastet");
}

console.log("check-uo01-spiegel-a01: ok");
