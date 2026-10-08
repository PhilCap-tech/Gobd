"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BereichSelect } from "@/components/bereich-select";
import { FirmaSelect } from "@/components/firma-select";
import { IntakeQuestionnaire } from "@/components/intake-questionnaire";
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
import { customerHubTitle } from "@/lib/account-display";
import { bereichIdOf, bereichLabel } from "@/lib/bereiche";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";
import {
  berlinTodayIso,
  versionChangeDraftError,
  versionLabelFromRow,
} from "@/lib/versioning";

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
};

function firmFactsFor(
  entityId: string,
  entities: EntityChoice[],
  firm: FirmFacts | undefined,
  company: string,
): FirmFacts {
  const selected = entities.find((item) => item.entityId === entityId);
  if (selected) {
    return {
      name: selected.name,
      street: selected.street,
      zip: selected.zip,
      city: selected.city,
      stnr: selected.stnr,
      ustId: selected.ustId,
    };
  }
  if (firm && (firm.name || firm.street || firm.city || firm.stnr || firm.ustId)) {
    return { ...firm, name: firm.name || company };
  }
  return { name: company };
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
  const [entityId, setEntityId] = useState(initialEntityId);
  const [answers, setAnswers] = useState<IntakeAnswers>(() =>
    startAnswers(initialAnswers, session.company, gesamtMode, facts),
  );
  const liveFacts = firmFactsFor(entityId, entities, firm, session.company);
  // Erster Schritt des Modus: Gesamt beginnt mit dem Betriebs-Check, Bereichs-VDs mit Schritt A.
  const firstStep = nextApplicableStep(-1, answers);
  const [error, setError] = useState("");
  const [showGaps, setShowGaps] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);
  const [scrollIssue, setScrollIssue] = useState<CatalogIssue | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [change, setChange] = useState<VersionChangeDraft>({
    validFrom: berlinTodayIso(),
    validTo: "",
    changeSummary: "",
    changedBy: session.email,
  });
  const [draftRestored, setDraftRestored] = useState(false);
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
      answers: answersRef.current,
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

  const postServerDraft = useCallback((revision: number, keepalive = false) => {
    const meta = draftMetaRef.current;
    if (!meta.draftKey || revision <= 0) return;
    const savedAt = new Date().toISOString();
    void fetch("/api/intake/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      keepalive,
      body: JSON.stringify({
        draftKey: meta.draftKey,
        sessionId: meta.sessionId,
        documentId: meta.documentId,
        areaFromDocumentId: meta.areaFromDocumentId,
        email: meta.email,
        entityId: meta.entityId,
        modus: meta.modus,
        step: stepRef.current,
        answers: answersRef.current,
        revision,
        change: { ...changeRef.current },
        clientUpdatedAt: serverDraftAtRef.current || savedAt,
      }),
    })
      .then(async (response) => {
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
          return;
        }
        if (response.ok) {
          const data = (await response.json()) as { draft?: { updatedAt?: string } };
          if (data.draft?.updatedAt) setServerDraftAt(data.draft.updatedAt);
        }
      })
      .catch(() => {
        // offline: localStorage reicht als Fallback
      });
  }, [writeLocalDraft]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let local: IntakeDraftSnapshot | null = null;
      try {
        const raw = window.localStorage.getItem(localDraftKey);
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
        const restoredAnswers = prefillKnownFacts(decision.answers, liveFactsRef.current);
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
    if (!draftKey || revision <= 0) return;
    const timer = window.setTimeout(() => postServerDraft(revisionRef.current), 400);
    return () => window.clearTimeout(timer);
  }, [answers, step, change, draftKey, draftReady, postServerDraft, writeLocalDraft]);
  useEffect(() => {
    function flush() {
      if (!draftReadyRef.current) return;
      const revision = revisionRef.current;
      if (revision <= 0) return;
      const snapshot = JSON.stringify({
        answers: answersRef.current,
        step: stepRef.current,
        change: changeRef.current,
      });
      if (snapshot === baselineRef.current) return;
      writeLocalDraft(revision);
      postServerDraft(revision, true);
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
  const stepIssues = showGaps && !firmMissing ? catalogStepIssues(step, answers) : [];
  const visibleError = firmMissing
    ? "Bitte eine Firma wählen."
    : stepIssues[0]?.message || error;
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
    if (showFirmSelect && !entityId.trim()) {
      setError("Bitte eine Firma wählen.");
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
    setPending(true);
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      let data: {
        error?: string;
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
        setError(data.error || "Speichern fehlgeschlagen.");
        return;
      }
      if (!data.store || !data.documentId) {
        setError(data.error || "Speichern fehlgeschlagen.");
        return;
      }
      clearDraft();
      const params = new URLSearchParams({
        session_id: session.stripeSessionId,
        document_id: data.documentId,
      });
      if (data.loginMail === "sent") params.set("anmeldung", "gesendet");
      else if (data.loginMail === "failed") params.set("anmeldung", "fehler");
      else if (data.loginMail === "stub") params.set("anmeldung", "stub");
      router.push(`/success?${params}`);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  const summary = useMemo(() => intakeSummary(answers), [answers]);

  return (
    <>
      {step < INTAKE_STEPS.length + 1 && (
        <div className="progress" aria-hidden="true">
          {Array.from({ length: INTAKE_STEPS.length + 1 }, (_, index) => (
            <i
              key={index}
              className={index < step ? "done" : index === step ? "on" : ""}
            />
          ))}
        </div>
      )}

      {session.stub && step <= INTAKE_STEPS.length && !isEdit && (
        <p className="banner">
          Test ohne Zahlung. Die Angaben werden gespeichert, sobald Sie
          absenden.
        </p>
      )}

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
        </>
      )}

      {step === INTAKE_STEPS.length && (
        <section>
          <p className="step-label">{INTAKE_REVIEW.stepLabel}</p>
          <h1>{INTAKE_REVIEW.title}</h1>
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

      {visibleError && <p className="error">{visibleError}</p>}

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
                  : "Speichern…"
                : isEdit
                  ? "Neue Version erzeugen"
                  : "Intake absenden"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
