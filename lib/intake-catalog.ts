import catalogFile from "@/content/intake-catalog/INTAKE-CATALOG-MVP-v1.json";
import {
  activityGaps,
  customerPrompt,
  derivedCatalogStatus,
  derivedReason,
  describedActivityLines,
  fieldLabel,
  optionLabel,
  p1FieldError,
  presentationBits,
  projectedBranchen,
  projectedRechtsform,
  RECHTSFORM_FREITEXT,
  statusChoiceVisible,
  TAETIGKEIT_FREITEXT,
  channelExceptionPhrases,
} from "@/lib/intake-present";
import {
  isControlQuestionId,
  isKeineKontrolleValues,
  KEINE_KONTROLLE_SATZ,
} from "@/lib/keine-angaben";
import {
  BELEGFLUSS,
  BEREICHE,
  bereichById,
  bereichChapterId,
  bereichIdOf,
  bereichQuestion,
  ALLGEMEINER_TEIL_IDS,
} from "@/lib/bereiche";
import { kanzleiAbgelehnt } from "@/lib/module/aussagen";
import {
  MODULE,
  gruppenFragen,
  modulQuestion,
} from "@/lib/module/katalog";
import {
  applyStammdatenPrefill,
  CHECK_FRAGEN,
  effectiveModulStatus,
  isGesamt,
  modulStatusError,
  modulZustand,
  STATUS_LABEL as MODUL_STATUS_LABEL,
  toolModules,
} from "@/lib/module/status";
import type { CheckKey } from "@/lib/module/typen";
import {
  FREITEXT_LIMIT_MESSAGE,
  freitextOverflows,
} from "@/lib/intake-payload";
import type { IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";

export const CATALOG_VERSION = catalogFile.version;

export const CATALOG_STATUSES = [
  "bestaetigt",
  "geplant",
  "unbekannt",
  "nicht_zutreffend",
] as const;

/** Chips in the form. „Nicht zutreffend“ is derived from the factual answer. */
export const PROCESS_STATUSES = ["bestaetigt", "geplant", "unbekannt"] as const;

export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

export type CatalogField = {
  key: string;
  type: string;
  label?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  item?: Record<string, string | { type: string; options?: string[] }>;
};

export type CatalogWhen = {
  "C01.kanaeleContainsAny"?: string[];
  "E01.formateContainsAny"?: string[];
  orC01?: string[];
  /** Only for these areas (Bereiche). Absent means every area. */
  bereichIn?: string[];
  /** Not for these areas. */
  bereichNotIn?: string[];
  /** Gesamt only: at least one listed module has status „tool“. */
  modul?: string[];
  /** Only for 24-Module Gesamtdokumente. */
  gesamtOnly?: true;
  /** Only for legacy Bereich documents (not Gesamt). */
  legacyOnly?: true;
  /** Betriebs-Check key must not be „nein“. */
  teil?: CheckKey;
};

export type CatalogQuestion = {
  id: string;
  prompt: string;
  fields: CatalogField[];
  statusRequired?: boolean;
  when?: CatalogWhen;
  note?: string;
  /** Customer-facing hint under the prompt (area questions). `note` stays internal. */
  hint?: string;
  output?: string[];
};

export type CatalogStep = {
  id: string;
  title: string;
  when?: CatalogWhen;
  questions: CatalogQuestion[];
};

export type CatalogQuestionState = {
  status?: CatalogStatus;
  reason?: string;
  responsible?: string;
  date?: string;
  values?: Record<string, unknown>;
};

export type CatalogState = Record<string, CatalogQuestionState>;

type CatalogFile = {
  version: string;
  answerStatuses: string[];
  steps: CatalogStep[];
};

const catalog = catalogFile as CatalogFile;

/** Steps and questions that only describe the Belegfluss. Other areas skip them. */
const BELEGFLUSS_ONLY_STEPS = new Set(["step-C", "step-D", "step-E", "step-F"]);
const BELEGFLUSS_ONLY_QUESTIONS = new Set(["A02"]);

export const BEREICH_STEP_ID = "step-BR";

function onlyBelegfluss(when: CatalogWhen | undefined): CatalogWhen {
  return { ...(when ?? {}), bereichIn: [BELEGFLUSS] };
}

export const BEREICH_RAHMEN_STEP_ID = "step-BR2";
export const BETRIEBS_CHECK_STEP_ID = "step-BC";
export const MODUL_UEBERSICHT_STEP_ID = "step-MO";

/** Special UI steps (no catalog questions; React renders Betriebs-Check / Übersicht). */
export const SPECIAL_STEP_IDS = new Set([BETRIEBS_CHECK_STEP_ID, MODUL_UEBERSICHT_STEP_ID]);

function areaStep(id: string, title: string, rahmen: boolean): CatalogStep {
  return {
    id,
    title,
    when: { bereichNotIn: [BELEGFLUSS] },
    questions: BEREICHE.flatMap((bereich) =>
      bereich.questions
        .filter((question) => Boolean(question.rahmen) === rahmen)
        .map((question) => ({
          id: question.id,
          prompt: question.prompt,
          hint: question.hint,
          fields: question.fields.map((field) => ({ ...field })),
          when: { bereichIn: [bereich.id] },
        })),
    ),
  };
}

/**
 * Two steps with the questions of every non-Belegfluss area; each question is
 * gated by its area. Step 1: area-specific process. Step 2: frame questions
 * (Abgrenzung, Systeme, IKS, Z1–Z3, Änderungen, Ausfall, Archiv).
 */
const BEREICH_STEP: CatalogStep = areaStep(BEREICH_STEP_ID, "Abläufe im Bereich", false);
const BEREICH_RAHMEN_STEP: CatalogStep = areaStep(
  BEREICH_RAHMEN_STEP_ID,
  "Kontrollen, Zugriff und Archiv im Bereich",
  true,
);

function areaQuestionToCatalog(question: {
  id: string;
  prompt: string;
  hint?: string;
  fields: Array<{ key: string; type: string; label?: string; required?: boolean; options?: string[] }>;
}): CatalogQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    hint: question.hint,
    fields: question.fields.map((field) => ({ ...field })),
  };
}

function moduleSteps(): CatalogStep[] {
  return MODULE.map((modul) => ({
    id: `step-M${String(modul.nr).padStart(2, "0")}`,
    title: `Modul ${modul.nr}: ${modul.titel}`,
    when: { gesamtOnly: true, modul: [modul.id] },
    questions: [
      ...modul.catalogIds.map((id) => {
        const source = catalog.steps.flatMap((step) => step.questions).find((q) => q.id === id);
        if (!source) {
          return {
            id,
            prompt: id,
            fields: [],
            when: { gesamtOnly: true, modul: [modul.id] },
          } satisfies CatalogQuestion;
        }
        return {
          ...source,
          when: { ...(source.when ?? {}), gesamtOnly: true as const, modul: [modul.id] },
        };
      }),
      ...modul.gruppen.flatMap((gruppe) =>
        gruppenFragen(gruppe).map((question) => ({
          ...areaQuestionToCatalog(question),
          when: {
            gesamtOnly: true as const,
            modul: [modul.id],
            ...(gruppe.teil ? { teil: gruppe.teil } : {}),
          },
        })),
      ),
    ],
  }));
}

function buildSteps(steps: CatalogStep[]): CatalogStep[] {
  const out: CatalogStep[] = [];
  const betriebsCheck: CatalogStep = {
    id: BETRIEBS_CHECK_STEP_ID,
    title: "Betriebs-Check",
    when: { gesamtOnly: true },
    questions: [],
  };
  const modulUebersicht: CatalogStep = {
    id: MODUL_UEBERSICHT_STEP_ID,
    title: "Module und Status",
    when: { gesamtOnly: true },
    questions: [],
  };
  out.push(betriebsCheck, modulUebersicht);
  for (const step of steps) {
    // Original A–I steps stay for legacy Bereich documents. In Gesamt mode the
    // same questions are asked inside the matching modules (no silent drop).
    const baseWhen: CatalogWhen = {
      ...(BELEGFLUSS_ONLY_STEPS.has(step.id) ? onlyBelegfluss(step.when) : (step.when ?? {})),
      legacyOnly: true,
    };
    const gated: CatalogStep = {
      ...step,
      when: baseWhen,
      questions: step.questions.map((question) => {
        let when = question.when;
        if (BELEGFLUSS_ONLY_QUESTIONS.has(question.id)) when = onlyBelegfluss(when);
        if (question.id === "A02" || question.id === "A03") {
          when = { ...(when ?? {}), legacyOnly: true };
        }
        return when ? { ...question, when } : question;
      }),
    };
    out.push(gated);
    if (step.id === "step-B") {
      out.push(
        { ...BEREICH_STEP, when: { ...(BEREICH_STEP.when ?? {}), legacyOnly: true } },
        { ...BEREICH_RAHMEN_STEP, when: { ...(BEREICH_RAHMEN_STEP.when ?? {}), legacyOnly: true } },
        ...moduleSteps(),
      );
    }
  }
  return out;
}

export const CATALOG_STEPS: CatalogStep[] = buildSteps(catalog.steps);

const PAPER_CHANNEL = "Post/Papier";
const EINVOICE_CHANNEL = "E-Rechnung (XRechnung/ZUGFeRD/XML)";

const STATUS_LABEL: Record<CatalogStatus, string> = {
  bestaetigt: "So läuft es heute",
  geplant: "Soll künftig so laufen",
  unbekannt: "Muss ich klären",
  nicht_zutreffend: "Entfällt",
};

const SUPPRESS: Record<string, string[]> = {
  A01: ["op-company", "op-gf", "op-branchen", "op-rechtsform", "op-mitarbeitende"],
  B01: ["op-fibu", "op-weitere-systeme"],
  B05: ["op-hosting"],
  C01: ["op-eingangsbelege"],
  C02: ["op-c02-sichtung"],
  E02: ["op-erechnung-validierung"],
  E05: ["op-ausgangsrechnungen"],
  F01: ["op-buchhaltung"],
  F05: ["op-f05-kanzlei-umfang", "op-steuerberater"],
  G01: ["op-archiv"],
  G02: ["op-zugriff", "op-berechtigungsliste"],
  G05: ["op-loeschfrist"],
  G06: ["op-backup"],
  H01: ["op-kontrollprotokoll", "op-iks-kontrollen"],
  H04: ["op-backup-test"],
};

const OPEN_TEXT: Record<string, { priority: "hoch" | "mittel" | "niedrig"; text: string; chapter: string }> = {
  A01: {
    priority: "hoch",
    text: "Rechtsträger, Standort und Geschäftsführung sind nicht als gelebte Angabe bestätigt.",
    chapter: "00-cover-freigabe",
  },
  A02: {
    priority: "mittel",
    text: "Geltungsbereich (Belegarten und Ausschlüsse) ist nicht bestätigt.",
    chapter: "01-zweck-geltung",
  },
  A03: {
    priority: "mittel",
    text: "Kasse, Shop, Lager, Lohn oder weitere Vorsysteme sind nicht bestätigt.",
    chapter: "01-zweck-geltung",
  },
  A04: {
    priority: "mittel",
    text: "Seit wann der Ablauf so ausgeführt wird, ist nicht bestätigt. Es wird nicht rückdatiert.",
    chapter: "12-versionspflege",
  },
  B01: {
    priority: "hoch",
    text: "Systeme, die Belege erzeugen oder archivieren, sind nicht bestätigt.",
    chapter: "03-systeme-datenfluss",
  },
  B04: {
    priority: "mittel",
    text: "Welche Dateien als Original aufbewahrt werden, ist nicht bestätigt.",
    chapter: "03-systeme-datenfluss",
  },
  B05: {
    priority: "mittel",
    text: "Unterlagen zu externen Systemen oder Anbietern sind nicht bestätigt.",
    chapter: "13-mitgeltende-unterlagen",
  },
  C01: {
    priority: "hoch",
    text: "Eingangswege sind nicht bestätigt.",
    chapter: "04-belegarten-kanaele",
  },
  C02: {
    priority: "mittel",
    text: "Sichtungsturnus der Eingangsbelege (Postfach oder Portal, wer, wie oft) ist nicht bestätigt.",
    chapter: "05-eingang-erechnung",
  },
  C03: {
    priority: "mittel",
    text: "Wer Papier entgegennimmt und wohin es gelangt, ist nicht bestätigt.",
    chapter: "06-papier-digitalisierung",
  },
  D01: {
    priority: "hoch",
    text: "Ob Papier gescannt wird und zu welchem Zweck, ist nicht bestätigt.",
    chapter: "06-papier-digitalisierung",
  },
  E01: {
    priority: "mittel",
    text: "Empfangene Rechnungsformate sind nicht bestätigt. PDF ist damit keine strukturierte E-Rechnung.",
    chapter: "05-eingang-erechnung",
  },
  E02: {
    priority: "hoch",
    text: "Empfang, Prüfung und Aufbewahrung des strukturierten Teils einer E-Rechnung sind nicht bestätigt.",
    chapter: "05-eingang-erechnung",
  },
  E03: {
    priority: "mittel",
    text: "Wer die sachliche Prüfung vor der Freigabe macht, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
  },
  E05: {
    priority: "mittel",
    text: "System und Nummernkreis der Ausgangsrechnungen sind nicht bestätigt.",
    chapter: "07-ausgangsrechnungen",
  },
  F01: {
    priority: "hoch",
    text: "Wer prüft, freigibt und bucht, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
  },
  F02: {
    priority: "mittel",
    text: "Welche Beleg-ID Original, Freigabe und Buchung verbindet, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
  },
  F05: {
    priority: "mittel",
    text: "Leistungsumfang der Kanzlei ist nicht bestätigt. Eine Verbuchung wird nicht als gelebter Prozess angenommen.",
    chapter: "08-freigabe-buchung-status",
  },
  G01: {
    priority: "hoch",
    text: "Ablageort und Suchmerkmale sind nicht bestätigt.",
    chapter: "09-ablage-aufbewahrung",
  },
  G02: {
    priority: "hoch",
    text: "Wer einsehen, ändern oder löschen darf, ist nicht bestätigt.",
    chapter: "10-berechtigungen-sicherung",
  },
  G05: {
    priority: "mittel",
    text: "Wer Fristen zuordnet und eine Löschung freigibt, ist nicht als gelebte Praxis bestätigt.",
    chapter: "09-ablage-aufbewahrung",
  },
  G06: {
    priority: "hoch",
    text: "Sicherung ist nicht bestätigt.",
    chapter: "10-berechtigungen-sicherung",
  },
  H01: {
    priority: "mittel",
    text: "Welche Kontrollen tatsächlich laufen, von wem und in welchem Turnus, ist nicht bestätigt.",
    chapter: "11-iks",
  },
  H04: {
    priority: "hoch",
    text: "Ein dokumentierter Wiederherstellungs- oder Exporttest liegt nicht vor.",
    chapter: "10-berechtigungen-sicherung",
  },
  I01: {
    priority: "mittel",
    text: "Wer die Dokumentation pflegt und wann eine neue Fassung entsteht, ist nicht bestätigt.",
    chapter: "12-versionspflege",
  },
  I02: {
    priority: "mittel",
    text: "Die Liste mitgeltender Unterlagen ist nicht bestätigt.",
    chapter: "13-mitgeltende-unterlagen",
  },
  I04: {
    priority: "hoch",
    text: "Die betriebliche Bestätigung (Name und Datum) liegt nicht vor. Sie wird nicht automatisch eingetragen.",
    chapter: "00-cover-freigabe",
  },
  I05: {
    priority: "niedrig",
    text: "Gültigkeitszeitraum dieser Fassung und der Ablageort älterer Fassungen sind nicht bestätigt.",
    chapter: "12-versionspflege",
  },
};

export type CatalogOpenPoint = {
  id: string;
  priority: "hoch" | "mittel" | "niedrig";
  text: string;
  chapter: string;
  suppress: string[];
};

export function catalogState(answers: IntakeAnswers): CatalogState {
  return answers.katalog ?? {};
}

export function hasCatalogAnswers(answers: IntakeAnswers): boolean {
  return Object.values(catalogState(answers)).some((entry) => Boolean(entry?.status));
}

function valuesOf(state: CatalogState, id: string): Record<string, unknown> {
  return state[id]?.values ?? {};
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
}

function systemCardDetail(row: Record<string, unknown>): string {
  const belege = asList(row.belegeRein);
  return [
    asText(row.nutzer) && `Nutzer: ${asText(row.nutzer)}`,
    belege.length ? `Belege: ${belege.join(", ")}` : "",
    asText(row.uebergabe) && `Übergabe: ${asText(row.uebergabe)}`,
    asText(row.originalOrt) && `Original: ${asText(row.originalOrt)}`,
    asText(row.hostingArt) && `Hosting: ${asText(row.hostingArt)}`,
  ]
    .filter(Boolean)
    .join("; ");
}

function providerDocLine(row: Record<string, unknown>): string {
  const stand = row.unterlagenStand as Record<string, string> | undefined;
  const named = stand
    ? Object.entries(stand)
        .filter(([, value]) => asText(value))
        .map(([name, value]) => `${name}: ${optionLabel("status", value)}`)
    : [];
  if (named.length) return `${asText(row.name)}: ${named.join(", ")}`;
  return `${asText(row.name)}: ${optionLabel("unterlagenVorhanden", asText(row.unterlagenVorhanden))}`;
}

function kanaeleOf(state: CatalogState): string[] {
  return asList(valuesOf(state, "C01").kanaele);
}

function formateOf(state: CatalogState): string[] {
  return asList(valuesOf(state, "E01").formate);
}

function bereichMatches(when: CatalogWhen | undefined, bereich: string): boolean {
  if (!when) return true;
  if (when.bereichIn && !when.bereichIn.includes(bereich)) return false;
  if (when.bereichNotIn && when.bereichNotIn.includes(bereich)) return false;
  return true;
}

function modeMatches(when: CatalogWhen | undefined, answers: IntakeAnswers): boolean {
  if (!when) return true;
  const gesamt = isGesamt(answers);
  if (when.gesamtOnly && !gesamt) return false;
  if (when.legacyOnly && gesamt) return false;
  return true;
}

function modulMatches(when: CatalogWhen | undefined, answers: IntakeAnswers): boolean {
  if (!when?.modul?.length) return true;
  if (!isGesamt(answers)) return false;
  return when.modul.some((id) => effectiveModulStatus(answers, id).status === "tool");
}

function teilMatches(when: CatalogWhen | undefined, answers: IntakeAnswers): boolean {
  if (!when?.teil) return true;
  if (!isGesamt(answers)) return true;
  return modulZustand(answers).check[when.teil] !== "nein";
}

function whenMatches(
  when: CatalogWhen | undefined,
  state: CatalogState,
  bereich: string,
  answers?: IntakeAnswers,
): boolean {
  if (!when) return true;
  if (answers && !modeMatches(when, answers)) return false;
  if (answers && !modulMatches(when, answers)) return false;
  if (answers && !teilMatches(when, answers)) return false;
  if (!bereichMatches(when, bereich)) return false;
  const channels = kanaeleOf(state);
  const formats = formateOf(state);
  const channelTokens = when["C01.kanaeleContainsAny"];
  if (channelTokens && !channelTokens.some((token) => channels.includes(token))) return false;
  if (when["E01.formateContainsAny"] || when.orC01) {
    const formatHit = (when["E01.formateContainsAny"] ?? []).some((token) => formats.includes(token));
    const channelHit = (when.orC01 ?? []).some((token) => channels.includes(token));
    if (!formatHit && !channelHit) return false;
  }
  return true;
}

export function catalogQuestionApplies(question: CatalogQuestion, answers: IntakeAnswers): boolean {
  // In Gesamt mode, Belegfluss-only gating is ignored for catalog questions that
  // a module reuses (modules declare their own modul gate).
  const bereich = isGesamt(answers) ? BELEGFLUSS : bereichIdOf(answers);
  return whenMatches(question.when, catalogState(answers), bereich, answers);
}

export function catalogStepApplies(step: CatalogStep, answers: IntakeAnswers): boolean {
  const bereich = isGesamt(answers) ? BELEGFLUSS : bereichIdOf(answers);
  if (!whenMatches(step.when, catalogState(answers), bereich, answers)) return false;
  if (SPECIAL_STEP_IDS.has(step.id)) return true;
  return step.questions.some((question) => catalogQuestionApplies(question, answers));
}

export function visibleCatalogQuestions(stepIndex: number, answers: IntakeAnswers): CatalogQuestion[] {
  const step = CATALOG_STEPS[stepIndex];
  if (!step || !catalogStepApplies(step, answers)) return [];
  return step.questions.filter((question) => catalogQuestionApplies(question, answers));
}

export function nextApplicableStep(from: number, answers: IntakeAnswers): number {
  for (let index = from + 1; index < CATALOG_STEPS.length; index += 1) {
    if (catalogStepApplies(CATALOG_STEPS[index], answers)) return index;
  }
  return CATALOG_STEPS.length;
}

export function previousApplicableStep(from: number, answers: IntakeAnswers): number {
  for (let index = from - 1; index >= 0; index -= 1) {
    if (catalogStepApplies(CATALOG_STEPS[index], answers)) return index;
  }
  return 0;
}

/** „Schritt k von n“ counted over the steps of the chosen area (branch steps like Papier stay counted). */
export function catalogStepPosition(stepIndex: number, answers: IntakeAnswers): { index: number; total: number } {
  const applicable = CATALOG_STEPS.map((step, index) => ({ step, index })).filter(({ step }) =>
    catalogStepApplies(step, answers) || SPECIAL_STEP_IDS.has(step.id) && isGesamt(answers) && modeMatches(step.when, answers),
  );
  // Prefer counting steps that can appear for this mode (even if later gated by answers).
  const bereich = isGesamt(answers) ? BELEGFLUSS : bereichIdOf(answers);
  const inMode = CATALOG_STEPS.map((step, index) => ({ step, index })).filter(({ step }) =>
    modeMatches(step.when, answers) && bereichMatches(step.when, bereich) && (!step.when?.modul || isGesamt(answers)),
  );
  const list = isGesamt(answers) ? inMode : inMode.filter(({ step }) => bereichMatches(step.when, bereich));
  const position = list.findIndex(({ index }) => index === stepIndex);
  return { index: position < 0 ? stepIndex : position, total: list.length || applicable.length };
}

/** Area-aware step title. The area step carries the area label. */
export function catalogStepTitle(stepIndex: number, answers: IntakeAnswers): string {
  const step = CATALOG_STEPS[stepIndex];
  if (!step) return "";
  if (step.id === BEREICH_STEP_ID) return `${bereichById(bereichIdOf(answers)).titel}: Abläufe`;
  if (step.id === BEREICH_RAHMEN_STEP_ID) {
    return `${bereichById(bereichIdOf(answers)).label}: Kontrollen, Zugriff und Archiv`;
  }
  if (step.id === BETRIEBS_CHECK_STEP_ID) return "Betriebs-Check: Welche Bereiche gibt es?";
  if (step.id === MODUL_UEBERSICHT_STEP_ID) return "Module und Dokumentationsstatus";
  return step.title;
}

/** True when forward navigation jumped over the paper/scan step because it does not apply. */
export function paperStepSkipped(from: number, to: number, answers: IntakeAnswers): boolean {
  const paper = CATALOG_STEPS.findIndex((step) => step.id === "step-D");
  if (paper < 0 || !(from < paper && to > paper)) return false;
  return !catalogStepApplies(CATALOG_STEPS[paper], answers);
}

function filled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0 && value.some((item) => filled(item));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => filled(item));
  }
  return Boolean(asText(value));
}

function fieldIsRequired(field: CatalogField): boolean {
  if (field.required === false) return false;
  if (field.type === "repeat") return (field.min ?? 1) > 0;
  return true;
}

function repeatReady(field: CatalogField, value: unknown): boolean {
  const min = field.min ?? 1;
  const rows = asRows(value).filter((row) =>
    Object.entries(field.item ?? {}).every(([key, spec]) => {
      const type = typeof spec === "string" ? spec : spec.type;
      if (type === "text") return Boolean(asText(row[key]));
      return filled(row[key]);
    }),
  );
  return rows.length >= min;
}

function fieldReady(field: CatalogField, value: unknown): boolean {
  if (!fieldIsRequired(field)) return true;
  if (field.type === "repeat") return repeatReady(field, value);
  if (field.type === "boolean") return value === true;
  if (field.type === "multi" || field.type === "multi_or_text") return asList(value).length > 0 || Boolean(asText(value));
  return filled(value);
}

/** One missing control on the current intake step. Anchors match the form ids. */
export type CatalogIssue = {
  questionId: string;
  fieldKey: string;
  anchor: string;
  focusId: string;
  message: string;
};

function catalogIssue(
  questionId: string,
  fieldKey: string,
  message: string,
  focusId?: string,
): CatalogIssue {
  const anchor = fieldKey === "block" ? `angabe-${questionId}` : `angabe-${questionId}-${fieldKey}`;
  return { questionId, fieldKey, anchor, focusId: focusId ?? anchor, message };
}

function choiceField(field: CatalogField): boolean {
  if (field.key === "branchen") return true;
  if (field.type === "enum" || field.type === "repeat") return true;
  if ((field.type === "multi" || field.type === "multi_or_text") && field.options?.length) return true;
  return false;
}

function missingFieldMessage(question: CatalogQuestion, field: CatalogField): string {
  const label = fieldLabel(question.id, field.key, field.label);
  if (question.id === "A04" && field.key === "gueltigAb") {
    return "Bitte das Datum ausfüllen: Seit wann läuft der beschriebene Ablauf so?";
  }
  if (question.id === "A04" && field.key === "keineRueckdatierungBestaetigt") {
    return `Bitte die Bestätigung ankreuzen: ${label}`;
  }
  if (field.type === "boolean") return `Bitte die Bestätigung ankreuzen: ${label}`;
  if (field.type === "date") return `Bitte das Datum ausfüllen: ${label}`;
  if (field.type === "enum" || field.type === "multi" || field.type === "multi_or_text") {
    return `Bitte auswählen: ${label}`;
  }
  return `Bitte ausfüllen: ${label}`;
}

function fieldIssue(question: CatalogQuestion, field: CatalogField): CatalogIssue {
  const anchor = `angabe-${question.id}-${field.key}`;
  const focusId = choiceField(field) ? anchor : `${question.id}-${field.key}`;
  return catalogIssue(question.id, field.key, missingFieldMessage(question, field), focusId);
}

function missingStatusMessage(question: CatalogQuestion): string {
  if (question.id === "A03") {
    return "Bitte für Kasse, Shop, Lager, Lohn und Plattformen jeweils angeben, ob es das gibt.";
  }
  if (question.id === "H04") {
    return "Bitte angeben, ob eine Wiederherstellung oder ein Export geprüft wurde.";
  }
  if (question.id === "B05") return "Bitte angeben, ob Systeme bei einem Anbieter liegen.";
  if (question.id === "F05") return "Bitte angeben, ob eine Kanzlei beteiligt ist.";
  if (question.id === "A04") {
    return "Bitte den Stand wählen: ob der Ablauf heute so läuft, künftig so laufen soll oder noch zu klären ist. Datum und die Bestätigung „Verstanden…“ sind erst Pflicht, wenn der Ablauf als heutige oder künftige Praxis gilt.";
  }
  return "Bitte angeben, ob das heute so läuft, künftig so laufen soll oder noch zu klären ist.";
}

function extraFieldIssues(id: string, entry: CatalogQuestionState): CatalogIssue[] {
  const values = entry.values ?? {};
  const issues: CatalogIssue[] = [];
  if (id === "A01" && (entry.status === "bestaetigt" || entry.status === "geplant")) {
    if (asText(values.rechtsform) === RECHTSFORM_FREITEXT && !asText(values.rechtsformFreitext)) {
      issues.push(
        catalogIssue(
          "A01",
          "rechtsformFreitext",
          "Bitte die Rechtsform kurz benennen.",
          "a01-rechtsform-frei",
        ),
      );
    }
    if (asList(values.branchen).includes(TAETIGKEIT_FREITEXT) && !asText(values.branchenFreitext)) {
      issues.push(
        catalogIssue(
          "A01",
          "branchenFreitext",
          "Bitte die sonstige Tätigkeit kurz benennen.",
          "a01-taetigkeit-frei",
        ),
      );
    }
  }
  if (id === "A02" && entry.status && entry.status !== "nicht_zutreffend") {
    const excluded = asList(values.ausgeschlossen);
    const shopOut = excluded.includes("Shop");
    const anyOut = excluded.length > 0 || Boolean(asText(values.ausgeschlossenSonstiges));
    const where = asText(values.ausgeschlossenWo);
    if (shopOut && !where) {
      issues.push(
        catalogIssue(
          "A02",
          "ausgeschlossenWo",
          "Bitte angeben, wo der Shop dokumentiert ist. Ausgeschlossen heißt nicht, dass der Vorgang undokumentiert bleibt.",
          "a02-wo",
        ),
      );
    } else if (anyOut && !where && (entry.status === "bestaetigt" || entry.status === "geplant")) {
      issues.push(
        catalogIssue(
          "A02",
          "ausgeschlossenWo",
          "Bitte angeben, wo die ausgenommenen Vorgänge dokumentiert sind.",
          "a02-wo",
        ),
      );
    }
  }
  return issues;
}

function questionIssues(
  question: CatalogQuestion,
  entry: CatalogQuestionState | undefined,
  answers: IntakeAnswers,
): CatalogIssue[] {
  const values = entry?.values ?? {};
  if (!entry?.status) {
    if (question.id === "A03") {
      const missing = question.fields
        .filter((field) => !fieldReady(field, values[field.key]))
        .map((field) => fieldIssue(question, field));
      if (missing.length) return missing;
    }
    const showChips = statusChoiceVisible(question.id, values);
    return [
      catalogIssue(
        question.id,
        "status",
        missingStatusMessage(question),
        showChips ? `${question.id}-status` : `angabe-${question.id}`,
      ),
    ];
  }
  if (entry.status === "nicht_zutreffend" && !asText(entry.reason)) {
    return [catalogIssue(question.id, "block", "Bitte kurz sagen, warum das entfällt.")];
  }
  const issues: CatalogIssue[] = [];
  if (entry.status === "bestaetigt" || entry.status === "geplant") {
    const channels = asList(valuesOf(catalogState(answers), "C01").kanaele);
    const p1 = p1FieldError(question.id, entry.status, values, channels);
    const keineKontrolle = isControlQuestionId(question.id) && isKeineKontrolleValues(values);
    if (p1) {
      issues.push(catalogIssue(question.id, "block", p1));
    } else if (!keineKontrolle) {
      for (const field of question.fields) {
        if (!fieldReady(field, values[field.key])) issues.push(fieldIssue(question, field));
      }
    }
  }
  issues.push(...extraFieldIssues(question.id, entry));
  return issues;
}

function betriebsCheckIssues(answers: IntakeAnswers): CatalogIssue[] {
  const check = modulZustand(answers).check;
  return CHECK_FRAGEN.filter((frage) => {
    const value = check[frage.key];
    return value !== "ja" && value !== "nein" && value !== "unbekannt";
  }).map((frage) => {
    const anchor = `check-${frage.key}`;
    return { ...catalogIssue("betriebs-check", frage.key, `Bitte für „${frage.label}“ ja, nein oder weiß ich nicht angeben.`, anchor), anchor };
  });
}

function modulUebersichtIssues(answers: IntakeAnswers): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  for (const modul of MODULE) {
    const message = modulStatusError(answers, modul.id);
    if (!message) continue;
    const anchor = `modul-${modul.id}`;
    issues.push({
      ...catalogIssue(modul.id, "status", message, `modul-${modul.id}-status`),
      anchor,
    });
  }
  if (!issues.length && !toolModules(answers).length) {
    const anchor = "modul-uebersicht";
    issues.push({
      ...catalogIssue(
        "module",
        "block",
        "Mindestens ein Modul muss den Status „Im Tool beschreiben“ haben (Kernmodule sind immer aktiv).",
        anchor,
      ),
      anchor,
    });
  }
  return issues;
}

function dedupeCatalogIssues(issues: CatalogIssue[]): CatalogIssue[] {
  const seen = new Set<string>();
  const out: CatalogIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.questionId}:${issue.fieldKey}:${issue.anchor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

/** Free-text overflows on this step. Empty when the step does not apply. */
export function freitextIssuesForStep(
  stepIndex: number,
  answers: IntakeAnswers,
): CatalogIssue[] {
  const step = CATALOG_STEPS[stepIndex];
  if (!step || !catalogStepApplies(step, answers)) return [];
  const questionIds = new Set(step.questions.map((question) => question.id));
  const seen = new Set<string>();
  const issues: CatalogIssue[] = [];
  for (const hit of freitextOverflows(answers)) {
    const onQuestion = questionIds.has(hit.questionId);
    const onStamm = step.id === BETRIEBS_CHECK_STEP_ID && hit.questionId === "stammdaten";
    const onModul =
      step.id === MODUL_UEBERSICHT_STEP_ID && /^m\d{2}$/.test(hit.questionId);
    if (!onQuestion && !onStamm && !onModul) continue;
    const key = `${hit.questionId}:${hit.fieldKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const anchor = onStamm
      ? `stamm-${hit.fieldKey}`
      : onModul
        ? `modul-${hit.questionId}-${hit.fieldKey}`
        : `angabe-${hit.questionId}-${hit.fieldKey}`;
    const focusId = onStamm
      ? `stamm-${hit.fieldKey}`
      : onModul
        ? `modul-${hit.questionId}-${hit.fieldKey}`
        : `${hit.questionId}-${hit.fieldKey}`;
    issues.push({
      ...catalogIssue(hit.questionId, hit.fieldKey, hit.message, focusId),
      anchor,
    });
  }
  return issues;
}

/** First step that still has a free-text overflow, for the submit guard. */
export function firstFreitextIssue(
  answers: IntakeAnswers,
): { step: number; issue: CatalogIssue } | null {
  for (let index = 0; index < CATALOG_STEPS.length; index += 1) {
    const issue = freitextIssuesForStep(index, answers)[0];
    if (issue) return { step: index, issue };
  }
  const leftover = freitextOverflows(answers)[0];
  if (!leftover) return null;
  return {
    step: 0,
    issue: catalogIssue(leftover.questionId, leftover.fieldKey, leftover.message),
  };
}

/**
 * Length messages stay visible while typing. Other gaps appear after Weiter.
 */
export function intakeFormIssues(
  stepIndex: number,
  answers: IntakeAnswers,
  showGaps: boolean,
): CatalogIssue[] {
  const lengthIssues = freitextIssuesForStep(stepIndex, answers);
  if (!showGaps) return lengthIssues;
  const rest = catalogStepIssues(stepIndex, answers).filter(
    (issue) => issue.message !== FREITEXT_LIMIT_MESSAGE,
  );
  return dedupeCatalogIssues([...lengthIssues, ...rest]);
}

/** Every open control on this step, in page order. Empty when the step can continue. */
export function catalogStepIssues(stepIndex: number, answers: IntakeAnswers): CatalogIssue[] {
  const step = CATALOG_STEPS[stepIndex];
  if (!step || !catalogStepApplies(step, answers)) return [];
  const lengthIssues = freitextIssuesForStep(stepIndex, answers);
  if (step.id === BETRIEBS_CHECK_STEP_ID) {
    return dedupeCatalogIssues([...lengthIssues, ...betriebsCheckIssues(answers)]);
  }
  if (step.id === MODUL_UEBERSICHT_STEP_ID) {
    return dedupeCatalogIssues([...lengthIssues, ...modulUebersichtIssues(answers)]);
  }
  const state = catalogState(answers);
  const issues: CatalogIssue[] = [];
  for (const question of visibleCatalogQuestions(stepIndex, answers)) {
    issues.push(...questionIssues(question, state[question.id], answers));
  }
  return dedupeCatalogIssues([...lengthIssues, ...issues]);
}

export function catalogStepError(stepIndex: number, answers: IntakeAnswers): string {
  return catalogStepIssues(stepIndex, answers)[0]?.message ?? "";
}

function touch(
  answers: IntakeAnswers,
  id: string,
  patch: CatalogQuestionState,
): IntakeAnswers {
  const current = catalogState(answers)[id] ?? {};
  return {
    ...answers,
    katalog: {
      ...catalogState(answers),
      [id]: {
        ...current,
        ...patch,
        values: patch.values ?? current.values ?? {},
      },
    },
  };
}

export function setCatalogStatus(
  answers: IntakeAnswers,
  id: string,
  status: CatalogStatus,
): IntakeAnswers {
  return touch(answers, id, { status });
}

export function setCatalogReason(answers: IntakeAnswers, id: string, reason: string): IntakeAnswers {
  return touch(answers, id, { reason });
}

export function setCatalogMeta(
  answers: IntakeAnswers,
  id: string,
  meta: { responsible?: string; date?: string },
): IntakeAnswers {
  return touch(answers, id, meta);
}

export function setCatalogValue(
  answers: IntakeAnswers,
  id: string,
  key: string,
  value: unknown,
): IntakeAnswers {
  const current = catalogState(answers)[id] ?? {};
  return touch(answers, id, {
    values: { ...(current.values ?? {}), [key]: value },
  });
}

export function setCatalogValues(
  answers: IntakeAnswers,
  id: string,
  values: Record<string, unknown>,
): IntakeAnswers {
  const current = catalogState(answers)[id] ?? {};
  return touch(answers, id, {
    values: { ...(current.values ?? {}), ...values },
  });
}

export function clearCatalogStatus(answers: IntakeAnswers, id: string): IntakeAnswers {
  const current = catalogState(answers)[id] ?? {};
  const nextEntry: CatalogQuestionState = { values: current.values ?? {} };
  if (current.responsible) nextEntry.responsible = current.responsible;
  if (current.date) nextEntry.date = current.date;
  return {
    ...answers,
    katalog: { ...catalogState(answers), [id]: nextEntry },
  };
}

/** Writes a status that follows from the factual answer. Leaves chosen process statuses untouched. */
export function applyDerivedStatus(answers: IntakeAnswers, id: string): IntakeAnswers {
  const values = catalogState(answers)[id]?.values ?? {};
  const derived = derivedCatalogStatus(id, values);
  if (!derived) return answers;
  let next = setCatalogStatus(answers, id, derived);
  next = setCatalogReason(next, id, derived === "nicht_zutreffend" ? derivedReason(id) : "");
  return next;
}

function live(state: CatalogState, id: string): boolean {
  return state[id]?.status === "bestaetigt";
}

function completeControls(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter(
    (row) => asText(row.name) && asText(row.turnus) && asText(row.wer) && asText(row.nachweis),
  );
}

/**
 * Catalog statuses win. Only `bestaetigt` becomes a lived generator field.
 * `geplant`, `unbekannt` and `nicht_zutreffend` do not. A04/I05 dates never
 * become the document's Gültig-ab. I04 never confirms the cover.
 */
export function projectCatalogAnswers(answers: IntakeAnswers): IntakeAnswers {
  const state = catalogState(answers);
  const next = emptyAnswers();
  if (answers.bereich) next.bereich = answers.bereich;
  if (answers.module) next.module = answers.module;
  if (live(state, "A01")) {
    const values = valuesOf(state, "A01");
    next.branchen = projectedBranchen(values);
    next.rechtsform = projectedRechtsform(values);
    next.mitarbeitende = asText(values.mitarbeitende);
    next.gf = asText(values.gf);
    next.standort = asText(values.standort);
  }
  if (live(state, "A02")) {
    const values = valuesOf(state, "A02");
    const scope = asList(values.belegartenScope);
    const excluded = [...asList(values.ausgeschlossen), asText(values.ausgeschlossenSonstiges)].filter(Boolean);
    const where = asText(values.ausgeschlossenWo);
    next.geltungBelegarten = scope.join(", ");
    next.geltungAusschluss = excluded.length
      ? `${excluded.join(", ")}${where ? ` (dokumentiert in: ${where})` : ""}`
      : "";
    next.geltung = [
      scope.length ? `Belegarten: ${scope.join(", ")}` : "",
      excluded.length
        ? `Ausschlüsse: ${excluded.join(", ")}${where ? ` (dokumentiert in: ${where})` : ""}`
        : "",
    ]
      .filter(Boolean)
      .join(". ");
  }
  if (live(state, "A03")) {
    const values = valuesOf(state, "A03");
    const labels: Record<string, string> = {
      kasse: "Kasse",
      shop: "Shop",
      lager: "Lager",
      lohn: "Lohn",
      plattformen: "Plattformen",
    };
    const ja = Object.keys(labels).filter((key) => values[key] === "ja").map((key) => labels[key]);
    const allNein = Object.keys(labels).every((key) => values[key] === "nein");
    next.vorsysteme = ja.length ? ja.join(", ") : allNein ? "Keine weiteren" : "";
    const hint = asText(values.hinweis);
    if (hint && next.vorsysteme) next.vorsysteme = `${next.vorsysteme}. ${hint}`;
  }
  if (live(state, "A01")) {
    const lines = describedActivityLines(valuesOf(state, "A01"));
    if (lines.length) {
      const base = next.vorsysteme === "Keine weiteren" ? "" : next.vorsysteme;
      next.vorsysteme = [base, ...lines].filter(Boolean).join(". ");
    }
  }
  if (live(state, "A04") && valuesOf(state, "A04").keineRueckdatierungBestaetigt === true) {
    next.seitWann = asText(valuesOf(state, "A04").gueltigAb);
  }
  if (live(state, "B01")) {
    const values = valuesOf(state, "B01");
    const systems = asRows(values.systeme);
    next.fibu = systems
      .filter((row) => asText(row.typ) === "fibu")
      .map((row) => asText(row.name))
      .filter(Boolean);
    const rest = systems
      .filter((row) => asText(row.typ) !== "fibu")
      .map((row) => [asText(row.name), asText(row.funktion)].filter(Boolean).join(" — "))
      .filter(Boolean);
    next.weitereSysteme = [...rest, asText(values.weitereFreitext)].filter(Boolean).join("; ");
    next.hosting = asText(values.hosting);
    next.it = asText(values.it);
    next.systeme = systems.map((row) => ({
      name: asText(row.name),
      funktion: [asText(row.funktion), systemCardDetail(row)].filter(Boolean).join(" — "),
    }));
  }
  if (live(state, "B04")) {
    const rows = asRows(valuesOf(state, "B04").originalJeWeg).filter(
      (row) => asText(row.belegweg) && asText(row.originalBeschreibung),
    );
    next.originalErhalt = rows
      .map((row) => `${asText(row.belegweg)}: ${asText(row.originalBeschreibung)}`)
      .join("; ");
    next.originalJeWeg = rows.map((row) => ({
      weg: asText(row.belegweg),
      original: asText(row.originalBeschreibung),
    }));
  }
  if (live(state, "B05")) {
    next.anbieterUnterlagen = asRows(valuesOf(state, "B05").externeSysteme)
      .filter((row) => asText(row.name))
      .map((row) => providerDocLine(row))
      .join("; ");
  }
  if (live(state, "C01")) {
    next.eingangsbelege = kanaeleOf(state);
  }
  if (live(state, "C02")) {
    const values = valuesOf(state, "C02");
    next.postfach = asText(values.postfachOderPortal);
    next.sichtungWer = asText(values.wer);
    next.sichtungTurnus = asText(values.turnus);
    next.sichtung = [next.postfach, next.sichtungWer, next.sichtungTurnus].filter(Boolean).join(", ");
    const ausnahmen = channelExceptionPhrases(values);
    if (ausnahmen.length) next.sichtung = [next.sichtung, ...ausnahmen].filter(Boolean).join(". ");
  }
  if (live(state, "C03")) {
    next.papierannahme = asText(valuesOf(state, "C03").schritte);
  }
  if (live(state, "D01")) {
    const values = valuesOf(state, "D01");
    const zweck = asText(values.scanZweck);
    next.scanZweck =
      zweck === "nein" ? "nein, kein Scan" : zweck === "ersetzend" ? "ersetzendes Scannen" : zweck;
    const eingang = asText(values.eingang);
    if (eingang) next.papierannahme = [next.papierannahme, eingang].filter(Boolean).join(". ");
    const original = asText(values.originalVerbleib);
    if (original) next.papierlager = original;
    const scanDetail = [asText(values.scanZeitpunkt), asText(values.vollstaendigkeit), asText(values.verantwortlich)]
      .filter(Boolean)
      .join(". ");
    if (scanDetail) next.scanAufbewahrung = scanDetail;
  }
  if (live(state, "E01")) {
    next.formate = formateOf(state);
  }
  if (live(state, "E02")) {
    const values = valuesOf(state, "E02");
    const validierung = asText(values.validierung);
    const ablauf = asText(values.ablauf);
    if (validierung === "ja_bestaetigt") {
      next.validierung = "ja";
      next.erechnungVerfahren = [ablauf, "Technische Validierung: ja."].filter(Boolean).join(" ");
    } else if (validierung === "nein") {
      next.validierung = "nein";
      next.erechnungVerfahren = [ablauf, "Technische Validierung: nein."].filter(Boolean).join(" ");
    }
  }
  if (live(state, "E03")) {
    const values = valuesOf(state, "E03");
    next.pruefrolle = asText(values.pruefer);
    next.pruefkriterien = asText(values.kriterien);
    next.sachlichePruefung = [next.pruefkriterien, next.pruefrolle].filter(Boolean).join(" — ");
  }
  if (live(state, "E05")) {
    const values = valuesOf(state, "E05");
    next.ausgangsrechnungen = asList(values.systeme);
    const who = asText(values.wer);
    const numbers = asText(values.nummernvergabe);
    const outgoing = [
      who,
      numbers,
      asText(values.freigabe) && `Freigabe: ${asText(values.freigabe)}`,
      asText(values.versand) && `Versand: ${asText(values.versand)}`,
      asText(values.storno) && `Korrektur: ${asText(values.storno)}`,
    ].filter(Boolean);
    if (outgoing.length) {
      next.fassungsrahmen = [next.fassungsrahmen, ...outgoing].filter(Boolean).join(". ");
    }
  }
  if (live(state, "F01")) {
    const values = valuesOf(state, "F01");
    next.rollePruefen = asText(values.sachlich);
    next.rolleFreigeben = asText(values.freigabe);
    next.rolleBuchen = asText(values.buchung);
    next.buchhaltung = asText(values.buchhaltung) || next.rolleBuchen;
    if (next.rollePruefen || next.rolleFreigeben || next.rolleBuchen) {
      next.rollen = `Prüfen: ${next.rollePruefen}. Freigeben: ${next.rolleFreigeben}. Buchen: ${next.rolleBuchen}.`;
    }
  }
  if (live(state, "F02")) {
    next.belegId = asText(valuesOf(state, "F02").belegIdBeschreibung);
  }
  if (live(state, "F05")) {
    const values = valuesOf(state, "F05");
    if (asText(values.nachweisVorhanden) === "ja" && asText(values.kanzleiName) && asText(values.leistungsumfang)) {
      next.steuerberater = `${asText(values.kanzleiName)}: ${asText(values.leistungsumfang)}`;
    }
  }
  if (live(state, "G01")) {
    const values = valuesOf(state, "G01");
    const rows = asRows(values.ablageJeArt).filter((row) => asText(row.art) || asText(row.ort));
    next.archiv = rows.length
      ? rows
          .map((row) =>
            [asText(row.art), asText(row.ort), asText(row.suche) && `Suche: ${asText(row.suche)}`]
              .filter(Boolean)
              .join(", "),
          )
          .join("; ")
      : [asText(values.ablage), asText(values.ordnung)].filter(Boolean).join(" — ");
  }
  if (live(state, "G02")) {
    const values = valuesOf(state, "G02");
    const rows = asRows(values.zugriffRollen).filter((row) => asList(row.rechte).length);
    next.zugriff = rows.length
      ? rows.map((row) => `${asText(row.rolle)}: ${asList(row.rechte).join(", ")}`).join(". ")
      : asText(values.zugriffKurz);
  }
  if (live(state, "G05")) {
    const values = valuesOf(state, "G05");
    next.loeschfreigabe = [asText(values.rolleFristen), asText(values.verfahren)].filter(Boolean).join(". ");
  }
  if (live(state, "G06")) {
    const values = valuesOf(state, "G06");
    next.backup = asList(values.backupArten).length ? asList(values.backupArten) : asText(values.backupArten) ? [asText(values.backupArten)] : [];
    const tested = asText(values.wiederherstellungGetestet);
    if (tested === "ja" || tested === "nein" || tested === "unbekannt") next.backupGetestet = tested;
    if (tested === "ja") next.wiederherstellungstest = asText(values.letztesTestdatum);
  }
  if (live(state, "H01")) {
    const values = valuesOf(state, "H01");
    if (isKeineKontrolleValues(values)) {
      next.kontrollen = KEINE_KONTROLLE_SATZ;
      next.kontrollenListe = [];
    } else {
      const rows = completeControls(asRows(values.kontrollen));
      next.kontrollen = rows
        .map((row) => `| ${asText(row.name)} | ${asText(row.turnus)} | ${asText(row.wer)} | ${asText(row.nachweis)} |`)
        .join("\n");
      next.kontrollenListe = rows.map((row) => ({
        was: asText(row.name),
        turnus: asText(row.turnus),
        wer: asText(row.wer),
        nachweis: asText(row.nachweis),
      }));
    }
  }
  if (live(state, "H04") && asText(valuesOf(state, "H04").status) === "bestaetigt") {
    const values = valuesOf(state, "H04");
    const line = [asText(values.datum), asText(values.ergebnis)].filter(Boolean).join(": ");
    if (line) {
      next.wiederherstellungstest = [next.wiederherstellungstest, line].filter(Boolean).join(". ");
    }
  }
  if (live(state, "I01")) {
    const values = valuesOf(state, "I01");
    next.dokumentenpflege = [asText(values.pfleger), asText(values.ausloeser)].filter(Boolean).join(". ");
  }
  if (live(state, "I02")) {
    next.anlagenliste = asRows(valuesOf(state, "I02").anlagen)
      .filter((row) => asText(row.name))
      .map((row) => `${asText(row.name)} (${optionLabel("status", asText(row.status))})`)
      .join("; ");
  }
  if (live(state, "I04")) {
    next.bestaetigungName = asText(valuesOf(state, "I04").name);
    next.bestaetigungDatum = asText(valuesOf(state, "I04").datum);
  }
  if (live(state, "I05")) {
    const values = valuesOf(state, "I05");
    const frame = [asText(values.gueltigAb), asText(values.speicherortHistorie)].filter(Boolean).join(" — ");
    next.fassungsrahmen = [frame, next.fassungsrahmen].filter(Boolean).join(". ");
  }
  return next;
}

function bereichOpenText(id: string): { priority: "hoch" | "mittel" | "niedrig"; text: string; chapter: string } | undefined {
  const hit = bereichQuestion(id);
  if (!hit) return undefined;
  return {
    priority: hit.question.priority ?? "mittel",
    text: hit.question.open,
    chapter: bereichChapterId(hit.bereich.id),
  };
}

function modulOpenText(id: string): { priority: "hoch" | "mittel" | "niedrig"; text: string; chapter: string } | undefined {
  const hit = modulQuestion(id);
  if (!hit) return undefined;
  return {
    priority: hit.question.priority ?? "mittel",
    text: hit.question.open,
    chapter: `modul-${hit.modul.id}`,
  };
}

function pointFor(id: string): CatalogOpenPoint {
  const meta = OPEN_TEXT[id] ?? modulOpenText(id) ?? bereichOpenText(id) ?? {
    priority: "mittel" as const,
    text: `${id} ist nicht bestätigt.`,
    chapter: "14-offene-punkte",
  };
  return {
    id: id === "C02" ? "op-c02-sichtung" : id === "F05" ? "op-f05-kanzlei-umfang" : `op-${id.toLowerCase()}`,
    priority: meta.priority,
    text: meta.text,
    chapter: meta.chapter,
    suppress: SUPPRESS[id] ?? [],
  };
}

export function catalogOpenPoints(answers: IntakeAnswers): CatalogOpenPoint[] {
  if (!hasCatalogAnswers(answers)) return [];
  const state = catalogState(answers);
  const points: CatalogOpenPoint[] = [];
  for (const step of CATALOG_STEPS) {
    if (!catalogStepApplies(step, answers)) continue;
    for (const question of step.questions) {
      if (!catalogQuestionApplies(question, answers)) continue;
      if (question.id === "BU07" && kanzleiAbgelehnt(answers)) continue;
      const status = state[question.id]?.status;
      if (status === "unbekannt" || status === "geplant") points.push(pointFor(question.id));
      if (question.id === "H01" && status !== "bestaetigt") {
        if (!points.some((point) => point.id === "op-h01")) points.push(pointFor("H01"));
      }
      if (
        question.id === "H01" &&
        status === "bestaetigt" &&
        !isKeineKontrolleValues(valuesOf(state, "H01"))
      ) {
        const rows = completeControls(asRows(valuesOf(state, "H01").kontrollen));
        if (!rows.length) points.push(pointFor("H01"));
      }
      if (
        status === "bestaetigt" &&
        isControlQuestionId(question.id) &&
        isKeineKontrolleValues(valuesOf(state, question.id))
      ) {
        const base = pointFor(question.id);
        points.push({
          ...base,
          id: `${base.id}-keine`,
          priority: "mittel",
          text: KEINE_KONTROLLE_SATZ,
        });
      }
      if (
        question.id === "A03" &&
        status === "bestaetigt" &&
        ["kasse", "shop", "lager", "lohn", "plattformen"].some(
          (key) => valuesOf(state, "A03")[key] === "unbekannt",
        )
      ) {
        points.push(pointFor("A03"));
      }
      if (question.id === "E02" && status === "bestaetigt" && asText(valuesOf(state, "E02").validierung) !== "ja_bestaetigt") {
        points.push(pointFor("E02"));
      }
      if (
        question.id === "G06" &&
        status === "bestaetigt" &&
        asText(valuesOf(state, "G06").wiederherstellungGetestet) !== "ja" &&
        state.H04?.status !== "unbekannt" &&
        state.H04?.status !== "geplant"
      ) {
        points.push({
          id: "op-g06-test",
          priority: "hoch",
          text: "Ein Wiederherstellungstest ist nicht bestätigt.",
          chapter: "10-berechtigungen-sicherung",
          suppress: ["op-backup-test"],
        });
      }
      if (question.id === "H04" && status === "bestaetigt" && asText(valuesOf(state, "H04").status) !== "bestaetigt") {
        points.push(pointFor("H04"));
      }
      if (question.id === "F05" && status === "bestaetigt" && asText(valuesOf(state, "F05").nachweisVorhanden) !== "ja") {
        points.push(pointFor("F05"));
      }
      if (
        question.id === "A01" &&
        status &&
        status !== "nicht_zutreffend"
      ) {
        for (const gap of activityGaps(valuesOf(state, "A01"))) {
          points.push({
            id: gap.id,
            priority: "hoch",
            text: gap.text,
            chapter: "03-systeme-datenfluss",
            suppress: [],
          });
        }
      }
      if (question.id === "I02" && status === "bestaetigt") {
        const missing = asRows(valuesOf(state, "I02").anlagen).some((row) => asText(row.status) === "offen");
        if (missing) {
          points.push({
            id: "op-i02-anlage",
            priority: "mittel",
            text: "Mindestens eine mitgeltende Unterlage muss noch ergänzt werden.",
            chapter: "13-mitgeltende-unterlagen",
            suppress: [],
          });
        }
      }
      if (question.id === "G02" && status === "bestaetigt" && asText(valuesOf(state, "G02").berechtigungslisteVorhanden) !== "ja") {
        points.push({
          id: "op-berechtigungsliste",
          priority: "mittel",
          text: "Eine Berechtigungsliste ist nicht bestätigt.",
          chapter: "10-berechtigungen-sicherung",
          suppress: [],
        });
      }
    }
  }
  if (isGesamt(answers)) {
    for (const modul of MODULE) {
      const eintrag = effectiveModulStatus(answers, modul.id);
      if (eintrag.status === "offen") {
        points.push({
          id: `op-modul-${modul.id}`,
          priority: "hoch",
          text: `Modul ${modul.nr} „${modul.titel}“ hat den Status „${MODUL_STATUS_LABEL.offen}“.`,
          chapter: `modul-${modul.id}`,
          suppress: [],
        });
      }
      if (eintrag.status === "extern" && !eintrag.ref?.trim()) {
        points.push({
          id: `op-modul-ref-${modul.id}`,
          priority: "hoch",
          text: `Für Modul ${modul.nr} „${modul.titel}“ fehlt der Verweis auf die bestehende Dokumentation.`,
          chapter: `modul-${modul.id}`,
          suppress: [],
        });
      }
    }
  }
  return points;
}

export function catalogSuppressesRule(ruleId: string, answers: IntakeAnswers): boolean {
  if (!hasCatalogAnswers(answers)) return false;
  const state = catalogState(answers);
  for (const step of CATALOG_STEPS) {
    if (!catalogStepApplies(step, answers)) continue;
    for (const question of step.questions) {
      if (!catalogQuestionApplies(question, answers)) continue;
      const status = state[question.id]?.status;
      if (!status) continue;
      const point = pointFor(question.id);
      if (point.id === ruleId) return true;
      const suppress = [...(SUPPRESS[question.id] ?? [])];
      if (question.id === "G02" && asText(valuesOf(state, "G02").berechtigungslisteVorhanden) !== "ja") {
        const index = suppress.indexOf("op-berechtigungsliste");
        if (index >= 0) suppress.splice(index, 1);
      }
      if (suppress.includes(ruleId)) return true;
    }
  }
  if (ruleId === "op-g06-test") {
    return catalogOpenPoints(answers).some((point) => point.id === "op-g06-test");
  }
  return false;
}

function mapChannels(channels: string[]): string[] {
  const mapped = new Set<string>();
  for (const channel of channels) {
    const value = channel.toLowerCase();
    if (value.includes("papier") || value.includes("post")) mapped.add(PAPER_CHANNEL);
    else if (value.includes("xrechnung") || value.includes("zugferd") || value.includes("e-rechnung") || value.includes("erechnung")) {
      mapped.add(EINVOICE_CHANNEL);
    } else if (value.includes("portal")) mapped.add("Portal");
    else if (value.includes("schnitt")) mapped.add("Schnittstelle");
    else if (value.includes("app") || value.includes("scan")) mapped.add("App");
    else if (value.includes("mail") || value.includes("pdf")) mapped.add("E-Mail-PDF");
  }
  return [...mapped];
}

/** Prefill catalog values from an old short intake. Does not mark them bestätigt. */
export function draftCatalogFromLegacy(answers: IntakeAnswers, company = ""): CatalogState {
  const systems = answers.fibu.map((name) => ({ name, funktion: "FiBu", typ: "fibu" }));
  return {
    A01: {
      values: {
        company,
        standort: answers.standort ?? "",
        branchen: answers.branchen,
        rechtsform: answers.rechtsform,
        mitarbeitende: answers.mitarbeitende,
        gf: answers.gf,
      },
    },
    B01: {
      values: {
        systeme: systems,
        weitereFreitext: answers.weitereSysteme,
        hosting: answers.hosting,
        it: answers.it === "nicht angegeben" ? "" : answers.it,
      },
    },
    C01: { values: { kanaele: mapChannels(answers.eingangsbelege) } },
    E01: { values: { formate: answers.formate ?? [] } },
    E05: { values: { systeme: answers.ausgangsrechnungen } },
    F01: { values: { buchhaltung: answers.buchhaltung } },
    F05: { values: { kanzleiName: answers.steuerberater } },
    G01: { values: { ablage: answers.archiv } },
    G02: { values: { zugriffKurz: answers.zugriff } },
    G06: { values: { backupArten: answers.backup.join(", ") } },
  };
}

export function withCatalogDraft(answers: IntakeAnswers, company = ""): IntakeAnswers {
  if (hasCatalogAnswers(answers) || Object.keys(catalogState(answers)).length > 0) return answers;
  return { ...answers, katalog: draftCatalogFromLegacy(answers, company) };
}

/** Firm master data already stored on the account. Only facts the user entered. */
export type FirmFacts = {
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
  stnr?: string;
  ustId?: string;
};

export function firmAddressLine(firm?: FirmFacts): string {
  if (!firm) return "";
  const street = firm.street?.trim() ?? "";
  const place = [firm.zip?.trim(), firm.city?.trim()].filter(Boolean).join(" ");
  return [street, place].filter(Boolean).join(", ");
}

const PREFILL_SKIP_KEYS = new Set([
  "gueltigAb",
  "datum",
  "letztesTestdatum",
  "keineRueckdatierungBestaetigt",
  "bestaetigungDatum",
  "bestaetigungName",
]);

function valueEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean" || typeof value === "number") return false;
  if (Array.isArray(value)) return value.length === 0 || value.every((item) => valueEmpty(item));
  if (typeof value === "object") {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.length === 0 || entries.every((item) => valueEmpty(item));
  }
  return false;
}

function isProtected(protect: Array<[string, string]> | undefined, id: string, key: string): boolean {
  return Boolean(protect?.some(([pid, pkey]) => pid === id && pkey === key));
}

function fillText(
  katalog: CatalogState,
  id: string,
  key: string,
  value: string | undefined,
  protect?: Array<[string, string]>,
): void {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || PREFILL_SKIP_KEYS.has(key) || isProtected(protect, id, key)) return;
  const entry = katalog[id] ?? {};
  const values = { ...(entry.values ?? {}) };
  if (!valueEmpty(values[key])) return;
  values[key] = trimmed;
  katalog[id] = { ...entry, values };
}

function fillRaw(
  katalog: CatalogState,
  id: string,
  key: string,
  value: unknown,
  protect?: Array<[string, string]>,
): void {
  if (PREFILL_SKIP_KEYS.has(key) || valueEmpty(value) || isProtected(protect, id, key)) return;
  const entry = katalog[id] ?? {};
  const values = { ...(entry.values ?? {}) };
  if (!valueEmpty(values[key])) return;
  values[key] = value;
  katalog[id] = { ...entry, values };
}

function ensureSystem(
  katalog: CatalogState,
  name: string,
  funktion: string,
  typ: string,
): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const entry = katalog.B01 ?? {};
  const values = { ...(entry.values ?? {}) };
  const systems = asRows(values.systeme);
  const named = systems.filter((row) => asText(row.name));
  if (named.some((row) => asText(row.name) === trimmed)) return;
  values.systeme = [...named, { name: trimmed, funktion, typ }];
  katalog.B01 = { ...entry, values };
}

function roleLines(pairs: Array<[string, string]>): string {
  return pairs
    .map(([label, value]) => (value.trim() ? `${label}: ${value.trim()}` : ""))
    .filter(Boolean)
    .join("\n");
}

/**
 * Copy facts the user already gave into empty catalog fields.
 * Never sets a process status, a date, or the no-backdating confirmation.
 * Never replaces a value the user already typed.
 */
export function prefillKnownFacts(
  answers: IntakeAnswers,
  firm?: FirmFacts,
  options?: { protect?: Array<[string, string]> },
): IntakeAnswers {
  const protect = options?.protect;
  const next = applyStammdatenPrefill(answers);
  const katalog: CatalogState = { ...(next.katalog ?? {}) };
  for (const [id, key] of protect ?? []) {
    const entry = katalog[id] ?? {};
    const values = { ...(entry.values ?? {}) };
    const edited = answers.katalog?.[id]?.values?.[key];
    if (valueEmpty(edited)) delete values[key];
    else values[key] = edited;
    katalog[id] = { ...entry, values };
  }
  const stamm = modulZustand(next).stammdaten ?? {};
  const a01 = () => katalog.A01?.values ?? {};

  fillText(katalog, "A01", "company", firm?.name, protect);
  fillText(katalog, "A01", "standort", firmAddressLine(firm) || answers.standort, protect);
  fillRaw(katalog, "A01", "branchen", answers.branchen, protect);
  fillText(katalog, "A01", "rechtsform", answers.rechtsform, protect);
  fillText(katalog, "A01", "mitarbeitende", answers.mitarbeitende, protect);
  fillText(katalog, "A01", "gf", answers.gf || stamm.gf, protect);
  fillText(katalog, "B01", "weitereFreitext", answers.weitereSysteme);
  fillText(katalog, "B01", "hosting", answers.hosting);
  fillText(katalog, "B01", "it", answers.it === "nicht angegeben" ? "" : answers.it);
  for (const name of answers.fibu) ensureSystem(katalog, name, "FiBu", "fibu");
  if (stamm.fibu) ensureSystem(katalog, stamm.fibu, "Finanzbuchhaltung", "fibu");
  fillRaw(katalog, "C01", "kanaele", mapChannels(answers.eingangsbelege));
  fillRaw(katalog, "E01", "formate", answers.formate);
  fillRaw(katalog, "E05", "systeme", answers.ausgangsrechnungen);
  fillText(katalog, "F01", "buchhaltung", answers.buchhaltung || stamm.buchhaltung);
  fillText(katalog, "F05", "kanzleiName", answers.steuerberater || stamm.kanzlei);
  fillText(katalog, "G01", "ablage", answers.archiv || stamm.archiv);
  fillText(katalog, "G02", "zugriffKurz", answers.zugriff);
  if (answers.backup.length) fillText(katalog, "G06", "backupArten", answers.backup.join(", "));

  fillText(katalog, "KA01", "system", stamm.kasse);
  fillText(katalog, "A01", "gastroKasse", stamm.kasse);
  fillText(katalog, "EC02", "system", stamm.shop);
  fillText(katalog, "A01", "onlineShop", stamm.shop);
  fillText(katalog, "LO01", "system", stamm.lohn);
  fillText(katalog, "WW01", "system", stamm.warenwirtschaft);
  fillText(katalog, "A01", "onlineWawi", stamm.warenwirtschaft);
  fillText(katalog, "BA01", "konten", stamm.bank);

  const company = asText(a01().company);
  const rechtsform = asText(a01().rechtsform);
  const rechtsformFrei = asText(a01().rechtsformFreitext);
  const formLine = rechtsform === RECHTSFORM_FREITEXT ? rechtsformFrei : rechtsform;
  const gesellschaften = [
    company,
    formLine ? `Rechtsform: ${formLine}` : "",
    firm?.stnr?.trim() ? `Steuernummer: ${firm.stnr.trim()}` : "",
    firm?.ustId?.trim() ? `USt-IdNr.: ${firm.ustId.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  fillText(katalog, "UO01", "gesellschaften", gesellschaften);
  fillText(katalog, "UO01", "standorte", asText(a01().standort));

  const activities = asList(a01().branchen).filter((item) => item !== TAETIGKEIT_FREITEXT);
  const activityFree = asText(a01().branchenFreitext);
  if (activityFree) activities.push(activityFree);
  fillText(katalog, "UO02", "taetigkeiten", activities.join(", "));

  fillText(
    katalog,
    "UO03",
    "zustaendigkeiten",
    roleLines([
      ["Geschäftsleitung", asText(a01().gf) || stamm.gf || ""],
      ["Buchhaltung", asText(katalog.F01?.values?.buchhaltung) || stamm.buchhaltung || ""],
      ["IT", asText(katalog.B01?.values?.it) || stamm.it || ""],
      ["Steuerkanzlei", asText(katalog.F05?.values?.kanzleiName) || stamm.kanzlei || ""],
    ]),
  );

  if (JSON.stringify(katalog) === JSON.stringify(next.katalog ?? {})) return next;
  return { ...next, katalog };
}

export function statusLabel(status: CatalogStatus): string {
  return STATUS_LABEL[status];
}

/** Beispiel GmbH: only facts already in the short partner fixture are bestätigt. */
export function beispielGmbHKatalog(answers: IntakeAnswers, company: string): CatalogState {
  const draft = draftCatalogFromLegacy(answers, company);
  const mark = (id: string, status: CatalogStatus, values?: Record<string, unknown>): CatalogQuestionState => ({
    status,
    reason: status === "nicht_zutreffend" ? "entfällt" : "",
    values: { ...(draft[id]?.values ?? {}), ...(values ?? {}) },
  });
  const unknown = (id: string, values?: Record<string, unknown>) => mark(id, "unbekannt", values);
  return {
    A01: unknown("A01"),
    A02: unknown("A02"),
    A03: unknown("A03"),
    A04: unknown("A04"),
    B01: mark("B01", "bestaetigt"),
    B04: unknown("B04"),
    B05: unknown("B05"),
    C01: mark("C01", "bestaetigt", { kanaele: ["E-Mail-PDF"] }),
    C02: unknown("C02"),
    E01: unknown("E01"),
    E03: unknown("E03"),
    E05: unknown("E05"),
    F01: unknown("F01"),
    F02: unknown("F02"),
    F05: unknown("F05"),
    G01: unknown("G01"),
    G02: mark("G02", "bestaetigt", { berechtigungslisteVorhanden: "unbekannt" }),
    G05: unknown("G05"),
    G06: mark("G06", "bestaetigt", { wiederherstellungGetestet: "unbekannt" }),
    H01: unknown("H01"),
    H04: unknown("H04"),
    I01: unknown("I01"),
    I02: unknown("I02"),
    I04: unknown("I04"),
    I05: unknown("I05"),
  };
}

function displayFieldValue(fieldKey: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === "object")) {
      return value
        .map((item) =>
          Object.values(item as Record<string, unknown>)
            .map((part) => optionLabel(fieldKey, asText(part)))
            .filter(Boolean)
            .join(" "),
        )
        .filter(Boolean)
        .join("; ");
    }
    return value
      .map((item) => optionLabel(fieldKey, asText(item)))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "ja" : "";
  return optionLabel(fieldKey, asText(value));
}

function summaryBits(question: CatalogQuestion, entry: CatalogState[string] | undefined): string[] {
  if (isControlQuestionId(question.id) && isKeineKontrolleValues(entry?.values)) {
    return [KEINE_KONTROLLE_SATZ];
  }
  const bits = question.fields.map((field) => {
    const shown = displayFieldValue(field.key, entry?.values?.[field.key]);
    if (!shown) return "";
    if (field.type === "enum" || field.key === "kasse" || field.key === "shop") {
      return `${fieldLabel(question.id, field.key, field.label)}: ${shown}`;
    }
    return shown;
  });
  if (question.id === "A01") {
    const detail = asText(entry?.values?.rechtsformFreitext);
    const extraActivity = asText(entry?.values?.branchenFreitext);
    if (detail) bits.push(detail);
    if (extraActivity) bits.push(extraActivity);
    bits.push(...describedActivityLines(entry?.values ?? {}));
  }
  if (question.id === "A02") {
    const where = asText(entry?.values?.ausgeschlossenWo);
    if (where) bits.push(`dokumentiert in: ${where}`);
  }
  return [...bits.filter(Boolean), ...presentationBits(question.id, entry?.values)].filter(Boolean);
}

export function catalogSummary(answers: IntakeAnswers): Array<[string, string]> {
  const state = catalogState(answers);
  const rows: Array<[string, string]> = [];
  for (const step of CATALOG_STEPS) {
    for (const question of step.questions) {
      if (!catalogQuestionApplies(question, answers) && !state[question.id]?.status) continue;
      const entry = state[question.id];
      const status = entry?.status ? STATUS_LABEL[entry.status] : "offen";
      rows.push([
        customerPrompt(question.id, question.prompt),
        [status, ...summaryBits(question, entry)].join(" · "),
      ]);
    }
  }
  return rows;
}

export type FragebogenQuestion = {
  id: string;
  prompt: string;
  hint: string;
  status: string;
  /** Answer lines; area questions carry their field labels. */
  lines: string[];
  reason: string;
};

export type FragebogenStep = { title: string; questions: FragebogenQuestion[] };

/**
 * Filled questionnaire grouped by step, as asked for this area. Used for the
 * Muster-Fragebogen page and PDF.
 */
export function catalogFragebogen(answers: IntakeAnswers): FragebogenStep[] {
  const state = catalogState(answers);
  const steps: FragebogenStep[] = [];
  CATALOG_STEPS.forEach((step, index) => {
    const questions = visibleCatalogQuestions(index, answers);
    if (!questions.length) return;
    steps.push({
      title: catalogStepTitle(index, answers),
      questions: questions.map((question) => {
        const entry = state[question.id];
        const area = bereichQuestion(question.id);
        const lines =
          isControlQuestionId(question.id) && isKeineKontrolleValues(entry?.values)
            ? [KEINE_KONTROLLE_SATZ]
            : area
          ? area.question.fields
              .map((field) => {
                const value = entry?.values?.[field.key];
                const text = Array.isArray(value)
                  ? value.map((item) => String(item)).filter(Boolean).join(", ")
                  : typeof value === "string"
                    ? value.trim()
                    : "";
                const shown = field.type === "enum" && text === "unbekannt" ? "noch zu klären" : text;
                return shown ? `${field.label}: ${shown}` : "";
              })
              .filter(Boolean)
          : summaryBits(question, entry);
        return {
          id: question.id,
          prompt: customerPrompt(question.id, question.prompt),
          hint: question.hint ?? "",
          status: entry?.status ? STATUS_LABEL[entry.status] : "offen",
          lines,
          reason: entry?.status === "nicht_zutreffend" ? asText(entry.reason) : "",
        };
      }),
    });
  });
  return steps;
}

/**
 * Start answers for a new area document of a company that already has one:
 * the general part (company, systems, archive, rights, controls, upkeep) is
 * carried over from the latest version; area questions start empty.
 */
export function answersForNewBereich(base: IntakeAnswers, bereich: string, company = ""): IntakeAnswers {
  const drafted = withCatalogDraft(base, company);
  const state = catalogState(drafted);
  const katalog: CatalogState = {};
  for (const id of ALLGEMEINER_TEIL_IDS) {
    if (state[id]) katalog[id] = state[id];
  }
  return { ...emptyAnswers(), bereich, katalog };
}

/**
 * Customer-facing line for one catalog question (prompt, status, answer bits)
 * without technical ids. Used by the Gesamtdokument module chapters.
 */
export function catalogAnswerLine(
  id: string,
  answers: IntakeAnswers,
): { prompt: string; status: string; details: string[]; reason: string } | null {
  const question = CATALOG_STEPS.flatMap((step) => step.questions).find((item) => item.id === id);
  if (!question) return null;
  const entry = catalogState(answers)[id];
  return {
    prompt: customerPrompt(question.id, question.prompt),
    status: entry?.status ? STATUS_LABEL[entry.status] : "offen",
    details: summaryBits(question, entry),
    reason: entry?.status === "nicht_zutreffend" ? asText(entry.reason) : "",
  };
}
