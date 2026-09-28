"use client";

import {
  FRAGE_STATUSES,
  frageApplies,
  setFrageReason,
  setFrageStatus,
  type FrageId,
  type FrageStatus,
} from "@/lib/frage-intake";
import {
  INTAKE_AUSGANG,
  INTAKE_BACKUP,
  INTAKE_BRANCHEN,
  INTAKE_EINGANG,
  INTAKE_FIBU,
  INTAKE_FORMATE,
  INTAKE_HOSTING,
  INTAKE_MITARBEITENDE,
  INTAKE_RECHTSFORMEN,
  INTAKE_SCAN_ZWECK,
  INTAKE_STEPS,
  INTAKE_VORSYSTEME,
} from "@/lib/intake-questions";
import type { IntakeAnswers } from "@/lib/types";

const STATUS_LABEL: Record<FrageStatus, string> = {
  bestätigt: "Bestätigt",
  geplant: "Geplant",
  unbekannt: "Unbekannt",
  "nicht zutreffend": "Nicht zutreffend",
};

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
                onChange(on ? value.filter((item) => item !== option) : [...value, option]);
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

function StatusPicker({
  id,
  answers,
  onChange,
}: {
  id: FrageId;
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
}) {
  const status = answers.fragen?.[id]?.status;
  return (
    <div className="field">
      <label>Status {id}</label>
      <div className="chips" role="group" aria-label={`Status ${id}`}>
        {FRAGE_STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            className={status === item ? "chip on" : "chip"}
            onClick={() => onChange(setFrageStatus(answers, id, item))}
          >
            {STATUS_LABEL[item]}
          </button>
        ))}
      </div>
      {status === "nicht zutreffend" && (
        <input
          aria-label={`Grund ${id}`}
          placeholder="Kurz der Grund, warum das entfällt"
          value={answers.fragen?.[id]?.text ?? ""}
          onChange={(event) => onChange(setFrageReason(answers, id, event.target.value))}
        />
      )}
      {status === "geplant" && (
        <p className="hint">Geplant ist kein Ist-Prozess und erscheint nicht als gelebter Ablauf.</p>
      )}
    </div>
  );
}

function show(id: FrageId, answers: IntakeAnswers): boolean {
  return frageApplies(id, answers);
}

export function IntakeQuestionnaire({
  step,
  answers,
  onChange,
}: {
  step: number;
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
}) {
  const meta = INTAKE_STEPS[step];
  if (!meta) return null;
  const patch = (partial: Partial<IntakeAnswers>) => onChange({ ...answers, ...partial });

  return (
    <section>
      <p className="step-label">{meta.stepLabel}</p>
      <h1>{meta.title}</h1>
      <div className="card">
        {step === 0 && (
          <>
            <p className="hint">A01 — Rechtsträger, Größe und Geschäftsführung.</p>
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
              <label htmlFor="rechtsform">Rechtsform</label>
              <select
                id="rechtsform"
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
              <label htmlFor="ma">Mitarbeitende (ca.)</label>
              <select
                id="ma"
                value={answers.mitarbeitende}
                onChange={(event) => patch({ mitarbeitende: event.target.value })}
              >
                <option value="">Bitte wählen</option>
                {INTAKE_MITARBEITENDE.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="gf">Geschäftsführung / Inhaber</label>
              <input
                id="gf"
                placeholder="Name"
                value={answers.gf}
                onChange={(event) => patch({ gf: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="standort">Standort</label>
              <input
                id="standort"
                placeholder="Ort, falls bekannt"
                value={answers.standort ?? ""}
                onChange={(event) => patch({ standort: event.target.value })}
              />
            </div>
            <StatusPicker id="A01" answers={answers} onChange={onChange} />

            <p className="hint">A02 — Welche Belegarten und Gesellschaften umfasst diese Fassung?</p>
            <div className="field">
              <label htmlFor="geltung">Geltungsbereich</label>
              <textarea
                id="geltung"
                placeholder="z. B. nur diese GmbH, Eingangs- und Ausgangsrechnungen"
                value={answers.geltung ?? ""}
                onChange={(event) => patch({ geltung: event.target.value })}
              />
            </div>
            <StatusPicker id="A02" answers={answers} onChange={onChange} />

            <p className="hint">A03 — Kasse, Shop, Lager, Lohn oder weitere Vorsysteme?</p>
            <div className="field">
              <label>Vorsysteme</label>
              <Chips
                options={INTAKE_VORSYSTEME}
                value={(answers.vorsysteme ?? "").split(", ").filter(Boolean)}
                onChange={(items) => patch({ vorsysteme: items.join(", ") })}
                multi
              />
            </div>
            <StatusPicker id="A03" answers={answers} onChange={onChange} />

            <p className="hint">A04 — Seit wann läuft der beschriebene Ablauf tatsächlich so? Kein Rückdatieren.</p>
            <div className="field">
              <label htmlFor="seit-wann">Seit wann</label>
              <input
                id="seit-wann"
                placeholder="z. B. 01.03.2024 oder unbekannt"
                value={answers.seitWann ?? ""}
                onChange={(event) => patch({ seitWann: event.target.value })}
              />
            </div>
            <StatusPicker id="A04" answers={answers} onChange={onChange} />
          </>
        )}

        {step === 1 && (
          <>
            <p className="hint">B01 — Welche Systeme erzeugen, empfangen, buchen oder archivieren Belege?</p>
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
              <label htmlFor="weitere">Weitere Systeme</label>
              <textarea
                id="weitere"
                value={answers.weitereSysteme}
                onChange={(event) => patch({ weitereSysteme: event.target.value })}
              />
            </div>
            <StatusPicker id="B01" answers={answers} onChange={onChange} />

            <p className="hint">B04 — Welche Dateien und Metadaten bleiben das Original?</p>
            <div className="field">
              <label htmlFor="original">Original</label>
              <textarea
                id="original"
                placeholder="z. B. empfangene PDF-Datei, nicht die Vorschau"
                value={answers.originalErhalt ?? ""}
                onChange={(event) => patch({ originalErhalt: event.target.value })}
              />
            </div>
            <StatusPicker id="B04" answers={answers} onChange={onChange} />

            <div className="field">
              <label htmlFor="hosting">Wo liegen die Daten?</label>
              <select
                id="hosting"
                value={answers.hosting}
                onChange={(event) => patch({ hosting: event.target.value })}
              >
                <option value="">Bitte wählen</option>
                {INTAKE_HOSTING.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            {show("B05", answers) ? (
              <>
                <p className="hint">B05 — Welche Anbieterunterlagen liegen für externe Systeme vor?</p>
                <div className="field">
                  <label htmlFor="anbieter">Anbieterunterlagen</label>
                  <textarea
                    id="anbieter"
                    placeholder="Vertrag, Export, AVV — oder noch nicht vorhanden"
                    value={answers.anbieterUnterlagen ?? ""}
                    onChange={(event) => patch({ anbieterUnterlagen: event.target.value })}
                  />
                </div>
                <StatusPicker id="B05" answers={answers} onChange={onChange} />
              </>
            ) : (
              <p className="hint">
                B05 erscheint, wenn das Hosting nicht nur lokal ist.
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <p className="hint">C01 — Welche Eingangswege gibt es tatsächlich?</p>
            <Chips
              options={INTAKE_EINGANG}
              value={answers.eingangsbelege}
              onChange={(eingangsbelege) => patch({ eingangsbelege })}
              multi
            />
            <StatusPicker id="C01" answers={answers} onChange={onChange} />
            {show("C02", answers) && (
              <>
                <p className="hint">C02 — Welches Postfach oder Portal wird von wem in welchem Turnus gesichtet?</p>
                <div className="field">
                  <label htmlFor="sichtung">Sichtung</label>
                  <textarea
                    id="sichtung"
                    value={answers.sichtung ?? ""}
                    onChange={(event) => patch({ sichtung: event.target.value })}
                  />
                </div>
                <StatusPicker id="C02" answers={answers} onChange={onChange} />
              </>
            )}
            <p className="hint">E01 — Formate. Eine PDF per E-Mail ist keine strukturierte E-Rechnung.</p>
            <Chips
              options={INTAKE_FORMATE}
              value={answers.formate ?? []}
              onChange={(formate) => patch({ formate })}
              multi
            />
            <StatusPicker id="E01" answers={answers} onChange={onChange} />
          </>
        )}

        {step === 3 && (
          <>
            {show("C03", answers) ? (
              <>
                <p className="hint">C03 — Wer nimmt Papier entgegen und wohin gelangt es?</p>
                <textarea
                  value={answers.papierannahme ?? ""}
                  onChange={(event) => patch({ papierannahme: event.target.value })}
                />
                <StatusPicker id="C03" answers={answers} onChange={onChange} />
                <p className="hint">D01 — Scan: nein, nur Bearbeitungskopie, oder ersetzend?</p>
                <Chips
                  options={INTAKE_SCAN_ZWECK}
                  value={answers.scanZweck ? [answers.scanZweck] : []}
                  onChange={(items) => patch({ scanZweck: items[0] ?? "" })}
                />
                <StatusPicker id="D01" answers={answers} onChange={onChange} />
                {show("D03", answers) && (
                  <>
                    <p className="hint">D03 — Original nach dem Scan vernichten oder zusätzlich aufbewahren?</p>
                    <textarea
                      value={answers.scanAufbewahrung ?? ""}
                      onChange={(event) => patch({ scanAufbewahrung: event.target.value })}
                    />
                    <StatusPicker id="D03" answers={answers} onChange={onChange} />
                  </>
                )}
                <p className="hint">D04 — Wo liegen Papieroriginale, wie geordnet, wer hat Zugriff?</p>
                <textarea
                  value={answers.papierlager ?? ""}
                  onChange={(event) => patch({ papierlager: event.target.value })}
                />
                <StatusPicker id="D04" answers={answers} onChange={onChange} />
              </>
            ) : (
              <p className="prose">
                Kein Papier- oder Scanweg gewählt. Kapitel 6 entfällt. Postfach enthält das Wort Post nicht als Papierweg.
              </p>
            )}
          </>
        )}

        {step === 4 && (
          <>
            {show("E02", answers) ? (
              <>
                <p className="hint">
                  E02 — Wie wird der strukturierte Teil empfangen, geprüft und im Original gespeichert?
                </p>
                <textarea
                  value={answers.erechnungVerfahren ?? ""}
                  onChange={(event) => patch({ erechnungVerfahren: event.target.value })}
                />
                <StatusPicker id="E02" answers={answers} onChange={onChange} />
              </>
            ) : (
              <p className="prose">
                Keine strukturierte E-Rechnung gewählt. Dieser Zweig entfällt. PDF bleibt ein eigenes Format.
              </p>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <p className="hint">E05 — Ausgangsrechnungen: System.</p>
            <Chips
              options={INTAKE_AUSGANG}
              value={answers.ausgangsrechnungen}
              onChange={(ausgangsrechnungen) => patch({ ausgangsrechnungen })}
              multi
            />
            <StatusPicker id="E05" answers={answers} onChange={onChange} />
            <p className="hint">E03 — Wer prüft den Leistungsbezug vor der Freigabe?</p>
            <input
              value={answers.sachlichePruefung ?? ""}
              placeholder="Name oder Rolle"
              onChange={(event) => patch({ sachlichePruefung: event.target.value })}
            />
            <StatusPicker id="E03" answers={answers} onChange={onChange} />
            <p className="hint">F01 — Wer gibt frei und wer übergibt zur Buchung?</p>
            <div className="field">
              <label htmlFor="buchhaltung">Buchhaltung / Belegverantwortung</label>
              <input
                id="buchhaltung"
                value={answers.buchhaltung}
                onChange={(event) => patch({ buchhaltung: event.target.value })}
              />
            </div>
            <StatusPicker id="F01" answers={answers} onChange={onChange} />
            <p className="hint">F02 — Welche Beleg-ID verbindet Original und Buchung?</p>
            <input
              value={answers.belegId ?? ""}
              onChange={(event) => patch({ belegId: event.target.value })}
            />
            <StatusPicker id="F02" answers={answers} onChange={onChange} />
            <p className="hint">F05 — Was übernimmt die Kanzlei tatsächlich? Ohne Bestätigung keine Buchungsrolle.</p>
            <input
              value={answers.steuerberater}
              placeholder="Name und Umfang, oder leer"
              onChange={(event) => patch({ steuerberater: event.target.value })}
            />
            <StatusPicker id="F05" answers={answers} onChange={onChange} />
          </>
        )}

        {step === 6 && (
          <>
            <p className="hint">G01 — Ablageort.</p>
            <input
              value={answers.archiv}
              onChange={(event) => patch({ archiv: event.target.value })}
            />
            <StatusPicker id="G01" answers={answers} onChange={onChange} />
            <p className="hint">G02 — Wer darf lesen, ändern, freigeben?</p>
            <textarea
              value={answers.zugriff}
              onChange={(event) => patch({ zugriff: event.target.value })}
            />
            <StatusPicker id="G02" answers={answers} onChange={onChange} />
            <p className="hint">
              G05 — Wer ordnet Fristen zu und gibt eine Löschung frei? Die gesetzliche Einordnung der Fristen bleibt der Fachtext, nicht diese Antwort.
            </p>
            <textarea
              value={answers.loeschfreigabe ?? ""}
              onChange={(event) => patch({ loeschfreigabe: event.target.value })}
            />
            <StatusPicker id="G05" answers={answers} onChange={onChange} />
            <p className="hint">G06 — Welche Sicherung ist tatsächlich eingerichtet?</p>
            <Chips
              options={INTAKE_BACKUP}
              value={answers.backup}
              onChange={(backup) => patch({ backup })}
              multi
            />
            <StatusPicker id="G06" answers={answers} onChange={onChange} />
            <p className="hint">H04 — Wann wurde Wiederherstellung oder Export zuletzt geprüft?</p>
            <input
              value={answers.wiederherstellungstest ?? ""}
              placeholder="Datum und Ergebnis, oder leer wenn keiner"
              onChange={(event) => patch({ wiederherstellungstest: event.target.value })}
            />
            <StatusPicker id="H04" answers={answers} onChange={onChange} />
          </>
        )}

        {step === 7 && (
          <>
            <p className="hint">H01 — Welche Kontrollen laufen tatsächlich, von wem, wie oft? Ohne Bestätigung kein Ist-Satz.</p>
            <textarea
              value={answers.kontrollen ?? ""}
              onChange={(event) => patch({ kontrollen: event.target.value })}
            />
            <StatusPicker id="H01" answers={answers} onChange={onChange} />
            <p className="hint">I01 — Wer pflegt die Dokumentation?</p>
            <textarea
              value={answers.dokumentenpflege ?? ""}
              onChange={(event) => patch({ dokumentenpflege: event.target.value })}
            />
            <StatusPicker id="I01" answers={answers} onChange={onChange} />
            <p className="hint">I02 — Welche Anlagen gibt es wirklich?</p>
            <textarea
              value={answers.anlagenliste ?? ""}
              onChange={(event) => patch({ anlagenliste: event.target.value })}
            />
            <StatusPicker id="I02" answers={answers} onChange={onChange} />
            <p className="hint">I05 — Zeitraum dieser Fassung und Ablage älterer Fassungen. Das setzt kein Gültig-ab rückwirkend.</p>
            <textarea
              value={answers.fassungsrahmen ?? ""}
              onChange={(event) => patch({ fassungsrahmen: event.target.value })}
            />
            <StatusPicker id="I05" answers={answers} onChange={onChange} />
            <p className="prose">
              I04 — Die Erzeugung ist keine betriebliche Bestätigung. Name und Datum der Geschäftsführung bleiben ein Platzhalter auf dem Deckblatt.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
