"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IntakeQuestionnaire } from "@/components/intake-questionnaire";
import { DEMO_BEISPIEL_SEED_NOTE, demoBeispielAnswers, demoBlankAnswers } from "@/lib/demo-beispiel";
import { intakeSummary } from "@/lib/frage-intake";
import {
  nextApplicableStep,
  paperStepSkipped,
  previousApplicableStep,
} from "@/lib/intake-catalog";
import { INTAKE_REVIEW, INTAKE_STEPS, intakeStepError } from "@/lib/intake-questions";
import { openPointBeforeUse } from "@/lib/intake-present";
import {
  evaluateOpenPoints,
  openPointChapterLabel,
} from "@/lib/open-points";
import { PARTNER_MUSTER_IDENTITY, PARTNER_MUSTER_PATH } from "@/lib/partner-muster";
import type { IntakeAnswers } from "@/lib/types";

const PAPER_SKIP_NOTE = "Kein Papierweg — Scan-Fragen übersprungen.";

type StartMode = "example" | "blank";

export function DemoWalkthrough() {
  const [mode, setMode] = useState<StartMode | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(() => demoBlankAnswers());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const openPoints = useMemo(
    () =>
      evaluateOpenPoints({
        answers,
        identity: PARTNER_MUSTER_IDENTITY,
      }),
    [answers],
  );
  const beforeUse = openPoints.filter((point) => openPointBeforeUse(point.priority, point.id));
  const later = openPoints.filter((point) => !openPointBeforeUse(point.priority, point.id));
  const summary = useMemo(() => intakeSummary(answers), [answers]);

  function begin(nextMode: StartMode) {
    setMode(nextMode);
    setAnswers(nextMode === "example" ? demoBeispielAnswers() : demoBlankAnswers());
    setStep(0);
    setError("");
    setNotice("");
  }

  if (!mode) {
    return (
      <>
        <p className="banner">
          Beispiel-Fragen — so etwa läuft der Prozess. Angaben hier sind ein Test, kein
          Mandantenmandat. Die Demo speichert keine Eingaben: kein Konto, keine Bestellung.
        </p>
        <h1>Fragenprozess ansehen</h1>
        <p className="prose">
          Entweder einen ausgefüllten Beispielbetrieb laden oder die Fragen selbst durchgehen.
        </p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => begin("example")}>
            Beispielbetrieb laden
          </button>
          <button type="button" className="btn ghost" onClick={() => begin("blank")}>
            Antworten selbst ausprobieren
          </button>
        </div>
        <p className="hint">{DEMO_BEISPIEL_SEED_NOTE}</p>
      </>
    );
  }

  return (
    <>
      <p className="banner">
        Beispiel-Fragen — so etwa läuft der Prozess. Angaben hier sind ein Test, kein
        Mandantenmandat. Die Demo speichert keine Eingaben: kein Konto, keine Bestellung. Die
        Fragen und die Prüfung vor „Weiter“ sind die aus dem produktiven Ablauf.
      </p>
      {mode === "example" ? <p className="hint">{DEMO_BEISPIEL_SEED_NOTE}</p> : null}

      {step <= INTAKE_STEPS.length && (
        <div className="progress" aria-hidden="true">
          {Array.from({ length: INTAKE_STEPS.length + 1 }, (_, index) => (
            <i key={index} className={index < step ? "done" : index === step ? "on" : ""} />
          ))}
        </div>
      )}

      {notice ? <p className="banner ok">{notice}</p> : null}

      {step < INTAKE_STEPS.length && (
        <IntakeQuestionnaire step={step} answers={answers} onChange={setAnswers} />
      )}

      {step === INTAKE_STEPS.length && (
        <section>
          <p className="step-label">{INTAKE_REVIEW.stepLabel}</p>
          <h1>Angaben und offene Punkte</h1>
          <p className="prose">
            Im Produkt hieße dieser Schritt „{INTAKE_REVIEW.title}“ und würde speichern. Hier endet
            die Demo. Die Liste nutzt denselben Regelsatz wie die Offene-Punkte-Tabelle im PDF.
          </p>
          <div className="card">
            <dl className="summary">
              {summary.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Vor Verwendung klären</h2>
            <p className="hint">
              {beforeUse.length} Punkt{beforeUse.length === 1 ? "" : "e"}. Diese Punkte sollten
              geklärt sein, bevor die Dokumentation verwendet wird.
            </p>
            {beforeUse.length === 0 ? (
              <p className="prose">Keine Punkte in dieser Gruppe.</p>
            ) : (
              <ul className="prose-list">
                {beforeUse.map((point) => (
                  <li key={point.id}>
                    {point.text}{" "}
                    <span className="hint">({openPointChapterLabel(point.chapter)})</span>
                  </li>
                ))}
              </ul>
            )}
            <h2>Später ergänzen</h2>
            <p className="hint">
              {later.length} Punkt{later.length === 1 ? "" : "e"}. Diese Angaben können nach der
              ersten Fassung ergänzt werden.
            </p>
            {later.length === 0 ? (
              <p className="prose">Keine Punkte in dieser Gruppe.</p>
            ) : (
              <ul className="prose-list">
                {later.map((point) => (
                  <li key={point.id}>
                    {point.text}{" "}
                    <span className="hint">({openPointChapterLabel(point.chapter)})</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="prose">
              So entstehen Entwurf und offene Punkte. Als Nächstes die Muster-Dokumentation ansehen.
            </p>
            <p className="hint">
              Diese Übersicht ist keine Freigabe. Das feste Muster-PDF der{" "}
              <Link href={PARTNER_MUSTER_PATH}>Beispiel GmbH</Link> nutzt dieselbe Gliederung.
              Gespeichert wird hier nichts.
            </p>
            <div className="actions" style={{ marginTop: 12 }}>
              <Link className="btn" href={PARTNER_MUSTER_PATH}>
                Muster-Dokumentation ansehen
              </Link>
            </div>
          </div>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions" style={{ marginTop: 18 }}>
        {step > 0 && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setError("");
              setNotice("");
              setStep((current) => previousApplicableStep(current, answers));
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
              const message = intakeStepError(step, answers);
              if (message) {
                setError(message);
                return;
              }
              const target = nextApplicableStep(step, answers);
              setNotice(paperStepSkipped(step, target, answers) ? PAPER_SKIP_NOTE : "");
              setError("");
              setStep(target);
            }}
          >
            {step === INTAKE_STEPS.length - 1 ? "Zur Übersicht" : "Weiter"}
          </button>
        )}
        {step === INTAKE_STEPS.length && (
          <button type="button" className="btn ghost" onClick={() => begin(mode)}>
            {mode === "example" ? "Beispielbetrieb erneut" : "Von vorn"}
          </button>
        )}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setMode(null);
            setStep(0);
            setError("");
            setNotice("");
          }}
        >
          Andere Startart
        </button>
      </div>
    </>
  );
}
