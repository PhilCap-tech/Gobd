"use client";

import { useMemo, useState } from "react";
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
  nextApplicableStep,
  paperStepSkipped,
  previousApplicableStep,
  withCatalogDraft,
} from "@/lib/intake-catalog";
import { INTAKE_REVIEW, INTAKE_STEPS, intakeStepError } from "@/lib/intake-questions";
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
};

export function IntakeForm({
  session,
  initialAnswers,
  sourceDocumentId,
  nextVersion,
  entities = [],
  initialEntityId = "",
  areaBaseDocumentId,
  existingBereiche = [],
}: IntakeFormProps) {
  const companyLabel = customerHubTitle(session.company, "");
  const nextVersionLabel = nextVersion
    ? versionLabelFromRow({ version: String(nextVersion) })
    : "n+1";
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [answers, setAnswers] = useState<IntakeAnswers>(() =>
    withCatalogDraft(initialAnswers ?? emptyAnswers(), session.company),
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [change, setChange] = useState<VersionChangeDraft>({
    validFrom: berlinTodayIso(),
    validTo: "",
    changeSummary: "",
    changedBy: session.email,
  });
  const isEdit = Boolean(sourceDocumentId);
  const isNewArea = Boolean(areaBaseDocumentId);
  const showFirmSelect = !isEdit && !isNewArea && entities.length > 1;

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
          {companyLabel ? ` für ${companyLabel}` : ""}. Beim Absenden entsteht
          Version {nextVersionLabel} — bisherige PDFs bleiben downloadbar.
        </p>
      )}

      {isNewArea && step <= INTAKE_STEPS.length && (
        <p className="banner">
          Neuer Bereich {bereichLabel(bereichIdOf(answers))}
          {companyLabel ? ` für ${companyLabel}` : ""}. Der allgemeine Teil (Unternehmen,
          Systeme, Ablage, Berechtigungen, Kontrollen) ist aus der letzten Fassung vorbelegt.
          Bitte prüfen. Alle Bereiche sind im Preis enthalten, es entsteht keine neue Bestellung.
        </p>
      )}

      {notice ? <p className="banner ok">{notice}</p> : null}

      {session.email && step === 0 && (
        <p className="hint">
          Session: {companyLabel || "—"} · {session.email}
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
          {step === 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <BereichSelect
                value={bereichIdOf(answers)}
                locked={isEdit}
                existing={existingBereiche}
                onChange={(bereich) => setAnswers((current) => ({ ...current, bereich }))}
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
                setNotice("");
                setStep((s) => previousApplicableStep(s, answers));
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
