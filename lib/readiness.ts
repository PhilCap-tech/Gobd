export const READINESS_BRANCHES = [
  { id: "handwerk", label: "Handwerk" },
  { id: "handel", label: "Handel" },
  { id: "praxis", label: "Praxis / Heilberufe" },
  { id: "gastronomie", label: "Gastronomie" },
  { id: "dienstleistung", label: "Dienstleistung / Freiberufler" },
  { id: "allgemein", label: "Sonstiges / Mischbetrieb" },
] as const;

export type ReadinessBrancheId = (typeof READINESS_BRANCHES)[number]["id"];

export const READINESS_BELEGE = [
  { id: "digital", label: "Überwiegend digital" },
  { id: "gemischt", label: "Gemischt (digital und Papier)" },
  { id: "papier", label: "Überwiegend Papier" },
  { id: "unklar", label: "Unklar / noch nicht geregelt" },
] as const;

export const READINESS_DOKUMENTATION = [
  { id: "nein", label: "Nein, noch keine" },
  { id: "teilweise", label: "Teilweise / Fragmente" },
  { id: "ja", label: "Ja, aktuell gehalten" },
] as const;

export const READINESS_ARCHIV = [
  { id: "software", label: "Buchhaltungssoftware / DATEV o. Ä." },
  { id: "ordner", label: "Cloud- oder Dateiordner" },
  { id: "papier", label: "Papierordner" },
  { id: "unklar", label: "Unklar / verteilt" },
] as const;

export type ReadinessAnswers = {
  name: string;
  email: string;
  company: string;
  branche: ReadinessBrancheId;
  belege: (typeof READINESS_BELEGE)[number]["id"];
  dokumentation: (typeof READINESS_DOKUMENTATION)[number]["id"];
  archiv: (typeof READINESS_ARCHIV)[number]["id"];
};

export type ReadinessLead = {
  timestamp: string;
  name: string;
  email: string;
  company: string;
  branche: ReadinessBrancheId;
  belege: string;
  dokumentation: string;
  archiv: string;
  documentId: string;
  pdfUrl: string;
  status: string;
  mailStatus: string;
};

export const READINESS_SHEET_COLUMNS = [
  "timestamp",
  "name",
  "email",
  "company",
  "branche",
  "belege",
  "dokumentation",
  "archiv",
  "document_id",
  "pdf_url",
  "status",
  "mail_status",
] as const;

export type ReadinessSheetColumn = (typeof READINESS_SHEET_COLUMNS)[number];

const READINESS_COLUMN_FIELDS = {
  timestamp: "timestamp",
  name: "name",
  email: "email",
  company: "company",
  branche: "branche",
  belege: "belege",
  dokumentation: "dokumentation",
  archiv: "archiv",
  document_id: "documentId",
  pdf_url: "pdfUrl",
  status: "status",
  mail_status: "mailStatus",
} as const satisfies Record<ReadinessSheetColumn, keyof ReadinessLead>;

export const READINESS_DISCLAIMER =
  "Keine Steuerberatung und kein Steuerberatungsersatz. Keine Zusicherung der GoBD-Konformität, keiner Prüfungssicherheit und keiner Anerkennung durch Finanzämter oder Prüfer. Das PDF ist eine allgemeine Arbeitshilfe zur Vorbereitung — keine fertige Verfahrensdokumentation.";

const BRANCH_IDS = new Set<string>(READINESS_BRANCHES.map((item) => item.id));
const BELEGE_IDS = new Set<string>(READINESS_BELEGE.map((item) => item.id));
const DOKUMENTATION_IDS = new Set<string>(
  READINESS_DOKUMENTATION.map((item) => item.id),
);
const ARCHIV_IDS = new Set<string>(READINESS_ARCHIV.map((item) => item.id));

export function isReadinessBrancheId(value: string): value is ReadinessBrancheId {
  return BRANCH_IDS.has(value);
}

export function normalizeReadinessBranche(value: string): ReadinessBrancheId {
  return isReadinessBrancheId(value) ? value : "allgemein";
}

export function brancheLabel(id: string): string {
  const match = READINESS_BRANCHES.find((item) => item.id === id);
  return match?.label ?? "KMU / allgemein";
}

export function optionLabel(
  options: readonly { id: string; label: string }[],
  id: string,
): string {
  return options.find((item) => item.id === id)?.label ?? id;
}

export function pdfTitleForBranche(id: string): string {
  return `GoBD-Grundlagen für ${brancheLabel(id)}`;
}

export function formatReadinessDate(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function firmaPlaceholder(company: string, name: string): string {
  const firm = company.trim();
  if (firm) return firm;
  const person = name.trim();
  if (person) return person;
  return "dein Betrieb";
}

export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

export function applyReadinessPlaceholders(
  markdown: string,
  vars: { Branche: string; Firma: string; Datum: string },
): string {
  return stripFrontmatter(markdown)
    .replaceAll("{{Branche}}", vars.Branche)
    .replaceAll("{{Firma}}", vars.Firma)
    .replaceAll("{{Datum}}", vars.Datum);
}

export function emptyReadinessLead(): ReadinessLead {
  return {
    timestamp: "",
    name: "",
    email: "",
    company: "",
    branche: "allgemein",
    belege: "",
    dokumentation: "",
    archiv: "",
    documentId: "",
    pdfUrl: "",
    status: "",
    mailStatus: "",
  };
}

function normalizeHeaderKey(col: string): string {
  return col.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const HEADER_FIELDS: Record<string, keyof ReadinessLead> = (() => {
  const map: Record<string, keyof ReadinessLead> = {};
  for (const [column, field] of Object.entries(READINESS_COLUMN_FIELDS) as Array<
    [ReadinessSheetColumn, keyof ReadinessLead]
  >) {
    map[column] = field;
    map[normalizeHeaderKey(column)] = field;
    map[field] = field;
    map[field.toLowerCase()] = field;
  }
  return map;
})();

export function readinessFieldForHeader(
  header: string,
): keyof ReadinessLead | undefined {
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  return HEADER_FIELDS[trimmed] ?? HEADER_FIELDS[normalizeHeaderKey(trimmed)];
}

export function readinessRowValues(
  row: ReadinessLead,
  header: readonly string[] = READINESS_SHEET_COLUMNS,
): string[] {
  return header.map((col) => {
    const field =
      readinessFieldForHeader(col) ??
      READINESS_COLUMN_FIELDS[col as ReadinessSheetColumn];
    return field ? String(row[field] ?? "") : "";
  });
}

export function readinessRowFromValues(
  header: string[],
  values: string[],
): ReadinessLead {
  const row = emptyReadinessLead();
  header.forEach((col, index) => {
    const field = readinessFieldForHeader(col);
    if (!field) return;
    const raw = String(values[index] ?? "").trim();
    if (field === "branche") {
      row.branche = normalizeReadinessBranche(raw);
      return;
    }
    row[field] = raw;
  });
  return row;
}

export function coerceReadinessLead(value: unknown): ReadinessLead | null {
  if (!value || typeof value !== "object") return null;
  const partial = value as Partial<ReadinessLead>;
  return {
    ...emptyReadinessLead(),
    ...partial,
    branche: normalizeReadinessBranche(String(partial.branche ?? "")),
  };
}

export function toReadinessLead(input: {
  answers: ReadinessAnswers;
  documentId: string;
  pdfUrl: string;
  status: string;
  mailStatus: string;
}): ReadinessLead {
  return {
    timestamp: new Date().toISOString(),
    name: input.answers.name,
    email: input.answers.email,
    company: input.answers.company,
    branche: input.answers.branche,
    belege: input.answers.belege,
    dokumentation: input.answers.dokumentation,
    archiv: input.answers.archiv,
    documentId: input.documentId,
    pdfUrl: input.pdfUrl,
    status: input.status,
    mailStatus: input.mailStatus,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isIdIn<T extends string>(
  value: unknown,
  allowed: ReadonlySet<string>,
): value is T {
  return typeof value === "string" && allowed.has(value);
}

export function parseReadinessAnswers(
  value: unknown,
): { ok: true; answers: ReadinessAnswers } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Angaben unvollständig." };
  }
  const v = value as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name.trim() : "";
  const email = typeof v.email === "string" ? v.email.trim() : "";
  const company = typeof v.company === "string" ? v.company.trim() : "";
  if (!name || name.length > 120) {
    return { ok: false, error: "Bitte einen Namen angeben." };
  }
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Bitte eine gültige E-Mail angeben." };
  }
  if (company.length > 160) {
    return { ok: false, error: "Firmenname ist zu lang." };
  }
  const brancheRaw = typeof v.branche === "string" ? v.branche.trim() : "";
  if (!brancheRaw) {
    return { ok: false, error: "Bitte eine Branche wählen." };
  }
  const branche = normalizeReadinessBranche(brancheRaw);
  if (
    !isIdIn<(typeof READINESS_BELEGE)[number]["id"]>(v.belege, BELEGE_IDS)
  ) {
    return { ok: false, error: "Bitte die Belegführung wählen." };
  }
  if (
    !isIdIn<(typeof READINESS_DOKUMENTATION)[number]["id"]>(
      v.dokumentation,
      DOKUMENTATION_IDS,
    )
  ) {
    return { ok: false, error: "Bitte den Stand der Dokumentation wählen." };
  }
  if (!isIdIn<(typeof READINESS_ARCHIV)[number]["id"]>(v.archiv, ARCHIV_IDS)) {
    return { ok: false, error: "Bitte den Archivort wählen." };
  }
  return {
    ok: true,
    answers: {
      name,
      email,
      company,
      branche,
      belege: v.belege,
      dokumentation: v.dokumentation,
      archiv: v.archiv,
    },
  };
}

export function answersFromReadinessLead(
  row: ReadinessLead,
): ReadinessAnswers | null {
  const parsed = parseReadinessAnswers({
    name: row.name,
    email: row.email,
    company: row.company,
    branche: row.branche,
    belege: row.belege,
    dokumentation: row.dokumentation,
    archiv: row.archiv,
  });
  return parsed.ok ? parsed.answers : null;
}

export function readinessPdfFileName(
  row: Pick<ReadinessLead, "company" | "name" | "branche">,
): string {
  const base =
    (row.company || row.name || brancheLabel(row.branche))
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "betrieb";
  return `GoBD-Grundlagen-${base}.pdf`;
}
