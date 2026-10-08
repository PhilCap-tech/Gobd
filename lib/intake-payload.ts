import type { IntakeAnswers } from "@/lib/types";

/**
 * Per free-text field. Tester fixtures use 3_000 and 6_000 characters and must
 * still pass. The cap is generous on purpose; the Sheets cell limit is handled
 * separately by storing the whole answer JSON in Blob.
 */
export const FREITEXT_MAX_CHARS = 12_000;

export const FREITEXT_LIMIT_MESSAGE =
  "Dieser Text ist zu lang. Bitte kürzen Sie ihn auf höchstens 12.000 Zeichen.";

export const DURABLE_STORE_MESSAGE =
  "Ihre Angaben konnten nicht dauerhaft gespeichert werden. Bitte versuchen Sie es erneut.";

export const INTAKE_PAYLOAD_REF_KEY = "__gobdAnswers";

export class DurableStoreError extends Error {
  readonly status = 503;

  constructor(message = DURABLE_STORE_MESSAGE) {
    super(message);
    this.name = "DurableStoreError";
  }
}

export type FreitextOverflow = {
  questionId: string;
  fieldKey: string;
  length: number;
  message: string;
};

export function freitextTooLong(value: string): boolean {
  return value.length > FREITEXT_MAX_CHARS;
}

export function intakePersistenceFailure(
  error: unknown,
): { status: number; error: string } | null {
  if (!error || typeof error !== "object") return null;
  const name = (error as { name?: string }).name;
  if (name === "DurableStoreError" || name === "BlobStorageError") {
    return { status: 503, error: DURABLE_STORE_MESSAGE };
  }
  return null;
}

type IntakePayloadRef = {
  locator: string;
  sha256: string;
};

export function encodeIntakePayloadRef(locator: string, sha256: string): string {
  return JSON.stringify({
    [INTAKE_PAYLOAD_REF_KEY]: locator,
    sha256,
  });
}

/** Pointer cell, or null when the cell still holds the answer JSON itself. */
export function intakePayloadLocator(
  raw: string | undefined | null,
): IntakePayloadRef | null {
  const text = raw?.trim() ?? "";
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if ("katalog" in parsed) return null;
    const locator = parsed[INTAKE_PAYLOAD_REF_KEY];
    if (typeof locator !== "string" || !locator.trim()) return null;
    const sha256 = typeof parsed.sha256 === "string" ? parsed.sha256 : "";
    return { locator: locator.trim(), sha256 };
  } catch {
    return null;
  }
}

function safeSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Private Blob path: one object per document version, under the family prefix. */
export function intakeAnswersBlobPath(
  familyId: string,
  documentId: string,
  version: number,
): string {
  const family = safeSegment(familyId);
  const document = safeSegment(documentId);
  if (!family || !document) {
    throw new DurableStoreError();
  }
  const safeVersion = version > 0 ? version : 1;
  return `gobd/${family}/${document}/v${safeVersion}-answers.json`;
}

function visit(
  questionId: string,
  fieldKey: string,
  value: unknown,
  hits: FreitextOverflow[],
): void {
  if (typeof value === "string") {
    if (value.length > FREITEXT_MAX_CHARS) {
      hits.push({
        questionId,
        fieldKey: fieldKey || questionId,
        length: value.length,
        message: FREITEXT_LIMIT_MESSAGE,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visit(questionId, fieldKey, item, hits);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    visit(questionId, fieldKey || key, child, hits);
  }
}

const TOP_LEVEL_TEXT = [
  "rechtsform",
  "mitarbeitende",
  "weitereSysteme",
  "archiv",
  "hosting",
  "zugriff",
  "gf",
  "buchhaltung",
  "it",
  "steuerberater",
  "bereich",
  "standort",
  "geltung",
  "geltungBelegarten",
  "geltungAusschluss",
  "vorsysteme",
  "seitWann",
  "originalErhalt",
  "anbieterUnterlagen",
  "sichtung",
  "postfach",
  "sichtungWer",
  "sichtungTurnus",
  "papierannahme",
  "scanZweck",
  "scanAufbewahrung",
  "papierlager",
  "erechnungVerfahren",
  "validierung",
  "sachlichePruefung",
  "pruefkriterien",
  "pruefrolle",
  "belegId",
  "rollePruefen",
  "rolleFreigeben",
  "rolleBuchen",
  "rollen",
  "loeschfreigabe",
  "wiederherstellungstest",
  "backupGetestet",
  "kontrollen",
  "dokumentenpflege",
  "anlagenliste",
  "fassungsrahmen",
  "bestaetigungName",
  "bestaetigungDatum",
] as const satisfies readonly (keyof IntakeAnswers)[];

const TOP_LEVEL_LISTS = [
  "branchen",
  "fibu",
  "eingangsbelege",
  "ausgangsrechnungen",
  "backup",
  "formate",
  "systeme",
  "originalJeWeg",
  "kontrollenListe",
] as const satisfies readonly (keyof IntakeAnswers)[];

/** Every free-text value over the cap, including nested repeat rows. */
export function freitextOverflows(answers: IntakeAnswers): FreitextOverflow[] {
  const hits: FreitextOverflow[] = [];
  for (const [id, entry] of Object.entries(answers.katalog ?? {})) {
    if (!entry) continue;
    visit(id, "reason", entry.reason, hits);
    visit(id, "responsible", entry.responsible, hits);
    visit(id, "date", entry.date, hits);
    for (const [key, value] of Object.entries(entry.values ?? {})) {
      visit(id, key, value, hits);
    }
  }
  for (const [id, entry] of Object.entries(answers.fragen ?? {})) {
    if (!entry) continue;
    visit(id, "text", entry.text, hits);
    visit(id, "verantwortung", entry.verantwortung, hits);
  }
  if (answers.module) {
    visit("stammdaten", "", answers.module.stammdaten, hits);
    for (const [id, entry] of Object.entries(answers.module.status ?? {})) {
      visit(id, "", entry, hits);
    }
    visit("module", "branchenArt", answers.module.branchenArt, hits);
    visit("module", "vorlage", answers.module.vorlage, hits);
    visit("module", "software", answers.module.software, hits);
  }
  for (const key of TOP_LEVEL_TEXT) visit(key, key, answers[key], hits);
  for (const key of TOP_LEVEL_LISTS) visit(key, key, answers[key], hits);

  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.questionId}:${hit.fieldKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
