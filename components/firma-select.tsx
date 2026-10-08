"use client";

import type { EntityChoice } from "@/lib/entities";

export function FirmaSelect({
  entities,
  value,
  onChange,
  required = false,
  invalid = false,
  id = "firma-select",
}: {
  entities: EntityChoice[];
  value: string;
  onChange: (entityId: string) => void;
  required?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  if (entities.length === 0) return null;

  return (
    <div className={invalid ? "field field-invalid" : "field"} id={`${id}-feld`}>
      <label htmlFor={id}>Firma</label>
      <select
        id={id}
        name="entityId"
        value={value}
        required={required}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {entities.length > 1 && <option value="">Bitte Firma wählen</option>}
        {entities.map((entity) => (
          <option key={entity.entityId} value={entity.entityId}>
            {entity.name}
          </option>
        ))}
      </select>
      {invalid ? (
        <p className="field-error" role="alert">
          Bitte eine Firma wählen.
        </p>
      ) : null}
    </div>
  );
}
