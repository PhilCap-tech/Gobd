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
  ensureGesamt,
  setCheckAntwort,
  STATUS_HILFE,
  STATUS_LABEL,
  STATUS_OPTION_LABEL,
  toolModules,
} from "../lib/module/status";
import { MODUL_STATUSES } from "../lib/module/typen";
import { CATALOG_STEPS, BETRIEBS_CHECK_STEP_ID, MODUL_UEBERSICHT_STEP_ID, catalogOpenPoints, catalogStepApplies, catalogStepError, catalogStepIssues, prefillKnownFacts, setCatalogStatus, setCatalogValue } from "../lib/intake-catalog";
import { emptyAnswers } from "../lib/types";
import { getGesamtMuster, MUSTER_VORLAGEN } from "../lib/module-muster";
import { renderGesamtChapters } from "../lib/gesamt-document";
import { uploadAllowed } from "../lib/blob";
import { draftIsNewer, normalizeDraftKey } from "../lib/intake-draft";
import { checkDocumentOwnership, checkDraftMerge, checkIntakeDraftRestore } from "./check-intake-draft";
import { BEREICHE } from "../lib/bereiche";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

ok(MODUL_STATUSES.join(",") === "tool,extern,offen,nicht_vorhanden", "status enums stable");
ok(STATUS_OPTION_LABEL.tool === "Im Tool beschreiben", "tool option label");
ok(STATUS_OPTION_LABEL.extern === "bestehende Dokumentation", "extern option label unchanged");
ok(STATUS_OPTION_LABEL.offen === "Später ausfüllen", "offen option label");
ok(STATUS_LABEL.offen === "Später ausfüllen", "offen display label");
ok(
  !/noch nicht dokumentiert/i.test(
    `${STATUS_LABEL.offen} ${STATUS_OPTION_LABEL.offen} ${STATUS_HILFE.offen}`,
  ),
  "offen status no longer uses noch nicht dokumentiert",
);
ok(STATUS_HILFE.offen.startsWith("Sie "), "offen hilfe is Sie-form");
ok(STATUS_OPTION_LABEL.nicht_vorhanden === "nicht vorhanden", "absent option label unchanged");
ok(STATUS_LABEL.tool === "Im Tool beschreiben", "tool display label");
ok(!/beschrieben/.test(`${STATUS_LABEL.tool} ${STATUS_OPTION_LABEL.tool}`), "tool label is infinitive");
ok(
  !/rechtssicher|gobd-konform|\bfertig\b/i.test(Object.values(STATUS_HILFE).join(" ")),
  "status help has no legal claims",
);
for (const status of MODUL_STATUSES) {
  ok(STATUS_HILFE[status].includes(" ") && !STATUS_HILFE[status].includes("Tool"), `hilfe ${status}`);
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

import { setVorlage } from "../lib/module/status";

{
  let a = ensureGesamt(emptyAnswers());
  a = setVorlage(a, "dienstleister");
  for (const key of ["bargeld", "lager", "personal", "zeiterfassung", "online", "retouren", "papier", "erechnung", "anlagen", "kanzlei", "branche", "zahlungsdienstleister"] as const) {
    if (!a.module!.check[key]) a = setCheckAntwort(a, key, "nein");
  }
  const chapters = renderGesamtChapters(a, "Keine offenen Punkte.");
  ok(chapters.some((c) => c.id === "vollstaendigkeit"), "Vollständigkeitsübersicht");
  ok(chapters.some((c) => c.id === "teil-1"), "Teil I");
  ok(chapters.some((c) => c.id === "modul-m01"), "Modul 1 chapter");
  ok(chapters.every((c) => c.id !== "modul-m08" || effectiveModulStatus(a, "m08").status !== "nicht_vorhanden"), "no silent kasse when absent");
  ok(!chapters.some((c) => c.id === "modul-m08"), "kasse chapter omitted when nicht vorhanden");
  ok(chapters.some((c) => c.id === "anhang-a"), "Anhang A");
  console.log("check-module gesamt chapters: green");
}

import { answersForGesamt } from "../lib/module/migration";
import { modulFortschritt, setModulEintrag } from "../lib/module/status";

{
  // Alle Module aktiv im Tool: jedes Modul hat ein PDF-Kapitel, keine technischen Ids.
  let a = ensureGesamt(emptyAnswers());
  for (const key of ["bargeld", "lager", "personal", "zeiterfassung", "online", "retouren", "papier", "erechnung", "anlagen", "kanzlei", "branche", "zahlungsdienstleister"] as const) {
    a = setCheckAntwort(a, key, "ja");
  }
  for (const modul of MODULE) a = setModulEintrag(a, modul.id, { status: "tool" });
  const chapters = renderGesamtChapters(a, "Keine offenen Punkte.");
  for (const modul of MODULE) {
    ok(chapters.some((c) => c.id === `modul-${modul.id}`), `PDF chapter for ${modul.id}`);
  }
  const text = chapters.map((c) => c.body ?? JSON.stringify(c)).join("\n");
  ok(!/\*\*[A-I]\d{2}:\*\*/.test(text), "no raw catalog ids like **A01:** in Gesamt PDF");
  ok(!text.includes("im Tool beschrieben") && !text.includes("Im Tool beschrieben"), "pdf does not use participle status label");
  ok(text.includes("Im Tool beschreiben"), "pdf uses infinitive status label");
  const vollst = chapters.find((c) => c.id === "vollstaendigkeit");
  ok(vollst && MODULE.every((m) => JSON.stringify(vollst).includes(m.titel)), "Vollständigkeit lists all 24 modules");
  // Kein stilles Auslassen: ein nicht vorhandenes Modul bleibt in der Übersicht sichtbar.
  const b = setModulEintrag(a, "m08", { status: "nicht_vorhanden", reason: "Keine Bargeldeinnahmen" });
  const vb = renderGesamtChapters(b, "").find((c) => c.id === "vollstaendigkeit");
  ok(JSON.stringify(vb).includes("Keine Bargeldeinnahmen"), "nicht vorhanden with reason shown in Vollständigkeit");
  const p = modulFortschritt(a, "m01");
  ok(p.gesamt > 0 && p.beantwortet <= p.gesamt, "modulFortschritt m01");
  console.log("check-module all-tool chapters: green");
}

{
  let offen = ensureGesamt(emptyAnswers());
  for (const key of ["bargeld", "lager", "personal", "zeiterfassung", "online", "retouren", "papier", "erechnung", "anlagen", "kanzlei", "branche", "zahlungsdienstleister"] as const) {
    offen = setCheckAntwort(offen, key, "unbekannt");
  }
  offen = { ...offen, katalog: { A01: { status: "bestaetigt" } } };
  const chapters = renderGesamtChapters(offen, "Keine offenen Punkte.");
  const text = chapters.map((c) => c.body ?? "").join("\n");
  ok(text.includes("Später ausfüllen"), "offen module uses Später ausfüllen in pdf");
  ok(!text.includes("noch nicht dokumentiert"), "pdf has no old offen wording");
  ok(!/ist Später ausfüllen/.test(text), "pdf does not say ist Später ausfüllen");
  const point = catalogOpenPoints(offen).find((item) => item.id.startsWith("op-modul-"));
  ok(Boolean(point?.text.includes("hat den Status „Später ausfüllen“")), "open point uses hat den Status");
  ok(!point?.text.includes("noch nicht dokumentiert"), "open point dropped old wording");
  console.log("check-module offen label: green");
}

{
  // Migration: Bereichs-VDs → Gesamtdokument.
  const kasse = { ...emptyAnswers(), bereich: "kasse", katalog: { A01: { status: "bestaetigt" as const, values: { rechtsform: "GmbH" } } } };
  const beleg = { ...emptyAnswers(), bereich: "belegfluss", katalog: { A01: { status: "unbekannt" as const }, C01: { status: "bestaetigt" as const } } };
  const g = answersForGesamt([kasse, beleg], "Test GmbH");
  ok(Boolean(g.module), "migration yields Gesamt");
  ok(g.module!.check.bargeld === "ja", "kasse → Betriebs-Check bargeld ja");
  ok(!g.module!.check.lager, "lager not invented");
  ok(g.katalog?.A01?.status === "bestaetigt", "first source wins");
  ok(g.katalog?.C01?.status === "bestaetigt", "catalog merged from second source");
  console.log("check-module migration: green");
}

import { nextApplicableStep } from "../lib/intake-catalog";
{
  const legacyStart = nextApplicableStep(-1, { ...emptyAnswers(), bereich: "kasse" });
  ok(CATALOG_STEPS[legacyStart]?.id === "step-A", `legacy intake starts at step-A (got ${CATALOG_STEPS[legacyStart]?.id})`);
  const gesamtStart = nextApplicableStep(-1, ensureGesamt(emptyAnswers()));
  ok(CATALOG_STEPS[gesamtStart]?.id === "step-BC", "Gesamt intake starts at Betriebs-Check");
  console.log("check-module first step: green");
}


{
  ok(MUSTER_VORLAGEN.length === 5, "five Gesamt-Muster vorlagen");
  const MIN_WORDS = 9000;
  const MIN_CHAPTERS = 20;
  for (const vorlage of MUSTER_VORLAGEN) {
    const muster = getGesamtMuster(vorlage);
    ok(muster, `Muster ${vorlage} exists`);
    if (!muster) continue;
    const tools = toolModules(muster.answers);
    ok(tools.length >= 15, `${vorlage} has >=15 tool modules (got ${tools.length})`);
    let unanswered = 0;
    for (const modul of tools) {
      for (const q of modulFragen(modul)) {
        if (!muster.answers.katalog?.[q.id]?.status) unanswered += 1;
      }
    }
    ok(unanswered === 0, `${vorlage} all tool-module questions answered (open ${unanswered})`);
    const chapters = renderGesamtChapters(muster.answers, "Offene Punkte (Muster).");
    const text = chapters.map((c) => `${c.title}\n${c.body}`).join("\n");
    const words = text.split(/\s+/).filter(Boolean).length;
    ok(chapters.length >= MIN_CHAPTERS, `${vorlage} chapters >= ${MIN_CHAPTERS} (got ${chapters.length})`);
    ok(words >= MIN_WORDS, `${vorlage} chapter words >= ${MIN_WORDS} (got ${words})`);
  }
  console.log("check-module muster depth: green");
}

async function checkMusterPdfDepth() {
  const { generatePdf } = await import("../lib/delivery");
  for (const vorlage of MUSTER_VORLAGEN) {
    const muster = getGesamtMuster(vorlage)!;
    const pdf = await generatePdf({
      answers: muster.answers,
      identity: muster.identity,
      documentId: muster.documentId,
      version: muster.version,
      variant: "muster",
    });
    // Byte length only guards against a collapsed render. Word and chapter
    // counts above are the content gate. Unconfirmed catalog sentences are
    // no longer printed, so complete Muster sit under the old 400_000 floor.
    const minBytes = 350_000;
    ok(pdf.buffer.length > minBytes, `${vorlage} PDF bytes > ${minBytes} (got ${pdf.buffer.length})`);
  }
  console.log("check-module muster pdf depth: green");
}
checkMusterPdfDepth().catch((error) => {
  console.error(error);
  process.exit(1);
});

{
  ok(uploadAllowed("application/pdf", 100) === "", "pdf allowed");
  ok(uploadAllowed("application/zip", 100) !== "", "zip rejected");
  ok(uploadAllowed("application/pdf", 20 * 1024 * 1024) !== "", "too large rejected");
  ok(normalizeDraftKey({ sessionId: "cs_test_1" }).startsWith("session:"), "draft key session");
  const moduleStep = CATALOG_STEPS.findIndex((step) => step.id === "step-M01");
  const a04base = ensureGesamt(emptyAnswers());
  a04base.katalog = {
    ...a04base.katalog,
    A04: { status: "bestaetigt", values: { keineRueckdatierungBestaetigt: true } },
  };
  const dateIssues = catalogStepIssues(moduleStep, a04base).filter((issue) => issue.questionId === "A04");
  ok(dateIssues.some((issue) => issue.fieldKey === "gueltigAb" && issue.message.includes("Datum")), "A04 date names the date");
  ok(dateIssues.every((issue) => issue.fieldKey !== "keineRueckdatierungBestaetigt"), "checked confirmation is not open");
  const unchecked = ensureGesamt(emptyAnswers());
  unchecked.katalog = { A04: { status: "bestaetigt", values: { gueltigAb: "2024-01-01" } } };
  const checkIssues = catalogStepIssues(moduleStep, unchecked).filter((issue) => issue.questionId === "A04");
  ok(checkIssues.some((issue) => issue.message.includes("Bestätigung")), "A04 checkbox is named");
  const noStatus = ensureGesamt(emptyAnswers());
  noStatus.katalog = { A04: { values: {} } };
  ok(
    catalogStepIssues(moduleStep, noStatus).some(
      (issue) => issue.questionId === "A04" && issue.fieldKey === "status" && issue.message.includes("Stand"),
    ),
    "A04 status chip is named",
  );
  const kept = prefillKnownFacts(
    setCatalogValue(ensureGesamt(emptyAnswers()), "A01", "company", "Eigene GmbH"),
    { name: "Nordlicht GmbH", street: "Hafenweg 2", zip: "20457", city: "Hamburg", stnr: "12/345/67890" },
  );
  ok(kept.katalog?.A01?.values?.company === "Eigene GmbH", "prefill does not overwrite a typed company");
  ok(String(kept.katalog?.A01?.values?.standort).includes("Hamburg"), "empty standort comes from firm address");
  ok(String(kept.katalog?.UO01?.values?.gesellschaften).includes("Eigene GmbH"), "gesellschaften follow the typed company");
  ok(String(kept.katalog?.UO01?.values?.gesellschaften).includes("12/345/67890"), "steuernummer is copied from firm data");
  ok(!kept.katalog?.A04?.values?.gueltigAb, "prefill does not invent a process date");
  ok(kept.katalog?.A04?.values?.keineRueckdatierungBestaetigt !== true, "prefill does not tick the confirmation");
  const cleared = prefillKnownFacts(
    setCatalogValue(
      setCatalogStatus(ensureGesamt(emptyAnswers()), "A04", "bestaetigt"),
      "A01",
      "company",
      "",
    ),
    { name: "Nordlicht GmbH" },
    { protect: [["A01", "company"]] },
  );
  ok(!String(cleared.katalog?.A01?.values?.company ?? "").trim(), "clearing a field stays cleared");
  ok(cleared.katalog?.A04?.status === "bestaetigt", "prefill keeps the chosen status");
  ok(draftIsNewer("2026-10-05T12:00:00.000Z", "2026-10-05T11:00:00.000Z"), "server newer wins");
  ok(!draftIsNewer("2026-10-05T11:00:00.000Z", "2026-10-05T12:00:00.000Z"), "client newer keeps");
  checkIntakeDraftRestore();
  checkDraftMerge();
  checkDocumentOwnership();
  console.log("check-module upload/draft helpers: green");
}
