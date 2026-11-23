/**
 * Fortschritt auf der Firmenkarte: nur passende Module, unbekannt zählt,
 * nicht_zutreffend zählt nicht, der Link springt zur ersten Lücke.
 * Abgeschickte Dokumente und Karten ohne Entwurf zeigen den Block nicht.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountCompanyCard } from "../components/account-company-card";
import {
  accountDraftContinueHref,
  accountDraftProgress,
  accountDraftProgressFromDraft,
  accountDraftProgressVisible,
  accountOpenPointsText,
  accountProgressSummary,
} from "../lib/account-progress";
import { safeNextPath } from "../lib/auth";
import {
  CATALOG_STEPS,
  catalogQuestionApplies,
  setCatalogStatus,
  type CatalogStatus,
} from "../lib/intake-catalog";
import { normalizeDraftKey, type IntakeDraft } from "../lib/intake-draft-shared";
import { CHECK_FRAGEN, ensureGesamt, setCheckAntwort, setModulEintrag } from "../lib/module/status";
import { emptyEntity, type Entity } from "../lib/entities";
import { emptyAnswers, type IntakeAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function withPricing<T>(model: string | undefined, flag: string | undefined, run: () => T): T {
  const savedModel = process.env.PRICING_MODEL;
  const savedFlag = process.env.INTAKE_LOGIN_FIRST_ENABLED;
  if (model === undefined) delete process.env.PRICING_MODEL;
  else process.env.PRICING_MODEL = model;
  if (flag === undefined) delete process.env.INTAKE_LOGIN_FIRST_ENABLED;
  else process.env.INTAKE_LOGIN_FIRST_ENABLED = flag;
  try {
    return run();
  } finally {
    if (savedModel === undefined) delete process.env.PRICING_MODEL;
    else process.env.PRICING_MODEL = savedModel;
    if (savedFlag === undefined) delete process.env.INTAKE_LOGIN_FIRST_ENABLED;
    else process.env.INTAKE_LOGIN_FIRST_ENABLED = savedFlag;
  }
}

function checks(value: "ja" | "nein" | "unbekannt"): IntakeAnswers {
  let answers = ensureGesamt(emptyAnswers());
  for (const frage of CHECK_FRAGEN) answers = setCheckAntwort(answers, frage.key, value);
  return answers;
}

function visibleIds(answers: IntakeAnswers, modulId: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const step of CATALOG_STEPS) {
    if (!step.when?.modul?.includes(modulId)) continue;
    for (const question of step.questions) {
      if (seen.has(question.id) || !catalogQuestionApplies(question, answers)) continue;
      seen.add(question.id);
      ids.push(question.id);
    }
  }
  return ids;
}

function answerVisible(answers: IntakeAnswers, modulId: string, status: CatalogStatus): IntakeAnswers {
  let next = answers;
  for (let guard = 0; guard < 6; guard += 1) {
    let changed = false;
    for (const id of visibleIds(next, modulId)) {
      if (next.katalog?.[id]?.status === status) continue;
      next = setCatalogStatus(next, id, status);
      changed = true;
    }
    if (!changed) break;
  }
  return next;
}

function draft(overrides: Partial<IntakeDraft> = {}): IntakeDraft {
  return {
    draftKey: "email:ada.fertig@example.com:default:gesamt",
    email: "ada.fertig@example.com",
    stripeSessionId: "",
    documentId: "",
    entityId: "",
    step: 0,
    answers: ensureGesamt(emptyAnswers()),
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function firm(): Entity {
  return {
    ...emptyEntity(),
    entityId: "ent_nordlicht",
    userEmail: "ada.fertig@example.com",
    name: "Nordlicht Handel GmbH",
    street: "Königstraße 12",
    zip: "50667",
    city: "Köln",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    checkoutPrefill: "done",
  };
}

const withoutKasse = checks("nein");
const base = accountDraftProgress(withoutKasse, "gesamt");
const withKasse = accountDraftProgress(setCheckAntwort(withoutKasse, "bargeld", "ja"), "gesamt");
ok(withKasse.total === base.total + 1, "Betriebs-Check Ja nimmt das Kassenmodul in die Zählung");
ok(base.total < withKasse.total, "Betriebs-Check Nein lässt das Kassenmodul weg");
ok(base.summary === accountProgressSummary(base.done, base.total), "Text ist X von Y Modulen erledigt");

const kasseAnswers = setCheckAntwort(withoutKasse, "bargeld", "ja");
const kasseIds = visibleIds(kasseAnswers, "m08");
ok(kasseIds.length > 0, "das Kassenmodul hat Fragen");
const unknownKasse = answerVisible(kasseAnswers, "m08", "unbekannt");
const unknownProgress = accountDraftProgress(unknownKasse, "gesamt");
ok(unknownProgress.done === base.done + 1, "unbekannt zählt als beantwortet, das Modul ist erledigt");
ok(unknownProgress.openPoints === kasseIds.length, "jede unbekannt-Antwort ist ein offener Punkt");
ok(
  unknownProgress.openPointsText === accountOpenPointsText(unknownProgress.openPoints),
  "offene Punkte stehen als eigener Satz",
);

const firstKasse = kasseIds[0] ?? "";
const mixed = setCatalogStatus(unknownKasse, firstKasse, "nicht_zutreffend");
const mixedProgress = accountDraftProgress(mixed, "gesamt");
ok(mixedProgress.openPoints === unknownProgress.openPoints - 1, "nicht_zutreffend ist kein offener Punkt");
ok(mixedProgress.done === unknownProgress.done, "nicht_zutreffend lässt die übrigen Antworten gelten");
ok(!mixedProgress.openPointsText.includes("nicht_zutreffend"), "der Satz nennt den Status nicht");

const excluded = answerVisible(kasseAnswers, "m08", "nicht_zutreffend");
const excludedProgress = accountDraftProgress(excluded, "gesamt");
ok(excludedProgress.total === base.total, "ein Modul nur mit nicht_zutreffend zählt nicht mit");
ok(
  excludedProgress.openPoints === base.openPoints,
  "nicht_zutreffend erzeugt keine offenen Punkte",
);

const rawExcluded = setCheckAntwort(withoutKasse, "bargeld", "ja");
rawExcluded.module!.status.m08 = { status: "nicht_vorhanden", reason: "", ref: "", link: "" };
(rawExcluded.module!.status.m08 as { status: string }).status = "nicht_zutreffend";
ok(
  accountDraftProgress(rawExcluded, "gesamt").total === base.total,
  "Modulstatus nicht_zutreffend zählt nicht mit",
);

const postponed = setModulEintrag(unknownKasse, "m08", { status: "offen", reason: "", ref: "", link: "" });
const postponedProgress = accountDraftProgress(postponed, "gesamt");
ok(postponedProgress.total === unknownProgress.total, "später bleibt in der Zählung");
ok(postponedProgress.done === unknownProgress.done - 1, "ein Modul auf später ist nicht erledigt");

const emptyGesamt = accountDraftProgress(ensureGesamt(emptyAnswers()), "gesamt");
ok(emptyGesamt.stepId === "step-BC", "ohne Betriebs-Check ist das die erste Lücke");
ok(emptyGesamt.openPointsText === "", "null offene Punkte werden nicht gezeigt");

const afterCompany = accountDraftProgress(setCatalogStatus(withoutKasse, "A01", "unbekannt"), "gesamt");
ok(afterCompany.stepId === "step-M01b", "unbekannt ist keine Lücke, der nächste Schritt ist es");
ok(afterCompany.openPointsText === "1 offener Punkt", "eine Klärung ist ein offener Punkt");
ok(accountDraftProgress(withoutKasse, "gesamt").stepId === "step-M01", "nach dem Check beginnt die Lücke bei Modul 1");

const bereichDraft = draft({
  draftKey: normalizeDraftKey({ email: "ada.fertig@example.com", modus: "bereich" }),
  answers: emptyAnswers(),
});
const bereichProgress = accountDraftProgressFromDraft(bereichDraft);
ok(bereichProgress.total > 0, "ein Bereichsentwurf hat einen eigenen Umfang");
ok(bereichProgress.total !== withKasse.total, "der Bereich zählt nicht die Module des Gesamtdokuments");
ok(bereichProgress.stepId !== "step-BC" && !bereichProgress.stepId.startsWith("step-M"), "die Lücke liegt im Bereich");
const polluted = accountDraftProgressFromDraft(
  draft({
    draftKey: bereichDraft.draftKey,
    answers: setCheckAntwort(ensureGesamt(emptyAnswers()), "bargeld", "ja"),
  }),
);
ok(polluted.total === bereichProgress.total, "ein Bereichsentwurf ignoriert den Modulstand");

const gapDraft = draft({
  draftKey: normalizeDraftKey({ email: "ada.fertig@example.com", modus: "gesamt" }),
  answers: setCatalogStatus(withoutKasse, "A01", "unbekannt"),
});
ok(gapDraft.draftKey.endsWith(":default:gesamt"), "der Default-Schlüssel bleibt unverändert");

withPricing("v3", undefined, () => {
  const unpaid = accountDraftContinueHref(gapDraft);
  ok(unpaid.startsWith("/fragebogen?"), "unbezahlter Login-Entwurf öffnet /fragebogen");
  ok(unpaid.includes("entity_id=default"), "der Default-Entwurf bleibt ungebunden");
  ok(unpaid.includes("schritt=step-M01b"), "der Link springt zur ersten Lücke");
  ok(!unpaid.includes(gapDraft.draftKey), "der Schlüssel steht nicht in der Adresse");

  const covered = draft({
    draftKey: normalizeDraftKey({ email: "ada.fertig@example.com", entityId: "ent_nordlicht", modus: "gesamt" }),
    entityId: "ent_nordlicht",
    answers: gapDraft.answers,
  });
  const coveredHref = accountDraftContinueHref(covered, { covered: true });
  ok(coveredHref.startsWith("/intake?"), "Comp, Digistore und Abo bleiben auf /intake");
  ok(coveredHref.includes("entity_id=ent_nordlicht"), "die Firma bleibt in der Adresse");
  ok(coveredHref.includes("schritt=step-M01b"), "auch dort springt der Link zur Lücke");
  ok(!coveredHref.includes("/fragebogen"), "eine abgedeckte Firma öffnet nicht /fragebogen");

  const areaHref = accountDraftContinueHref(bereichDraft);
  ok(areaHref.startsWith("/intake?"), "ein Bereichsentwurf bleibt auf /intake");
  ok(areaHref.includes(`schritt=${bereichProgress.stepId}`), "die Lücke liegt im Bereichsschritt");
  ok(!areaHref.includes("/fragebogen"), "ein Bereichsentwurf öffnet nicht /fragebogen");
});

const submitted = draft({
  draftKey: "session:cs_test_done:gesamt",
  stripeSessionId: "cs_test_done",
  documentId: "doc_done",
});
ok(accountDraftProgressVisible(submitted, [{ documentId: "doc_done" }]) === null, "ein abgeschicktes Dokument zeigt keinen Block");
ok(accountDraftProgressVisible(submitted, []) !== null, "dieselbe Zahlung ohne Dokument bleibt sichtbar");
ok(accountDraftProgressVisible(null, []) === null, "ohne Entwurf gibt es keinen Block");

function renderCard(drafts: IntakeDraft[]): string {
  return renderToStaticMarkup(
    createElement(AccountCompanyCard, {
      email: "ada.fertig@example.com",
      group: { entity: firm(), families: [], continueDrafts: drafts },
      empty: drafts.length === 0,
    }),
  );
}

const shown = renderCard([gapDraft]);
ok(shown.includes(accountProgressSummary(
  accountDraftProgressFromDraft(gapDraft).done,
  accountDraftProgressFromDraft(gapDraft).total,
)), "die Karte zeigt den Stand");
ok(shown.includes("1 offener Punkt"), "die Karte zeigt den offenen Punkt");
ok(shown.includes("Weiter ausfüllen"), "der Linktext bleibt Weiter ausfüllen");
ok(shown.includes("schritt=step-M01b"), "die Karte verlinkt die Lücke");
ok(!renderCard([]).includes("Modulen erledigt"), "ohne Entwurf fehlt der Block");
ok(!shown.includes("fertig") && !shown.includes("Garantie") && !shown.includes("rechtssicher"), "keine gesperrten Wörter");

const css = readFileSync("app/globals.css", "utf8");
ok(css.includes(".draft-progress .btn") && css.includes("position: static"), "der Knopf liegt im Fluss und wird nicht überdeckt");

ok(
  safeNextPath("/fragebogen?entity_id=default&schritt=step-M01b") ===
    "/fragebogen?entity_id=default&schritt=step-M01b",
  "die Anmeldung behält die Lücke",
);
ok(
  safeNextPath("/fragebogen?entity_id=firm-a&next=https://evil.example") === "/fragebogen?entity_id=firm-a",
  "fremde Parameter fallen weiter weg",
);

console.log("check-account-progress: ok");
