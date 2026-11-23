/**
 * Fünf benannte Etappen für das Gesamtdokument.
 * Die Bezeichnung enthält keine Dauer und keine Modulzahl.
 */

export const INTAKE_ETAPPEN = [
  { id: "betrieb", label: "Ihr Betrieb" },
  { id: "unternehmen", label: "Unternehmen" },
  { id: "ablaeufe", label: "Abläufe" },
  { id: "systeme", label: "Systeme" },
  { id: "pflege", label: "Kontrollen und Pflege" },
] as const;

export type IntakeEtappeId = (typeof INTAKE_ETAPPEN)[number]["id"];

/** -1, wenn der Schritt zu keiner Etappe gehört (Übersicht, Bereichsfragen). */
export function etappeIndexForStepId(stepId: string): number {
  if (stepId === "step-BC") return 0;
  if (stepId.startsWith("step-M01")) return 1;
  const match = /^step-M(\d\d)$/.exec(stepId);
  if (!match) return -1;
  const nr = Number(match[1]);
  if (nr >= 2 && nr <= 14) return 2;
  if (nr >= 15 && nr <= 19) return 3;
  if (nr >= 20 && nr <= 24) return 4;
  return -1;
}
