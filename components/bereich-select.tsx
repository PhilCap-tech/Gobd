"use client";

import { BEREICHE, bereichById } from "@/lib/bereiche";

/** Area picker at the start of the intake. One Verfahrensdokumentation per area. */
export function BereichSelect({
  value,
  onChange,
  locked = false,
  existing = [],
}: {
  value: string;
  onChange: (next: string) => void;
  locked?: boolean;
  /** Areas the company already documents (shown as a hint, still selectable). */
  existing?: string[];
}) {
  const current = bereichById(value);
  if (locked) {
    return (
      <p className="hint" style={{ margin: 0 }}>
        Bereich dieser Verfahrensdokumentation: <strong>{current.label}</strong>
      </p>
    );
  }
  return (
    <div className="field" style={{ margin: 0 }}>
      <label htmlFor="intake-bereich">Für welchen Bereich erstellen Sie diese Verfahrensdokumentation?</label>
      <select
        id="intake-bereich"
        value={current.id}
        onChange={(event) => onChange(event.target.value)}
      >
        {BEREICHE.map((bereich) => (
          <option key={bereich.id} value={bereich.id}>
            {bereich.label}
            {existing.includes(bereich.id) ? " (bereits vorhanden)" : ""}
          </option>
        ))}
      </select>
      <p className="hint">
        {current.kurz} Typische Systeme: {current.beispiele}. Jeder Bereich wird eine eigene
        Verfahrensdokumentation mit eigenen Versionen. Alle Bereiche sind im Preis enthalten.
      </p>
    </div>
  );
}
