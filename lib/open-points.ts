import bundle from "@/content/delivery-templates/bundle.json";
import {
  documentAnswers,
  openPointsFromFragen,
  suppressRuleForFragen,
} from "@/lib/frage-intake";
import { BEREICHE, bereichChapterId, isBelegfluss } from "@/lib/bereiche";
import { kanzleiAbgelehnt } from "@/lib/module/aussagen";
import { BUNDLE_KAPITEL_ZU_MODUL } from "@/lib/module/katalog";
import { effectiveModulStatus, isGesamt } from "@/lib/module/status";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

export type OpenPointSeverity = "low" | "medium" | "high";

/** Customer-facing labels. The PDF and partner excerpt do not print template ids. */
export const OPEN_POINT_CHAPTER_LABELS: Record<string, string> = {
  "00-cover-freigabe": "Deckblatt",
  "00b-dokumentenlenkung": "Dokumentenlenkung",
  "01-zweck-geltung": "Zweck und Geltungsbereich",
  "02-unternehmen-rollen": "Rollen",
  "03-systeme-datenfluss": "Systemlandschaft",
  "04-belegarten-kanaele": "Belegarten",
  "05-eingang-erechnung": "Eingang und E-Rechnung",
  "06-papier-digitalisierung": "Papier und Digitalisierung",
  "07-ausgangsrechnungen": "Ausgang und Korrekturen",
  "08-freigabe-buchung-status": "Prüfung und Freigabe",
  "09-ablage-aufbewahrung": "Ablage und Aufbewahrung",
  "10-berechtigungen-sicherung": "Berechtigungen und Sicherung",
  "11-iks": "Internes Kontrollsystem",
  "12-versionspflege": "Versionspflege",
  "13-mitgeltende-unterlagen": "Mitgeltende Unterlagen",
  "14-offene-punkte": "Offene Punkte",
  "A-prozessmatrix": "Anhang A Prozessmatrix",
  "B-begriffe": "Anhang B Begriffe",
};

/** PDF column. The intake does not collect a due date, so none is invented. */
export function openPointPriorityLabel(severity: string): string {
  if (severity === "high") return "hoch";
  if (severity === "medium") return "mittel";
  if (severity === "low") return "niedrig";
  return severity;
}

export function openPointDueLabel(): string {
  return "nicht festgelegt";
}

export function openPointChapterLabel(id?: string): string {
  if (!id) return "—";
  if (id.startsWith("modul-")) {
    const nr = id.replace("modul-m", "").replace(/^0+/, "") || id;
    return `Modul ${nr}`;
  }
  const bereich = BEREICHE.find((item) => bereichChapterId(item.id) === id);
  if (bereich) return `Bereich ${bereich.label}`;
  return OPEN_POINT_CHAPTER_LABELS[id] ?? id;
}

/** Rules about Eingang, Scan, E-Rechnung and Buchungsübergabe only apply to Belegfluss documents. */
const BELEGFLUSS_ONLY_CHAPTERS = new Set([
  "04-belegarten-kanaele",
  "05-eingang-erechnung",
  "06-papier-digitalisierung",
  "07-ausgangsrechnungen",
  "08-freigabe-buchung-status",
  "A-prozessmatrix",
]);
/** Area documents ask their own frame questions (e.g. xx95 Ausfall) instead. */
const BELEGFLUSS_ONLY_RULES = new Set(["op-buchhaltung", "op-steuerberater", "op-notfall"]);

function ruleAppliesToArea(rule: { id: string; chapter?: unknown }, answers: IntakeAnswers): boolean {
  if (isGesamt(answers)) {
    const chapter = String(rule.chapter ?? "");
    const modulId = BUNDLE_KAPITEL_ZU_MODUL[chapter];
    if (modulId) return effectiveModulStatus(answers, modulId).status === "tool";
    return true;
  }
  if (isBelegfluss(answers)) return true;
  if (BELEGFLUSS_ONLY_RULES.has(rule.id)) return false;
  return !BELEGFLUSS_ONLY_CHAPTERS.has(String(rule.chapter ?? ""));
}

export type OpenPointPriority = "hoch" | "mittel" | "niedrig";

/** Outline v4 customer shape, plus the older fields the UI already reads. */
export type DeliveryOpenPoint = {
  id: string;
  priority: OpenPointPriority;
  text: string;
  responsibility?: string;
  /** Set only when a rule carries a date. Never invented. */
  dueDate?: string;
  title: string;
  severity: OpenPointSeverity;
  status: "open";
  chapter?: string;
  field?: string;
};

function priorityFromSeverity(severity: string): OpenPointPriority {
  if (severity === "high") return "hoch";
  if (severity === "low") return "niedrig";
  return "mittel";
}

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

/** Substrings that keep a filled field from driving a lived Kanzlei process (F05). */
const UNCONFIRMED_SCOPE_MARKERS = [
  "zu bestätigen",
  "unbekannt",
  "geplant",
  "nicht zutreffend",
];

/**
 * True when the value is filled but still marked unconfirmed.
 * Exact empty labels stay on `when: empty` and return false here.
 */
export function intakeValueHasUnconfirmedScope(value: unknown): boolean {
  if (isEmptyIntakeValue(value)) return false;
  const items = Array.isArray(value) ? value.map((item) => String(item)) : [String(value ?? "")];
  return items.some((item) =>
    UNCONFIRMED_SCOPE_MARKERS.some((marker) => intakeValueContainsToken(item, marker)),
  );
}

/** Whole word, so „Post“ does not match „Postfach“. */
function intakeValueHasWord(value: unknown, token: string): boolean {
  const needle = token.trim();
  if (!needle) return false;
  const items = Array.isArray(value) ? value.map((item) => String(item)) : [String(value ?? "")];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
  return items.some((item) => re.test(item));
}

function hasPaperPath(value: unknown): boolean {
  return (
    intakeValueContainsToken(value, "Papier") ||
    intakeValueContainsToken(value, "Papierbeleg") ||
    intakeValueHasWord(value, "Post")
  );
}

function hasErsetzendesScannen(value: unknown): boolean {
  return intakeValueContainsToken(value, "ersetzend");
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
 * `when`: `empty`, `always`, `arrayContainsAny` (legacy `includes`),
 * `unconfirmedScope`, `ersetzendOhnePapier`.
 * Rules with `customerFacing: false` and Stripe/stub fields are omitted.
 * `ersetzendOhnePapier` is one hint before use, not a general contradiction engine
 * and not a Freigabe.
 */
export function evaluateOpenPoints(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
}): DeliveryOpenPoint[] {
  const lived = documentAnswers(input.answers);
  const root = {
    identity: input.identity,
    answers: lived,
  };
  const points: DeliveryOpenPoint[] = [];
  for (const rule of bundle.openPointsRules.rules) {
    if (!ruleIsCustomerFacing(rule)) continue;
    if (!ruleAppliesToArea(rule, input.answers)) continue;
    if (suppressRuleForFragen(rule.id, input.answers)) continue;
    if (
      kanzleiAbgelehnt(input.answers) &&
      (rule.id === "op-steuerberater" || rule.id === "op-f05-kanzlei-umfang")
    ) {
      continue;
    }
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
      matches = tokens.some((token) =>
        token.trim().toLowerCase() === "post"
          ? intakeValueHasWord(value, token)
          : intakeValueContainsToken(value, token),
      );
    } else if (when === "unconfirmedScope") {
      matches = Boolean(field) && intakeValueHasUnconfirmedScope(value);
    } else if (when === "ersetzendOhnePapier") {
      const fields =
        "fields" in rule && Array.isArray(rule.fields)
          ? rule.fields.filter((item): item is string => typeof item === "string")
          : [];
      const values = fields.map((pathExpr) => lookup(root, pathExpr));
      const mentionsScanReplace = values.some((item) => hasErsetzendesScannen(item));
      const mentionsPaper = values.some((item) => hasPaperPath(item));
      matches = mentionsScanReplace && !mentionsPaper;
    }
    if (!matches) continue;
    const text =
      rule.id === "op-berechtigungsliste" && kanzleiAbgelehnt(input.answers)
        ? "Berechtigungsliste als mitgeltende Unterlage ablegen."
        : rule.text;
    const rawDue = "dueDate" in rule ? (rule.dueDate as unknown) : undefined;
    const dueDate = typeof rawDue === "string" && rawDue.trim() ? rawDue.trim() : undefined;
    const priority =
      "priority" in rule &&
      (rule.priority === "hoch" || rule.priority === "mittel" || rule.priority === "niedrig")
        ? rule.priority
        : priorityFromSeverity(String(rule.severity));
    points.push({
      id: rule.id,
      priority,
      text,
      responsibility: responsibilityLabel(
        root,
        "responsibilityField" in rule && rule.responsibilityField
          ? String(rule.responsibilityField)
          : undefined,
      ),
      ...(dueDate ? { dueDate } : {}),
      title: text,
      severity: rule.severity as OpenPointSeverity,
      status: "open",
      chapter: "chapter" in rule ? String(rule.chapter) : undefined,
      field,
    });
  }
  for (const extra of openPointsFromFragen(input.answers)) {
    if (points.some((point) => point.id === extra.id)) continue;
    const severity =
      extra.priority === "hoch" ? "high" : extra.priority === "niedrig" ? "low" : "medium";
    points.push({
      id: extra.id,
      priority: extra.priority,
      text: extra.text,
      responsibility: "zu benennen",
      title: extra.text,
      severity,
      status: "open",
      chapter: extra.chapter,
    });
  }
  return points;
}
