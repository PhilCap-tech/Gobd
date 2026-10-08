"use client";

import { useRef } from "react";
import {
  applyDerivedStatus,
  clearCatalogStatus,
  PROCESS_STATUSES,
  setCatalogMeta,
  setCatalogStatus,
  setCatalogValues,
  statusLabel,
  type CatalogStatus,
} from "@/lib/intake-catalog";
import {
  AENDERUNGSANLAESSE,
  ANBIETER_UNTERLAGEN,
  ANLAGE_STATUS,
  ANLAGEN_CHECKLISTE,
  BELEG_REIN,
  channelPlaceLabel,
  composeCatalogValues,
  DIGITAL_CHANNELS,
  emptyChannelDetail,
  FREIGABE_SCHRITTE,
  HOSTING_OPTIONS,
  KANZLEI_AUFGABEN,
  KONTROLL_TURNUS,
  optionLabel,
  PAPER_CHANNEL,
  PRUEF_KRITERIEN,
  SICHERUNG_OPTIONS,
  statusChoiceVisible,
  TURNUS_OPTIONS,
  TYPISCHE_KONTROLLEN,
  ZUGRIFF_RECHTE,
  ZUGRIFF_ROLLEN,
  type ChannelDetail,
} from "@/lib/intake-present";
import type { IntakeAnswers } from "@/lib/types";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
}

function Chips({
  options,
  value,
  multi,
  onChange,
  labelOf,
}: {
  options: readonly string[];
  value: string[];
  multi?: boolean;
  onChange: (next: string[]) => void;
  labelOf?: (option: string) => string;
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
              if (multi) onChange(on ? value.filter((item) => item !== option) : [...value, option]);
              else onChange([option]);
            }}
          >
            {labelOf ? labelOf(option) : option}
          </button>
        );
      })}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function InfoNote({ label, text: body }: { label: string; text: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <div className="field">
      <button type="button" className="btn linkish" onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog ref={ref} className="info-dialog">
        <p className="prose">{body}</p>
        <button type="button" className="btn ghost" onClick={() => ref.current?.close()}>
          Schließen
        </button>
      </dialog>
    </div>
  );
}

function saveQuestion(
  answers: IntakeAnswers,
  id: string,
  patch: Record<string, unknown>,
  mode?: "derive" | "open",
): IntakeAnswers {
  const current = answers.katalog?.[id]?.values ?? {};
  const merged = composeCatalogValues(id, { ...current, ...patch });
  let next = setCatalogValues(answers, id, merged);
  if (mode === "derive") next = applyDerivedStatus(next, id);
  if (mode === "open") {
    const previous = answers.katalog?.[id]?.status;
    if (previous === "nicht_zutreffend" || previous === "unbekannt") next = clearCatalogStatus(next, id);
  }
  return next;
}

function ChannelFields({
  channel,
  row,
  onChange,
}: {
  channel: string;
  row: ChannelDetail;
  onChange: (next: ChannelDetail) => void;
}) {
  return (
    <div className="system-card">
      <p className="prose">{channel}</p>
      <div className="field">
        <TextField
          label={channelPlaceLabel(channel)}
          value={row.ort}
          onChange={(ort) => onChange({ ...row, ort })}
        />
      </div>
      <div className="field">
        <TextField label="Welche Person?" value={row.wer} onChange={(wer) => onChange({ ...row, wer })} />
      </div>
      <div className="field">
        <span className="hint">Wie oft wird gesichtet?</span>
        <Chips
          options={TURNUS_OPTIONS}
          value={row.turnus ? [row.turnus] : []}
          onChange={(next) => onChange({ ...row, turnus: next[0] ?? "" })}
        />
        {row.turnus === "anders" ? (
          <TextField
            label="Welcher Turnus?"
            value={row.turnusFrei}
            onChange={(turnusFrei) => onChange({ ...row, turnusFrei })}
          />
        ) : null}
      </div>
      <div className="field">
        <TextField
          label="Wohin wird übergeben?"
          value={row.uebergabe}
          onChange={(uebergabe) => onChange({ ...row, uebergabe })}
        />
      </div>
      <div className="field">
        <TextField
          label="Welche Ausnahmen gibt es?"
          value={row.ausnahmen}
          placeholder="Zum Beispiel keine, oder eine Urlaubsvertretung"
          onChange={(ausnahmen) => onChange({ ...row, ausnahmen })}
        />
      </div>
    </div>
  );
}

function StandChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Chips
      options={ANLAGE_STATUS.map((item) => item.value)}
      value={value ? [value] : []}
      labelOf={(option) => ANLAGE_STATUS.find((item) => item.value === option)?.label ?? option}
      onChange={(next) => onChange(next[0] ?? "")}
    />
  );
}

export function P1QuestionFields({
  questionId,
  answers,
  onChange,
}: {
  questionId: string;
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
}) {
  const values = answers.katalog?.[questionId]?.values ?? {};
  const channels = list(answers.katalog?.C01?.values?.kanaele);
  const digital = channels.filter((channel) => (DIGITAL_CHANNELS as readonly string[]).includes(channel));

  function commit(patch: Record<string, unknown>, mode?: "derive" | "open") {
    onChange(saveQuestion(answers, questionId, patch, mode));
  }

  if (questionId === "B01") {
    const systems = rowsOf(values.systeme);
    const cards = systems.length ? systems : [{}];
    return (
      <div>
        {cards.map((row, index) => (
          <div className="system-card" key={`system-${index}`}>
            <p className="prose">System {index + 1}</p>
            <div className="field">
              <TextField
                label="Name"
                value={text(row.name)}
                onChange={(name) => {
                  const copy = cards.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], name };
                  commit({ systeme: copy });
                }}
              />
            </div>
            <div className="field">
              <TextField
                label="Zweck"
                value={text(row.funktion)}
                onChange={(funktion) => {
                  const copy = cards.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], funktion };
                  commit({ systeme: copy });
                }}
              />
            </div>
            <div className="field">
              <span className="hint">Art</span>
              <Chips
                options={["fibu", "postfach", "portal", "archiv", "rechnungssoftware", "sonstiges"]}
                value={text(row.typ) ? [text(row.typ)] : []}
                labelOf={(option) => optionLabel("typ", option)}
                onChange={(next) => {
                  const copy = cards.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], typ: next[0] ?? "" };
                  commit({ systeme: copy });
                }}
              />
            </div>
            <div className="field">
              <TextField
                label="Wer nutzt es?"
                value={text(row.nutzer)}
                onChange={(nutzer) => {
                  const copy = cards.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], nutzer };
                  commit({ systeme: copy });
                }}
              />
            </div>
            <div className="field">
              <span className="hint">Welche Belege gehen hinein?</span>
              <Chips
                options={BELEG_REIN}
                value={list(row.belegeRein)}
                multi
                onChange={(belegeRein) => {
                  const copy = cards.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], belegeRein };
                  commit({ systeme: copy });
                }}
              />
            </div>
            <div className="field">
              <TextField
                label="Wohin wird übergeben?"
                value={text(row.uebergabe)}
                onChange={(uebergabe) => {
                  const copy = cards.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], uebergabe };
                  commit({ systeme: copy });
                }}
              />
            </div>
            <div className="field">
              <TextField
                label="Wo liegt das Original?"
                value={text(row.originalOrt)}
                onChange={(originalOrt) => {
                  const copy = cards.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], originalOrt };
                  commit({ systeme: copy });
                }}
              />
            </div>
            <div className="field">
              <span className="hint">Hosting</span>
              <Chips
                options={HOSTING_OPTIONS}
                value={text(row.hostingArt) ? [text(row.hostingArt)] : []}
                onChange={(next) => {
                  const copy = cards.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], hostingArt: next[0] ?? "" };
                  commit({ systeme: copy });
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn ghost"
          onClick={() => commit({ systeme: [...cards, {}] })}
        >
          Weiteres System
        </button>
        <div className="field">
          <TextField
            label="Weitere Systeme"
            value={text(values.weitereFreitext)}
            placeholder="Weitere Systeme, die Belege berühren"
            onChange={(weitereFreitext) => commit({ weitereFreitext })}
          />
        </div>
        <div className="field">
          <TextField
            label="IT-Verantwortung"
            value={text(values.it)}
            onChange={(it) => commit({ it })}
          />
        </div>
      </div>
    );
  }

  if (questionId === "B04") {
    const stored = rowsOf(values.originalJeWeg);
    const suggested = channels.length
      ? channels.map((channel) => ({ belegweg: channel, originalBeschreibung: "" }))
      : [{ belegweg: "", originalBeschreibung: "" }];
    const originals = (stored.length ? stored : suggested) as Record<string, unknown>[];
    const choices = channels.length ? [...channels, "anderer Weg"] : [];
    return (
      <div>
        <p className="hint">
          Das Original ist die Datei, die über den Eingangsweg angekommen ist. Dieselbe Zuordnung
          steht auf der Systemkarte unter „Wo liegt das Original?“.
        </p>
        {originals.map((row, index) => {
          const weg = text(row.belegweg);
          const other = row.andererWeg === true || (Boolean(weg) && !channels.includes(weg));
          const picked = channels.includes(weg) ? weg : other ? "anderer Weg" : "";
          return (
            <div className="system-card" key={`original-${index}`}>
              <div className="field">
                {choices.length ? (
                  <>
                    <span className="hint">Eingangsweg</span>
                    <Chips
                      options={choices}
                      value={picked ? [picked] : []}
                      onChange={(next) => {
                        const copy = originals.map((item) => ({ ...item }));
                        const choice = next[0] ?? "";
                        copy[index] =
                          choice === "anderer Weg"
                            ? { ...copy[index], andererWeg: true, belegweg: channels.includes(weg) ? "" : weg }
                            : { ...copy[index], andererWeg: false, belegweg: choice };
                        commit({ originalJeWeg: copy });
                      }}
                    />
                  </>
                ) : null}
                {!choices.length || other ? (
                  <TextField
                    label="Eingangsweg"
                    value={channels.includes(weg) ? "" : weg}
                    onChange={(belegweg) => {
                      const copy = originals.map((item) => ({ ...item }));
                      copy[index] = { ...copy[index], andererWeg: true, belegweg };
                      commit({ originalJeWeg: copy });
                    }}
                  />
                ) : null}
              </div>
              <div className="field">
                <TextField
                  label="Was gilt als Original?"
                  value={text(row.originalBeschreibung)}
                  placeholder="Zum Beispiel die empfangene PDF-Datei"
                  onChange={(originalBeschreibung) => {
                    const copy = originals.map((item) => ({ ...item }));
                    copy[index] = { ...copy[index], originalBeschreibung };
                    commit({ originalJeWeg: copy });
                  }}
                />
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="btn ghost"
          onClick={() => commit({ originalJeWeg: [...originals, { belegweg: "", originalBeschreibung: "" }] })}
        >
          Weiterer Eingangsweg
        </button>
      </div>
    );
  }

  if (questionId === "B05") {
    const gate = text(values.anbieter);
    const systems = rowsOf(values.externeSysteme);
    const cards = systems.length ? systems : [{}];
    return (
      <div>
        <div className="field">
          <span className="hint">Liegen Systeme bei einem Anbieter?</span>
          <Chips
            options={["ja", "nein", "unbekannt"]}
            value={gate ? [gate] : []}
            labelOf={(option) => (option === "unbekannt" ? "weiß ich nicht" : optionLabel("anbieter", option))}
            onChange={(next) => commit({ anbieter: next[0] ?? "" }, next[0] === "ja" ? "open" : "derive")}
          />
        </div>
        {gate === "nein" ? (
          <p className="hint">Dann entfällt die Liste der Anbieterunterlagen.</p>
        ) : null}
        {gate === "ja"
          ? cards.map((row, index) => {
              const stand = (row.unterlagenStand ?? {}) as Record<string, string>;
              return (
                <div className="system-card" key={`provider-${index}`}>
                  <div className="field">
                    <TextField
                      label="Name des Systems"
                      value={text(row.name)}
                      onChange={(name) => {
                        const copy = cards.map((item) => ({ ...item }));
                        copy[index] = { ...copy[index], name };
                        commit({ externeSysteme: copy });
                      }}
                    />
                  </div>
                  {ANBIETER_UNTERLAGEN.map((name) => (
                    <div className="field" key={name}>
                      <span className="hint">{name}</span>
                      <StandChips
                        value={text(stand[name])}
                        onChange={(next) => {
                          const copy = cards.map((item) => ({ ...item }));
                          copy[index] = {
                            ...copy[index],
                            unterlagenStand: { ...stand, [name]: next },
                          };
                          commit({ externeSysteme: copy });
                        }}
                      />
                    </div>
                  ))}
                </div>
              );
            })
          : null}
        {gate === "ja" ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => commit({ externeSysteme: [...cards, {}] })}
          >
            Weiteres System beim Anbieter
          </button>
        ) : null}
      </div>
    );
  }

  if (questionId === "C02") {
    const detail = (values.kanaeleDetail ?? {}) as Record<string, ChannelDetail>;
    if (!digital.length) {
      return <p className="hint">Zuerst einen digitalen Eingangsweg wählen.</p>;
    }
    return (
      <div>
        {digital.map((channel) => (
          <ChannelFields
            key={channel}
            channel={channel}
            row={{ ...emptyChannelDetail(), ...detail[channel] }}
            onChange={(row) => commit({ kanaeleDetail: { ...detail, [channel]: row } })}
          />
        ))}
      </div>
    );
  }

  if (questionId === "C03") {
    const row = { ...emptyChannelDetail(), ...(values.eingang as ChannelDetail | undefined) };
    return (
      <ChannelFields
        channel={PAPER_CHANNEL}
        row={row}
        onChange={(eingang) => commit({ eingang })}
      />
    );
  }

  if (questionId === "D01") {
    const zweck = text(values.scanZweck);
    return (
      <div>
        <div className="field">
          <span className="hint">Wird gescannt, und wozu?</span>
          <Chips
            options={["nein", "Bearbeitungskopie", "ersetzend"]}
            value={zweck ? [zweck] : []}
            labelOf={(option) => optionLabel("scanZweck", option)}
            onChange={(next) => commit({ scanZweck: next[0] ?? "" })}
          />
        </div>
        <div className="field">
          <TextField
            label="Wo kommt das Papier an, und wo liegt es bis zur weiteren Bearbeitung?"
            value={text(values.eingang)}
            onChange={(eingang) => commit({ eingang })}
          />
        </div>
        {zweck && zweck !== "nein" ? (
          <>
            <div className="field">
              <TextField
                label="Wann wird gescannt?"
                value={text(values.scanZeitpunkt)}
                placeholder="Zum Beispiel am Tag des Eingangs"
                onChange={(scanZeitpunkt) => commit({ scanZeitpunkt })}
              />
            </div>
            <div className="field">
              <TextField
                label="Wie wird die Vollständigkeit geprüft?"
                value={text(values.vollstaendigkeit)}
                placeholder="Zum Beispiel Seitenzahl und Lesbarkeit"
                onChange={(vollstaendigkeit) => commit({ vollstaendigkeit })}
              />
            </div>
          </>
        ) : null}
        {zweck ? (
          <div className="field">
            <TextField
              label={
                zweck === "ersetzend"
                  ? "Wann wird das Papieroriginal vernichtet?"
                  : "Wo bleibt das Papieroriginal?"
              }
              value={text(values.originalVerbleib)}
              onChange={(originalVerbleib) => commit({ originalVerbleib })}
            />
          </div>
        ) : null}
        <div className="field">
          <TextField
            label="Wer ist dafür zuständig?"
            value={text(values.verantwortlich)}
            onChange={(verantwortlich) => commit({ verantwortlich })}
          />
        </div>
      </div>
    );
  }

  if (questionId === "E02") {
    return (
      <div>
        <InfoNote
          label="Was ist das Original?"
          text="Bei einer strukturierten E-Rechnung ist die empfangene Datei im Originalformat das aufzubewahrende Original. Eine lesbare Ansicht ersetzt diese Datei nicht."
        />
        <div className="field">
          <TextField
            label="Wie kommt sie an?"
            value={text(values.empfang)}
            onChange={(empfang) => commit({ empfang })}
          />
        </div>
        <div className="field">
          <TextField
            label="Wie wird sie lesbar gemacht?"
            value={text(values.lesbar)}
            onChange={(lesbar) => commit({ lesbar })}
          />
        </div>
        <div className="field">
          <TextField
            label="Wie wird sie geprüft?"
            value={text(values.pruefung)}
            onChange={(pruefung) => commit({ pruefung })}
          />
        </div>
        <div className="field">
          <span className="hint">Gibt es eine technische Prüfung?</span>
          <Chips
            options={["ja_bestaetigt", "nein", "unbekannt"]}
            value={text(values.validierung) ? [text(values.validierung)] : []}
            labelOf={(option) => optionLabel("validierung", option)}
            onChange={(next) => commit({ validierung: next[0] ?? "" })}
          />
        </div>
        <div className="field">
          <TextField
            label="Wie wird das Originalformat aufbewahrt?"
            value={text(values.aufbewahrung)}
            onChange={(aufbewahrung) => commit({ aufbewahrung })}
          />
        </div>
      </div>
    );
  }

  if (questionId === "E03") {
    return (
      <div>
        <div className="field">
          <TextField
            label="Wer prüft?"
            value={text(values.pruefer)}
            onChange={(pruefer) => commit({ pruefer })}
          />
        </div>
        <div className="field">
          <span className="hint">Worauf wird geprüft?</span>
          <Chips
            options={PRUEF_KRITERIEN}
            value={list(values.kriterienAuswahl)}
            multi
            onChange={(kriterienAuswahl) => commit({ kriterienAuswahl })}
          />
        </div>
        <div className="field">
          <TextField
            label="Weitere Prüfkriterien"
            value={text(values.kriterienFrei)}
            onChange={(kriterienFrei) => commit({ kriterienFrei })}
          />
        </div>
      </div>
    );
  }

  if (questionId === "E05") {
    return (
      <div>
        <div className="field">
          <TextField
            label="Welche Software?"
            value={text(values.systeme)}
            onChange={(systeme) => commit({ systeme })}
          />
        </div>
        <div className="field">
          <TextField label="Wer erstellt die Rechnungen?" value={text(values.wer)} onChange={(wer) => commit({ wer })} />
        </div>
        <div className="field">
          <TextField
            label="Wer gibt frei?"
            value={text(values.freigabe)}
            onChange={(freigabe) => commit({ freigabe })}
          />
        </div>
        <div className="field">
          <TextField
            label="Welcher Nummernkreis?"
            value={text(values.nummernvergabe)}
            placeholder="Zum Beispiel fortlaufend je Jahr"
            onChange={(nummernvergabe) => commit({ nummernvergabe })}
          />
        </div>
        <div className="field">
          <TextField
            label="Wie werden sie versendet?"
            value={text(values.versand)}
            onChange={(versand) => commit({ versand })}
          />
        </div>
        <div className="field">
          <TextField
            label="Wie laufen Korrektur und Storno?"
            value={text(values.storno)}
            placeholder="Zum Beispiel eigene Nummer, Original bleibt"
            onChange={(storno) => commit({ storno })}
          />
        </div>
      </div>
    );
  }

  if (questionId === "F01") {
    const systems = (values.schrittSystem ?? {}) as Record<string, string>;
    const proofs = (values.schrittNachweis ?? {}) as Record<string, string>;
    return (
      <div className="intake-table-wrap">
        <table className="intake-table">
          <thead>
            <tr>
              <th scope="col">Schritt</th>
              <th scope="col">Person oder Rolle</th>
              <th scope="col">System</th>
              <th scope="col">Nachweis</th>
            </tr>
          </thead>
          <tbody>
            {FREIGABE_SCHRITTE.map((step) => (
              <tr key={step.key}>
                <th scope="row">{step.schritt}</th>
                <td>
                  <input
                    aria-label={`${step.schritt}: Person oder Rolle`}
                    value={text(values[step.key])}
                    onChange={(event) => commit({ [step.key]: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`${step.schritt}: System`}
                    value={text(systems[step.key])}
                    onChange={(event) =>
                      commit({ schrittSystem: { ...systems, [step.key]: event.target.value } })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`${step.schritt}: Nachweis`}
                    value={text(proofs[step.key])}
                    onChange={(event) =>
                      commit({ schrittNachweis: { ...proofs, [step.key]: event.target.value } })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (questionId === "F05") {
    const gate = text(values.kanzleiBeteiligt);
    return (
      <div>
        <div className="field">
          <span className="hint">Ist eine Kanzlei am Belegweg beteiligt?</span>
          <Chips
            options={["ja", "nein", "unbekannt"]}
            value={gate ? [gate] : []}
            labelOf={(option) => (option === "unbekannt" ? "weiß ich nicht" : optionLabel("kanzlei", option))}
            onChange={(next) =>
              commit({ kanzleiBeteiligt: next[0] ?? "" }, next[0] === "ja" ? "open" : "derive")
            }
          />
        </div>
        {gate === "nein" ? <p className="hint">Dann entfallen die Fragen zur Kanzlei.</p> : null}
        {gate === "ja" ? (
          <>
            <div className="field">
              <TextField
                label="Welche Kanzlei?"
                value={text(values.kanzleiName)}
                onChange={(kanzleiName) => commit({ kanzleiName })}
              />
            </div>
            <div className="field">
              <span className="hint">Welche Aufgaben übernimmt sie?</span>
              <Chips
                options={KANZLEI_AUFGABEN}
                value={list(values.aufgaben)}
                multi
                onChange={(aufgaben) => commit({ aufgaben })}
              />
            </div>
            {list(values.aufgaben).includes("Sonstiges") ? (
              <div className="field">
                <TextField
                  label="Welche weitere Aufgabe?"
                  value={text(values.aufgabenFrei)}
                  onChange={(aufgabenFrei) => commit({ aufgabenFrei })}
                />
              </div>
            ) : null}
            <div className="field">
              <span className="hint">Liegt die Vereinbarung vor?</span>
              <Chips
                options={["ja", "nein", "unbekannt"]}
                value={text(values.nachweisVorhanden) ? [text(values.nachweisVorhanden)] : []}
                labelOf={(option) => optionLabel("nachweisVorhanden", option)}
                onChange={(next) => commit({ nachweisVorhanden: next[0] ?? "" })}
              />
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (questionId === "G01") {
    const scope = list(answers.katalog?.A02?.values?.belegartenScope);
    const stored = rowsOf(values.ablageJeArt);
    const suggested = (scope.length ? scope : ["Belege"]).map((art) => ({ art, ort: "", suche: "" }));
    const table = stored.length ? stored : suggested;
    return (
      <div>
        {table.map((row, index) => (
          <div className="system-card" key={`ablage-${index}`}>
            <div className="field">
              <TextField
                label="Belegart oder Belegweg"
                value={text(row.art)}
                onChange={(art) => {
                  const copy = table.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], art };
                  commit({ ablageJeArt: copy });
                }}
              />
            </div>
            <div className="field">
              <TextField
                label="Ablageort"
                value={text(row.ort)}
                onChange={(ort) => {
                  const copy = table.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], ort };
                  commit({ ablageJeArt: copy });
                }}
              />
            </div>
            <div className="field">
              <TextField
                label="Woran findet man den Beleg?"
                value={text(row.suche)}
                placeholder="Zum Beispiel Datum und Lieferant"
                onChange={(suche) => {
                  const copy = table.map((item) => ({ ...item }));
                  copy[index] = { ...copy[index], suche };
                  commit({ ablageJeArt: copy });
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn ghost"
          onClick={() => commit({ ablageJeArt: [...table, { art: "", ort: "", suche: "" }] })}
        >
          Weitere Belegart
        </button>
      </div>
    );
  }

  if (questionId === "G02") {
    const stored = rowsOf(values.zugriffRollen);
    const kanzlei = text(answers.katalog?.F05?.values?.kanzleiBeteiligt) === "ja";
    const roles = kanzlei ? [...ZUGRIFF_ROLLEN, "Kanzlei"] : [...ZUGRIFF_ROLLEN];
    function rechteFor(rolle: string): string[] {
      const found = stored.find((row) => text(row.rolle) === rolle);
      return list(found?.rechte);
    }
    return (
      <div>
        {roles.map((rolle) => (
          <div className="field" key={rolle}>
            <span className="hint">{rolle}</span>
            <Chips
              options={ZUGRIFF_RECHTE}
              value={rechteFor(rolle)}
              multi
              onChange={(rechte) => {
                const rest = stored.filter((row) => text(row.rolle) !== rolle);
                commit({ zugriffRollen: [...rest, { rolle, rechte }] });
              }}
            />
          </div>
        ))}
        <div className="field">
          <span className="hint">Gibt es eine Liste der Zugriffsrechte?</span>
          <Chips
            options={["ja", "nein", "unbekannt"]}
            value={text(values.berechtigungslisteVorhanden) ? [text(values.berechtigungslisteVorhanden)] : []}
            labelOf={(option) => optionLabel("berechtigungslisteVorhanden", option)}
            onChange={(next) => commit({ berechtigungslisteVorhanden: next[0] ?? "" })}
          />
        </div>
      </div>
    );
  }

  if (questionId === "G06") {
    const chosen = list(values.sicherung);
    return (
      <div>
        <InfoNote
          label="Sicherung und Prüfung"
          text="„Der Anbieter sichert“ beschreibt, was der Betreiber zusagt. „Rücksicherung oder Export geprüft“ heißt, der Betrieb hat selbst probiert, ob Daten zurückkommen oder exportiert werden können. Beides kann zutreffen."
        />
        <div className="field">
          <Chips
            options={SICHERUNG_OPTIONS}
            value={chosen}
            multi
            onChange={(next) => {
              const turnedUnknown = next.includes("weiß ich nicht") && !chosen.includes("weiß ich nicht");
              commit({
                sicherung: turnedUnknown ? ["weiß ich nicht"] : next.filter((item) => item !== "weiß ich nicht"),
              });
            }}
          />
        </div>
      </div>
    );
  }

  if (questionId === "H01") {
    const controls = rowsOf(values.kontrollen);
    const selected = controls.map((row) => text(row.name)).filter(Boolean);
    const options = [...TYPISCHE_KONTROLLEN] as string[];
    for (const name of selected) if (!options.includes(name)) options.push(name);
    return (
      <div>
        <div className="field">
          <span className="hint">Welche Kontrollen gibt es?</span>
          <Chips
            options={options}
            value={selected}
            multi
            onChange={(next) => {
              const kept = controls.filter((row) => next.includes(text(row.name)));
              const added = next
                .filter((name) => !selected.includes(name))
                .map((name) => ({ name, turnusWahl: "", turnusFrei: "", wer: "", nachweis: "" }));
              commit({ kontrollen: [...kept, ...added] });
            }}
          />
        </div>
        {controls.map((row, index) => {
          const choice =
            text(row.turnusWahl) ||
            ((KONTROLL_TURNUS as readonly string[]).includes(text(row.turnus)) ? text(row.turnus) : "");
          return (
            <div className="system-card" key={`kontrolle-${text(row.name)}`}>
              <p className="prose">{text(row.name)}</p>
              <div className="field">
                <span className="hint">Wie oft?</span>
                <Chips
                  options={KONTROLL_TURNUS}
                  value={choice ? [choice] : []}
                  onChange={(next) => {
                    const copy = controls.map((item) => ({ ...item }));
                    copy[index] = { ...copy[index], turnusWahl: next[0] ?? "" };
                    commit({ kontrollen: copy });
                  }}
                />
                {choice === "anders" ? (
                  <TextField
                    label="Welcher Turnus?"
                    value={text(row.turnusFrei)}
                    onChange={(turnusFrei) => {
                      const copy = controls.map((item) => ({ ...item }));
                      copy[index] = { ...copy[index], turnusFrei };
                      commit({ kontrollen: copy });
                    }}
                  />
                ) : null}
              </div>
              <div className="field">
                <TextField
                  label="Wer führt sie aus?"
                  value={text(row.wer)}
                  onChange={(wer) => {
                    const copy = controls.map((item) => ({ ...item }));
                    copy[index] = { ...copy[index], wer };
                    commit({ kontrollen: copy });
                  }}
                />
              </div>
              <div className="field">
                <TextField
                  label="Woran ist sie erkennbar?"
                  value={text(row.nachweis)}
                  onChange={(nachweis) => {
                    const copy = controls.map((item) => ({ ...item }));
                    copy[index] = { ...copy[index], nachweis };
                    commit({ kontrollen: copy });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (questionId === "H04") {
    const stand = text(values.status);
    return (
      <div>
        <div className="field">
          <Chips
            options={["bestaetigt", "nie", "unbekannt"]}
            value={stand ? [stand] : []}
            labelOf={(option) =>
              option === "bestaetigt" ? "getestet" : option === "nie" ? "noch nie" : "weiß ich nicht"
            }
            onChange={(next) => commit({ status: next[0] ?? "" }, "derive")}
          />
        </div>
        {stand === "bestaetigt" ? (
          <>
            <div className="field">
              <label>
                Datum der Prüfung
                <input
                  type="date"
                  value={text(values.datum)}
                  onChange={(event) => commit({ datum: event.target.value })}
                />
              </label>
            </div>
            <div className="field">
              <label>
                Ergebnis
                <textarea
                  value={text(values.ergebnis)}
                  onChange={(event) => commit({ ergebnis: event.target.value })}
                />
              </label>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (questionId === "I01") {
    return (
      <div>
        <div className="field">
          <TextField
            label="Wer pflegt die Dokumentation?"
            value={text(values.pfleger)}
            onChange={(pfleger) => commit({ pfleger })}
          />
        </div>
        <div className="field">
          <span className="hint">Wann entsteht eine neue Fassung?</span>
          <Chips
            options={AENDERUNGSANLAESSE}
            value={list(values.ausloeserAuswahl)}
            multi
            onChange={(ausloeserAuswahl) => commit({ ausloeserAuswahl })}
          />
        </div>
        {list(values.ausloeserAuswahl).includes("Sonstiges") ? (
          <div className="field">
            <TextField
              label="Welcher weitere Anlass?"
              value={text(values.ausloeserFrei)}
              onChange={(ausloeserFrei) => commit({ ausloeserFrei })}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (questionId === "I02") {
    const stored = rowsOf(values.anlagen);
    function standOf(name: string): string {
      return text(stored.find((row) => text(row.name) === name)?.status);
    }
    return (
      <div>
        {ANLAGEN_CHECKLISTE.map((name) => (
          <div className="field" key={name}>
            <span className="hint">{name}</span>
            <StandChips
              value={standOf(name)}
              onChange={(status) => {
                const extras = stored.filter(
                  (row) => !(ANLAGEN_CHECKLISTE as readonly string[]).includes(text(row.name)),
                );
                const checklist = ANLAGEN_CHECKLISTE.map((item) => ({
                  name: item,
                  status: item === name ? status : standOf(item),
                }));
                commit({ anlagen: [...checklist, ...extras] });
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export const P1_QUESTION_IDS = new Set([
  "B01",
  "B04",
  "B05",
  "C02",
  "C03",
  "D01",
  "E02",
  "E03",
  "E05",
  "F01",
  "F05",
  "G01",
  "G02",
  "G06",
  "H01",
  "H04",
  "I01",
  "I02",
]);

export function ProcessStatus({
  questionId,
  prompt,
  answers,
  onChange,
  issue = "",
}: {
  questionId: string;
  prompt: string;
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
  issue?: string;
}) {
  const entry = answers.katalog?.[questionId];
  const values = entry?.values ?? {};
  const showChoice = statusChoiceVisible(questionId, values);
  const showMeta = entry?.status === "geplant" || entry?.status === "unbekannt";
  if (!showChoice && !showMeta) return null;
  return (
    <div className={issue ? "field field-invalid" : "field"} id={`angabe-${questionId}-status`}>
      {showChoice ? (
        <>
          <div
            className="chips"
            id={`${questionId}-status`}
            tabIndex={-1}
            role="group"
            aria-label={`Stand: ${prompt}`}
          >
            {PROCESS_STATUSES.map((status) => {
              const active = entry?.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  className={active ? "chip on" : "chip"}
                  aria-pressed={active}
                  onClick={() =>
                    onChange(
                      active
                        ? clearCatalogStatus(answers, questionId)
                        : setCatalogStatus(answers, questionId, status as CatalogStatus),
                    )
                  }
                >
                  {statusLabel(status)}
                </button>
              );
            })}
          </div>
          {entry?.status === "geplant" ? (
            <p className="hint">
              Dieser Ablauf ist vorgesehen, aber noch nicht die heutige Praxis. Er erscheint nicht als
              bereits gelebter Prozess.
            </p>
          ) : null}
        </>
      ) : null}
      {issue ? (
        <p className="field-error" role="alert">
          {issue}
        </p>
      ) : null}
      {showMeta ? (
        <>
          <label htmlFor={`${questionId}-wer`}>Verantwortung</label>
          <input
            id={`${questionId}-wer`}
            value={entry?.responsible ?? ""}
            onChange={(event) =>
              onChange(setCatalogMeta(answers, questionId, { responsible: event.target.value }))
            }
          />
          <label htmlFor={`${questionId}-bis`}>Datum</label>
          <input
            id={`${questionId}-bis`}
            type="date"
            value={entry?.date ?? ""}
            onChange={(event) =>
              onChange(setCatalogMeta(answers, questionId, { date: event.target.value }))
            }
          />
        </>
      ) : null}
    </div>
  );
}
