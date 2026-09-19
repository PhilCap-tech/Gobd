import bundle from "@/content/delivery-templates/bundle.json";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

export type OpenPointSeverity = "low" | "medium" | "high";

export type DeliveryOpenPoint = {
  id: string;
  title: string;
  severity: OpenPointSeverity;
  status: "open";
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

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.filter(Boolean).length === 0;
  return String(value).trim() === "";
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item).trim()).filter(Boolean).join(", ");
    return joined || "nicht angegeben";
  }
  if (value == null) return "nicht angegeben";
  const text = String(value).trim();
  return text || "nicht angegeben";
}

function lookup(context: TemplateContext, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, token: string) => {
    if (token === "openPointsTable") return context.openPointsTable;
    if (token === "generatedAt") return context.generatedAt;
    if (token === "disclaimer") return context.disclaimer;
    if (token === "documentId") return context.documentId;
    if (token === "bundleVersion") return context.bundleVersion;
    return formatValue(lookup(context, token));
  });
}

export function evaluateOpenPoints(answers: IntakeAnswers): DeliveryOpenPoint[] {
  const points: DeliveryOpenPoint[] = [];
  for (const rule of bundle.openPointsRules) {
    const always = "always" in rule && rule.always === true;
    const field = "field" in rule ? rule.field : undefined;
    const empty = field
      ? isEmptyValue(answers[field as keyof IntakeAnswers])
      : false;
    if (always || empty) {
      points.push({
        id: rule.id,
        title: rule.title,
        severity: rule.severity as OpenPointSeverity,
        status: "open",
      });
    }
  }
  return points;
}

function openPointsTable(points: DeliveryOpenPoint[]): string {
  if (points.length === 0) {
    return "Keine offenen Punkte aus den Intake-Regeln.";
  }
  return points
    .map((point) => `- [${point.severity}] ${point.title}`)
    .join("\n");
}

export function renderDeliveryDocument(input: {
  identity: CheckoutIdentity;
  answers: IntakeAnswers;
  documentId: string;
}): RenderedDocument {
  const generatedAt = new Date().toLocaleString("de-DE");
  const openPoints = evaluateOpenPoints(input.answers);
  const base = {
    identity: input.identity,
    answers: input.answers,
    disclaimer: bundle.disclaimer,
    generatedAt,
    documentId: input.documentId,
    bundleVersion: bundle.version,
    openPointsTable: openPointsTable(openPoints),
  } satisfies TemplateContext;

  return {
    disclaimer: bundle.disclaimer,
    cover: renderTemplate(bundle.coverMarkdown, base).trim(),
    chapters: bundle.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      body: renderTemplate(chapter.bodyMarkdown, base).trim(),
    })),
    openPoints,
    generatedAt,
  };
}

export const deliveryBundle = bundle;
