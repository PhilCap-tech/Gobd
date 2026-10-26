/**
 * Zentrales Fehler-Log (Datenschutz, CoS 26.10. 16:49).
 *
 * Gibt nur Kontext-Label, Fehlername und Status/Code aus: HTTP-Status als
 * Zahl (statusCode/status/response.status) oder ein kurzer Code-String
 * (Stripe `code`, Google/Node `code`). Nie message, body, response, stack
 * oder ein Feld mit `@`. Zusatzfelder (`extra`) nur als einfache Werte ohne `@`.
 * `scripts/check-log-hygiene.ts` sperrt rohe Fehlerobjekte in console.*.
 */

export type LogErrorLevel = "error" | "warn" | "info";

export type LogErrorFields = {
  name: string;
  status?: number;
  code?: string;
};

type ExtraValue = string | number | boolean | null | undefined;

const SAFE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;

function safeToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return SAFE_TOKEN.test(trimmed) ? trimmed : undefined;
}

function httpStatus(value: unknown): number | undefined {
  const number = typeof value === "string" && /^\d{3}$/.test(value.trim()) ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number) && number >= 100 && number <= 599
    ? number
    : undefined;
}

function field(source: unknown, key: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  try {
    return (source as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

/** Nur Name, Status und Code eines beliebigen Fehlerwerts. */
export function errorLogFields(error: unknown): LogErrorFields {
  let name = "Error";
  if (error instanceof Error) name = safeToken(error.name) ?? "Error";
  else if (error && typeof error === "object") name = safeToken(field(error, "name")) ?? "Error";
  else if (error === undefined || error === null) name = "unknown";
  else if (typeof error !== "string") name = typeof error;

  const response = field(error, "response");
  const status =
    httpStatus(field(error, "statusCode")) ??
    httpStatus(field(error, "status")) ??
    httpStatus(field(response, "status")) ??
    httpStatus(field(error, "code"));
  const rawCode = field(error, "code");
  const code = typeof rawCode === "string" && httpStatus(rawCode) === undefined ? safeToken(rawCode) : undefined;

  return {
    name,
    ...(status !== undefined ? { status } : {}),
    ...(code !== undefined ? { code } : {}),
  };
}

function safeExtra(extra: Record<string, ExtraValue> | undefined): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!extra) return out;
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      if (value.includes("@")) continue;
      out[key] = value.slice(0, 200);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Fehler protokollieren: `logError("[intake] POST fehlgeschlagen", error)`. */
export function logError(
  context: string,
  error: unknown,
  options: { level?: LogErrorLevel; extra?: Record<string, ExtraValue> } = {},
): void {
  const fields = { ...safeExtra(options.extra), ...errorLogFields(error) };
  const level = options.level ?? "error";
  if (level === "warn") console.warn(context, fields);
  else if (level === "info") console.info(context, fields);
  else console.error(context, fields);
}
