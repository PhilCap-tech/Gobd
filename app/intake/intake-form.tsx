"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { anmeldungParam } from "@/lib/login-mail-shared";
import {
  fetchRetrying503,
  FINAL_SAVE_FAILED_MESSAGE,
  FINAL_SAVE_RETRIES,
  prepayRedirectAllowed,
  SAVE_PENDING_LABEL,
  SERVER_SAVE_FAILED_HINT,
  autosaveRetryDelayMs,
  nextSaveFailures,
} from "@/lib/fetch-retry";
import { DraftAutosave } from "@/lib/draft-autosave";
import { IntakeHintProvider, intakeInviteHref } from "@/components/intake-question-hint";
import { SHEETS_RETRY_MESSAGE } from "@/lib/sheets-unavailable";
import { BereichSelect } from "@/components/bereich-select";
import { FirmaSelect } from "@/components/firma-select";
import { IntakeProgress } from "@/components/intake-progress";
import { IntakeQuestionnaire, StepError } from "@/components/intake-questionnaire";
import { IntakeStepHeading, useIntakeStepFocus } from "@/components/intake-step-heading";
import {
  VersionChangeFields,
  type VersionChangeDraft,
} from "@/components/version-change-fields";
import type { EntityChoice } from "@/lib/entities";
import { intakeSummary } from "@/lib/frage-intake";
import {
  CATALOG_STEPS,
  catalogStepApplies,
  catalogStepIssues,
  firstFreitextIssue,
  intakeFormIssues,
  nextApplicableStep,
  paperStepSkipped,
  prefillKnownFacts,
  previousApplicableStep,
  withCatalogDraft,
  type CatalogIssue,
  type FirmFacts,
} from "@/lib/intake-catalog";
import { ensureGesamt, isGesamt } from "@/lib/module/status";
import {
  draftRevision,
  normalizeDraftKey,
  parseDraftVersionChange,
  preferIntakeSnapshot,
  resolveDraftAfterLoad,
  type DraftVersionChange,
  type IntakeDraftSnapshot,
} from "@/lib/intake-draft-shared";
import { INTAKE_REVIEW, INTAKE_STEPS } from "@/lib/intake-questions";
import { stripEmptyIntakeCards } from "@/lib/intake-present";
import { customerHubTitle } from "@/lib/account-display";
import { bereichIdOf, bereichLabel } from "@/lib/bereiche";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";
import {
  berlinTodayIso,
  versionChangeDraftError,
  versionLabelFromRow,
} from "@/lib/versioning";
import { readIntakeDraftEntry, sweepIntakeDrafts } from "@/lib/browser-storage-expiry";

type IntakeFormProps = {
  session: CheckoutIdentity;
  initialAnswers?: IntakeAnswers;
  sourceDocumentId?: string;
  nextVersion?: number;
  entities?: EntityChoice[];
  initialEntityId?: string;
  /** New area document for a company that already has one (no new checkout). */
  areaBaseDocumentId?: string;
  /** Areas the company already documents. */
  existingBereiche?: string[];
  /** Start as 24-Module Gesamtdokument. */
  gesamtMode?: boolean;
  /** Katalog-Schritt, z. B. step-MO aus dem Konto. */
  initialStepId?: string;
  /** Modulzeile in der Übersicht, z. B. m08. */
  focusModulId?: string;
  /** Firmenstammdaten für leere Felder (Name, Anschrift, Steuernummer). */
  firm?: FirmFacts;
  /** Anmeldung, wenn eine gelieferte Fassung ohne Login geändert werden soll. */
  loginHref?: string;
  /**
   * Nur bei Stripe-Test-Key (`sk_test_` / `pk_test_`). Live blendet den
   * Hinweis aus.
   */
  stripeTestMode?: boolean;
  /**
   * Neues Preismodell, Login zuerst (INTAKE_LOGIN_FIRST_ENABLED): nach der
   * letzten Frage nicht absenden, sondern Entwurf speichern und zur Paketwahl
   * (Zahlung) wechseln. Erstellt wird erst nach bestätigter Zahlung.
   */
  prepayHref?: string;
};

/** Random id for this page and for each submit. */
function newClientId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function checkoutBilling(firm: FirmFacts | undefined): Pick<
  FirmFacts,
  "billingLine1" | "billingPostalCode" | "billingCity"
> {
  return {
    billingLine1: firm?.billingLine1,
    billingPostalCode: firm?.billingPostalCode,
    billingCity: firm?.billingCity,
  };
}

function firmFactsFor(
  entityId: string,
  entities: EntityChoice[],
  firm: FirmFacts | undefined,
  company: string,
): FirmFacts {
  const billing = checkoutBilling(firm);
  const selected = entities.find((item) => item.entityId === entityId);
  if (selected) {
    return {
      name: selected.name,
      street: selected.street,
      zip: selected.zip,
      city: selected.city,
      stnr: selected.stnr,
      ustId: selected.ustId,
      ...billing,
    };
  }
  if (
    firm &&
    (firm.name ||
      firm.street ||
      firm.city ||
      firm.stnr ||
      firm.ustId ||
      firm.billingCity ||
      firm.billingLine1 ||
      firm.billingPostalCode)
  ) {
    return { ...firm, name: firm.name || company };
  }
  return { name: company, ...billing };
}

function resolveInitialStep(answers: IntakeAnswers, stepId?: string, modulId?: string): number {
  const fallback = nextApplicableStep(-1, answers);
  const moduleStep = modulId ? `step-M${modulId.slice(1)}` : "";
  for (const id of [moduleStep, stepId ?? ""]) {
    if (!id) continue;
    const index = CATALOG_STEPS.findIndex((step) => step.id === id);
    if (index >= 0 && catalogStepApplies(CATALOG_STEPS[index], answers)) return index;
  }
  return fallback;
}

function startAnswers(
  initial: IntakeAnswers | undefined,
  company: string,
  gesamtMode: boolean,
  firm: FirmFacts,
): IntakeAnswers {
  const start = withCatalogDraft(initial ?? emptyAnswers(), firm.name || company);
  const base = gesamtMode || isGesamt(start) ? ensureGesamt(start) : start;
  return prefillKnownFacts(base, firm);
}

export function IntakeForm({
  session,
  initialAnswers,
  sourceDocumentId,
  nextVersion,
  entities = [],
  initialEntityId = "",
  areaBaseDocumentId,
  existingBereiche = [],
  gesamtMode = false,
  initialStepId = "",
  focusModulId = "",
  firm,
  loginHref = "",
  stripeTestMode = false,
  prepayHref = "",
}: IntakeFormProps) {
  const facts = firmFactsFor(initialEntityId, entities, firm, session.company);
  const companyLabel = customerHubTitle(session.company, "");
  const nextVersionLabel = nextVersion
    ? versionLabelFromRow({ version: String(nextVersion) })
    : "n+1";
  const router = useRouter();
  const [step, setStep] = useState(() =>
    resolveInitialStep(
      startAnswers(initialAnswers, session.company, gesamtMode, facts),
      initialStepId,
      focusModulId,
    ),
  );
  useIntakeStepFocus(step);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [answers, setAnswers] = useState<IntakeAnswers>(() =>
    startAnswers(initialAnswers, session.company, gesamtMode, facts),
  );
  const liveFacts = firmFactsFor(entityId, entities, firm, session.company);
  // Erster Schritt des Modus: Gesamt beginnt mit dem Betriebs-Check, Bereichs-VDs mit Schritt A.
  const firstStep = nextApplicableStep(-1, answers);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [showGaps, setShowGaps] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);
  const [scrollIssue, setScrollIssue] = useState<CatalogIssue | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [change, setChange] = useState<VersionChangeDraft>({
    validFrom: berlinTodayIso(),
    validTo: "",
    changeSummary: "",
    changedBy: session.email,
  });
  const [draftRestored, setDraftRestored] = useState(false);
  const saveBlockedRef = useRef(false);
  /** Autosave reached the server but was not stored (e.g. 503 after retries). */
  const [saveFailures, setSaveFailures] = useState(0);
  const serverSaveFailed = saveFailures > 0;
  /** Final save before the package choice failed: no redirect, retry button. */
  const [finalSaveFailed, setFinalSaveFailed] = useState(false);
  // Entwurf: localStorage (Fallback) + Server (gerätübergreifend).
  const draftKey = normalizeDraftKey({
    sessionId: session.stripeSessionId,
    documentId: sourceDocumentId,
    areaFromDocumentId: areaBaseDocumentId,
    email: session.email,
    entityId: initialEntityId || entityId,
    modus: gesamtMode ? "gesamt" : "bereich",
  });
  const localDraftKey = `gobd-intake-draft:${draftKey || session.stripeSessionId || "neu"}`;
  const [draftReady, setDraftReady] = useState(false);
  const [serverDraftAt, setServerDraftAt] = useState("");
  const revisionRef = useRef(0);
  /** True from the submit click until the submit failed. No autosave meanwhile. */
  const submittingRef = useRef(false);
  /** This page. Sent with every save; the submit closes it on the server. */
  const [formId, setFormId] = useState(() => newClientId().replace(/-/g, ""));
  /** Same submit id for every retry of the same payload. */
  const submitIdRef = useRef<{ id: string; payload: string } | null>(null);
  /** Last state the server confirmed; an equal save is not sent. */
  const lastSavedRef = useRef("");
  const lastSnapshotRef = useRef("");
  const baselineRef = useRef("");
  const answersRef = useRef(answers);
  const stepRef = useRef(step);
  const changeRef = useRef(change);
  const liveFactsRef = useRef(liveFacts);
  const serverDraftAtRef = useRef("");
  const draftReadyRef = useRef(false);
  const formDirtyRef = useRef(false);
  const initialFormRef = useRef<{
    answers: IntakeAnswers;
    step: number;
    change: VersionChangeDraft;
  } | null>(null);
  const draftMetaRef = useRef({
    draftKey,
    localDraftKey,
    sessionId: session.stripeSessionId,
    documentId: sourceDocumentId,
    areaFromDocumentId: areaBaseDocumentId,
    email: session.email,
    entityId: entityId || initialEntityId,
    modus: gesamtMode ? "gesamt" : "bereich",
  });
  useLayoutEffect(() => {
    answersRef.current = answers;
    stepRef.current = step;
    changeRef.current = change;
    liveFactsRef.current = liveFacts;
    serverDraftAtRef.current = serverDraftAt;
    draftReadyRef.current = draftReady;
    if (initialFormRef.current == null) {
      initialFormRef.current = {
        answers: JSON.parse(JSON.stringify(answers)) as IntakeAnswers,
        step,
        change: { ...change },
      };
      baselineRef.current = JSON.stringify({ answers, step, change });
    }
    formDirtyRef.current = JSON.stringify({ answers, step, change }) !== baselineRef.current;
    draftMetaRef.current = {
      draftKey,
      localDraftKey,
      sessionId: session.stripeSessionId,
      documentId: sourceDocumentId,
      areaFromDocumentId: areaBaseDocumentId,
      email: session.email,
      entityId: entityId || initialEntityId,
      modus: gesamtMode ? "gesamt" : "bereich",
    };
  });

  const writeLocalDraft = useCallback((revision: number) => {
    const savedAt = new Date().toISOString();
    const snapshot: IntakeDraftSnapshot = {
      answers: stripEmptyIntakeCards(answersRef.current),
      step: stepRef.current,
      savedAt,
      revision,
      change: { ...changeRef.current },
    };
    try {
      window.localStorage.setItem(draftMetaRef.current.localDraftKey, JSON.stringify(snapshot));
    } catch {
      // Speicher voll oder gesperrt
    }
    return snapshot;
  }, []);

  /** Resolves true only when the server holds this state (saved now or before). */
  const postServerDraft = useCallback((
    revision: number,
    keepalive = false,
    signal?: AbortSignal,
    retries = 1,
  ): Promise<boolean> => {
    const meta = draftMetaRef.current;
    if (!meta.draftKey || revision <= 0) return Promise.resolve(false);
    if (submittingRef.current) return Promise.resolve(false);
    const answersNow = stripEmptyIntakeCards(answersRef.current);
    const saveKey = JSON.stringify({
      draftKey: meta.draftKey,
      answers: answersNow,
      step: stepRef.current,
      change: changeRef.current,
    });
    if (saveKey === lastSavedRef.current) {
      setSaveFailures(0);
      return Promise.resolve(true);
    }
    const savedAt = new Date().toISOString();
    setSaving(true);
    return fetchRetrying503(
      "/api/intake/draft",
      {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      keepalive,
      signal,
      body: JSON.stringify({
        draftKey: meta.draftKey,
        sessionId: meta.sessionId,
        documentId: meta.documentId,
        areaFromDocumentId: meta.areaFromDocumentId,
        email: meta.email,
        entityId: meta.entityId,
        modus: meta.modus,
        step: stepRef.current,
        answers: answersNow,
        revision,
        change: { ...changeRef.current },
        clientUpdatedAt: serverDraftAtRef.current || savedAt,
        formId,
      }),
      },
      // One retry with a growing wait: the next edit saves again anyway.
      { retries, backoff: true },
    )
      .then(async (response): Promise<boolean> => {
        // Submitted meanwhile: this answer is stale.
        if (submittingRef.current || signal?.aborted) return false;
        if (response.status === 401) {
          setNeedsLogin(true);
          setError("Bitte melden Sie sich an, um Ihre Angaben zu ändern.");
          return false;
        }
        if (response.status === 413 || response.status === 429) {
          // Neues Modell: Entwurf zu groß bzw. zu viele offene Entwürfe.
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          saveBlockedRef.current = true;
          setError(data.error || "Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.");
          return false;
        }
        saveBlockedRef.current = false;
        if (response.status === 409) {
          const data = (await response.json()) as {
            draft?: { answers: IntakeAnswers; step: number; updatedAt: string; revision?: number };
          };
          const serverRev = draftRevision(data.draft);
          // Keep what is on screen. Raise the revision floor and write it locally
          // so the next edit is stored instead of being dropped.
          if (serverRev > revisionRef.current) {
            revisionRef.current = serverRev;
            writeLocalDraft(serverRev);
          }
          if (data.draft?.updatedAt) setServerDraftAt(data.draft.updatedAt);
          return false;
        }
        if (response.ok) {
          const data = (await response.json()) as { draft?: { updatedAt?: string } };
          lastSavedRef.current = saveKey;
          if (data.draft?.updatedAt) setServerDraftAt(data.draft.updatedAt);
          setSaveFailures((n) => nextSaveFailures(n, true));
          return true;
        }
        // 503 after the retries (or another server error): kept locally only.
        setSaveFailures((n) => nextSaveFailures(n, false));
        return false;
      })
      .catch(() => {
        // offline: localStorage reicht als Fallback
        if (!signal?.aborted) setSaveFailures((n) => nextSaveFailures(n, false));
        return false;
      })
      .finally(() => setSaving(false));
  }, [formId, writeLocalDraft]);
  const [autosave] = useState(() => new DraftAutosave());
  useEffect(() => {
    autosave.setSend((signal) =>
      postServerDraft(revisionRef.current, false, signal).then(() => undefined),
    );
  }, [autosave, postServerDraft]);
  // Hint „… Wir versuchen es erneut.“: retry on its own (5 s, doubled, max 60 s).
  useEffect(() => {
    if (saveFailures === 0) return;
    const timer = window.setTimeout(() => autosave.request(), autosaveRetryDelayMs(saveFailures));
    return () => window.clearTimeout(timer);
  }, [autosave, saveFailures]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let local: IntakeDraftSnapshot | null = null;
      try {
        // 30-Tage-Ablauf im Browser (lib/browser-storage-expiry.ts); nur lokal, Server-Entwurf unberührt.
        const now = Date.now();
        sweepIntakeDrafts(window.localStorage, now);
        const raw = readIntakeDraftEntry(window.localStorage, localDraftKey, now);
        if (raw) {
          const parsed = JSON.parse(raw) as IntakeDraftSnapshot;
          if (parsed.answers && typeof parsed.answers === "object") {
            const change = parseDraftVersionChange(parsed.change);
            local = {
              answers: parsed.answers,
              step: Number(parsed.step) || 0,
              savedAt: parsed.savedAt ?? "",
              revision: draftRevision(parsed),
              ...(change ? { change } : {}),
            };
          }
        }
      } catch {
        // kein localStorage
      }
      let server: IntakeDraftSnapshot | null = null;
      if (draftKey) {
        try {
          const params = new URLSearchParams({ draftKey });
          if (session.stripeSessionId) params.set("sessionId", session.stripeSessionId);
          const response = await fetch(`/api/intake/draft?${params}`);
          if (response.ok) {
            const data = (await response.json()) as {
              draft?: {
                answers: IntakeAnswers;
                step: number;
                updatedAt: string;
                revision?: number;
                change?: DraftVersionChange;
              } | null;
            };
            if (data.draft?.answers) {
              const change = parseDraftVersionChange(data.draft.change);
              server = {
                answers: data.draft.answers,
                step: Number(data.draft.step) || 0,
                savedAt: data.draft.updatedAt,
                revision: draftRevision(data.draft),
                ...(change ? { change } : {}),
              };
              setServerDraftAt(data.draft.updatedAt);
            }
          }
        } catch {
          // offline: nur lokal
        }
      }
      if (cancelled) return;
      const chosen = preferIntakeSnapshot(server, local);
      const decision = resolveDraftAfterLoad({
        saved: chosen,
        localEdited: formDirtyRef.current || revisionRef.current > 0,
        localRevision: revisionRef.current,
        current: {
          answers: answersRef.current,
          step: stepRef.current,
          change: changeRef.current,
        },
      });
      revisionRef.current = decision.revision;
      if (decision.restored) {
        const restoredAnswers = prefillKnownFacts(
          stripEmptyIntakeCards(decision.answers),
          liveFactsRef.current,
        );
        const restoredStep = Math.max(
          nextApplicableStep(-1, restoredAnswers),
          Math.min(decision.step, INTAKE_STEPS.length),
        );
        const restoredChange = decision.change;
        baselineRef.current = JSON.stringify({
          answers: restoredAnswers,
          step: restoredStep,
          change: restoredChange,
        });
        lastSnapshotRef.current = baselineRef.current;
        setAnswers(restoredAnswers);
        setStep(restoredStep);
        setChange(restoredChange);
        setDraftRestored(true);
      }
      setDraftReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftKey, localDraftKey, session.stripeSessionId]);
  useEffect(() => {
    if (!draftReady) return;
    const snapshot = JSON.stringify({ answers, step, change });
    // The untouched prefill is not a user draft. Saving it used to win the
    // reload and looked like only the company field had been restored.
    if (!baselineRef.current) baselineRef.current = snapshot;
    if (snapshot === baselineRef.current) return;
    let revision = revisionRef.current;
    if (snapshot !== lastSnapshotRef.current) {
      lastSnapshotRef.current = snapshot;
      revision += 1;
      revisionRef.current = revision;
      writeLocalDraft(revision);
    }
    if (!draftKey || revision <= 0 || submittingRef.current) return;
    // One PUT at a time; edits within 1.5 s go out together.
    const timer = window.setTimeout(() => autosave.request(), 1500);
    return () => window.clearTimeout(timer);
  }, [answers, step, change, draftKey, draftReady, autosave, writeLocalDraft]);
  useEffect(() => () => autosave.stop(), [autosave]);
  useEffect(() => {
    // Browser Back after a submit restores this page from the bfcache with the
    // submit still "running". Make the form usable again; a repeated submit
    // keeps its submitId and is answered with the stored document.
    function restored(event: PageTransitionEvent) {
      if (!event.persisted) return;
      submittingRef.current = false;
      setPending(false);
      // The old page id was closed by the submit; edits from here on are a new page.
      setFormId(newClientId().replace(/-/g, ""));
      autosave.resume();
    }
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, [autosave]);
  useEffect(() => {
    function flush() {
      if (!draftReadyRef.current || submittingRef.current) return;
      const revision = revisionRef.current;
      if (revision <= 0) return;
      const snapshot = JSON.stringify({
        answers: answersRef.current,
        step: stepRef.current,
        change: changeRef.current,
      });
      if (snapshot === baselineRef.current) return;
      writeLocalDraft(revision);
      void postServerDraft(revision, true);
    }
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [postServerDraft, writeLocalDraft]);
  function clearDraft() {
    try {
      window.localStorage.removeItem(localDraftKey);
    } catch {
      // ignorieren
    }
    if (draftKey) {
      const params = new URLSearchParams({ draftKey });
      if (session.stripeSessionId) params.set("sessionId", session.stripeSessionId);
      void fetch(`/api/intake/draft?${params}`, { method: "DELETE" }).catch(() => undefined);
    }
    setServerDraftAt("");
  }
  function beginFresh() {
    const confirmed = window.confirm(
      "Neu beginnen? Der gespeicherte Entwurf wird verworfen. Angaben, die nur in diesem Entwurf stehen, gehen verloren.",
    );
    if (!confirmed) return;
    const fresh = initialFormRef.current;
    if (!fresh) return;
    clearDraft();
    const snapshot = JSON.stringify({
      answers: fresh.answers,
      step: fresh.step,
      change: fresh.change,
    });
    baselineRef.current = snapshot;
    lastSnapshotRef.current = snapshot;
    revisionRef.current = 0;
    formDirtyRef.current = false;
    setAnswers(JSON.parse(JSON.stringify(fresh.answers)) as IntakeAnswers);
    setStep(fresh.step);
    setChange({ ...fresh.change });
    setDraftRestored(false);
    setNotice("");
    setError("");
  }
  const isEdit = Boolean(sourceDocumentId);
  const isNewArea = Boolean(areaBaseDocumentId);
  const showFirmSelect = !isEdit && !isNewArea && entities.length > 1;

  const firmMissing = showGaps && step === firstStep && showFirmSelect && !entityId.trim();
  const stepIssues = intakeFormIssues(step, answers, showGaps && !firmMissing);
  const visibleError = error;
  useEffect(() => {
    if (!scrollTick || !firmMissing) return;
    const node = document.getElementById("firma-select");
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (node instanceof HTMLElement) node.focus({ preventScroll: true });
  }, [scrollTick, firmMissing]);

  function chooseEntity(nextId: string) {
    setEntityId(nextId);
    const nextFacts = firmFactsFor(nextId, entities, firm, session.company);
    setAnswers((current) => prefillKnownFacts(current, nextFacts));
  }

  function validate(current: number): boolean {
    setError("");
    if (current === firstStep && showFirmSelect && !entityId.trim()) {
      setShowGaps(true);
      setScrollIssue(null);
      setScrollTick((tick) => tick + 1);
      return false;
    }
    const found = catalogStepIssues(current, answers);
    if (found.length) {
      setShowGaps(true);
      setScrollIssue(found[0]);
      setScrollTick((tick) => tick + 1);
      return false;
    }
    setShowGaps(false);
    setScrollIssue(null);
    return true;
  }

  async function submit() {
    // One submit at a time (a double click or a second tap while the first runs).
    if (submittingRef.current) return;
    if (showFirmSelect && !entityId.trim()) {
      setError("Bitte eine Firma wählen.");
      return;
    }
    const overflow = firstFreitextIssue(answers);
    if (overflow) {
      setShowGaps(true);
      setStep(overflow.step);
      setScrollIssue(overflow.issue);
      setScrollTick((tick) => tick + 1);
      setError(overflow.issue.message);
      return;
    }
    const changeError = versionChangeDraftError(change, {
      requireSummary: isEdit,
    });
    if (changeError) {
      setError(changeError);
      return;
    }
    setError("");
    setNeedsLogin(false);
    if (prepayHref) {
      // Login zuerst: Entwurf sichern, dann Paketwahl. Kein Absenden, keine Erstellung.
      setPending(true);
      setFinalSaveFailed(false);
      try {
        // Only redirect once the server confirmed the draft: after payment the
        // draft is taken over from the server (lib/prepay-draft.ts, no_draft).
        let saved = await postServerDraft(revisionRef.current, false, undefined, FINAL_SAVE_RETRIES);
        // 409 raised the revision floor: one more attempt with the new revision.
        if (!saved && !saveBlockedRef.current) {
          saved = await postServerDraft(revisionRef.current, false, undefined, FINAL_SAVE_RETRIES);
        }
        if (!prepayRedirectAllowed(saved, saveBlockedRef.current)) {
          if (!saveBlockedRef.current) {
            setFinalSaveFailed(true);
            setError(FINAL_SAVE_FAILED_MESSAGE);
          }
          setPending(false);
          return;
        }
        const target = new URLSearchParams({ draftKey });
        if (entityId.trim()) target.set("entity_id", entityId.trim());
        window.location.href = new URL(`${prepayHref}?${target.toString()}`, window.location.origin).toString();
      } catch {
        setFinalSaveFailed(true);
        setError(FINAL_SAVE_FAILED_MESSAGE);
        setPending(false);
      }
      return;
    }
    setPending(true);
    submittingRef.current = true;
    autosave.stop();
    let submitted = false;
    const payload = {
      sessionId: session.stripeSessionId,
      email: session.email,
      company: session.company,
      answers,
      documentId: sourceDocumentId,
      areaFromDocumentId: areaBaseDocumentId,
      entityId: entityId.trim() || undefined,
      validFrom: change.validFrom,
      validTo: change.validTo,
      changeSummary: change.changeSummary,
      changedBy: change.changedBy,
    };
    const payloadKey = JSON.stringify(payload);
    if (submitIdRef.current?.payload !== payloadKey) {
      submitIdRef.current = { id: newClientId(), payload: payloadKey };
    }
    try {
      const response = await fetchRetrying503(
        "/api/intake",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            submitId: submitIdRef.current.id,
            formId,
            draftKey: draftKey || undefined,
          }),
        },
        { backoff: true },
      );
      let data: {
        error?: string;
        questionId?: string;
        fieldKey?: string;
        store?: string;
        documentId?: string;
        loginMail?: string;
      } = {};
      try {
        const text = await response.text();
        if (text.trim()) {
          data = JSON.parse(text) as typeof data;
        }
      } catch {
        data = {};
      }
      if (!response.ok) {
        if (response.status === 401) setNeedsLogin(true);
        if (data.questionId) {
          const found = firstFreitextIssue(answers);
          if (found) {
            setShowGaps(true);
            setStep(found.step);
            setScrollIssue(found.issue);
            setScrollTick((tick) => tick + 1);
          }
        }
        setError(data.error || (response.status === 503 ? SHEETS_RETRY_MESSAGE : "Speichern fehlgeschlagen."));
        return;
      }
      if (!data.store || !data.documentId) {
        setError(data.error || "Speichern fehlgeschlagen.");
        return;
      }
      submitted = true;
      clearDraft();
      const params = new URLSearchParams({ document_id: data.documentId });
      if (session.stripeSessionId) params.set("session_id", session.stripeSessionId);
      const anmeldung = anmeldungParam(data.loginMail);
      if (anmeldung) params.set("anmeldung", anmeldung);
      router.push(`/success?${params}`);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      if (!submitted) {
        // Not stored: the form stays editable and saving goes on.
        submittingRef.current = false;
        autosave.resume();
        autosave.request();
        setPending(false);
      }
    }
  }

  const summary = useMemo(() => intakeSummary(answers), [answers]);

  return (
    <>
      {step < INTAKE_STEPS.length + 1 && <IntakeProgress step={step} answers={answers} />}

      {stripeTestMode ? (
        session.stub && step <= INTAKE_STEPS.length && !isEdit ? (
          <p className="banner">
            Test ohne Zahlung. Die Angaben werden gespeichert, sobald Sie
            absenden.
          </p>
        ) : null
      ) : null}

      {isEdit && step <= INTAKE_STEPS.length && (
        <p className="banner">
          Sie bearbeiten die Angaben
          {companyLabel ? ` für ${companyLabel}` : ""}. Beim Absenden entsteht
          Version {nextVersionLabel} — bisherige PDFs bleiben downloadbar.
        </p>
      )}

      {isNewArea && isGesamt(answers) && step <= INTAKE_STEPS.length && (
        <p className="banner">
          Neues Gesamtdokument{companyLabel ? ` für ${companyLabel}` : ""}. Angaben aus Ihren
          bisherigen Bereichs-Dokumentationen sind übernommen und den Modulen zugeordnet. Bitte
          prüfen. Die bisherigen Bereichs-Dokumentationen bleiben im Konto lesbar. Es entsteht keine
          neue Bestellung.
        </p>
      )}

      {isNewArea && !isGesamt(answers) && step <= INTAKE_STEPS.length && (
        <p className="banner">
          Neuer Bereich {bereichLabel(bereichIdOf(answers))}
          {companyLabel ? ` für ${companyLabel}` : ""}. Der allgemeine Teil (Unternehmen,
          Systeme, Ablage, Berechtigungen, Kontrollen) ist aus der letzten Fassung vorbelegt.
          Bitte prüfen. Alle Bereiche sind im Preis enthalten, es entsteht keine neue Bestellung.
        </p>
      )}

      {draftRestored ? (
        <div className="banner" role="status">
          <p style={{ margin: 0 }}>Ihr Entwurf wurde wiederhergestellt.</p>
          <div className="actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn ghost" onClick={beginFresh}>
              Neu beginnen
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="banner ok">{notice}</p> : null}
      {saving && !pending ? (
        <p className="hint" role="status">
          {SAVE_PENDING_LABEL}
        </p>
      ) : null}
      {serverSaveFailed && !saving && !finalSaveFailed ? (
        <p className="hint" role="status">
          {SERVER_SAVE_FAILED_HINT}
        </p>
      ) : null}

      {session.email && step === firstStep && (
        <p className="hint">
          Session: {companyLabel || "—"} · {session.email}
        </p>
      )}

      {step < INTAKE_STEPS.length && (
        <>
          {step === firstStep && showFirmSelect && (
            <div className="card" style={{ marginBottom: 16 }}>
              <FirmaSelect
                entities={entities}
                value={entityId}
                onChange={chooseEntity}
                required
                invalid={firmMissing}
              />
            </div>
          )}
          {step === firstStep && !isGesamt(answers) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <BereichSelect
                value={bereichIdOf(answers)}
                locked={isEdit}
                existing={existingBereiche}
                onChange={(bereich) => setAnswers((current) => ({ ...current, bereich }))}
              />
            </div>
          )}
          {step === firstStep && isGesamt(answers) && (
            <p className="banner">
              Gesamtdokument mit 24 Modulen. Zuerst der Betriebs-Check, danach die Module Ihres
              Betriebs. Alle Module sind im Preis enthalten.
            </p>
          )}
          <IntakeHintProvider
            value={{
              // Vor der Zahlung (Paketwahl offen) kein Einladen-Link.
              paid: !prepayHref,
              inviteHref: prepayHref ? "" : intakeInviteHref(entityId || initialEntityId),
            }}
          >
          <IntakeQuestionnaire
            step={step}
            answers={answers}
            onChange={setAnswers}
            sessionId={session.stripeSessionId}
            documentId={sourceDocumentId || areaBaseDocumentId || ""}
            focusModulId={focusModulId}
            issues={stepIssues}
            scrollTick={scrollTick}
            scrollIssue={scrollIssue}
            firm={liveFacts}
          />
          </IntakeHintProvider>
        </>
      )}

      {step === INTAKE_STEPS.length && (
        <section>
          <p className="step-label">{INTAKE_REVIEW.stepLabel}</p>
          <IntakeStepHeading>{INTAKE_REVIEW.title}</IntakeStepHeading>
          <div className="card">
            <dl className="summary">
              {summary.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <VersionChangeFields
              value={change}
              onChange={setChange}
              summaryRequired={isEdit}
              idPrefix="intake-version"
            />
            <p className="disclaimer">
              Kein Steuerberatungsersatz. Die erzeugte Dokumentation ist ein
              Entwurf aus Ihren Angaben — keine Freigabe und keine
              individuelle Steuer- oder Rechtsberatung. Eine Abstimmung mit
              dem Steuerberater ist optional und nur im Rahmen eines
              gesonderten Auftrags.
            </p>
          </div>
        </section>
      )}

      {firmMissing ? <p className="error">Bitte eine Firma wählen.</p> : null}
      {stepIssues.length ? <StepError issues={stepIssues} /> : null}
      {!firmMissing && !stepIssues.length && visibleError ? (
        <p className="error">
          {visibleError}
          {needsLogin && loginHref ? (
            <>
              {" "}
              <Link href={loginHref}>Zur Anmeldung</Link>
            </>
          ) : null}
        </p>
      ) : null}
      {finalSaveFailed && !pending && !firmMissing && !stepIssues.length ? (
        <div className="actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={submit}>
            Erneut versuchen
          </button>
        </div>
      ) : null}

      {step < INTAKE_STEPS.length + 1 && (
        <div className="actions" style={{ marginTop: 18 }}>
          {step > firstStep && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setError("");
                setShowGaps(false);
                setNotice("");
                setStep((s) => Math.max(firstStep, previousApplicableStep(s, answers)));
              }}
            >
              Zurück
            </button>
          )}
          {step < INTAKE_STEPS.length && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!validate(step)) return;
                const target = nextApplicableStep(step, answers);
                setNotice(
                  paperStepSkipped(step, target, answers)
                    ? "Kein Papierweg — Scan-Fragen übersprungen."
                    : "",
                );
                setStep(target);
              }}
            >
              {step === INTAKE_STEPS.length - 1 ? "Zur Übersicht" : "Weiter"}
            </button>
          )}
          {step === INTAKE_STEPS.length && (
            <button type="button" className="btn" onClick={submit} disabled={pending}>
              {pending
                ? isEdit
                  ? "Erzeuge Version…"
                  : SAVE_PENDING_LABEL
                : isEdit
                  ? "Neue Version erzeugen"
                  : prepayHref
                    ? "Weiter zur Paketwahl"
                    : "Intake absenden"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
