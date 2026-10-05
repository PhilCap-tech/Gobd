"use client";

import {
  applySoftwarePreset,
  applyStammdatenPrefill,
  BRANCHEN_VORLAGEN,
  CHECK_FRAGEN,
  modulFortschritt,
  setCheckAntwort,
  setStammdaten,
  setVorlage,
  SOFTWARE_PRESETS,
  vollstaendigkeitsZeilen,
} from "@/lib/module/status";
import type { CheckAntwort } from "@/lib/module/typen";
import type { IntakeAnswers } from "@/lib/types";

const ANTWORTEN: Array<{ value: CheckAntwort; label: string }> = [
  { value: "ja", label: "Ja" },
  { value: "nein", label: "Nein" },
  { value: "unbekannt", label: "Weiß ich nicht" },
];

export function BetriebsCheckStep({
  answers,
  onChange,
}: {
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
}) {
  const check = answers.module?.check ?? {};
  const stammdaten = answers.module?.stammdaten ?? {};
  const vorlage = answers.module?.vorlage ?? "";
  const software = answers.module?.software ?? [];

  return (
    <section>
      <p className="step-label">Betriebs-Check</p>
      <h1>Welche Bereiche gibt es in deinem Betrieb?</h1>
      <p className="prose">
        Anhand dieser Angaben schaltet das Tool die passenden Module frei. Du kannst Module später im
        Konto ergänzen. Kernmodule (Organisation, Buchführung, Archiv, Systeme, Rechte, Sicherung,
        Kontrollen, Auslagerung, Prüfung, Änderungen, Pflege) sind immer aktiv.
      </p>
      <div className="card">
        <h2>Branchenvorlage (optional)</h2>
        <p className="hint">Vorbelegung der Antworten — bitte prüfen und anpassen.</p>
        <div className="chips">
          {BRANCHEN_VORLAGEN.map((item) => (
            <button
              key={item.id}
              type="button"
              className={vorlage === item.id ? "chip on" : "chip"}
              onClick={() => onChange(setVorlage(answers, item.id))}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Betriebs-Check</h2>
        {CHECK_FRAGEN.map((frage) => (
          <div className="field" key={frage.key}>
            <label>{frage.label}</label>
            <p className="hint">{frage.hilfe}</p>
            <div className="chips">
              {ANTWORTEN.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={check[frage.key] === option.value ? "chip on" : "chip"}
                  onClick={() => onChange(setCheckAntwort(answers, frage.key, option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Software-Vorlagen (optional)</h2>
        <p className="hint">Trägt vorgeschlagene Systemnamen ein — Status setzt du selbst.</p>
        <div className="chips">
          {SOFTWARE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={software.includes(preset.id) ? "chip on" : "chip"}
              onClick={() => onChange(applySoftwarePreset(answers, preset.id))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Einmal erfassen, überall nutzen</h2>
        <p className="hint">Diese Angaben werden in passende Felder der Module vorbelegt.</p>
        {(
          [
            ["gf", "Geschäftsführung"],
            ["buchhaltung", "Buchhaltung"],
            ["it", "IT"],
            ["kanzlei", "Steuerkanzlei"],
            ["fibu", "FiBu-System"],
            ["archiv", "Archiv / Ablage"],
          ] as const
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={`stamm-${key}`}>{label}</label>
            <input
              id={`stamm-${key}`}
              value={stammdaten[key] ?? ""}
              onChange={(event) => {
                let next = setStammdaten(answers, { [key]: event.target.value });
                next = applyStammdatenPrefill(next);
                onChange(next);
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ModulUebersichtStep({
  answers,
  onChange,
}: {
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
}) {
  const rows = vollstaendigkeitsZeilen(answers);
  return (
    <section>
      <p className="step-label">Module</p>
      <h1>Module und Dokumentationsstatus</h1>
      <p className="prose">
        So wird dein Gesamtdokument aufgebaut. Ein vorhandener Bereich darf nicht stillschweigend
        fehlen: im Tool beschreiben, bestehende Dokumentation verlinken oder als offenen Punkt
        führen. „Nicht vorhanden“ nur bei betriebsabhängigen Modulen mit kurzer Begründung.
      </p>
      <div className="card">
        <table className="summary-table">
          <thead>
            <tr>
              <th>Modul</th>
              <th>Status</th>
              <th>Angabe</th>
              <th>Stand</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const current = answers.module?.status?.[row.modul];
              return (
                <tr key={row.modul}>
                  <td>
                    {row.nr}. {row.titel}
                  </td>
                  <td>
                    <select
                      value={current?.status ?? row.status}
                      onChange={(event) => {
                        const status = event.target.value as typeof row.status;
                        const nextStatus = {
                          ...(answers.module?.status ?? {}),
                          [row.modul]: {
                            status,
                            reason: current?.reason ?? "",
                            ref: current?.ref ?? "",
                            link: current?.link ?? "",
                          },
                        };
                        onChange({
                          ...answers,
                          module: { ...(answers.module ?? { version: 1, check: {}, status: {} }), status: nextStatus },
                        });
                      }}
                    >
                      <option value="tool">im Tool beschrieben</option>
                      <option value="extern">bestehende Dokumentation</option>
                      <option value="offen">noch nicht dokumentiert</option>
                      <option value="nicht_vorhanden">nicht vorhanden</option>
                    </select>
                  </td>
                  <td>
                    {(current?.status ?? row.status) === "extern" ? (
                      <input
                        placeholder="Titel / Ablageort der Dokumentation"
                        value={current?.ref ?? ""}
                        onChange={(event) => {
                          const nextStatus = {
                            ...(answers.module?.status ?? {}),
                            [row.modul]: {
                              status: "extern" as const,
                              ref: event.target.value,
                              link: current?.link ?? "",
                            },
                          };
                          onChange({
                            ...answers,
                            module: {
                              ...(answers.module ?? { version: 1, check: {}, status: {} }),
                              status: nextStatus,
                            },
                          });
                        }}
                      />
                    ) : null}
                    {(current?.status ?? row.status) === "nicht_vorhanden" ? (
                      <input
                        placeholder="Kurze Begründung"
                        value={current?.reason ?? ""}
                        onChange={(event) => {
                          const nextStatus = {
                            ...(answers.module?.status ?? {}),
                            [row.modul]: {
                              status: "nicht_vorhanden" as const,
                              reason: event.target.value,
                            },
                          };
                          onChange({
                            ...answers,
                            module: {
                              ...(answers.module ?? { version: 1, check: {}, status: {} }),
                              status: nextStatus,
                            },
                          });
                        }}
                      />
                    ) : null}
                    {(current?.status ?? row.status) === "tool" || (current?.status ?? row.status) === "offen"
                      ? row.label
                      : null}
                  </td>
                  <td>
                    {(() => {
                      if ((current?.status ?? row.status) !== "tool") return "—";
                      const stand = modulFortschritt(answers, row.modul);
                      if (!stand.gesamt) return "—";
                      return `${stand.beantwortet}/${stand.gesamt}${stand.offen ? ` · ${stand.offen} zu klären` : ""}`;
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
