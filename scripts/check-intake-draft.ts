/**
 * Draft round-trip: every intake field type survives save + restore,
 * and prefill only fills fields that are still empty afterwards.
 */
import assert from "node:assert/strict";
import {
  catalogStepIssues,
  CATALOG_STEPS,
  clearCatalogStatus,
  prefillKnownFacts,
  setCatalogMeta,
  setCatalogStatus,
  setCatalogValue,
} from "../lib/intake-catalog";
import {
  draftRevision,
  incomingDraftWins,
  preferIntakeSnapshot,
  type IntakeDraftSnapshot,
} from "../lib/intake-draft-shared";
import { ensureGesamt, setCheckAntwort, setModulEintrag } from "../lib/module/status";
import { emptyAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

export function checkIntakeDraftRestore(): void {
  let answers = ensureGesamt(emptyAnswers());
  answers = setCatalogValue(answers, "A01", "company", "Eigene GmbH");
  answers = setCatalogValue(answers, "A01", "rechtsform", "GmbH");
  answers = setCatalogValue(answers, "A01", "gf", "Ada Beispiel");
  answers = setCatalogValue(answers, "A01", "branchen", ["Handel"]);
  answers = setCatalogStatus(answers, "A04", "bestaetigt");
  answers = setCatalogValue(answers, "A04", "gueltigAb", "2020-05-01");
  answers = setCatalogValue(answers, "A04", "keineRueckdatierungBestaetigt", true);
  answers = setCatalogStatus(answers, "B01", "geplant");
  answers = setCatalogMeta(answers, "B01", { responsible: "Kim Prüfer", date: "2026-11-01" });
  answers = setCatalogValue(answers, "B01", "it", "Intern");
  answers = setCheckAntwort(answers, "bargeld", "ja");
  answers = setCheckAntwort(answers, "lager", "nein");
  answers = setModulEintrag(answers, "m02", { status: "extern", ref: "Bestehende VD Verkauf" });

  const step = CATALOG_STEPS.findIndex((item) => item.id === "step-M01");
  ok(step >= 0, "module 1 step exists");

  const stored = JSON.parse(
    JSON.stringify({ answers, step, savedAt: "2026-10-08T10:00:00.000Z", revision: 4 }),
  ) as IntakeDraftSnapshot;

  ok(stored.answers.katalog?.A04?.values?.keineRueckdatierungBestaetigt === true, "checkbox boolean survives JSON");
  ok(stored.answers.katalog?.A04?.values?.gueltigAb === "2020-05-01", "date survives JSON");
  ok(stored.answers.katalog?.A04?.status === "bestaetigt", "status chip survives JSON");
  ok(stored.answers.katalog?.A01?.values?.rechtsform === "GmbH", "select survives JSON");
  ok(stored.answers.module?.check?.bargeld === "ja", "betriebs-check survives JSON");
  ok(stored.answers.module?.status?.m02?.status === "extern", "module status survives JSON");
  ok(stored.step === step, "position survives JSON");

  const staleServer: IntakeDraftSnapshot = {
    answers: prefillKnownFacts(ensureGesamt(emptyAnswers()), { name: "Nordlicht GmbH" }),
    step: 0,
    savedAt: "2026-10-08T10:05:00.000Z",
    revision: 1,
  };
  const chosen = preferIntakeSnapshot(staleServer, stored);
  ok(chosen === stored, "higher revision beats a newer incomplete server draft");
  ok(
    !incomingDraftWins({ revision: 1, clientUpdatedAt: "2026-10-08T10:05:00.000Z" }, { revision: 4, updatedAt: "2026-10-08T10:00:00.000Z" }),
    "older revision does not overwrite",
  );
  ok(
    incomingDraftWins({ revision: 4, clientUpdatedAt: "2026-10-08T09:00:00.000Z" }, { revision: 1, updatedAt: "2026-10-08T10:05:00.000Z" }),
    "newer revision wins despite an older timestamp",
  );
  ok(draftRevision({ revision: 0 }) === 0, "unset revision stays 0");

  const restored = prefillKnownFacts(chosen!.answers, {
    name: "Nordlicht GmbH",
    street: "Hafenweg 2",
    zip: "20457",
    city: "Hamburg",
  });
  const a01 = restored.katalog?.A01?.values ?? {};
  const a04 = restored.katalog?.A04;
  ok(a01.company === "Eigene GmbH", "prefill does not replace a restored company");
  ok(a01.rechtsform === "GmbH", "restored Rechtsform stays");
  ok(a01.gf === "Ada Beispiel", "restored Geschäftsleitung stays");
  ok(Array.isArray(a01.branchen) && (a01.branchen as string[]).includes("Handel"), "restored multi choice stays");
  ok(String(a01.standort).includes("Hamburg"), "prefill fills a still-empty standort");
  ok(a04?.values?.gueltigAb === "2020-05-01", "restored Gültig-ab stays");
  ok(a04?.values?.keineRueckdatierungBestaetigt === true, "restored confirmation stays checked");
  ok(a04?.status === "bestaetigt", "restored Stand stays");
  ok(restored.katalog?.B01?.status === "geplant", "restored geplant status stays");
  ok(restored.katalog?.B01?.responsible === "Kim Prüfer", "restored responsibility stays");
  ok(restored.katalog?.B01?.date === "2026-11-01", "restored status date stays");
  ok(restored.katalog?.B01?.values?.it === "Intern", "restored text field stays");
  ok(restored.module?.check?.bargeld === "ja" && restored.module?.check?.lager === "nein", "restored Betriebs-Check stays");
  ok(restored.module?.status?.m02?.ref === "Bestehende VD Verkauf", "restored module status stays");

  const cleared = clearCatalogStatus(restored, "A04");
  ok(!cleared.katalog?.A04?.status, "clicking the active Stand clears it");
  ok(cleared.katalog?.A04?.values?.gueltigAb === "2020-05-01", "clearing Stand keeps the date");
  ok(cleared.katalog?.A04?.values?.keineRueckdatierungBestaetigt === true, "clearing Stand keeps the checkbox");
  ok(
    catalogStepIssues(step, cleared).some((issue) => issue.questionId === "A04" && issue.fieldKey === "status"),
    "required Stand validation returns after clearing",
  );

  console.log("check-intake-draft: green");
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("check-intake-draft.ts") || entry.endsWith("check-intake-draft.js")) {
  checkIntakeDraftRestore();
}
