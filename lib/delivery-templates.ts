import { readFileSync } from "node:fs";
import path from "node:path";
import bundle from "@/content/delivery-templates/bundle.json";
import {
  evaluateOpenPoints,
  intakeValueContainsToken,
  intakeValueHasUnconfirmedScope,
  isEmptyIntakeValue,
  type DeliveryOpenPoint,
} from "@/lib/open-points";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";
import { versionMetaSentence as buildVersionMetaSentence } from "@/lib/versioning";

export type { DeliveryOpenPoint, OpenPointSeverity } from "@/lib/open-points";
export { evaluateOpenPoints, isEmptyIntakeValue } from "@/lib/open-points";

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
  /** Display date `dd.mm.yyyy`, empty when this render has no Gültig-ab. */
  validFromDisplay: string;
  versionMetaSentence: string;
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
  validFrom: string;
  validTo: string;
  changeSummary: string;
  changedBy: string;
  /** Gültig-ab when set, otherwise the generation timestamp (legacy history cell). */
  historyDate: string;
  /** "ja" only when F05 is a filled name without an unconfirmed-scope marker. */
  kanzleiBucht: string;
  /** "ja" when the Kanzlei field is filled but the scope is not confirmed. */
  kanzleiUnbestaetigt: string;
};

type Filter =
  | { name: "join"; sep: string }
  | { name: "or"; fallback: string }
  | { name: "orPath"; path: string };

type BundleChapter = {
  id: string;
  title?: string;
  file?: string;
  markdown: string;
  includeIf?:
    | boolean
    | {
        anyPathNonEmpty?: string[];
        anyTokenIn?: { path: string; tokens: string[] }[];
        /** Delivery 4.0.0: [path, tokens]. „Post“ is a whole word. */
        containsAny?: [string, string[]];
        /** Delivery 4.0.0: omit the chapter when this path is empty. */
        pathNonEmpty?: string;
      };
};

/** „Post“ must not match „Postfach“. Other tokens stay substring matches. */
function intakeTokenMatches(value: unknown, token: string): boolean {
  if (token.trim().toLowerCase() === "post") {
    const items = Array.isArray(value) ? value.map((item) => String(item)) : [String(value ?? "")];
    const re = /(^|[^\p{L}\p{N}])Post([^\p{L}\p{N}]|$)/iu;
    return items.some((item) => re.test(item));
  }
  return intakeValueContainsToken(value, token);
}

function firstFilled(...values: string[]): string {
  for (const value of values) {
    if (!isEmptyIntakeValue(value)) return value.trim();
  }
  return "nicht angegeben";
}

/**
 * Legacy role fallbacks. Do not print these in customer templates: a fallback
 * names a person for a step the questionnaire did not confirm.
 */
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
      continue;
    }
    const orPath = token.match(/^or\s+([A-Za-z_][\w.]*)$/);
    if (orPath) {
      filters.push({ name: "orPath", path: orPath[1] ?? "" });
    }
  }
  return { path: pathExpr, filters };
}

function resolveFilters(filters: Filter[], context: TemplateContext): Filter[] {
  const resolved: Filter[] = [];
  for (const filter of filters) {
    if (filter.name !== "orPath") {
      resolved.push(filter);
      continue;
    }
    const value = lookup(context, filter.path);
    if (isEmptyIntakeValue(value)) continue;
    const fallback = Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean).join(", ")
      : String(value).trim();
    if (fallback) resolved.push({ name: "or", fallback });
  }
  return resolved;
}

/** Internal and fixture ids must not print on the customer document. */
function customerDocumentId(documentId: string): string {
  const id = documentId.trim();
  if (!id) return "";
  const lower = id.toLowerCase();
  if (
    lower === "check" ||
    lower === "plan" ||
    lower === "edit" ||
    lower === "regenerated" ||
    lower.startsWith("partner-") ||
    lower.startsWith("sample-") ||
    lower.includes("stub") ||
    lower.includes("stripe") ||
    lower.startsWith("cs_") ||
    lower.startsWith("cus_") ||
    lower.includes("cs_test") ||
    lower.includes("cus_")
  ) {
    return "";
  }
  return id;
}

function applyFilters(value: unknown, filters: Filter[]): string {
  let current: unknown = value;
  if (filters.length === 0) {
    if (isEmptyIntakeValue(current)) return "nicht angegeben";
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
      current = isEmptyIntakeValue(current) ? filter.fallback : current;
    }
  }
  if (Array.isArray(current)) {
    return current.map((item) => String(item).trim()).filter(Boolean).join(", ");
  }
  return current == null ? "" : String(current);
}

function conditionHolds(expr: string, context: TemplateContext): boolean {
  const contains = expr.match(/^(.+?)\s+contains\s+["']([^"']+)["']$/);
  if (contains) {
    return intakeValueContainsToken(lookup(context, contains[1].trim()), contains[2]);
  }
  const pathExpr = expr.trim();
  const value = lookup(context, pathExpr);
  if (
    pathExpr === "answers.steuerberater" &&
    intakeValueHasUnconfirmedScope(value)
  ) {
    return false;
  }
  return !isEmptyIntakeValue(value);
}

function findBlockEnd(
  input: string,
  from: number,
): { bodyEnd: number; tagEnd: number } {
  let depth = 1;
  let index = from;
  while (index < input.length) {
    const nextOpen = input.indexOf("{{#", index);
    const nextClose = input.indexOf("{{/", index);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      const closeBrace = input.indexOf("}}", nextOpen);
      index = closeBrace === -1 ? input.length : closeBrace + 2;
      continue;
    }
    depth -= 1;
    const closeBrace = input.indexOf("}}", nextClose);
    const tagEnd = closeBrace === -1 ? input.length : closeBrace + 2;
    if (depth === 0) return { bodyEnd: nextClose, tagEnd };
    index = tagEnd;
  }
  return { bodyEnd: input.length, tagEnd: input.length };
}

function renderBlocks(template: string, context: TemplateContext): string {
  let output = "";
  let index = 0;
  while (index < template.length) {
    const open = template.indexOf("{{#", index);
    if (open === -1) {
      output += template.slice(index);
      break;
    }
    output += template.slice(index, open);
    const tagEnd = template.indexOf("}}", open);
    if (tagEnd === -1) {
      output += template.slice(open);
      break;
    }
    const tag = template.slice(open + 3, tagEnd).trim();
    const unless = tag.startsWith("unless");
    const expr = tag.replace(/^(if|unless)\s+/, "");
    const block = findBlockEnd(template, tagEnd + 2);
    const include = unless
      ? !conditionHolds(expr, context)
      : conditionHolds(expr, context);
    if (include) output += renderBlocks(template.slice(tagEnd + 2, block.bodyEnd), context);
    index = block.tagEnd;
  }
  return output;
}

function renderValues(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([^}#/][^}]*?)\s*\}\}/g, (_, expr: string) => {
    const { path: pathExpr, filters } = parsePlaceholder(expr);
    const resolved = resolveFilters(filters, context);
    if (pathExpr === "openPointsTable") return context.openPointsTable;
    if (pathExpr === "generatedAt") return context.generatedAt;
    if (pathExpr === "generatedAtDisplay") return context.generatedAtDisplay;
    if (pathExpr === "disclaimer") return context.disclaimer;
    if (pathExpr === "documentId") {
      return applyFilters(customerDocumentId(context.documentId), resolved);
    }
    if (pathExpr === "bundleVersion") return context.bundleVersion;
    if (pathExpr === "version") return context.version;
    return applyFilters(lookup(context, pathExpr), resolved);
  });
}

/** Frage-IDs stay in the markdown as comments and never reach the customer PDF. */
function stripInternalMarkers(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return stripInternalMarkers(renderValues(renderBlocks(template, context), context));
}

function openPointsTable(points: DeliveryOpenPoint[]): string {
  if (points.length === 0) {
    return "Keine offenen Punkte. Das ist keine Freigabe durch die Geschäftsführung und kein Nachweis, dass der Prozess vollständig beschrieben ist.";
  }
  const rows = points
    .map((point) => {
      const title = point.title.replaceAll("|", "\\|");
      const who = (point.responsibility || "—").replaceAll("|", "\\|");
      const due = (point.dueDate || "nicht festgelegt").replaceAll("|", "\\|");
      return `| ${point.id} | ${point.priority} | ${title} | ${who} | ${due} |`;
    })
    .join("\n");
  return `| Kennung | Priorität | Zu klären | Verantwortung | Zieltermin |\n| --- | --- | --- | --- | --- |\n${rows}`;
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

export function formatBerlinDateTime(date = new Date()): string {
  const formatted = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${formatted} Uhr`;
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

function chapterMarkdown(chapter: BundleChapter): string {
  return readTemplateFile(chapter.file, chapter.markdown);
}

function chapterApplies(
  chapter: BundleChapter,
  context: { identity: CheckoutIdentity; answers: IntakeAnswers },
): boolean {
  const includeIf = chapter.includeIf;
  if (includeIf === false) return false;
  if (includeIf === true || includeIf == null) return true;
  const root = context as TemplateContext;
  if (typeof includeIf.pathNonEmpty === "string") {
    return !isEmptyIntakeValue(lookup(root, includeIf.pathNonEmpty));
  }
  const containsAny = includeIf.containsAny;
  if (Array.isArray(containsAny) && typeof containsAny[0] === "string" && Array.isArray(containsAny[1])) {
    const pathExpr = containsAny[0];
    return containsAny[1].some((token) => intakeTokenMatches(lookup(root, pathExpr), token));
  }
  const paths = includeIf.anyPathNonEmpty ?? [];
  const tokenGroups = includeIf.anyTokenIn ?? [];
  if (paths.length === 0 && tokenGroups.length === 0) return true;
  const pathOk =
    paths.length === 0 ||
    paths.some((pathExpr) => !isEmptyIntakeValue(lookup(root, pathExpr)));
  const tokenOk =
    tokenGroups.length === 0 ||
    tokenGroups.some((group) =>
      group.tokens.some((token) => intakeTokenMatches(lookup(root, group.path), token)),
    );
  return pathOk && tokenOk;
}

export function renderDeliveryDocument(input: {
  identity: CheckoutIdentity;
  answers: IntakeAnswers;
  documentId: string;
  version?: number;
  /** Display strings (`dd.mm.yyyy`). Omitted on renders without version metadata. */
  versionMeta?: {
    validFrom?: string;
    validTo?: string;
    changeSummary?: string;
    changedBy?: string;
  };
}): RenderedDocument {
  const generatedAt = formatBerlinDateTime();
  const generatedAtDisplay = formatBerlinDate();
  const versionLabel = formatVersionLabel(input.version);
  const openPoints = evaluateOpenPoints(input);
  const validFrom = input.versionMeta?.validFrom?.trim() ?? "";
  const validTo = input.versionMeta?.validTo?.trim() ?? "";
  const changeSummary = input.versionMeta?.changeSummary?.trim() ?? "";
  const changedBy = input.versionMeta?.changedBy?.trim() ?? "";
  const kanzleiUnbestaetigt = intakeValueHasUnconfirmedScope(input.answers.steuerberater);
  const kanzleiBucht =
    !isEmptyIntakeValue(input.answers.steuerberater) && !kanzleiUnbestaetigt;
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
    validFrom,
    validTo,
    changeSummary,
    changedBy,
    historyDate: validFrom || generatedAt,
    kanzleiBucht: kanzleiBucht ? "ja" : "",
    kanzleiUnbestaetigt: kanzleiUnbestaetigt ? "ja" : "",
  };

  const coverSource = readTemplateFile(
    "coverFile" in bundle ? String(bundle.coverFile) : "chapters/00-cover-freigabe.md",
    bundle.coverMarkdown,
  );

  return {
    disclaimer: bundle.disclaimer,
    cover: renderTemplate(coverSource, base).trim(),
    chapters: (bundle.chapters as BundleChapter[])
      .filter((chapter) =>
        chapterApplies(chapter, {
          identity: input.identity,
          answers: input.answers,
        }),
      )
      .map((chapter) => {
      const source = chapterMarkdown(chapter);
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
    validFromDisplay: validFrom,
    versionMetaSentence: buildVersionMetaSentence({
      validFrom,
      validTo,
      changeSummary,
      changedBy,
    }),
  };
}

export const deliveryBundle = bundle;
