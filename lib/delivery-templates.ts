import { readFileSync } from "node:fs";
import path from "node:path";
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
  generatedAtDisplay: string;
  versionLabel: string;
};

type TemplateContext = {
  identity: CheckoutIdentity;
  answers: IntakeAnswers;
  disclaimer: string;
  generatedAt: string;
  generatedAtDisplay: string;
  documentId: string;
  bundleVersion: string;
  version: string;
  openPointsTable: string;
  roles: Record<string, string>;
};

type Filter = { name: "join"; sep: string } | { name: "or"; fallback: string };

type BundleChapter = {
  id: string;
  title?: string;
  file?: string;
  shortFile?: string;
  markdown: string;
  markdownShort?: string;
};

const EMPTY_VALUES = new Set(
  (bundle.openPointsRules.emptyValues ?? [])
    .map((value) => (value == null ? "" : String(value).trim().toLowerCase())),
);

const PAPER_PATH = /papier|scan|ordner|brief|post|analog|ausdruck|fax/i;

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

export function hasPaperBelege(answers: IntakeAnswers): boolean {
  return [...answers.eingangsbelege, ...answers.ausgangsrechnungen].some((value) =>
    PAPER_PATH.test(value),
  );
}

function firstFilled(...values: string[]): string {
  for (const value of values) {
    if (!isEmptyValue(value)) return value.trim();
  }
  return "nicht angegeben";
}

export function roleAssignments(answers: IntakeAnswers): Record<string, string> {
  return {
    posteingang: firstFilled(answers.buchhaltung, answers.gf),
    identifikation: firstFilled(answers.buchhaltung, answers.gf),
    pruefungEingang: firstFilled(answers.buchhaltung, answers.steuerberater),
    digitalisierung: firstFilled(answers.it, answers.buchhaltung),
    ablage: firstFilled(answers.buchhaltung, answers.it),
    aufbereitung: firstFilled(answers.buchhaltung, answers.steuerberater),
    vernichtungFreigabe: firstFilled(answers.gf),
    itBackup: firstFilled(answers.it),
  };
}

function lookup(root: TemplateContext, pathExpr: string): unknown {
  const parts = pathExpr.split(".").filter(Boolean);
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
  const [pathExpr = "", ...rest] = splitFilters(expr.trim());
  const filters: Filter[] = [];
  for (const token of rest) {
    const joinMatch = token.match(/^join\s+["'](.*)["']$/);
    if (joinMatch) {
      filters.push({ name: "join", sep: joinMatch[1] ?? ", " });
      continue;
    }
    const orMatch = token.match(/^or\s+["'](.*)["']$/);
    if (orMatch) {
      filters.push({ name: "or", fallback: orMatch[1] ?? "" });
    }
  }
  return { path: pathExpr, filters };
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
    const { path: pathExpr, filters } = parsePlaceholder(expr);
    if (pathExpr === "openPointsTable") return context.openPointsTable;
    if (pathExpr === "generatedAt") return context.generatedAt;
    if (pathExpr === "generatedAtDisplay") return context.generatedAtDisplay;
    if (pathExpr === "disclaimer") return context.disclaimer;
    if (pathExpr === "documentId") return context.documentId;
    if (pathExpr === "bundleVersion") return context.bundleVersion;
    if (pathExpr === "version") return context.version;
    return applyFilters(lookup(context, pathExpr), filters);
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
    if (!isEmptyValue(value)) continue;
    points.push({
      id: rule.id,
      title: rule.text,
      severity: rule.severity as OpenPointSeverity,
      status: "open",
      chapter: "chapter" in rule ? String(rule.chapter) : undefined,
      field: String(rule.field),
    });
  }
  if (!hasPaperBelege(input.answers)) {
    points.push({
      id: "op-papierweg",
      title:
        "Kein Papierweg im Intake erkennbar — Kapitel 4 ist gekürzt. Bei regelmäßigem Papieraufkommen Prozess nachtragen.",
      severity: "low",
      status: "open",
      chapter: "04-verfahren-papier",
      field: "answers.eingangsbelege",
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

export function formatBerlinDate(date = new Date()): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatVersionLabel(version?: number): string {
  const n = version && version > 0 ? version : 1;
  return `${n}.0`;
}

function templatesDir(): string {
  return path.join(process.cwd(), "content", "delivery-templates");
}

function readTemplateFile(relPath: string | undefined, fallback: string): string {
  if (!relPath) return fallback;
  try {
    return readFileSync(path.join(templatesDir(), relPath), "utf8");
  } catch {
    return fallback;
  }
}

function chapterMarkdown(chapter: BundleChapter, answers: IntakeAnswers): string {
  const useShort = chapter.id === "04-verfahren-papier" && !hasPaperBelege(answers);
  if (useShort) {
    return readTemplateFile(chapter.shortFile, chapter.markdownShort || chapter.markdown);
  }
  return readTemplateFile(chapter.file, chapter.markdown);
}

export function renderDeliveryDocument(input: {
  identity: CheckoutIdentity;
  answers: IntakeAnswers;
  documentId: string;
  version?: number;
}): RenderedDocument {
  const generatedAt = formatBerlinIso();
  const generatedAtDisplay = formatBerlinDate();
  const versionLabel = formatVersionLabel(input.version);
  const openPoints = evaluateOpenPoints(input);
  const base: TemplateContext = {
    identity: input.identity,
    answers: input.answers,
    disclaimer: bundle.disclaimer,
    generatedAt,
    generatedAtDisplay,
    documentId: input.documentId,
    bundleVersion: bundle.version,
    version: versionLabel,
    openPointsTable: openPointsTable(openPoints),
    roles: roleAssignments(input.answers),
  };

  const coverSource = readTemplateFile(
    "coverFile" in bundle ? String(bundle.coverFile) : "cover.md",
    bundle.coverMarkdown,
  );

  return {
    disclaimer: bundle.disclaimer,
    cover: renderTemplate(coverSource, base).trim(),
    chapters: (bundle.chapters as BundleChapter[]).map((chapter) => {
      const source = chapterMarkdown(chapter, input.answers);
      const body = renderTemplate(source, base).trim();
      return {
        id: chapter.id,
        title: headingTitle(body, chapter.title || chapter.id),
        body,
      };
    }),
    openPoints,
    generatedAt,
    generatedAtDisplay,
    versionLabel,
  };
}

export const deliveryBundle = bundle;
