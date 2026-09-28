"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IntakeQuestionnaire } from "@/components/intake-questionnaire";
import { seedDemoFragen } from "@/lib/frage-intake";
import { INTAKE_REVIEW, INTAKE_STEPS, intakeStepError } from "@/lib/intake-questions";
import {
  evaluateOpenPoints,
  openPointChapterLabel,
  openPointDueLabel,
} from "@/lib/open-points";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_PATH,
} from "@/lib/partner-muster";
import type { IntakeAnswers } from "@/lib/types";

export function DemoWalkthrough() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(() => seedDemoFragen(PARTNER_MUSTER_ANSWERS));
  const [error, setError] = useState("");

  const openPoints = useMemo(
    () =>
      evaluateOpenPoints({
        answers,
        identity: PARTNER_MUSTER_IDENTITY,
      }),
    [answers],
  );

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
      <p className="banner">
        Beispiel-Fragen — so etwa läuft der Prozess. Angaben hier sind ein
        Test, kein Mandantenmandat. Die Demo speichert keine Eingaben: kein
        Konto, kein Checkout. Die Fragen und die Prüfung vor „Weiter“ sind die
        aus dem produktiven Ablauf.
      </p>

      {step <= INTAKE_STEPS.length && (
        <div className="progress" aria-hidden="true">
          {Array.from({ length: INTAKE_STEPS.length + 1 }, (_, index) => (
            <i
              key={index}
              className={index < step ? "done" : index === step ? "on" : ""}
            />
          ))}
        </div>
      )}

      {step < INTAKE_STEPS.length && (
        <IntakeQuestionnaire step={step} answers={answers} onChange={setAnswers} />
      )}

      {step === INTAKE_STEPS.length && (
        <section>
          <p className="step-label">{INTAKE_REVIEW.stepLabel}</p>
          <h1>Angaben und offene Punkte</h1>
          <p className="prose">
            Im Produkt hieße dieser Schritt „{INTAKE_REVIEW.title}“ und würde
            speichern. Hier endet die Demo. Die Liste nutzt denselben
            Regelsatz wie die Offene-Punkte-Tabelle im PDF.
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
            <h2>Offene Punkte zu diesen Angaben</h2>
            <p className="hint">
              {openPoints.length} Punkt{openPoints.length === 1 ? "" : "e"}.
              Priorität wie im PDF: hoch, mittel, niedrig. Zieltermin nicht
              festgelegt.
            </p>
            {openPoints.length === 0 ? (
              <p className="prose">
                Kein offener Punkt aus diesen Statuswerten. Das ist keine Freigabe
                und kein Nachweis, dass der Prozess vollständig beschrieben ist.
              </p>
            ) : (
              <div className="legal legal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Priorität</th>
                      <th scope="col">Offener Punkt</th>
                      <th scope="col">Kapitel</th>
                      <th scope="col">Zieltermin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPoints.map((point) => (
                      <tr key={point.id}>
                        <td>{point.priority}</td>
                        <td>{point.text}</td>
                        <td>{openPointChapterLabel(point.chapter)}</td>
                        <td>{point.dueDate ?? openPointDueLabel()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="prose">
              So entstehen Entwurf und Offene Punkte. Als Nächstes die
              Muster-Dokumentation ansehen.
            </p>
            <p className="hint">
              Diese Liste folgt Ihren Klicks. Das feste Muster-PDF der{" "}
              <Link href={PARTNER_MUSTER_PATH}>Beispiel GmbH</Link> nutzt
              dieselbe Gliederung. Präsens nur für bestätigte Angaben. Die
              Erzeugung ist keine Freigabe durch die Geschäftsführung.
              Gültig-ab gibt es beim Speichern einer Fassung nach dem Kauf,
              nicht in dieser Demo.
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
              setStep((current) => Math.max(0, current - 1));
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
              setError("");
              setStep((current) => current + 1);
            }}
          >
            {step === INTAKE_STEPS.length - 1 ? "Zur Übersicht" : "Weiter"}
          </button>
        )}
        {step === INTAKE_STEPS.length && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setAnswers(seedDemoFragen(PARTNER_MUSTER_ANSWERS));
              setError("");
              setStep(0);
            }}
          >
            Beispieldaten erneut
          </button>
        )}
      </div>
    </>
  );
}
