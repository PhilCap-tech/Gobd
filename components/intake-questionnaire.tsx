"use client";

import {
  FRAGE_STATUSES,
  VORSYSTEM_ARTEN,
  frageApplies,
  setFrageMeta,
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
} from "@/lib/intake-questions";
import type { IntakeAnswers, TriState } from "@/lib/types";

const META_IDS = new Set<FrageId>(["A04", "C02", "E03", "F01", "F05", "G05", "H01"]);

const TRI: TriState[] = ["ja", "nein", "unbekannt"];

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
      {META_IDS.has(id) && (
        <div className="field">
          <label htmlFor={`${id}-wer`}>Verantwortung (wenn bekannt)</label>
          <input
            id={`${id}-wer`}
            value={answers.fragen?.[id]?.verantwortung ?? ""}
            onChange={(event) =>
              onChange(setFrageMeta(answers, id, { verantwortung: event.target.value }))
            }
          />
          <label htmlFor={`${id}-bis`}>Datum (wenn bekannt)</label>
          <input
            id={`${id}-bis`}
            type="date"
            value={answers.fragen?.[id]?.datum ?? ""}
            onChange={(event) => onChange(setFrageMeta(answers, id, { datum: event.target.value }))}
          />
        </div>
      )}
    </div>
  );
}

function TriChips({
  value,
  onChange,
  label,
}: {
  value: TriState | "" | undefined;
  onChange: (next: TriState) => void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {TRI.map((item) => (
        <button
          key={item}
          type="button"
          className={value === item ? "chip on" : "chip"}
          onClick={() => onChange(item)}
        >
          {item === "ja" ? "Ja" : item === "nein" ? "Nein" : "Unbekannt"}
        </button>
      ))}
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

            <p className="hint">A02 — Welche Belegarten umfasst diese Fassung, und was ist ausgeschlossen?</p>
            <div className="field">
              <label htmlFor="belegarten">Belegarten</label>
              <textarea
                id="belegarten"
                placeholder="z. B. Eingangsrechnungen, Ausgangsrechnungen"
                value={answers.geltungBelegarten ?? ""}
                onChange={(event) => patch({ geltungBelegarten: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ausschluss">Ausschlüsse</label>
              <textarea
                id="ausschluss"
                placeholder="z. B. Kasse, Lohn — oder keine"
                value={answers.geltungAusschluss ?? ""}
                onChange={(event) => patch({ geltungAusschluss: event.target.value })}
              />
            </div>
            <StatusPicker id="A02" answers={answers} onChange={onChange} />

            <p className="hint">A03 — Vorsysteme: je Art Ja, Nein oder unbekannt.</p>
            {VORSYSTEM_ARTEN.map((art) => (
              <div className="field" key={art}>
                <label>{art}</label>
                <TriChips
                  label={art}
                  value={answers.vorsystemAntwort?.[art]}
                  onChange={(value) =>
                    patch({
                      vorsystemAntwort: { ...answers.vorsystemAntwort, [art]: value },
                    })
                  }
                />
              </div>
            ))}
            <StatusPicker id="A03" answers={answers} onChange={onChange} />

            <p className="hint">A04 — Wirksamkeitsdatum des beschriebenen Ablaufs. Kein Rückdatieren der Fassung.</p>
            <div className="field">
              <label htmlFor="seit-wann">Wirksamkeitsdatum</label>
              <input
                id="seit-wann"
                type="date"
                value={answers.seitWann ?? ""}
                onChange={(event) => patch({ seitWann: event.target.value })}
              />
            </div>
            <StatusPicker id="A04" answers={answers} onChange={onChange} />
          </>
        )}

        {step === 1 && (
          <>
            <p className="hint">B01 — Systeme, wiederholbar. FiBu ist nur eine Zeile, nicht die ganze Liste.</p>
            <div className="field">
              <label>Bekannte FiBu, falls zutreffend</label>
              <Chips
                options={INTAKE_FIBU}
                value={answers.fibu}
                onChange={(fibu) => patch({ fibu })}
                multi
              />
            </div>
            {(answers.systeme?.length ? answers.systeme : [{ name: "", funktion: "" }]).map((row, index) => (
              <div className="field" key={`system-${index}`}>
                <label htmlFor={`system-name-${index}`}>System {index + 1}</label>
                <input
                  id={`system-name-${index}`}
                  placeholder="Name"
                  value={row.name}
                  onChange={(event) => {
                    const systeme = [...(answers.systeme?.length ? answers.systeme : [{ name: "", funktion: "" }])];
                    systeme[index] = { ...systeme[index], name: event.target.value };
                    patch({ systeme });
                  }}
                />
                <input
                  aria-label={`Funktion System ${index + 1}`}
                  placeholder="Funktion, z. B. erzeugt Belege"
                  value={row.funktion}
                  onChange={(event) => {
                    const systeme = [...(answers.systeme?.length ? answers.systeme : [{ name: "", funktion: "" }])];
                    systeme[index] = { ...systeme[index], funktion: event.target.value };
                    patch({ systeme });
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                patch({
                  systeme: [...(answers.systeme ?? []), { name: "", funktion: "" }],
                })
              }
            >
              Weiteres System
            </button>
            <StatusPicker id="B01" answers={answers} onChange={onChange} />

            <p className="hint">B04 — Welches Original bleibt je Eingangsweg erhalten?</p>
            {(answers.eingangsbelege.length ? answers.eingangsbelege : ["Weg"]).map((weg) => {
              const current = (answers.originalJeWeg ?? []).find((row) => row.weg === weg);
              return (
                <div className="field" key={weg}>
                  <label htmlFor={`original-${weg}`}>{weg}</label>
                  <input
                    id={`original-${weg}`}
                    placeholder="Was ist hier das Original?"
                    value={current?.original ?? ""}
                    onChange={(event) => {
                      const others = (answers.originalJeWeg ?? []).filter((row) => row.weg !== weg);
                      patch({ originalJeWeg: [...others, { weg, original: event.target.value }] });
                    }}
                  />
                </div>
              );
            })}
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
                <p className="hint">C02 — Postfach oder Portal, wer sichtet, welcher Turnus?</p>
                <div className="field">
                  <label htmlFor="postfach">Postfach / Portal</label>
                  <input
                    id="postfach"
                    value={answers.postfach ?? ""}
                    onChange={(event) => patch({ postfach: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="sichtung-wer">Wer</label>
                  <input
                    id="sichtung-wer"
                    value={answers.sichtungWer ?? ""}
                    onChange={(event) => patch({ sichtungWer: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="sichtung-turnus">Turnus</label>
                  <input
                    id="sichtung-turnus"
                    placeholder="z. B. arbeitstäglich"
                    value={answers.sichtungTurnus ?? ""}
                    onChange={(event) => patch({ sichtungTurnus: event.target.value })}
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
                <p className="hint">E02 — Technische Validierung: ja, nein oder unbekannt. PDF ist keine E-Rechnung.</p>
                <TriChips
                  label="Validierung"
                  value={answers.validierung}
                  onChange={(validierung) => patch({ validierung })}
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
            <p className="hint">E03 — Prüfkriterien und Rolle, getrennt.</p>
            <div className="field">
              <label htmlFor="kriterien">Kriterien</label>
              <textarea
                id="kriterien"
                value={answers.pruefkriterien ?? ""}
                onChange={(event) => patch({ pruefkriterien: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="pruefrolle">Rolle</label>
              <input
                id="pruefrolle"
                value={answers.pruefrolle ?? ""}
                onChange={(event) => patch({ pruefrolle: event.target.value })}
              />
            </div>
            <StatusPicker id="E03" answers={answers} onChange={onChange} />
            <p className="hint">F01 — Prüfen, freigeben und buchen sind drei Rollen.</p>
            <div className="field">
              <label htmlFor="rolle-pruefen">Prüfen</label>
              <input
                id="rolle-pruefen"
                value={answers.rollePruefen ?? ""}
                onChange={(event) => patch({ rollePruefen: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="rolle-frei">Freigeben</label>
              <input
                id="rolle-frei"
                value={answers.rolleFreigeben ?? ""}
                onChange={(event) => patch({ rolleFreigeben: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="rolle-buchen">Buchen</label>
              <input
                id="rolle-buchen"
                value={answers.rolleBuchen ?? ""}
                onChange={(event) =>
                  patch({ rolleBuchen: event.target.value, buchhaltung: event.target.value })
                }
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
            <p className="hint">G06 — Welche Sicherung ist eingerichtet, und wurde sie getestet?</p>
            <Chips
              options={INTAKE_BACKUP}
              value={answers.backup}
              onChange={(backup) => patch({ backup })}
              multi
            />
            <div className="field">
              <label>Wiederherstellung getestet</label>
              <TriChips
                label="Backup getestet"
                value={answers.backupGetestet}
                onChange={(backupGetestet) => patch({ backupGetestet })}
              />
            </div>
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
            <p className="hint">
              H01 — Kontrollen, wiederholbar: was, Turnus, wer, Nachweis. Ohne Zeile bleibt das IKS leer und ein offener Punkt.
            </p>
            {(answers.kontrollenListe?.length
              ? answers.kontrollenListe
              : [{ was: "", turnus: "", wer: "", nachweis: "" }]
            ).map((row, index) => (
              <div className="field" key={`kontrolle-${index}`}>
                <label htmlFor={`k-was-${index}`}>Kontrolle {index + 1}</label>
                <input
                  id={`k-was-${index}`}
                  placeholder="Was"
                  value={row.was}
                  onChange={(event) => {
                    const kontrollenListe = [
                      ...(answers.kontrollenListe?.length
                        ? answers.kontrollenListe
                        : [{ was: "", turnus: "", wer: "", nachweis: "" }]),
                    ];
                    kontrollenListe[index] = { ...kontrollenListe[index], was: event.target.value };
                    patch({ kontrollenListe });
                  }}
                />
                <input
                  aria-label={`Turnus Kontrolle ${index + 1}`}
                  placeholder="Turnus"
                  value={row.turnus}
                  onChange={(event) => {
                    const kontrollenListe = [
                      ...(answers.kontrollenListe?.length
                        ? answers.kontrollenListe
                        : [{ was: "", turnus: "", wer: "", nachweis: "" }]),
                    ];
                    kontrollenListe[index] = { ...kontrollenListe[index], turnus: event.target.value };
                    patch({ kontrollenListe });
                  }}
                />
                <input
                  aria-label={`Wer Kontrolle ${index + 1}`}
                  placeholder="Wer"
                  value={row.wer}
                  onChange={(event) => {
                    const kontrollenListe = [
                      ...(answers.kontrollenListe?.length
                        ? answers.kontrollenListe
                        : [{ was: "", turnus: "", wer: "", nachweis: "" }]),
                    ];
                    kontrollenListe[index] = { ...kontrollenListe[index], wer: event.target.value };
                    patch({ kontrollenListe });
                  }}
                />
                <input
                  aria-label={`Nachweis Kontrolle ${index + 1}`}
                  placeholder="Nachweis"
                  value={row.nachweis}
                  onChange={(event) => {
                    const kontrollenListe = [
                      ...(answers.kontrollenListe?.length
                        ? answers.kontrollenListe
                        : [{ was: "", turnus: "", wer: "", nachweis: "" }]),
                    ];
                    kontrollenListe[index] = { ...kontrollenListe[index], nachweis: event.target.value };
                    patch({ kontrollenListe });
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                patch({
                  kontrollenListe: [
                    ...(answers.kontrollenListe ?? []),
                    { was: "", turnus: "", wer: "", nachweis: "" },
                  ],
                })
              }
            >
              Weitere Kontrolle
            </button>
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
            <p className="hint">
              I04 — Betriebliche Bestätigung: Name und Datum. Die Generierung setzt den Freigabestatus nicht auf bestätigt.
            </p>
            <div className="field">
              <label htmlFor="i04-name">Name</label>
              <input
                id="i04-name"
                value={answers.bestaetigungName ?? ""}
                onChange={(event) => patch({ bestaetigungName: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="i04-datum">Datum</label>
              <input
                id="i04-datum"
                type="date"
                value={answers.bestaetigungDatum ?? ""}
                onChange={(event) => patch({ bestaetigungDatum: event.target.value })}
              />
            </div>
            <StatusPicker id="I04" answers={answers} onChange={onChange} />
          </>
        )}
      </div>
    </section>
  );
}
