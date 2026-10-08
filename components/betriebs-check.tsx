"use client";

import { useEffect } from "react";
import { prefillKnownFacts, type CatalogIssue } from "@/lib/intake-catalog";
import {
  applySoftwarePreset,
  BRANCHEN_VORLAGEN,
  CHECK_FRAGEN,
  modulFortschritt,
  setCheckAntwort,
  setStammdaten,
  setVorlage,
  SOFTWARE_PRESETS,
  STATUS_HILFE,
  STATUS_OPTION_LABEL,
  vollstaendigkeitsZeilen,
} from "@/lib/module/status";
import { MODUL_STATUSES, type CheckAntwort } from "@/lib/module/typen";
import type { IntakeAnswers } from "@/lib/types";

const ANTWORTEN: Array<{ value: CheckAntwort; label: string }> = [
  { value: "ja", label: "Ja" },
  { value: "nein", label: "Nein" },
  { value: "unbekannt", label: "Weiß ich nicht" },
];

/** Shared Stammdaten block on the Betriebs-Check. Role fields want person names. */
const STAMMDATEN_FELDER = [
  { key: "gf", label: "Geschäftsführung", placeholder: "Name" },
  { key: "buchhaltung", label: "Buchhaltung", placeholder: "Name" },
  { key: "it", label: "IT", placeholder: "Name" },
  { key: "kanzlei", label: "Steuerkanzlei", placeholder: "Name" },
  { key: "fibu", label: "FiBu-System", placeholder: "Systemname" },
  { key: "archiv", label: "Archiv / Ablage", placeholder: "Ablageort" },
] as const;

export function BetriebsCheckStep({
  answers,
  onChange,
  issues = [],
}: {
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
  issues?: CatalogIssue[];
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
        {CHECK_FRAGEN.map((frage) => {
          const gap = issues.find((issue) => issue.fieldKey === frage.key && issue.anchor === `check-${frage.key}`);
          return (
          <div className={gap ? "field field-invalid" : "field"} id={`check-${frage.key}`} key={frage.key} tabIndex={gap ? -1 : undefined}>
            <label>{frage.label}</label>
            {gap ? (
              <p className="field-error" role="alert">
                {gap.message}
              </p>
            ) : null}
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
          );
        })}
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
              onClick={() => onChange(prefillKnownFacts(applySoftwarePreset(answers, preset.id)))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Namen der Verantwortlichen — einmal erfassen, überall nutzen</h2>
        <p className="hint">
          Trage hier die Namen (und Systeme) ein. Wir belegen passende Felder in den Modulen vor.
        </p>
        {STAMMDATEN_FELDER.map((field) => (
          <div className="field" key={field.key}>
            <label htmlFor={`stamm-${field.key}`}>{field.label}</label>
            <input
              id={`stamm-${field.key}`}
              value={stammdaten[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) => {
                const next = prefillKnownFacts(setStammdaten(answers, { [field.key]: event.target.value }));
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
  sessionId = "",
  documentId = "",
  focusModulId = "",
  issues = [],
}: {
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
  sessionId?: string;
  documentId?: string;
  /** Modulzeile, die aus dem Konto („Jetzt ausfüllen“) angesprungen wird. */
  focusModulId?: string;
  issues?: CatalogIssue[];
}) {
  const rows = vollstaendigkeitsZeilen(answers);
  useEffect(() => {
    if (!focusModulId) return;
    document.getElementById(`modul-${focusModulId}`)?.scrollIntoView({ block: "center" });
  }, [focusModulId]);
  return (
    <section id="modul-uebersicht">
      <p className="step-label">Module</p>
      <h1>Module und Dokumentationsstatus</h1>
      <p className="prose">
        So wird dein Gesamtdokument aufgebaut. Ein vorhandener Bereich darf nicht stillschweigend
        fehlen: „{STATUS_OPTION_LABEL.tool}“, bestehende Dokumentation verlinken oder den Status „{STATUS_OPTION_LABEL.offen}“ setzen. „Nicht vorhanden“ nur, wenn es den Ablauf bei dir nicht gibt — mit kurzer Begründung.
      </p>
      <details className="status-hilfe" open>
        <summary>Was die Status bedeuten</summary>
        <ul>
          {MODUL_STATUSES.map((status) => (
            <li key={status}>
              <strong>{STATUS_OPTION_LABEL[status]}:</strong> {STATUS_HILFE[status]}
            </li>
          ))}
        </ul>
      </details>
      <div className="card">
        <div className="intake-table-wrap">
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
              const gap = issues.find((issue) => issue.anchor === `modul-${row.modul}`);
              return (
                <tr
                  key={row.modul}
                  id={`modul-${row.modul}`}
                  className={[focusModulId === row.modul ? "modul-focus" : "", gap ? "row-invalid" : ""]
                    .filter(Boolean)
                    .join(" ") || undefined}
                >
                  <td>
                    {row.nr}. {row.titel}
                    {gap ? (
                      <p className="field-error" role="alert">
                        {gap.message}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <select
                      id={`modul-${row.modul}-status`}
                      aria-invalid={Boolean(gap) || undefined}
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
                      {MODUL_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_OPTION_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {(current?.status ?? row.status) === "extern" ? (
                      <div style={{ display: "grid", gap: 6 }}>
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
                                uploadUrl: current?.uploadUrl,
                                uploadName: current?.uploadName,
                                uploadAt: current?.uploadAt,
                                uploadSize: current?.uploadSize,
                                uploadType: current?.uploadType,
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
                        <input
                          placeholder="URL (optional)"
                          value={current?.link ?? ""}
                          onChange={(event) => {
                            const nextStatus = {
                              ...(answers.module?.status ?? {}),
                              [row.modul]: {
                                status: "extern" as const,
                                ref: current?.ref ?? "",
                                link: event.target.value,
                                uploadUrl: current?.uploadUrl,
                                uploadName: current?.uploadName,
                                uploadAt: current?.uploadAt,
                                uploadSize: current?.uploadSize,
                                uploadType: current?.uploadType,
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
                        <label className="hint" style={{ display: "grid", gap: 4 }}>
                          Datei (PDF, DOCX, JPEG/PNG/WebP, max. 12 MB)
                          <input
                            type="file"
                            accept=".pdf,.docx,image/jpeg,image/png,image/webp"
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              const body = new FormData();
                              body.set("file", file);
                              body.set("modulId", row.modul);
                              if (sessionId) body.set("sessionId", sessionId);
                              if (documentId) body.set("documentId", documentId);
                              try {
                                const response = await fetch("/api/module-upload", {
                                  method: "POST",
                                  body,
                                });
                                const data = (await response.json()) as {
                                  error?: string;
                                  uploadUrl?: string;
                                  uploadName?: string;
                                  uploadAt?: string;
                                  uploadSize?: number;
                                  uploadType?: string;
                                };
                                if (!response.ok) {
                                  window.alert(data.error || "Upload fehlgeschlagen.");
                                  return;
                                }
                                const nextStatus = {
                                  ...(answers.module?.status ?? {}),
                                  [row.modul]: {
                                    status: "extern" as const,
                                    ref: current?.ref || data.uploadName || file.name,
                                    link: current?.link ?? "",
                                    uploadUrl: data.uploadUrl,
                                    uploadName: data.uploadName,
                                    uploadAt: data.uploadAt,
                                    uploadSize: data.uploadSize,
                                    uploadType: data.uploadType,
                                  },
                                };
                                onChange({
                                  ...answers,
                                  module: {
                                    ...(answers.module ?? { version: 1, check: {}, status: {} }),
                                    status: nextStatus,
                                  },
                                });
                              } catch {
                                window.alert("Netzwerkfehler beim Upload.");
                              } finally {
                                event.target.value = "";
                              }
                            }}
                          />
                        </label>
                        {current?.uploadName ? (
                          <p className="hint" style={{ margin: 0 }}>
                            Hochgeladen: {current.uploadName}
                            {current.uploadAt
                              ? ` · ${new Date(current.uploadAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`
                              : ""}
                            {current.uploadUrl ? (
                              <>
                                {" "}
                                ·{" "}
                                <a href={current.uploadUrl} target="_blank" rel="noreferrer">
                                  öffnen
                                </a>
                              </>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
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
                      ? STATUS_OPTION_LABEL[current?.status ?? row.status]
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
      </div>
    </section>
  );
}
