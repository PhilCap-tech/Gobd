/** Der Lesepfad der Zählung schreibt den Kopf nicht. Er meldet ihn nur. */
export class IntakeHeaderError extends Error {
  readonly kind: "leer" | "unvollstaendig";

  constructor(kind: "leer" | "unvollstaendig") {
    super(kind === "leer" ? "leerer Kopf" : "unvollständiger Kopf");
    this.name = "IntakeHeaderError";
    this.kind = kind;
  }
}

/** Leer, wenn keine Zelle gefüllt ist. Unvollständig, wenn die Spalte fragen fehlt. */
export function intakeHeaderProblem(header: readonly string[]): "leer" | "unvollstaendig" | null {
  const cells = header.map((cell) => cell.trim()).filter(Boolean);
  if (cells.length === 0) return "leer";
  if (!cells.includes("fragen")) return "unvollstaendig";
  return null;
}
