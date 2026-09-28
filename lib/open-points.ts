import bundle from "@/content/delivery-templates/bundle.json";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

export type OpenPointSeverity = "low" | "medium" | "high";

/** Customer-facing labels. The PDF and partner excerpt do not print template ids. */
export const OPEN_POINT_CHAPTER_LABELS: Record<string, string> = {
  "00-cover": "Deckblatt",
  "01-merkmal-tabelle": "Merkmalübersicht",
  "02-zweck-grenzen": "Zweck und Grenzen",
  "03-systeme-belegarten": "Systeme und Belegarten",
  "04-eingang-pruefung": "Eingang und Prüfung",
  "05-freigabe-buchung": "Freigabe und Buchung",
  "06-aufbewahrung": "Aufbewahrung",
  "07-kontrollen-aenderungen": "Kontrollen und Änderungen",
  "08-anlagen-offene-punkte": "Anlagen und offene Punkte",
  "09-version-bestaetigung": "Version und Bestätigung",
  "10-quellen": "Quellen",
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
  /** Resolved from the rule, for the customer table. Empty when the rule names nobody. */
  responsibility?: string;
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

const INTERNAL_OPEN_POINT_FIELDS = new Set([
  "identity.stripeSessionId",
  "identity.stripeCustomerId",
  "identity.stub",
]);

/** Case-insensitive token match. Hyphens are ignored so „E-Mail“ matches „Email“. */
export function intakeValueContainsToken(value: unknown, token: string): boolean {
  const needle = normalizeIntakeToken(token);
  if (!needle) return false;
  const items = Array.isArray(value) ? value.map((item) => String(item)) : [String(value ?? "")];
  return items.some((item) => normalizeIntakeToken(item).includes(needle));
}

function normalizeIntakeToken(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, "");
}

function ruleIsCustomerFacing(rule: {
  customerFacing?: boolean;
  field?: string | null;
}): boolean {
  if (rule.customerFacing === false) return false;
  if (rule.field && INTERNAL_OPEN_POINT_FIELDS.has(rule.field)) return false;
  return true;
}

function responsibilityLabel(
  root: object,
  field: string | null | undefined,
): string | undefined {
  if (!field) return undefined;
  const value = lookup(root, field);
  if (isEmptyIntakeValue(value)) return "zu benennen";
  return String(value).trim();
}

/**
 * Customer open points from `open-points-rules` via `bundle.json`.
 * `when`: `empty`, `always`, `arrayContainsAny` (and legacy `includes`).
 * Rules with `customerFacing: false` and Stripe/stub fields are omitted.
 * No contradiction checks.
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
    if (!ruleIsCustomerFacing(rule)) continue;
    const when = "when" in rule ? String(rule.when) : "empty";
    const field = "field" in rule && rule.field ? String(rule.field) : undefined;
    const value = field ? lookup(root, field) : undefined;
    let matches = false;
    if (when === "always") {
      matches = true;
    } else if (when === "empty") {
      matches = Boolean(field) && isEmptyIntakeValue(value);
    } else if (when === "arrayContainsAny" || when === "includes") {
      const tokens =
        "tokens" in rule && Array.isArray(rule.tokens)
          ? rule.tokens.filter((item): item is string => typeof item === "string")
          : "includes" in rule && Array.isArray(rule.includes)
            ? rule.includes.filter((item): item is string => typeof item === "string")
            : [];
      matches = tokens.some((token) => intakeValueContainsToken(value, token));
    }
    if (!matches) continue;
    points.push({
      id: rule.id,
      title: rule.text,
      severity: rule.severity as OpenPointSeverity,
      status: "open",
      chapter: "chapter" in rule ? String(rule.chapter) : undefined,
      field,
      responsibility: responsibilityLabel(
        root,
        "responsibilityField" in rule && rule.responsibilityField
          ? String(rule.responsibilityField)
          : undefined,
      ),
    });
  }
  return points;
}
