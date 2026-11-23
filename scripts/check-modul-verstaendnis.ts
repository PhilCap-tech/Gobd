/**
 * Akzeptanz für FX-01, FX-02, FX-03, FX-05, FX-06, Kasse-Schlüssel, M2-01/02/06.
 * M2-01 ist Variante (b): fehlender Stand ist ein offener Punkt, kein Fehler.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATALOG_STEPS,
  catalogOpenPoints,
  catalogStepIssues,
  confirmVorschlag,
  prefillKnownFacts,
  removeKanzleiEintrag,
  setCatalogStatus,
  setCatalogValue,
  visibleCatalogQuestions,
  nextApplicableStep,
} from "@/lib/intake-catalog";
import { renderGesamtChapters } from "@/lib/gesamt-document";
import { getGesamtMuster } from "@/lib/module-muster";
import {
  AF01_ZUORDNUNG,
  applySoftwarePreset,
  derivedModulStatus,
  effectiveModulStatus,
  ensureGesamt,
  modulFortschritt,
  setCheckAntwort,
  setModulEintrag,
  setVorlage,
  vollstaendigkeitsZeilen,
} from "@/lib/module/status";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";
import {
  AF01_HILFE,
  AF01_PLACEHOLDER,
  AF01_PROMPT,
  AF01_STATUTORY_HINT,
  BEISPIELWERT_OFFEN,
  ENTFAELLT_CHIP,
  ENTFAELLT_GRUND,
  FIKTIV_FIELD_MESSAGE,
  FIKTIV_TOKEN,
  KANZLEI_HILFE,
  KANZLEI_JA,
  KANZLEI_LABEL,
  KANZLEI_NEIN,
  KANZLEI_WIDERSPRUCH,
  KANZLEI_WIDERSPRUCH_OFFEN,
  MODUL_SPAETER_HINWEIS,
  MODUL_SPAETER_LABEL,
  RETOUREN_HILFE,
  RETOUREN_HINWEIS,
  VORSCHLAG_MARKE,
  VORSCHLAG_RUECKFRAGE,
  WW01_HILFE,
  WW01_SYSTEM_PLACEHOLDER,
  WW01_VORGAENGE_PLACEHOLDER,
  af01StatutoryHint,
  valueContainsFiktiv,
} from "@/lib/modul-verstaendnis";

const VORLAGEN = ["dienstleister", "handel", "ecommerce", "gastro", "handwerk"] as const;

function walkStrings(value: unknown, found: string[]): void {
  if (typeof value === "string") {
    if (value.includes(FIKTIV_TOKEN)) found.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, found);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) walkStrings(item, found);
  }
}

function stepIndex(id: string): number {
  const index = CATALOG_STEPS.findIndex((step) => step.id === id);
  assert.ok(index >= 0, id);
  return index;
}

function question(id: string) {
  for (const step of CATALOG_STEPS) {
    const hit = step.questions.find((item) => item.id === id);
    if (hit) return hit;
  }
  throw new Error(`Frage ${id} fehlt`);
}

function bodyOf(answers: IntakeAnswers, modulId?: string): string {
  return renderGesamtChapters(answers, "Offene Punkte.", modulId ? { onlyModul: modulId } : {})
    .map((chapter) => chapter.body)
    .join("\n");
}

function withCheck(answers: IntakeAnswers, key: "online" | "retouren" | "personal" | "zeiterfassung" | "kanzlei", value: "ja" | "nein"): IntakeAnswers {
  return setCheckAntwort(answers, key, value);
}

// 1 — keine (fiktiv)-Vorlagenwerte, Block und PDF-Netz
for (const id of VORLAGEN) {
  const answers = setVorlage(ensureGesamt(emptyAnswers()), id);
  const hits: string[] = [];
  walkStrings(answers.katalog, hits);
  assert.deepEqual(hits, [], `${id}: Katalog ohne (fiktiv)`);
}
{
  let answers = ensureGesamt(emptyAnswers());
  answers = setModulEintrag(answers, "m10", { status: "tool" });
  answers = setCatalogValue(answers, "WW01", "system", `Warenwirtschaft ${FIKTIV_TOKEN}`);
  answers = setCatalogValue(answers, "WW01", "vorgaenge", "Wareneingang");
  answers = setCatalogStatus(answers, "WW01", "bestaetigt");
  const issues = catalogStepIssues(stepIndex("step-M10"), answers);
  assert.ok(issues.some((issue) => issue.message === FIKTIV_FIELD_MESSAGE && issue.fieldKey === "system"), "So läuft es heute blockiert");
  const pdf = bodyOf(answers, "m10");
  assert.ok(!pdf.includes(FIKTIV_TOKEN), "Gesamt-PDF ohne (fiktiv)");
  assert.ok(
    catalogOpenPoints(answers).some((point) => point.text === BEISPIELWERT_OFFEN),
    "offener Punkt statt Beispielwert",
  );
}
assert.equal(question("WW01").hint, WW01_HILFE);
assert.equal(question("WW01").fields.find((field) => field.key === "system")?.placeholder, WW01_SYSTEM_PLACEHOLDER);
assert.equal(question("WW01").fields.find((field) => field.key === "vorgaenge")?.placeholder, WW01_VORGAENGE_PLACEHOLDER);

// 2 — AF01 leer, Hinweis nicht blockierend, Fristentabelle im Muster
{
  const answers = setVorlage(ensureGesamt(emptyAnswers()), "handel");
  assert.equal(answers.katalog?.AF01?.values?.ablauf, undefined, "AF01.ablauf nicht vorbelegt");
  const af01 = question("AF01");
  assert.equal(af01.prompt, AF01_PROMPT);
  assert.equal(af01.hint, AF01_HILFE);
  assert.equal(af01.fields.find((field) => field.key === "ablauf")?.placeholder, AF01_PLACEHOLDER);
  assert.equal(af01StatutoryHint(AF01_ZUORDNUNG), AF01_STATUTORY_HINT);
  assert.equal(af01StatutoryHint("Die Buchhaltung führt eine Liste und kennzeichnet das Archiv."), null);
  let pasted = setModulEintrag(ensureGesamt(emptyAnswers()), "m16", { status: "tool" });
  pasted = setCatalogValue(pasted, "AF01", "ablauf", AF01_ZUORDNUNG);
  pasted = setCatalogValue(pasted, "AF01", "liste", "ja");
  pasted = setCatalogStatus(pasted, "AF01", "bestaetigt");
  const issues = catalogStepIssues(stepIndex("step-M16"), pasted);
  assert.ok(!issues.some((issue) => issue.message === AF01_STATUTORY_HINT), "Gesetzeswortlaut blockiert nicht");
  const handel = getGesamtMuster("handel");
  assert.ok(handel, "Handel-Muster");
  assert.equal(handel?.answers.katalog?.AF01?.values?.ablauf, AF01_ZUORDNUNG, "Muster behält den Fristentext");
  const fristen = bodyOf(handel!.answers, "m16");
  assert.ok(fristen.includes("Buchungsbelege 8 Jahre"), "Fristentabelle unverändert");
  assert.ok(fristen.includes("§ 147"), "Grundlage der Fristen bleibt");
}

// 3 — Vorschlag markieren, bestätigen, Fortschritt, offener Punkt
{
  const handel = setVorlage(ensureGesamt(emptyAnswers()), "handel");
  assert.equal(handel.katalog?.UO02?.vorschlag?.taetigkeiten, handel.katalog?.UO02?.values?.taetigkeiten);
  assert.equal(handel.katalog?.KA01?.vorschlag?.kassenart, "Elektronisches Kassensystem mit TSE");
  const datev = applySoftwarePreset(ensureGesamt(emptyAnswers()), "datev");
  assert.equal(datev.katalog?.BU01?.vorschlag?.kontenrahmen, "SKR 03");
  assert.ok(Array.isArray(datev.katalog?.B01?.vorschlag?.systeme), "B01-Vorschlag");
  assert.ok(VORSCHLAG_MARKE.startsWith("Vorschlag aus der Branchenvorlage"));
  let confirmed = setCatalogStatus(handel, "UO02", "bestaetigt");
  const blocked = catalogStepIssues(stepIndex("step-M01c"), confirmed);
  assert.ok(blocked.some((issue) => issue.message === VORSCHLAG_RUECKFRAGE), "Bestätigung nötig");
  const before = modulFortschritt(handel, "m01").beantwortet;
  const uoOnly = modulFortschritt(handel, "m01");
  assert.ok(uoOnly.beantwortet === before);
  const open = catalogOpenPoints(setCatalogStatus(handel, "A01", "unbekannt"));
  assert.ok(open.some((point) => point.id === "op-uo02"), "unbestätigter Vorschlag ist offener Punkt");
  const pdf = bodyOf(setCatalogStatus(handel, "UO02", "bestaetigt"), "m01");
  assert.ok(!pdf.includes("Einzel-/Großhandel mit Kasse und Lager"), "Vorschlag nicht als Ist");
  confirmed = confirmVorschlag(handel, "UO02");
  assert.equal(confirmed.katalog?.UO02?.status, "bestaetigt");
  assert.equal(catalogStepIssues(stepIndex("step-M01c"), confirmed).some((issue) => issue.fieldKey === "vorschlag"), false);
  assert.ok(modulFortschritt(confirmed, "m01").beantwortet > modulFortschritt(handel, "m01").beantwortet);
}

// 5 — Kanzlei-Widerspruch
{
  let answers = ensureGesamt(emptyAnswers());
  answers = setCheckAntwort(answers, "kanzlei", "nein");
  answers = {
    ...answers,
    module: { ...answers.module!, stammdaten: { kanzlei: "Kanzlei Testweg GmbH" } },
  };
  answers = setCatalogValue(answers, "UO03", "zustaendigkeiten", "Steuerkanzlei: Kanzlei Testweg GmbH");
  answers = setCatalogStatus(answers, "UO03", "bestaetigt");
  const checkSrc = readFileSync("components/betriebs-check.tsx", "utf8");
  assert.ok(checkSrc.includes("{KANZLEI_WIDERSPRUCH}"));
  assert.ok(checkSrc.includes("{KANZLEI_JA}") && checkSrc.includes("{KANZLEI_NEIN}"));
  assert.equal(KANZLEI_WIDERSPRUCH.includes("beim Betriebs-Check aber"), true);
  assert.equal(KANZLEI_JA, "Ja, Check auf Ja setzen");
  assert.equal(KANZLEI_NEIN, "Nein, Kanzlei-Eintrag entfernen");
  assert.ok(readFileSync("lib/module/status.ts", "utf8").includes("KANZLEI_LABEL"));
  assert.ok(KANZLEI_LABEL.startsWith("Arbeitet eine Steuerkanzlei"));
  assert.ok(KANZLEI_HILFE.includes("Wählen Sie"));
  const accepted = setCheckAntwort(answers, "kanzlei", "ja");
  assert.equal(accepted.module?.check?.kanzlei, "ja");
  const removed = removeKanzleiEintrag(answers);
  assert.equal(removed.module?.stammdaten?.kanzlei, "");
  assert.ok(!String(removed.katalog?.UO03?.values?.zustaendigkeiten ?? "").includes("Kanzlei Testweg"));
  const pdf = bodyOf(answers, "m01");
  assert.ok(pdf.includes("Kanzlei Testweg GmbH"), "Name bleibt im PDF");
  assert.ok(catalogOpenPoints(answers).some((point) => point.text === KANZLEI_WIDERSPRUCH_OFFEN));
}

// 6 — Retouren und Zeiterfassung
{
  let handel = setVorlage(ensureGesamt(emptyAnswers()), "handel");
  assert.equal(effectiveModulStatus(handel, "m13").status, "tool", "Retouren schalten Modul 13 ein");
  assert.notEqual(vollstaendigkeitsZeilen(handel).find((row) => row.modul === "m13")?.status, "nicht_vorhanden");
  const ids = visibleCatalogQuestions(stepIndex("step-M13"), handel).map((item) => item.id);
  assert.ok(ids.includes("RT00") && ids.includes("RT01"), "Retourenfragen werden gestellt");
  assert.ok(!ids.includes("EC01"), "Shopfragen bleiben aus");
  assert.ok(ids.includes("EC00") && ids.includes("EC91") && ids.includes("EC92"));
  let bothOff = ensureGesamt(emptyAnswers());
  bothOff = withCheck(bothOff, "online", "nein");
  bothOff = withCheck(bothOff, "retouren", "nein");
  assert.equal(derivedModulStatus(bothOff.module!, "m13").status, "nicht_vorhanden");
  let zeit = ensureGesamt(emptyAnswers());
  zeit = withCheck(zeit, "personal", "nein");
  zeit = withCheck(zeit, "zeiterfassung", "ja");
  assert.equal(effectiveModulStatus(zeit, "m12").status, "tool");
  const lohn = visibleCatalogQuestions(stepIndex("step-M12"), zeit).map((item) => item.id);
  assert.ok(lohn.includes("ZE01"), "Zeiterfassung wird gefragt");
  assert.ok(!lohn.includes("LO01"), "Lohnfragen bleiben aus");
  assert.equal(RETOUREN_HILFE.includes("Umtausch"), true);
  assert.equal(RETOUREN_HINWEIS.includes("auch ohne Onlineshop"), true);
}

// 7 — Kasse-Schlüssel
{
  const pos = applySoftwarePreset(ensureGesamt(emptyAnswers()), "pos");
  assert.equal(pos.module?.stammdaten?.kasse, undefined);
  assert.equal(pos.katalog?.KA01?.values?.art, undefined);
  let typed = prefillKnownFacts({
    ...ensureGesamt(emptyAnswers()),
    module: { ...ensureGesamt(emptyAnswers()).module!, stammdaten: { kasse: "Kasse Nord", shop: "Shop Nord", warenwirtschaft: "Lager Nord" } },
  });
  assert.equal(typed.katalog?.KA01?.values?.system, "Kasse Nord");
  assert.equal(typed.katalog?.A01?.values?.gastroKasse, undefined);
  assert.equal(typed.katalog?.A01?.values?.onlineShop, undefined);
  assert.equal(typed.katalog?.A01?.values?.onlineWawi, undefined);
  typed = setCatalogValue(typed, "A01", "branchen", ["Gastronomie", "Onlinehandel"]);
  typed = prefillKnownFacts(typed);
  assert.equal(typed.katalog?.A01?.values?.gastroKasse, "Kasse Nord");
  assert.equal(typed.katalog?.A01?.values?.onlineShop, "Shop Nord");
  assert.equal(typed.katalog?.A01?.values?.onlineWawi, "Lager Nord");
}

// 9 — Modul später, keine 13 Fehler, Chip
{
  const form = readFileSync("app/intake/intake-form.tsx", "utf8");
  assert.ok(form.includes("{MODUL_SPAETER_LABEL}"));
  assert.ok(form.includes("{MODUL_SPAETER_HINWEIS}"));
  assert.equal(MODUL_SPAETER_LABEL, "Dieses Modul später ausfüllen");
  assert.equal(MODUL_SPAETER_HINWEIS, "Das Modul bleibt als offene Aufgabe in Ihrem Konto.");
  const hint = readFileSync("components/intake-questionnaire.tsx", "utf8");
  assert.equal(hint.split("<IntakeQuestionHint />").length - 1, 1);
  assert.ok(readFileSync("lib/invite-copy.ts", "utf8").includes("mit ‚Muss ich klären‘ markieren."));
  let empty = ensureGesamt(emptyAnswers());
  for (const key of ["bargeld", "lager", "personal", "zeiterfassung", "online", "retouren", "papier", "erechnung", "anlagen", "kanzlei", "branche", "zahlungsdienstleister"] as const) {
    empty = setCheckAntwort(empty, key, "ja");
  }
  const issues = catalogStepIssues(stepIndex("step-M02"), empty);
  const statusErrors = issues.filter((issue) => issue.message.includes("ob das heute so läuft"));
  assert.equal(statusErrors.length, 0, "keine wiederholten Statusfehler");
  assert.equal(question("LE01").allowEntfaellt, true);
  assert.equal(question("LE03").allowEntfaellt, true);
  assert.equal(question("LE04").allowEntfaellt, true);
  assert.equal(question("VK01").allowEntfaellt, undefined);
  assert.equal(question("LE02").allowEntfaellt, undefined);
  assert.equal(question("LE05").allowEntfaellt, undefined);
  assert.equal(ENTFAELLT_CHIP, "Gibt es bei uns nicht");
  let marked = setCatalogStatus(empty, "LE03", "nicht_zutreffend");
  marked = { ...marked, katalog: { ...marked.katalog, LE03: { ...marked.katalog?.LE03, status: "nicht_zutreffend", reason: ENTFAELLT_GRUND } } };
  assert.equal(catalogStepIssues(stepIndex("step-M02"), marked).some((issue) => issue.questionId === "LE03"), false);
  assert.ok(modulFortschritt(marked, "m02").beantwortet >= 1);
  const pdf = bodyOf(setModulEintrag(marked, "m02", { status: "tool" }), "m02");
  assert.ok(pdf.includes("entfällt"));
  assert.ok(pdf.includes(ENTFAELLT_GRUND));
  assert.ok(!/\bLE03\b/.test(pdf), "keine Fragen-ID im PDF");
  const later = setModulEintrag(empty, "m02", { status: "offen" });
  assert.equal(effectiveModulStatus(later, "m02").status, "offen");
  const next = nextApplicableStep(stepIndex("step-M02"), later);
  assert.notEqual(CATALOG_STEPS[next]?.when?.modul?.[0], "m02");
}

// 10 — Sie, keine verbotenen Wörter in den neuen Sätzen, keine Fragen-IDs
{
  const texts = [
    WW01_HILFE,
    WW01_SYSTEM_PLACEHOLDER,
    WW01_VORGAENGE_PLACEHOLDER,
    AF01_PROMPT,
    AF01_HILFE,
    AF01_PLACEHOLDER,
    AF01_STATUTORY_HINT,
    FIKTIV_FIELD_MESSAGE,
    BEISPIELWERT_OFFEN,
    VORSCHLAG_MARKE,
    VORSCHLAG_RUECKFRAGE,
    KANZLEI_LABEL,
    KANZLEI_HILFE,
    KANZLEI_WIDERSPRUCH,
    KANZLEI_WIDERSPRUCH_OFFEN,
    RETOUREN_HILFE,
    RETOUREN_HINWEIS,
    MODUL_SPAETER_LABEL,
    MODUL_SPAETER_HINWEIS,
    ENTFAELLT_GRUND,
  ];
  const banned = /\b(fertig|reicht|garantiert|Garantie|rechtssicher|GoBD-konform|prüfungssicher|Bestseller)\b|(\bdu\b|\bdich\b|\bdein\b)/i;
  for (const text of texts) {
    assert.equal(banned.test(text), false, text);
    assert.equal(/\b[A-Z]{2}\d{2}\b/.test(text), false, text);
  }
  assert.ok(!valueContainsFiktiv(WW01_SYSTEM_PLACEHOLDER));
}

// 11 — alte Entwürfe bleiben, Muster behält (fiktiv)
{
  let old = ensureGesamt(emptyAnswers());
  old = setCatalogValue(old, "WW01", "system", `Warenwirtschaft ${FIKTIV_TOKEN}`);
  old = setCatalogValue(old, "WW01", "vorgaenge", "Wareneingang");
  old = setCatalogStatus(old, "WW01", "bestaetigt");
  old = setCatalogValue(old, "UO02", "taetigkeiten", "Einzel-/Großhandel mit Kasse und Lager");
  old = setCatalogStatus(old, "UO02", "bestaetigt");
  const reloaded = JSON.parse(JSON.stringify(old)) as IntakeAnswers;
  const kept = prefillKnownFacts(reloaded);
  assert.equal(kept.katalog?.WW01?.status, "bestaetigt");
  assert.equal(kept.katalog?.WW01?.values?.system, `Warenwirtschaft ${FIKTIV_TOKEN}`);
  assert.equal(kept.katalog?.UO02?.values?.taetigkeiten, "Einzel-/Großhandel mit Kasse und Lager");
  assert.equal(kept.katalog?.UO02?.status, "bestaetigt");
  assert.equal(kept.katalog?.WW01?.vorschlag, undefined, "alte Werte werden nicht nachträglich zum Vorschlag");
  for (const id of VORLAGEN) {
    const muster = getGesamtMuster(id);
    assert.ok(muster, id);
    const pdf = bodyOf(muster!.answers);
    assert.ok(pdf.includes(FIKTIV_TOKEN), `${id}: Muster behält Beispielnamen`);
    assert.equal(muster?.answers.katalog?.AF01?.values?.ablauf, AF01_ZUORDNUNG);
  }
}

console.log("check-modul-verstaendnis: all green");
