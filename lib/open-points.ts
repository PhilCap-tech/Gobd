import bundle from "@/content/delivery-templates/bundle.json";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

export type OpenPointSeverity = "low" | "medium" | "high";

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

/**
 * Same rules as the PDF open-points table (`open-points-rules` via `bundle.json`).
 * Only `when: "empty"` and `when: "always"`. No contradiction checks.
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
    if (when !== "empty") continue;
    if (!("field" in rule) || !rule.field) continue;
    const value = lookup(root, String(rule.field));
    if (!isEmptyIntakeValue(value)) continue;
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
