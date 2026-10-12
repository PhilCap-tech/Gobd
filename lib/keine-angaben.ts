/**
 * Exklusive Angaben „keine Kontrolle“ und „keine Ausnahmen“.
 * Keine Importe aus Katalog, Bereichen oder der PDF-Erzeugung.
 */

export const KEINE_REGELMAESSIGE_KONTROLLE = "Keine regelmäßige Kontrolle";

export const KONTROLLEN_HINWEIS =
  "Gemeint sind einfache Prüfschritte, die Fehler auffangen, z. B. „Ich gleiche jeden Monat Kontoauszug und Buchhaltung ab“; wenn Sie keine haben, wählen Sie „Keine regelmäßige Kontrolle“.";

export const KEINE_KONTROLLE_SATZ =
  "Für diesen Bereich ist derzeit keine regelmäßige Kontrolle eingerichtet.";

export const KEINE_AUSNAHMEN = "Keine Ausnahmen";

export const KEINE_AUSNAHMEN_SATZ = "Keine Ausnahmen.";

export function mitKeineKontrolle(names: string[]): string[] {
  if (names.includes(KEINE_REGELMAESSIGE_KONTROLLE)) return names;
  return [...names, KEINE_REGELMAESSIGE_KONTROLLE];
}

/** xx92, H01 und die Kontrollfragen KF01–KF05. */
export function isControlQuestionId(id: string): boolean {
  return id === "H01" || /^KF0[1-5]$/.test(id) || /92$/.test(id);
}

/**
 * Die zuletzt gesetzte Auswahl gewinnt: die exklusive Option ersetzt die
 * übrigen, eine konkrete Option entfernt die exklusive.
 */
export function normalizeExclusiveSelection(values: string[], exclusive: string): string[] {
  if (!values.includes(exclusive)) return values;
  if (values[values.length - 1] === exclusive) return [exclusive];
  return values.filter((item) => item !== exclusive);
}

export function controlNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === "string" ? name.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

export function isKeineKontrolleValues(values: Record<string, unknown> | undefined): boolean {
  if (!values) return false;
  if (values.keineKontrolle === true) return true;
  const names = controlNames(values.kontrollen);
  return names.length > 0 && names.every((name) => name === KEINE_REGELMAESSIGE_KONTROLLE);
}

/** Katalognamen, die als durchgeführte Kontrolle gelten. Die Keine-Angabe zählt nicht. */
export function realControlNames(values: Record<string, unknown> | undefined): string[] {
  if (!values || values.keineKontrolle === true) return [];
  return controlNames(values.kontrollen).filter((name) => name !== KEINE_REGELMAESSIGE_KONTROLLE);
}

export function ausnahmenPhrase(
  row: { keineAusnahmen?: boolean; ausnahmen?: unknown } | undefined,
): string {
  if (!row) return "";
  if (row.keineAusnahmen === true) return KEINE_AUSNAHMEN_SATZ;
  const text = typeof row.ausnahmen === "string" ? row.ausnahmen.trim() : "";
  return text ? `Ausnahmen: ${text}` : "";
}
