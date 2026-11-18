/** Der Lesepfad der Zählung schreibt den Kopf nicht. Er meldet ihn nur. */
export class IntakeHeaderError extends Error {
  readonly kind: "leer" | "unvollstaendig";
  readonly columns: readonly string[];

  constructor(kind: "leer" | "unvollstaendig", columns: readonly string[] = []) {
    super(kind === "leer" ? "leerer Kopf" : "unvollständiger Kopf");
    this.name = "IntakeHeaderError";
    this.kind = kind;
    this.columns = columns;
  }
}

export type IntakeHeaderProblem = {
  kind: "leer" | "unvollstaendig";
  columns: readonly string[];
};

const REQUIRED_COLUMNS = ["fragen"] as const;

/** Leer, wenn keine Zelle gefüllt ist. Unvollständig nennt jede fehlende Pflichtspalte. */
export function intakeHeaderProblem(header: readonly string[]): IntakeHeaderProblem | null {
  const cells = header.map((cell) => cell.trim()).filter(Boolean);
  if (cells.length === 0) return { kind: "leer", columns: [] };
  const columns = REQUIRED_COLUMNS.filter((column) => !cells.includes(column));
  if (columns.length === 0) return null;
  return { kind: "unvollstaendig", columns };
}
