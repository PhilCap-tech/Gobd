import { AMPEL_UTM_NONE } from "@/lib/ampel";
import type { ReadinessLead } from "@/lib/readiness";

export const AMPEL_STATS_TIMEZONE = "Europe/Berlin";

export type AmpelCount = {
  total: number;
  today: number;
  last7Days: number;
};

export type AmpelOptInLabel = "keins" | "unbestätigt" | "bestätigt" | "widerrufen" | "unbekannt";
export type AmpelMailedLabel = "ja" | "nein" | "unbekannt";
export type AmpelResultLabel = "Grün" | "Gelb" | "Rot" | "unbekannt";

export type AmpelStatsEntry = {
  at: string;
  timeBerlin: string;
  email: string;
  result: AmpelResultLabel;
  optIn: AmpelOptInLabel;
  mailed: AmpelMailedLabel;
  utmSource: string;
  test: boolean;
};

export type AmpelStatsReport = {
  timezone: typeof AMPEL_STATS_TIMEZONE;
  generatedAt: string;
  counts: {
    withTests: AmpelCount;
    withoutTests: AmpelCount;
  };
  includeTests: boolean;
  entries: AmpelStatsEntry[];
};

const BERLIN_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: AMPEL_STATS_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const BERLIN_LABEL = new Intl.DateTimeFormat("de-DE", {
  timeZone: AMPEL_STATS_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = Number(parts.find((item) => item.type === type)?.value ?? "0");
  return type === "hour" ? value % 24 : value;
}

/** Berlin wall clock expressed as a UTC timestamp, minus the real instant. */
function berlinOffsetMs(instant: Date): number {
  const parts = BERLIN_PARTS.formatToParts(instant);
  const asUtc = Date.UTC(
    part(parts, "year"),
    part(parts, "month") - 1,
    part(parts, "day"),
    part(parts, "hour"),
    part(parts, "minute"),
    part(parts, "second"),
  );
  return asUtc - instant.getTime();
}

export function berlinYmd(instant: Date): { year: number; month: number; day: number } {
  const parts = BERLIN_PARTS.formatToParts(instant);
  return {
    year: part(parts, "year"),
    month: part(parts, "month"),
    day: part(parts, "day"),
  };
}

/** UTC timestamp of 00:00 on that calendar day in Europe/Berlin. */
export function berlinDayStart(year: number, month: number, day: number): number {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = berlinOffsetMs(new Date(guess));
  const start = guess - offset;
  const offsetAtStart = berlinOffsetMs(new Date(start));
  return offsetAtStart === offset ? start : guess - offsetAtStart;
}

function addCalendarDays(
  ymd: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function ampelCountWindows(now: Date): { todayStart: number; last7Start: number } {
  const today = berlinYmd(now);
  const start7 = addCalendarDays(today, -6);
  return {
    todayStart: berlinDayStart(today.year, today.month, today.day),
    last7Start: berlinDayStart(start7.year, start7.month, start7.day),
  };
}

export function isAmpelTestEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0 || at !== normalized.lastIndexOf("@")) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || !domain || domain.includes(" ")) return false;
  if (local.startsWith("gobd16x-")) return true;
  if (domain === "maxxspace.com" || domain === "mail.tm" || domain === "gobd-doku-erstellen.de") {
    return true;
  }
  return normalized === "cappe@gmx.de";
}

export function ampelLeadInstant(lead: Pick<ReadinessLead, "timestamp" | "consentAt">): number | null {
  const ms = Date.parse(lead.timestamp || lead.consentAt);
  return Number.isFinite(ms) ? ms : null;
}

export function formatBerlinTime(ms: number): string {
  if (!Number.isFinite(ms)) return "unbekannt";
  return BERLIN_LABEL.format(new Date(ms));
}

export function ampelResultLabel(light: string): AmpelResultLabel {
  switch (light.trim()) {
    case "gruen":
      return "Grün";
    case "gelb":
      return "Gelb";
    case "rot":
      return "Rot";
    default:
      return "unbekannt";
  }
}

export function ampelOptInLabel(lead: Pick<ReadinessLead, "marketingOptIn" | "status">): AmpelOptInLabel {
  const value = lead.marketingOptIn.trim();
  if (lead.status === "ampel_expired" && !value) return "unbekannt";
  switch (value) {
    case "":
      return "keins";
    case "pending":
      return "unbestätigt";
    case "confirmed":
      return "bestätigt";
    case "withdrawn":
      return "widerrufen";
    default:
      return "unbekannt";
  }
}

export function ampelMailedLabel(value: string): AmpelMailedLabel {
  if (value === "ja" || value === "nein") return value;
  return "unbekannt";
}

export function ampelUtmLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "unbekannt";
  if (trimmed === AMPEL_UTM_NONE) return "keine";
  return trimmed;
}

function emptyCount(): AmpelCount {
  return { total: 0, today: 0, last7Days: 0 };
}

function bump(count: AmpelCount, instant: number | null, windows: { todayStart: number; last7Start: number }, nowMs: number) {
  count.total += 1;
  if (instant == null || instant > nowMs) return;
  if (instant >= windows.todayStart) count.today += 1;
  if (instant >= windows.last7Start) count.last7Days += 1;
}

export function buildAmpelStats(
  rows: readonly ReadinessLead[],
  options: { now?: Date; includeTests?: boolean } = {},
): AmpelStatsReport {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const windows = ampelCountWindows(now);
  const includeTests = options.includeTests === true;
  const withTests = emptyCount();
  const withoutTests = emptyCount();
  const entries: AmpelStatsEntry[] = [];

  for (const row of rows) {
    if (!row.leadId.startsWith("ampel-")) continue;
    const instant = ampelLeadInstant(row);
    const test = isAmpelTestEmail(row.email);
    bump(withTests, instant, windows, nowMs);
    if (!test) bump(withoutTests, instant, windows, nowMs);
    if (test && !includeTests) continue;
    entries.push({
      at: instant == null ? "" : new Date(instant).toISOString(),
      timeBerlin: instant == null ? "unbekannt" : formatBerlinTime(instant),
      email: row.email.trim(),
      result: ampelResultLabel(row.ampelLight),
      optIn: ampelOptInLabel(row),
      mailed: ampelMailedLabel(row.mailed),
      utmSource: ampelUtmLabel(row.utmSource),
      test,
    });
  }

  entries.sort((left, right) => {
    const leftMs = Date.parse(left.at);
    const rightMs = Date.parse(right.at);
    const leftOk = Number.isFinite(leftMs);
    const rightOk = Number.isFinite(rightMs);
    if (leftOk && rightOk && leftMs !== rightMs) return rightMs - leftMs;
    if (leftOk !== rightOk) return leftOk ? -1 : 1;
    return left.email.localeCompare(right.email, "de");
  });

  return {
    timezone: AMPEL_STATS_TIMEZONE,
    generatedAt: now.toISOString(),
    counts: { withTests, withoutTests },
    includeTests,
    entries,
  };
}
