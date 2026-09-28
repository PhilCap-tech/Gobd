"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FirmaSelect } from "@/components/firma-select";
import { IntakeQuestionnaire } from "@/components/intake-questionnaire";
import {
  VersionChangeFields,
  type VersionChangeDraft,
} from "@/components/version-change-fields";
import type { EntityChoice } from "@/lib/entities";
import { intakeSummary } from "@/lib/frage-intake";
import { withCatalogDraft } from "@/lib/intake-catalog";
import { INTAKE_REVIEW, INTAKE_STEPS, intakeStepError } from "@/lib/intake-questions";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";
import { berlinTodayIso, versionChangeDraftError } from "@/lib/versioning";

type IntakeFormProps = {
  session: CheckoutIdentity;
  initialAnswers?: IntakeAnswers;
  sourceDocumentId?: string;
  nextVersion?: number;
  entities?: EntityChoice[];
  initialEntityId?: string;
};

export function IntakeForm({
  session,
  initialAnswers,
  sourceDocumentId,
  nextVersion,
  entities = [],
  initialEntityId = "",
}: IntakeFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [answers, setAnswers] = useState<IntakeAnswers>(() =>
    withCatalogDraft(initialAnswers ?? emptyAnswers(), session.company),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [change, setChange] = useState<VersionChangeDraft>({
    validFrom: berlinTodayIso(),
    validTo: "",
    changeSummary: "",
    changedBy: session.email,
  });
  const isEdit = Boolean(sourceDocumentId);
  const showFirmSelect = !isEdit && entities.length > 1;

  function validate(current: number): boolean {
    setError("");
    if (current === 0 && showFirmSelect && !entityId.trim()) {
      setError("Bitte eine Firma wählen.");
      return false;
    }
    const message = intakeStepError(current, answers);
    if (message) {
      setError(message);
      return false;
    }
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
      const params = new URLSearchParams({
        session_id: session.stripeSessionId,
        document_id: data.documentId,
      });
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
          Test ohne Zahlung. Die Angaben werden gespeichert, sobald du
          absendest.
        </p>
      )}

      {isEdit && step <= INTAKE_STEPS.length && (
        <p className="banner">
          Du bearbeitest die Angaben
          {session.company ? ` für ${session.company}` : ""}. Beim Absenden
          entsteht Version {nextVersion ?? "n+1"} — bisherige PDFs bleiben
          downloadbar.
        </p>
      )}

      {session.email && step === 0 && (
        <p className="hint">
          Session: {session.company || "—"} · {session.email}
        </p>
      )}

      {step < INTAKE_STEPS.length && (
        <>
          {step === 0 && showFirmSelect && (
            <div className="card" style={{ marginBottom: 16 }}>
              <FirmaSelect
                entities={entities}
                value={entityId}
                onChange={setEntityId}
                required
              />
            </div>
          )}
          <IntakeQuestionnaire step={step} answers={answers} onChange={setAnswers} />
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
              Entwurf aus deinen Angaben — keine Freigabe und keine
              individuelle Steuer- oder Rechtsberatung. Eine Abstimmung mit
              dem Steuerberater ist optional und nur im Rahmen eines
              gesonderten Auftrags.
            </p>
          </div>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {step < INTAKE_STEPS.length + 1 && (
        <div className="actions" style={{ marginTop: 18 }}>
          {step > 0 && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setError("");
                setStep((s) => Math.max(0, s - 1));
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
                setStep((s) => s + 1);
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
