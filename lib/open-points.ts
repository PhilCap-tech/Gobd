import bundle from "@/content/delivery-templates/bundle.json";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

export type OpenPointSeverity = "low" | "medium" | "high";

/** Customer-facing labels. The PDF and partner excerpt do not print template ids. */
export const OPEN_POINT_CHAPTER_LABELS: Record<string, string> = {
  "00-cover": "Deckblatt",
  "01-vorbemerkungen": "1. Zweck und Grenzen",
  "02-zielsetzung": "2. Systeme und Belegarten",
  "03-organisation-sicherheit": "3. Verantwortung, Zugriff und Aufbewahrung",
  "04-verfahren-papier": "4. Papierweg",
  "05-verfahren-digital": "5. Eingang, Ausgang und Ablage",
  "06-mitgeltende-unterlagen": "6. Mitgeltende Unterlagen",
  "07-aenderungshistorie": "7. Version",
  "08-glossar": "8. Quellen",
  "09-offene-punkte": "9. Offene Punkte",
};

export function openPointChapterLabel(id?: string): string {
  if (!id) return "—";
  return OPEN_POINT_CHAPTER_LABELS[id] ?? id;
}

export type DeliveryOpenPoint = {
  id: string;
  title: string;
  severity: OpenPointSeverity;
  status: "open";
  chapter?: string;
  field?: string;
};

/** Labels the rules treat as empty. Selected UI values such as „Unklar“ are not in this list. */
export const OPEN_POINT_EMPTY_LABELS = (bundle.openPointsRules.emptyValues ?? [])
  .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

const EMPTY_VALUES = new Set(
  (bundle.openPointsRules.emptyValues ?? []).map((value) =>
    value == null ? "" : String(value).trim().toLowerCase(),
  ),
);

export function isEmptyIntakeValue(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) {
    if (bundle.openPointsRules.arrayEmptyMeansOpen) {
      return value.map((item) => String(item).trim()).filter(Boolean).length === 0;
    }
    return value.length === 0;
  }
  const text = String(value).trim().toLowerCase();
  return EMPTY_VALUES.has(text);
}

function lookup(root: object, pathExpr: string): unknown {
  const parts = pathExpr.split(".").filter(Boolean);
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Intake options that make the paper chapter applicable. Steps inside it stay unconfirmed. */
export const PAPER_PATH_OPTIONS = ["Papierordner", "Scan / App"] as const;

export function intakeIncludesPaperPath(values: readonly string[]): boolean {
  return values.some((item) =>
    (PAPER_PATH_OPTIONS as readonly string[]).includes(item.trim()),
  );
}

function asTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (value == null) return [];
  const text = String(value).trim();
  return text ? [text] : [];
}

function ruleMatchesIncludes(value: unknown, needles: readonly string[]): boolean {
  if (needles.length === 0) return false;
  const haystack = asTextList(value);
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Same rules as the PDF open-points table (`open-points-rules` via `bundle.json`).
 * `when: "empty"`, `when: "includes"`, and `when: "always"`. No contradiction checks.
 */
export function evaluateOpenPoints(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
}): DeliveryOpenPoint[] {
  const root = {
    identity: input.identity,
    answers: input.answers,
  };
  const points: DeliveryOpenPoint[] = [];
  for (const rule of bundle.openPointsRules.rules) {
    const when = "when" in rule ? String(rule.when) : "empty";
    if (when === "always") {
      points.push({
        id: rule.id,
        title: rule.text,
        severity: rule.severity as OpenPointSeverity,
        status: "open",
        chapter: "chapter" in rule ? String(rule.chapter) : undefined,
        field: "field" in rule ? String(rule.field) : undefined,
      });
      continue;
    }
    if (when !== "empty" && when !== "includes") continue;
    if (!("field" in rule) || !rule.field) continue;
    const value = lookup(root, String(rule.field));
    if (when === "includes") {
      const needles =
        "includes" in rule && Array.isArray(rule.includes)
          ? rule.includes.filter((item): item is string => typeof item === "string")
          : [];
      if (!ruleMatchesIncludes(value, needles)) continue;
    } else if (!isEmptyIntakeValue(value)) {
      continue;
    }
    points.push({
      id: rule.id,
      title: rule.text,
      severity: rule.severity as OpenPointSeverity,
      status: "open",
      chapter: "chapter" in rule ? String(rule.chapter) : undefined,
      field: String(rule.field),
    });
  }
  return points;
}
