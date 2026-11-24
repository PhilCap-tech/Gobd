/**
 * V-1: E05.systeme and other list-capable fields show array templates.
 *   npx tsx scripts/check-e05-software-liste.ts
 */
import assert from "node:assert/strict";
import {
  CATALOG_STEPS,
  asList,
  catalogFieldVisibleText,
  draftCatalogFromLegacy,
  listFieldDisplay,
  prefillKnownFacts,
  projectCatalogAnswers,
  setCatalogStatus,
  setCatalogValues,
  withCatalogDraft,
} from "@/lib/intake-catalog";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";
import {
  BRANCHEN_VORLAGEN,
  SOFTWARE_PRESETS,
  applySoftwarePreset,
  ensureGesamt,
  setVorlage,
} from "@/lib/module/status";

function fieldType(questionId: string, key: string): string | undefined {
  for (const step of CATALOG_STEPS) {
    const question = step.questions.find((item) => item.id === questionId);
    const field = question?.fields.find((item) => item.key === key);
    if (field) return field.type;
  }
  return undefined;
}

function isFilledTextOrStringList(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) {
    return value.some((item) => String(item).trim());
  }
  return false;
}

function assertAllPrefillVisible(label: string, answers: IntakeAnswers): void {
  for (const [id, entry] of Object.entries(answers.katalog ?? {})) {
    for (const [key, value] of Object.entries(entry?.values ?? {})) {
      if (!isFilledTextOrStringList(value)) continue;
      const type = fieldType(id, key);
      if (!type) continue;
      const visible = catalogFieldVisibleText(id, key, value, type);
      assert.ok(
        visible.trim(),
        `${label}: ${id}.${key} is not shown (${JSON.stringify(value)})`,
      );
    }
  }
}

{
  const systems = ["lexoffice", "DATEV"];
  const shown = listFieldDisplay(systems);
  assert.equal(shown, "lexoffice, DATEV", "E05-Array wird als Liste angezeigt");
  assert.notEqual(shown, "", "Anzeige-String ist nicht leer");
  assert.deepEqual(asList(shown), systems, "Roundtrip Anzeige → Speichern bleibt dieselbe Liste");

  let answers = ensureGesamt(emptyAnswers());
  answers = setCatalogValues(answers, "E05", { systeme: systems });
  answers = setCatalogStatus(answers, "E05", "bestaetigt");
  const before = projectCatalogAnswers(answers).ausgangsrechnungen;
  assert.deepEqual(before, systems, "Generator liest die Array-Vorlage");

  const afterSave = setCatalogValues(answers, "E05", { systeme: asList(listFieldDisplay(systems)) });
  const confirmed = setCatalogStatus(afterSave, "E05", "bestaetigt");
  assert.deepEqual(
    projectCatalogAnswers(confirmed).ausgangsrechnungen,
    before,
    "Generator-Wert vorher = nachher",
  );

  assert.equal(listFieldDisplay("lexoffice, DATEV"), "lexoffice, DATEV", "String-Altwert wird angezeigt");
  assert.deepEqual(asList("lexoffice, DATEV"), systems, "String-Altwert wird zur Liste");
  assert.equal(
    catalogFieldVisibleText("E05", "systeme", "lexoffice, DATEV", "multi_or_text"),
    "lexoffice, DATEV",
    "E05 zeigt den String-Altwert",
  );
  let legacy = setCatalogValues(ensureGesamt(emptyAnswers()), "E05", { systeme: "lexoffice, DATEV" });
  legacy = setCatalogStatus(legacy, "E05", "bestaetigt");
  assert.deepEqual(projectCatalogAnswers(legacy).ausgangsrechnungen, systems, "Generator liest den String-Altwert");
  assert.equal(listFieldDisplay("lexoffice, "), "lexoffice, ", "getipptes Komma und Leerzeichen bleiben im Rohtext");
}

{
  const ecommerce = setVorlage(ensureGesamt(emptyAnswers()), "ecommerce");
  const kanaele = ecommerce.katalog?.EC01?.values?.kanaele;
  assert.equal(
    catalogFieldVisibleText("EC01", "kanaele", kanaele, "textarea"),
    "Eigener Onlineshop, Marktplatz",
    "E-Commerce-Vorlage zeigt die Kanäle",
  );
  assert.equal(
    catalogFieldVisibleText("EC01", "kanaele", ["Eigener Onlineshop", "Marktplatz"], "textarea"),
    "Eigener Onlineshop, Marktplatz",
    "gespeicherter Array-Entwurf für EC01 sieht nicht leer aus",
  );
}

{
  const firm = { name: "Nordlicht GmbH" };
  for (const vorlage of BRANCHEN_VORLAGEN) {
    for (const preset of [null, ...SOFTWARE_PRESETS.filter((item) => ["datev", "lexoffice", "sevdesk"].includes(item.id))]) {
      let answers = ensureGesamt(emptyAnswers());
      answers = setVorlage(answers, vorlage.id);
      if (preset) answers = applySoftwarePreset(answers, preset.id);
      answers = prefillKnownFacts(withCatalogDraft(answers, firm.name), firm);
      const label = `${vorlage.id}${preset ? `+${preset.id}` : ""}`;
      assertAllPrefillVisible(label, answers);
    }
  }

  const prefillOnly = prefillKnownFacts(
    withCatalogDraft({ ...emptyAnswers(), ausgangsrechnungen: ["lexoffice", "DATEV"] }, "Nordlicht GmbH"),
    { name: "Nordlicht GmbH" },
  );
  assertAllPrefillVisible("prefill", prefillOnly);
  assert.equal(
    catalogFieldVisibleText("E05", "systeme", prefillOnly.katalog?.E05?.values?.systeme, "multi_or_text"),
    "lexoffice, DATEV",
    "Prefill aus ausgangsrechnungen wird angezeigt",
  );

  const legacyDraft = {
    ...emptyAnswers(),
    katalog: draftCatalogFromLegacy({ ...emptyAnswers(), ausgangsrechnungen: ["lexoffice", "DATEV"] }, "Nordlicht GmbH"),
  };
  assertAllPrefillVisible("legacy", legacyDraft);
  assert.equal(
    catalogFieldVisibleText("E05", "systeme", legacyDraft.katalog?.E05?.values?.systeme, "multi_or_text"),
    "lexoffice, DATEV",
    "Legacy-Entwurf wird angezeigt",
  );
}

console.log("check-e05-software-liste: ok");
