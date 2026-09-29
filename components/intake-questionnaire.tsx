"use client";

import {
  CATALOG_STATUSES,
  CATALOG_STEPS,
  catalogQuestionApplies,
  catalogStepApplies,
  setCatalogMeta,
  setCatalogReason,
  setCatalogStatus,
  setCatalogValue,
  statusLabel,
  visibleCatalogQuestions,
  type CatalogField,
} from "@/lib/intake-catalog";
import {
  activityFollowupsFor,
  columnLabel,
  FIELD_PLACEHOLDERS,
  fieldLabel,
  MITARBEITENDE_OPTIONS,
  optionLabel,
  RECHTSFORM_FREITEXT,
  RECHTSFORMEN,
  TAETIGKEIT_FREITEXT,
  TAETIGKEITEN,
} from "@/lib/intake-present";
import { INTAKE_STEPS } from "@/lib/intake-questions";
import type { IntakeAnswers } from "@/lib/types";

function itemFields(field: CatalogField): Array<{ key: string; type: string; options?: string[] }> {
  return Object.entries(field.item ?? {}).map(([key, spec]) =>
    typeof spec === "string"
      ? { key, type: spec }
      : { key, type: spec.type, options: spec.options },
  );
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function ChoiceList({
  fieldKey,
  options,
  value,
  multi,
  onChange,
}: {
  fieldKey: string;
  options: string[];
  value: string[];
  multi?: boolean;
  onChange: (next: string[]) => void;
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
            {optionLabel(fieldKey, option)}
          </button>
        );
      })}
    </div>
  );
}

function Dropdown({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const known = value === "" || options.includes(value);
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Bitte wählen</option>
      {!known ? <option value={value}>{value}</option> : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function FieldInput({
  id,
  field,
  label,
  value,
  onChange,
}: {
  id: string;
  field: CatalogField;
  label: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (field.key === "rechtsform") {
    return <Dropdown id={id} options={RECHTSFORMEN} value={asText(value)} onChange={onChange} />;
  }
  if (field.key === "mitarbeitende") {
    return (
      <Dropdown id={id} options={MITARBEITENDE_OPTIONS} value={asText(value)} onChange={onChange} />
    );
  }
  if (field.key === "branchen") {
    const selected = asList(value);
    const options: string[] = [...TAETIGKEITEN];
    for (const item of selected) {
      if (!options.includes(item)) options.push(item);
    }
    return (
      <ChoiceList
        fieldKey={field.key}
        options={options}
        value={selected}
        multi
        onChange={onChange}
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        id={id}
        placeholder={FIELD_PLACEHOLDERS[field.key]}
        value={asText(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (field.type === "date") {
    return (
      <input
        id={id}
        type="date"
        value={asText(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (field.type === "boolean") {
    return (
      <label>
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />{" "}
        {label}
      </label>
    );
  }
  if (field.type === "enum" && field.options) {
    return (
      <ChoiceList
        fieldKey={field.key}
        options={field.options}
        value={asText(value) ? [asText(value)] : []}
        onChange={(next) => onChange(next[0] ?? "")}
      />
    );
  }
  if ((field.type === "multi" || field.type === "multi_or_text") && field.options) {
    return (
      <ChoiceList
        fieldKey={field.key}
        options={field.options}
        value={asList(value)}
        multi
        onChange={onChange}
      />
    );
  }
  if (field.type === "multi" || field.type === "multi_or_text") {
    return (
      <textarea
        id={id}
        placeholder="Mehrere Angaben, eine pro Zeile oder durch Komma"
        value={Array.isArray(value) ? value.join(", ") : asText(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (field.type === "repeat") {
    const columns = itemFields(field);
    const rows =
      Array.isArray(value) && value.length
        ? (value as Record<string, unknown>[])
        : [Object.fromEntries(columns.map((column) => [column.key, ""]))];
    return (
      <div>
        {rows.map((row, index) => (
          <div className="field" key={`${field.key}-${index}`}>
            <label>
              {label} {index + 1}
            </label>
            {columns.map((column) =>
              column.type === "enum" && column.options ? (
                <div key={column.key}>
                  <span className="hint">{columnLabel(field.key, column.key)}</span>
                  <ChoiceList
                    fieldKey={column.key}
                    options={column.options}
                    value={asText(row[column.key]) ? [asText(row[column.key])] : []}
                    onChange={(next) => {
                      const copy = rows.map((item) => ({ ...item }));
                      copy[index] = { ...copy[index], [column.key]: next[0] ?? "" };
                      onChange(copy);
                    }}
                  />
                </div>
              ) : (
                <input
                  key={column.key}
                  aria-label={`${columnLabel(field.key, column.key)} ${index + 1}`}
                  placeholder={columnLabel(field.key, column.key)}
                  value={asText(row[column.key])}
                  onChange={(event) => {
                    const copy = rows.map((item) => ({ ...item }));
                    copy[index] = { ...copy[index], [column.key]: event.target.value };
                    onChange(copy);
                  }}
                />
              ),
            )}
          </div>
        ))}
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            onChange([...rows, Object.fromEntries(columns.map((column) => [column.key, ""]))])
          }
        >
          Weiterer Eintrag
        </button>
      </div>
    );
  }
  return (
    <input
      id={id}
      placeholder={FIELD_PLACEHOLDERS[field.key]}
      value={asText(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
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
  const catalogStep = CATALOG_STEPS[step];
  if (!meta || !catalogStep) return null;
  const questions = visibleCatalogQuestions(step, answers);

  return (
    <section>
      <p className="step-label">{meta.stepLabel}</p>
      <h1>{meta.title}</h1>
      <div className="card">
        {!catalogStepApplies(catalogStep, answers) || questions.length === 0 ? (
          <p className="prose">Dieser Schritt entfällt. Er gilt nur, wenn ein passender Weg gewählt ist.</p>
        ) : (
          questions.map((question) => {
            const entry = answers.katalog?.[question.id];
            const values = entry?.values ?? {};
            const activities = asList(values.branchen);
            const excluded = asList(values.ausgeschlossen);
            const shopExcluded = excluded.includes("Shop");
            return (
              <div key={question.id}>
                <p className="prose">{question.prompt}</p>
                {question.id === "A04" ? (
                  <p className="hint">
                    Das Datum ist der Beginn des beschriebenen Ablaufs im Betrieb. Es ist nicht das
                    Datum, an dem diese Dokumentation erstellt wird. „Keine Rückdatierung“ heißt: die
                    Dokumentation behauptet nicht, sie habe schon gegolten, bevor sie erstellt wurde.
                  </p>
                ) : null}
                {question.fields.map((field) => {
                  const label = fieldLabel(question.id, field.key, field.label);
                  return (
                    <div className="field" key={field.key}>
                      {field.type !== "boolean" ? (
                        <label htmlFor={`${question.id}-${field.key}`}>{label}</label>
                      ) : null}
                      <FieldInput
                        id={`${question.id}-${field.key}`}
                        field={field}
                        label={label}
                        value={values[field.key]}
                        onChange={(value) =>
                          onChange(setCatalogValue(answers, question.id, field.key, value))
                        }
                      />
                    </div>
                  );
                })}
                {question.id === "A01" && activities.includes(TAETIGKEIT_FREITEXT) ? (
                  <div className="field">
                    <label htmlFor="a01-taetigkeit-frei">Welche sonstige Tätigkeit?</label>
                    <input
                      id="a01-taetigkeit-frei"
                      placeholder={FIELD_PLACEHOLDERS.branchenFreitext}
                      value={asText(values.branchenFreitext)}
                      onChange={(event) =>
                        onChange(setCatalogValue(answers, "A01", "branchenFreitext", event.target.value))
                      }
                    />
                  </div>
                ) : null}
                {question.id === "A01" && asText(values.rechtsform) === RECHTSFORM_FREITEXT ? (
                  <div className="field">
                    <label htmlFor="a01-rechtsform-frei">Welche Rechtsform genau?</label>
                    <input
                      id="a01-rechtsform-frei"
                      placeholder={FIELD_PLACEHOLDERS.rechtsformFreitext}
                      value={asText(values.rechtsformFreitext)}
                      onChange={(event) =>
                        onChange(setCatalogValue(answers, "A01", "rechtsformFreitext", event.target.value))
                      }
                    />
                  </div>
                ) : null}
                {question.id === "A01"
                  ? activityFollowupsFor(activities).map((group) => (
                      <div key={group.activity}>
                        <p className="hint">Folgefragen zu {group.activity}</p>
                        {group.fields.map((field) => (
                          <div className="field" key={field.key}>
                            <label htmlFor={`a01-${field.key}`}>{field.label}</label>
                            <input
                              id={`a01-${field.key}`}
                              placeholder={FIELD_PLACEHOLDERS[field.key]}
                              value={asText(values[field.key])}
                              onChange={(event) =>
                                onChange(setCatalogValue(answers, "A01", field.key, event.target.value))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ))
                  : null}
                {question.id === "A02" &&
                (excluded.length > 0 || asText(values.ausgeschlossenSonstiges).trim()) ? (
                  <div className="field">
                    <label htmlFor="a02-wo">
                      {shopExcluded
                        ? "Wo ist der Shop dokumentiert?"
                        : "Wo sind diese Vorgänge dokumentiert?"}
                    </label>
                    {shopExcluded ? (
                      <p className="hint">
                        Der Shop bleibt ein realer Vorgang. Bitte nennen, in welcher Dokumentation er
                        beschrieben ist.
                      </p>
                    ) : null}
                    <input
                      id="a02-wo"
                      placeholder={FIELD_PLACEHOLDERS.ausgeschlossenWo}
                      value={asText(values.ausgeschlossenWo)}
                      onChange={(event) =>
                        onChange(setCatalogValue(answers, "A02", "ausgeschlossenWo", event.target.value))
                      }
                    />
                  </div>
                ) : null}
                <div className="field">
                  <label>Stand dieser Angabe</label>
                  <div className="chips" role="group" aria-label={`Stand: ${question.prompt}`}>
                    {CATALOG_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={entry?.status === status ? "chip on" : "chip"}
                        onClick={() => onChange(setCatalogStatus(answers, question.id, status))}
                      >
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                  {entry?.status === "nicht_zutreffend" ? (
                    <input
                      aria-label="Grund, warum das entfällt"
                      placeholder="Kurz der Grund, warum das entfällt"
                      value={entry.reason ?? ""}
                      onChange={(event) =>
                        onChange(setCatalogReason(answers, question.id, event.target.value))
                      }
                    />
                  ) : null}
                  {entry?.status === "geplant" ? (
                    <p className="hint">
                      Geplant ist kein Ist-Prozess und erscheint nicht als gelebter Ablauf.
                    </p>
                  ) : null}
                  <label htmlFor={`${question.id}-wer`}>Verantwortung (optional)</label>
                  <input
                    id={`${question.id}-wer`}
                    value={entry?.responsible ?? ""}
                    onChange={(event) =>
                      onChange(setCatalogMeta(answers, question.id, { responsible: event.target.value }))
                    }
                  />
                  <label htmlFor={`${question.id}-bis`}>Datum (optional)</label>
                  <input
                    id={`${question.id}-bis`}
                    type="date"
                    value={entry?.date ?? ""}
                    onChange={(event) =>
                      onChange(setCatalogMeta(answers, question.id, { date: event.target.value }))
                    }
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export function catalogQuestionVisible(id: string, answers: IntakeAnswers): boolean {
  for (const step of CATALOG_STEPS) {
    const question = step.questions.find((item) => item.id === id);
    if (question) return catalogQuestionApplies(question, answers);
  }
  return false;
}
