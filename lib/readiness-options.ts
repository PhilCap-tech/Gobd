export const READINESS_BRANCHEN = [
  { id: "handwerk", label: "Handwerk" },
  { id: "handel", label: "Handel" },
  { id: "praxis", label: "Praxis / Heilberufe" },
  { id: "gastronomie", label: "Gastronomie" },
  { id: "dienstleistung", label: "Dienstleistung" },
  { id: "allgemein", label: "Allgemein" },
] as const;

export type ReadinessBrancheId = (typeof READINESS_BRANCHEN)[number]["id"];

export const READINESS_BELEGWEGE = ["Papier", "Digital", "Gemischt"] as const;
export type ReadinessBelegweg = (typeof READINESS_BELEGWEGE)[number];

const MODULE_IDS = new Set<string>(READINESS_BRANCHEN.map((item) => item.id));

export function isReadinessBrancheId(value: string): value is ReadinessBrancheId {
  return MODULE_IDS.has(value);
}

export function isReadinessBelegweg(value: string): value is ReadinessBelegweg {
  return (READINESS_BELEGWEGE as readonly string[]).includes(value);
}

/** UI key → module file. Unknown / empty → allgemein. */
export function resolveReadinessBranche(
  value: string | null | undefined,
): ReadinessBrancheId {
  const key = (value || "").trim().toLowerCase();
  if (isReadinessBrancheId(key)) return key;
  return "allgemein";
}

export function readinessBrancheLabel(id: string): string {
  const resolved = resolveReadinessBranche(id);
  return READINESS_BRANCHEN.find((item) => item.id === resolved)?.label ?? "Allgemein";
}
