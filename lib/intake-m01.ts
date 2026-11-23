/**
 * Modul 1 im Fragebogen: fünf Seiten, und nur noch Felder blockieren,
 * ohne die das PDF nicht erzeugt werden kann.
 *
 * Die PDF-Erzeugung braucht aus Modul 1 kein Formularfeld. Der Firmenname
 * auf dem Deckblatt kommt aus der gewählten Firma. Leere Angaben werden
 * ein neutraler Satz und ein offener Punkt, nichts wird erfunden.
 */

export const M01_PAGE_IDS = ["step-M01", "step-M01b", "step-M01c", "step-M01d", "step-M01e"] as const;

export const M01_PAGES: ReadonlyArray<{ id: (typeof M01_PAGE_IDS)[number]; title: string; questionIds: string[] }> = [
  { id: "step-M01", title: "Unternehmen", questionIds: ["A01"] },
  { id: "step-M01b", title: "Beginn des Ablaufs", questionIds: ["A04"] },
  { id: "step-M01c", title: "Tätigkeiten und Standorte", questionIds: ["UO01", "UO02"] },
  { id: "step-M01d", title: "Zuständigkeiten und Vertretung", questionIds: ["UO03", "UO04"] },
  { id: "step-M01e", title: "Befugnisse und Geltungsbereich", questionIds: ["UO05", "UO06"] },
];

/** Fragen, deren Stand (So läuft es heute / künftig / klären) in Modul 1 nicht mehr blockiert. */
export const M01_STATUS_OPTIONAL = ["A01", "A04", "UO01", "UO02", "UO03", "UO04", "UO05", "UO06"] as const;

/**
 * Felder, die in Modul 1 von Pflicht auf optional wechseln.
 * Schon vorher optional und hier nicht enthalten: A01.mitarbeitende, UO01.standorte, UO06.ausgenommen.
 */
export const M01_NOW_OPTIONAL: ReadonlyArray<{ questionId: string; fieldKey: string; label: string }> = [
  { questionId: "A01", fieldKey: "company", label: "Unternehmen" },
  { questionId: "A01", fieldKey: "standort", label: "Standort" },
  { questionId: "A01", fieldKey: "branchen", label: "Tätigkeitsbereiche" },
  { questionId: "A01", fieldKey: "rechtsform", label: "Rechtsform" },
  { questionId: "A01", fieldKey: "gf", label: "Geschäftsleitung (Name)" },
  { questionId: "A04", fieldKey: "gueltigAb", label: "Beginn des beschriebenen Ablaufs" },
  { questionId: "A04", fieldKey: "keineRueckdatierungBestaetigt", label: "Keine Rückdatierung bestätigt" },
  { questionId: "UO01", fieldKey: "gesellschaften", label: "Gesellschaften" },
  { questionId: "UO02", fieldKey: "taetigkeiten", label: "Tätigkeiten und Umsatzarten" },
  { questionId: "UO02", fieldKey: "kunden", label: "Kundengruppen" },
  { questionId: "UO03", fieldKey: "zustaendigkeiten", label: "Aufgabe und zuständige Person oder Rolle" },
  { questionId: "UO03", fieldKey: "organigramm", label: "Organigramm oder Aufgabenliste vorhanden" },
  { questionId: "UO04", fieldKey: "vertretung", label: "Vertretungsregelung" },
  { questionId: "UO04", fieldKey: "schriftlich", label: "Schriftlich festgehalten" },
  { questionId: "UO05", fieldKey: "befugnisse", label: "Befugnis, Person oder Rolle, Betragsgrenze" },
  { questionId: "UO06", fieldKey: "geltung", label: "Geltungsbereich" },
];

export const M01_OFFEN_SATZ = "Hierzu liegt noch keine Angabe vor. Siehe offene Punkte.";

export const M01_BEGINN_SATZ =
  "Der Beginn des beschriebenen Ablaufs ist nicht angegeben. Diese Fassung behauptet nicht, sie habe schon vor ihrer Erstellung gegolten.";

export const M01_PAGE_HINT =
  "Was Sie hier nicht ausfüllen, bleibt ein offener Punkt. Sie können später ergänzen.";

export function m01StatusOptional(questionId: string): boolean {
  return (M01_STATUS_OPTIONAL as readonly string[]).includes(questionId);
}

export function m01FieldNowOptional(questionId: string, fieldKey: string): boolean {
  return M01_NOW_OPTIONAL.some((item) => item.questionId === questionId && item.fieldKey === fieldKey);
}

function fieldFilled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some((item) => fieldFilled(item));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => fieldFilled(item));
  }
  return Boolean(String(value ?? "").trim());
}

/**
 * Modul 1 erzeugt einen offenen Punkt, wenn die Frage ohne Stand bleibt
 * oder als heutige Praxis markiert ist, aber ohne die frühere Pflichtangabe.
 * „Entfällt“ mit Begründung bleibt ohne diesen Punkt.
 * Beim Beginn zählt das Datum: eine Bestätigung ohne Datum bleibt offen.
 */
export function m01NeedsOpenPoint(
  questionId: string,
  entry: { status?: string; values?: Record<string, unknown> } | undefined,
): boolean {
  if (!m01StatusOptional(questionId)) return false;
  const status = entry?.status;
  if (status === "nicht_zutreffend") return false;
  if (!status) return true;
  if (status !== "bestaetigt") return false;
  if (questionId === "A04") return !String(entry?.values?.gueltigAb ?? "").trim();
  const keys = M01_NOW_OPTIONAL.filter((item) => item.questionId === questionId).map((item) => item.fieldKey);
  if (!keys.length) return false;
  return keys.every((key) => !fieldFilled(entry?.values?.[key]));
}
