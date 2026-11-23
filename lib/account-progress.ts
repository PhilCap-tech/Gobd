/**
 * Fortschritt eines offenen Fragebogen-Entwurfs für das Konto.
 * Gerechnet aus dem gespeicherten Entwurf, ohne ihn zu schreiben.
 */
import {
  BETRIEBS_CHECK_STEP_ID,
  CATALOG_STEPS,
  MODUL_UEBERSICHT_STEP_ID,
  catalogQuestionApplies,
  catalogState,
  catalogStepApplies,
  type CatalogQuestion,
  type CatalogStep,
} from "@/lib/intake-catalog";
import type { IntakeDraft } from "@/lib/intake-draft-shared";
import { MODULE } from "@/lib/module/katalog";
import {
  betriebsCheckVollstaendig,
  effectiveModulStatus,
  ensureGesamt,
  isGesamt,
} from "@/lib/module/status";
import {
  isUndeliveredDraft,
  openDraftContinuePath,
  openDraftIsBereich,
  type OpenDraftContinueOptions,
} from "@/lib/open-drafts";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

const ANSWERED = new Set(["bestaetigt", "geplant", "unbekannt", "nicht_zutreffend"]);

export type AccountDraftProgress = {
  done: number;
  total: number;
  openPoints: number;
  /** Erster Schritt mit einer Frage ohne Stand. Leer, wenn keine Lücke offen ist. */
  stepId: string;
  /** Gesetztes Modul, wenn die Lücke ein auf „später“ gesetztes Modul ist. */
  modulId: string;
  summary: string;
  /** Leer bei 0. */
  openPointsText: string;
};

export function accountProgressSummary(done: number, total: number): string {
  return `${done} von ${total} Modulen erledigt`;
}

export function accountOpenPointsText(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "1 offener Punkt";
  return `${count} offene Punkte`;
}

function statusOf(answers: IntakeAnswers, id: string): string {
  const status = answers.katalog?.[id]?.status;
  return typeof status === "string" ? status : "";
}

function moduleStatus(answers: IntakeAnswers, modulId: string): string {
  const stored = answers.module?.status?.[modulId] as { status?: string } | undefined;
  // Ein gespeicherter Stand „nicht_zutreffend“ schließt das Modul aus,
  // auch wenn die heutige Ableitung diesen Wert noch verwirft.
  if (stored?.status === "nicht_zutreffend") return stored.status;
  return effectiveModulStatus(answers, modulId).status;
}

function withoutModule(answers: IntakeAnswers): IntakeAnswers {
  if (!answers.module) return answers;
  const next: IntakeAnswers = { ...answers };
  delete next.module;
  return next;
}

function moduleSteps(modulId: string): CatalogStep[] {
  return CATALOG_STEPS.filter((step) => step.when?.modul?.includes(modulId));
}

function visibleQuestions(step: CatalogStep, answers: IntakeAnswers): CatalogQuestion[] {
  return step.questions.filter((question) => catalogQuestionApplies(question, answers));
}

function pack(done: number, total: number, openPoints: number, stepId: string, modulId: string): AccountDraftProgress {
  return {
    done,
    total,
    openPoints,
    stepId,
    modulId,
    summary: accountProgressSummary(done, total),
    openPointsText: accountOpenPointsText(openPoints),
  };
}

/**
 * Gesamtdokument: ein Modul zählt, wenn es für diesen Betrieb gilt.
 * „nicht vorhanden“ und „nicht zutreffend“ zählen nicht. Ein Modul, dessen
 * Fragen alle „nicht zutreffend“ sind, zählt nicht. „Später“ zählt und ist
 * nicht erledigt. „Bestehende Dokumentation“ ist erledigt.
 * „Muss ich klären“ (unbekannt) ist beantwortet und ein offener Punkt.
 */
function gesamtProgress(answers: IntakeAnswers): AccountDraftProgress {
  const state = catalogState(answers);
  let done = 0;
  let total = 0;
  let openPoints = 0;
  const seenOpen = new Set<string>();
  let questionGap = "";
  let laterModul = "";
  const checkOpen =
    catalogStepApplies(
      CATALOG_STEPS.find((step) => step.id === BETRIEBS_CHECK_STEP_ID) ?? CATALOG_STEPS[0],
      answers,
    ) && !betriebsCheckVollstaendig(answers);

  for (const modul of MODULE) {
    const status = moduleStatus(answers, modul.id);
    if (status === "nicht_vorhanden" || status === "nicht_zutreffend") continue;
    if (status === "offen") {
      total += 1;
      if (!laterModul) laterModul = modul.id;
      continue;
    }
    if (status === "extern") {
      total += 1;
      done += 1;
      continue;
    }
    if (status !== "tool") continue;

    const steps = moduleSteps(modul.id);
    const visible: Array<{ stepId: string; question: CatalogQuestion }> = [];
    const seen = new Set<string>();
    for (const step of steps) {
      for (const question of visibleQuestions(step, answers)) {
        if (seen.has(question.id)) continue;
        seen.add(question.id);
        visible.push({ stepId: step.id, question });
      }
    }
    const counted = visible.filter((item) => statusOf(answers, item.question.id) !== "nicht_zutreffend");
    if (visible.length === 0 || counted.length === 0) continue;

    total += 1;
    let moduleDone = true;
    for (const item of counted) {
      const value = state[item.question.id]?.status ?? "";
      if (value === "unbekannt" && !seenOpen.has(item.question.id)) {
        seenOpen.add(item.question.id);
        openPoints += 1;
      }
      if (!ANSWERED.has(value)) {
        moduleDone = false;
        if (!questionGap) questionGap = item.stepId;
      }
    }
    if (moduleDone) done += 1;
  }

  const stepId = checkOpen ? BETRIEBS_CHECK_STEP_ID : questionGap || (laterModul ? MODUL_UEBERSICHT_STEP_ID : "");
  const modulId = !checkOpen && !questionGap ? laterModul : "";
  return pack(done, total, openPoints, stepId, modulId);
}

/** Bereichsentwurf: nur die Schritte dieses Bereichs, nicht die 24 Module. */
function bereichProgress(answers: IntakeAnswers): AccountDraftProgress {
  const scoped = withoutModule(answers);
  const state = catalogState(scoped);
  let done = 0;
  let total = 0;
  let openPoints = 0;
  const seenOpen = new Set<string>();
  let questionGap = "";

  for (const step of CATALOG_STEPS) {
    if (step.id === MODUL_UEBERSICHT_STEP_ID || step.id === BETRIEBS_CHECK_STEP_ID) continue;
    if (!catalogStepApplies(step, scoped)) continue;
    const seen = new Set<string>();
    const visible = visibleQuestions(step, scoped).filter((question) => {
      if (seen.has(question.id)) return false;
      seen.add(question.id);
      return true;
    });
    const counted = visible.filter((question) => state[question.id]?.status !== "nicht_zutreffend");
    if (visible.length === 0 || counted.length === 0) continue;
    total += 1;
    let stepDone = true;
    for (const question of counted) {
      const value = state[question.id]?.status ?? "";
      if (value === "unbekannt" && !seenOpen.has(question.id)) {
        seenOpen.add(question.id);
        openPoints += 1;
      }
      if (!ANSWERED.has(value)) {
        stepDone = false;
        if (!questionGap) questionGap = step.id;
      }
    }
    if (stepDone) done += 1;
  }
  return pack(done, total, openPoints, questionGap, "");
}

export function accountDraftProgress(answers: IntakeAnswers, scope: "gesamt" | "bereich"): AccountDraftProgress {
  return scope === "bereich" ? bereichProgress(answers) : gesamtProgress(answers);
}

export function accountDraftProgressFromDraft(
  draft: Pick<IntakeDraft, "draftKey" | "answers">,
): AccountDraftProgress {
  const raw = draft.answers && typeof draft.answers === "object" ? draft.answers : emptyAnswers();
  if (openDraftIsBereich(draft)) return bereichProgress(raw);
  return gesamtProgress(isGesamt(raw) ? raw : ensureGesamt(raw));
}

/**
 * Block nur bei einem offenen, nicht abgesendeten Entwurf.
 * Ein abgeschicktes Dokument und ein fehlender Entwurf liefern null.
 */
export function accountDraftProgressVisible(
  draft: Pick<IntakeDraft, "draftKey" | "answers" | "documentId" | "stripeSessionId"> | null | undefined,
  delivered: readonly { documentId?: string; stripeSessionId?: string }[],
): AccountDraftProgress | null {
  if (!draft?.draftKey?.trim()) return null;
  if (!isUndeliveredDraft(draft, delivered)) return null;
  return accountDraftProgressFromDraft(draft);
}

/** „Weiter ausfüllen“ auf die erste Lücke. Der Entwurfsschlüssel bleibt unverändert. */
export function accountDraftContinueHref(
  draft: Pick<IntakeDraft, "draftKey" | "answers" | "documentId" | "stripeSessionId" | "entityId">,
  options?: OpenDraftContinueOptions,
): string {
  const progress = accountDraftProgressFromDraft(draft);
  const base = openDraftContinuePath(draft, options);
  if (!progress.stepId) return base;
  const url = new URL(base, "http://local.invalid");
  url.searchParams.set("schritt", progress.stepId);
  if (progress.modulId) url.searchParams.set("modul", progress.modulId);
  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}
