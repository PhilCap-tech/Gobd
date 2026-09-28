"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FirmaSelect } from "@/components/firma-select";
import {
  VersionChangeFields,
  type VersionChangeDraft,
} from "@/components/version-change-fields";
import type { EntityChoice } from "@/lib/entities";
import {
  INTAKE_AUSGANG,
  INTAKE_BACKUP,
  INTAKE_BRANCHEN,
  INTAKE_EINGANG,
  INTAKE_FIBU,
  INTAKE_HOSTING,
  INTAKE_MITARBEITENDE,
  INTAKE_RECHTSFORMEN,
  INTAKE_REVIEW,
  INTAKE_STEPS,
  intakeStepError,
} from "@/lib/intake-questions";
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

function Chips({
  options,
  value,
  onChange,
  multi,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="chips">
      {options.map((option) => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={on ? "chip on" : "chip"}
            onClick={() => {
              if (multi) {
                onChange(
                  on ? value.filter((item) => item !== option) : [...value, option],
                );
              } else {
                onChange([option]);
              }
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

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
  const [answers, setAnswers] = useState<IntakeAnswers>(
    initialAnswers ?? emptyAnswers,
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

  function patch(partial: Partial<IntakeAnswers>) {
    setAnswers((current) => ({ ...current, ...partial }));
  }

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

  const summary = useMemo(
    () => [
      ["Branche", answers.branchen.join(", ") || "—"],
      ["Rechtsform", answers.rechtsform || "—"],
      ["Mitarbeitende", answers.mitarbeitende || "—"],
      ["FiBu", answers.fibu.join(", ") || "—"],
      ["Weitere Systeme", answers.weitereSysteme || "—"],
      ["Eingangsbelege", answers.eingangsbelege.join(", ") || "—"],
      ["Ausgangsrechnungen", answers.ausgangsrechnungen.join(", ") || "—"],
      ["Archiv", answers.archiv || "—"],
      ["Hosting", answers.hosting || "—"],
      ["Backup", answers.backup.join(", ") || "—"],
      ["Zugriff", answers.zugriff || "—"],
      ["GF / Inhaber", answers.gf || "—"],
      ["Buchhaltung", answers.buchhaltung || "—"],
      ["IT", answers.it || "—"],
      ["Steuerberater", answers.steuerberater || "—"],
    ],
    [answers],
  );

  return (
    <>
      {step < 6 && (
        <div className="progress" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <i
              key={index}
              className={index < step ? "done" : index === step ? "on" : ""}
            />
          ))}
        </div>
      )}

      {session.stub && step < 6 && !isEdit && (
        <p className="banner">
          Test ohne Zahlung. Die Angaben werden gespeichert, sobald du
          absendest.
        </p>
      )}

      {isEdit && step < 6 && (
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

      {step === 0 && (
        <section>
          <p className="step-label">{INTAKE_STEPS[0].stepLabel}</p>
          <h1>{INTAKE_STEPS[0].title}</h1>
          <div className="card">
            {showFirmSelect && (
              <FirmaSelect
                entities={entities}
                value={entityId}
                onChange={setEntityId}
                required
              />
            )}
            <div className="field">
              <label>Branche (mehrere möglich)</label>
              <Chips
                options={[...INTAKE_BRANCHEN]}
                value={answers.branchen}
                onChange={(branchen) => patch({ branchen })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="rechtsform">Rechtsform</label>
              <select
                id="rechtsform"
                value={answers.rechtsform}
                onChange={(e) => patch({ rechtsform: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                {INTAKE_RECHTSFORMEN.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ma">Mitarbeitende (ca.)</label>
              <select
                id="ma"
                value={answers.mitarbeitende}
                onChange={(e) => patch({ mitarbeitende: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                {INTAKE_MITARBEITENDE.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <p className="step-label">{INTAKE_STEPS[1].stepLabel}</p>
          <h1>{INTAKE_STEPS[1].title}</h1>
          <div className="card">
            <div className="field">
              <label>Buchhaltung / FiBu</label>
              <Chips
                options={[...INTAKE_FIBU]}
                value={answers.fibu}
                onChange={(fibu) => patch({ fibu })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="andere-sw">
                Weitere Systeme (ERP, Kassensystem, Zeiterfassung …)
              </label>
              <textarea
                id="andere-sw"
                placeholder="z. B. Shopify, Lightspeed, Clockodo …"
                value={answers.weitereSysteme}
                onChange={(e) => patch({ weitereSysteme: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <p className="step-label">{INTAKE_STEPS[2].stepLabel}</p>
          <h1>{INTAKE_STEPS[2].title}</h1>
          <div className="card">
            <div className="field">
              <label>Wie kommen Eingangsbelege rein?</label>
              <Chips
                options={[...INTAKE_EINGANG]}
                value={answers.eingangsbelege}
                onChange={(eingangsbelege) => patch({ eingangsbelege })}
                multi
              />
            </div>
            <div className="field">
              <label>Ausgangsrechnungen</label>
              <Chips
                options={[...INTAKE_AUSGANG]}
                value={answers.ausgangsrechnungen}
                onChange={(ausgangsrechnungen) => patch({ ausgangsrechnungen })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="archiv">Wo werden Belege archiviert?</label>
              <input
                id="archiv"
                placeholder="z. B. DATEV Unternehmen online, Drive, lokaler Server …"
                value={answers.archiv}
                onChange={(e) => patch({ archiv: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <p className="step-label">{INTAKE_STEPS[3].stepLabel}</p>
          <h1>{INTAKE_STEPS[3].title}</h1>
          <div className="card">
            <div className="field">
              <label htmlFor="hosting">Wo liegen die Daten?</label>
              <select
                id="hosting"
                value={answers.hosting}
                onChange={(e) => patch({ hosting: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                {INTAKE_HOSTING.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Backup</label>
              <Chips
                options={[...INTAKE_BACKUP]}
                value={answers.backup}
                onChange={(backup) => patch({ backup })}
              />
            </div>
            <div className="field">
              <label htmlFor="zugriff">Wer hat Zugriff auf Buchhaltungsdaten?</label>
              <textarea
                id="zugriff"
                placeholder="z. B. Inhaber, Buchhaltung intern, Steuerberater, externe IT …"
                value={answers.zugriff}
                onChange={(e) => patch({ zugriff: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          <p className="step-label">{INTAKE_STEPS[4].stepLabel}</p>
          <h1>{INTAKE_STEPS[4].title}</h1>
          <div className="card">
            <div className="field">
              <label htmlFor="gf">Geschäftsführung / Inhaber</label>
              <input
                id="gf"
                placeholder="Name"
                value={answers.gf}
                onChange={(e) => patch({ gf: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="buchhaltung">Buchhaltung / Belegverantwortung</label>
              <input
                id="buchhaltung"
                placeholder="Name oder „externer Steuerberater“"
                value={answers.buchhaltung}
                onChange={(e) => patch({ buchhaltung: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="it-person">IT / Systeme</label>
              <input
                id="it-person"
                placeholder="Name oder Dienstleister"
                value={answers.it}
                onChange={(e) => patch({ it: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="steuerberater">Steuerberater (Kanzlei)</label>
              <input
                id="steuerberater"
                placeholder="optional"
                value={answers.steuerberater}
                onChange={(e) => patch({ steuerberater: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 5 && (
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
              Entwurf zur Abstimmung mit deinem Steuerberater — keine
              individuelle Steuer- oder Rechtsberatung.
            </p>
          </div>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {step < 6 && (
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
          {step < 5 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!validate(step)) return;
                setStep((s) => s + 1);
              }}
            >
              {step === 4 ? "Zur Übersicht" : "Weiter"}
            </button>
          )}
          {step === 5 && (
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
