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

export type RenderedChapter = {
  id: string;
  title: string;
  body: string;
};

export type RenderedDocument = {
  disclaimer: string;
  cover: string;
  chapters: RenderedChapter[];
  openPoints: DeliveryOpenPoint[];
  generatedAt: string;
};

type TemplateContext = {
  identity: CheckoutIdentity;
  answers: IntakeAnswers;
  disclaimer: string;
  generatedAt: string;
  documentId: string;
  bundleVersion: string;
  openPointsTable: string;
};

type Filter = { name: "join"; sep: string } | { name: "or"; fallback: string };

const EMPTY_VALUES = new Set(
  (bundle.openPointsRules.emptyValues ?? [])
    .map((value) => (value == null ? "" : String(value).trim().toLowerCase())),
);

function isEmptyValue(value: unknown): boolean {
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

function lookup(root: TemplateContext, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function splitFilters(expr: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (const ch of expr) {
    if ((ch === '"' || ch === "'") && quote === null) {
      quote = ch;
      current += ch;
    } else if (quote && ch === quote) {
      quote = null;
      current += ch;
    } else if (!quote && ch === "|") {
      tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function parsePlaceholder(expr: string): { path: string; filters: Filter[] } {
  const [path = "", ...rest] = splitFilters(expr.trim());
  const filters: Filter[] = [];
  for (const token of rest) {
    const joinMatch = token.match(/^join\s+["'](.*)["']$/);
    if (joinMatch) {
      filters.push({ name: "join", sep: joinMatch[1] });
      continue;
    }
    const orMatch = token.match(/^or\s+["'](.*)["']$/);
    if (orMatch) {
      filters.push({ name: "or", fallback: orMatch[1] });
    }
  }
  return { path, filters };
}

function applyFilters(value: unknown, filters: Filter[]): string {
  let current: unknown = value;
  if (filters.length === 0) {
    if (isEmptyValue(current)) return "nicht angegeben";
    if (Array.isArray(current)) {
      return current.map((item) => String(item).trim()).filter(Boolean).join(", ");
    }
    return String(current).trim();
  }
  for (const filter of filters) {
    if (filter.name === "join") {
      current = Array.isArray(current)
        ? current.map((item) => String(item).trim()).filter(Boolean).join(filter.sep)
        : current == null
          ? ""
          : String(current);
    } else if (filter.name === "or") {
      current = isEmptyValue(current) ? filter.fallback : current;
    }
  }
  if (Array.isArray(current)) {
    return current.map((item) => String(item).trim()).filter(Boolean).join(", ");
  }
  return current == null ? "" : String(current);
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
    const { path, filters } = parsePlaceholder(expr);
    if (path === "openPointsTable") return context.openPointsTable;
    if (path === "generatedAt") return context.generatedAt;
    if (path === "disclaimer") return context.disclaimer;
    if (path === "documentId") return context.documentId;
    if (path === "bundleVersion") return context.bundleVersion;
    return applyFilters(lookup(context, path), filters);
  });
}

export function evaluateOpenPoints(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
}): DeliveryOpenPoint[] {
  const root = {
    identity: input.identity,
    answers: input.answers,
  } as unknown as TemplateContext;
  const points: DeliveryOpenPoint[] = [];
  for (const rule of bundle.openPointsRules.rules) {
    if (rule.when && rule.when !== "empty") continue;
    const value = lookup(root, rule.field);
    if (!isEmptyValue(value)) continue;
    points.push({
      id: rule.id,
      title: rule.text,
      severity: rule.severity as OpenPointSeverity,
      status: "open",
      chapter: "chapter" in rule ? String(rule.chapter) : undefined,
      field: rule.field,
    });
  }
  return points;
}

function openPointsTable(points: DeliveryOpenPoint[]): string {
  if (points.length === 0) {
    return "Zum Zeitpunkt der Erstellung waren alle abgefragten Intake-Felder befüllt; es wurden keine automatischen offenen Punkte erzeugt.";
  }
  const rows = points
    .map(
      (point) =>
        `| ${point.severity} | ${point.title.replaceAll("|", "\\|")} | ${point.chapter || "—"} |`,
    )
    .join("\n");
  return `| Schwere | Offener Punkt | Kapitel |\n| --- | --- | --- |\n${rows}`;
}

function headingTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

export function formatBerlinIso(date = new Date()): string {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return formatted.replace(" ", "T");
}

export function renderDeliveryDocument(input: {
  identity: CheckoutIdentity;
  answers: IntakeAnswers;
  documentId: string;
}): RenderedDocument {
  const generatedAt = formatBerlinIso();
  const openPoints = evaluateOpenPoints(input);
  const base: TemplateContext = {
    identity: input.identity,
    answers: input.answers,
    disclaimer: bundle.disclaimer,
    generatedAt,
    documentId: input.documentId,
    bundleVersion: bundle.version,
    openPointsTable: openPointsTable(openPoints),
  };

  return {
    disclaimer: bundle.disclaimer,
    cover: renderTemplate(bundle.coverMarkdown, base).trim(),
    chapters: bundle.chapters.map((chapter) => ({
      id: chapter.id,
      title: headingTitle(chapter.markdown, chapter.id),
      body: renderTemplate(chapter.markdown, base).trim(),
    })),
    openPoints,
    generatedAt,
  };
}

export const deliveryBundle = bundle;
