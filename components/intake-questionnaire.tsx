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
  type CatalogStatus,
} from "@/lib/intake-catalog";
import { INTAKE_STEPS } from "@/lib/intake-questions";
import type { IntakeAnswers } from "@/lib/types";

function itemFields(field: CatalogField): Array<{ key: string; type: string; options?: string[] }> {
  return Object.entries(field.item ?? {}).map(([key, spec]) =>
    typeof spec === "string"
      ? { key, type: spec }
      : { key, type: spec.type, options: spec.options },
  );
}

function labelFor(field: CatalogField, fallback?: string): string {
  return field.label || fallback || field.key;
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
  options,
  value,
  multi,
  onChange,
}: {
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
            {option}
          </button>
        );
      })}
    </div>
  );
}

function FieldInput({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: CatalogField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (field.type === "textarea") {
    return (
      <textarea
        id={id}
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
        {labelFor(field)}
      </label>
    );
  }
  if (field.type === "enum" && field.options) {
    return (
      <ChoiceList
        options={field.options}
        value={asText(value) ? [asText(value)] : []}
        onChange={(next) => onChange(next[0] ?? "")}
      />
    );
  }
  if ((field.type === "multi" || field.type === "multi_or_text") && field.options) {
    return (
      <ChoiceList options={field.options} value={asList(value)} multi onChange={onChange} />
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
              {labelFor(field)} {index + 1}
            </label>
            {columns.map((column) =>
              column.type === "enum" && column.options ? (
                <ChoiceList
                  key={column.key}
                  options={column.options}
                  value={asText(row[column.key]) ? [asText(row[column.key])] : []}
                  onChange={(next) => {
                    const copy = rows.map((item) => ({ ...item }));
                    copy[index] = { ...copy[index], [column.key]: next[0] ?? "" };
                    onChange(copy);
                  }}
                />
              ) : (
                <input
                  key={column.key}
                  aria-label={`${column.key} ${index + 1}`}
                  placeholder={column.key}
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
            onChange([
              ...rows,
              Object.fromEntries(columns.map((column) => [column.key, ""])),
            ])
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
          <p className="prose">
            Dieser Schritt entfällt. Er gilt nur, wenn ein passender Weg gewählt ist.
          </p>
        ) : (
          questions.map((question) => {
            const entry = answers.katalog?.[question.id];
            return (
              <div key={question.id}>
                <p className="hint">
                  {question.id} — {question.prompt}
                </p>
                {question.note ? <p className="hint">{question.note}</p> : null}
                {question.fields.map((field) => (
                  <div className="field" key={field.key}>
                    {field.type !== "boolean" ? (
                      <label htmlFor={`${question.id}-${field.key}`}>{labelFor(field)}</label>
                    ) : null}
                    <FieldInput
                      id={`${question.id}-${field.key}`}
                      field={field}
                      value={entry?.values?.[field.key]}
                      onChange={(value) => onChange(setCatalogValue(answers, question.id, field.key, value))}
                    />
                  </div>
                ))}
                <div className="field">
                  <label>Status {question.id}</label>
                  <div className="chips" role="group" aria-label={`Status ${question.id}`}>
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
                      aria-label={`Grund ${question.id}`}
                      placeholder="Kurz der Grund, warum das entfällt"
                      value={entry.reason ?? ""}
                      onChange={(event) => onChange(setCatalogReason(answers, question.id, event.target.value))}
                    />
                  ) : null}
                  {entry?.status === "geplant" ? (
                    <p className="hint">Geplant ist kein Ist-Prozess und erscheint nicht als gelebter Ablauf.</p>
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
                {question.id === "I04" ? (
                  <p className="prose">
                    Die Erzeugung setzt den Freigabestatus nicht auf bestätigt. Name und Datum bleiben ein
                    Vermerk, der Status auf dem Deckblatt bleibt ausstehend.
                  </p>
                ) : null}
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
