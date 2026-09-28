"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { evaluateOpenPoints, openPointChapterLabel } from "@/lib/open-points";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_PATH,
} from "@/lib/partner-muster";
import type { IntakeAnswers } from "@/lib/types";

function Chips({
  options,
  value,
  onChange,
  multi,
}: {
  options: readonly string[];
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

export function DemoWalkthrough() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(PARTNER_MUSTER_ANSWERS);
  const [error, setError] = useState("");

  function patch(partial: Partial<IntakeAnswers>) {
    setAnswers((current) => ({ ...current, ...partial }));
  }

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

      {step === 0 && (
        <section>
          <p className="step-label">{INTAKE_STEPS[0].stepLabel}</p>
          <h1>{INTAKE_STEPS[0].title}</h1>
          <div className="card">
            <div className="field">
              <label>Branche (mehrere möglich)</label>
              <Chips
                options={INTAKE_BRANCHEN}
                value={answers.branchen}
                onChange={(branchen) => patch({ branchen })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="demo-rechtsform">Rechtsform</label>
              <select
                id="demo-rechtsform"
                value={answers.rechtsform}
                onChange={(event) => patch({ rechtsform: event.target.value })}
              >
                <option value="">Bitte wählen</option>
                {INTAKE_RECHTSFORMEN.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="demo-ma">Mitarbeitende (ca.)</label>
              <select
                id="demo-ma"
                value={answers.mitarbeitende}
                onChange={(event) => patch({ mitarbeitende: event.target.value })}
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
                options={INTAKE_FIBU}
                value={answers.fibu}
                onChange={(fibu) => patch({ fibu })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="demo-systeme">
                Weitere Systeme (ERP, Kassensystem, Zeiterfassung …)
              </label>
              <textarea
                id="demo-systeme"
                placeholder="z. B. Shopify, Lightspeed, Clockodo …"
                value={answers.weitereSysteme}
                onChange={(event) => patch({ weitereSysteme: event.target.value })}
              />
            </div>
            <p className="hint">
              Systeme sind diese beiden Felder. Es gibt keinen weiteren
              Fragenzweig dazu.
            </p>
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
                options={INTAKE_EINGANG}
                value={answers.eingangsbelege}
                onChange={(eingangsbelege) => patch({ eingangsbelege })}
                multi
              />
            </div>
            <div className="field">
              <label>Ausgangsrechnungen</label>
              <Chips
                options={INTAKE_AUSGANG}
                value={answers.ausgangsrechnungen}
                onChange={(ausgangsrechnungen) => patch({ ausgangsrechnungen })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="demo-archiv">Wo werden Belege archiviert?</label>
              <input
                id="demo-archiv"
                placeholder="z. B. DATEV Unternehmen online, Drive, lokaler Server …"
                value={answers.archiv}
                onChange={(event) => patch({ archiv: event.target.value })}
              />
            </div>
            <p className="hint">
              Belegeingang ist die Auswahl oben. Die nächsten Fragen bleiben
              gleich. Im Dokument setzt der Generator die gewählten Wege in die
              festen Kapitel „Verfahren Papier“ und „Verfahren Digital“ — beide
              Kapitel entstehen immer.
            </p>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <p className="step-label">{INTAKE_STEPS[3].stepLabel}</p>
          <h1>{INTAKE_STEPS[3].title}</h1>
          <div className="card">
            <div className="field">
              <label htmlFor="demo-hosting">Wo liegen die Daten?</label>
              <select
                id="demo-hosting"
                value={answers.hosting}
                onChange={(event) => patch({ hosting: event.target.value })}
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
                options={INTAKE_BACKUP}
                value={answers.backup}
                onChange={(backup) => patch({ backup })}
              />
            </div>
            <div className="field">
              <label htmlFor="demo-zugriff">
                Wer hat Zugriff auf Buchhaltungsdaten?
              </label>
              <textarea
                id="demo-zugriff"
                placeholder="z. B. Inhaber, Buchhaltung intern, Steuerberater, externe IT …"
                value={answers.zugriff}
                onChange={(event) => patch({ zugriff: event.target.value })}
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
              <label htmlFor="demo-gf">Geschäftsführung / Inhaber</label>
              <input
                id="demo-gf"
                placeholder="Name"
                value={answers.gf}
                onChange={(event) => patch({ gf: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="demo-buchhaltung">
                Buchhaltung / Belegverantwortung
              </label>
              <input
                id="demo-buchhaltung"
                placeholder="Name oder „externer Steuerberater“"
                value={answers.buchhaltung}
                onChange={(event) => patch({ buchhaltung: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="demo-it">IT / Systeme</label>
              <input
                id="demo-it"
                placeholder="Name oder Dienstleister"
                value={answers.it}
                onChange={(event) => patch({ it: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="demo-stb">Steuerberater (Kanzlei)</label>
              <input
                id="demo-stb"
                placeholder="optional"
                value={answers.steuerberater}
                onChange={(event) => patch({ steuerberater: event.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 5 && (
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
              {openPoints.length} Punkt{openPoints.length === 1 ? "" : "e"} aus
              leeren Feldern. Schwere wie im PDF: high, medium, low.
            </p>
            {openPoints.length === 0 ? (
              <p className="prose">
                Alle abgefragten Felder sind befüllt. Der Regelsatz erzeugt dann
                keine automatischen offenen Punkte.
              </p>
            ) : (
              <div className="legal legal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Schwere</th>
                      <th scope="col">Offener Punkt</th>
                      <th scope="col">Kapitel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPoints.map((point) => (
                      <tr key={point.id}>
                        <td>{point.severity}</td>
                        <td>{point.title}</td>
                        <td>{openPointChapterLabel(point.chapter)}</td>
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
              <Link href={PARTNER_MUSTER_PATH}>Beispiel GmbH</Link> ist ein
              Entwurf (DRAFT / not Philip-final), nicht die fachliche
              Endfassung. Gültig-ab und ein Kurztext zur Änderung gibt es beim
              Speichern einer Fassung nach dem Kauf, nicht in dieser Demo.
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
        {step < 5 && (
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
            {step === 4 ? "Zur Übersicht" : "Weiter"}
          </button>
        )}
        {step === 5 && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setAnswers(PARTNER_MUSTER_ANSWERS);
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
