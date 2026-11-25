/**
 * Retention for the counters that already run (#321/#322).
 * Markers 30 days from creation, no extension. Count rows 24 months
 * after the count day. Test rows 7 days. `starts/…` is never deleted.
 * Switches default off. Dry-run counts only.
 *
 * link_requested, verify_human and verify_scanner are ordinary rows on
 * the messluecken tab. They have no marker file. A standard row follows
 * the 24-month rule; a test row follows the 7-day rule.
 */
export const MEASURE_MARKER_DAYS = 30;
export const MEASURE_ROW_MONTHS = 24;
export const MEASURE_TEST_DAYS = 7;
export const MEASURE_MARKER_PREFIX = "gobd/measure-claim/";

export const MEASURE_COUNT_TABS = {
  home_cta: { dateIndex: 0, cohortIndex: null },
  messluecken: { dateIndex: 0, cohortIndex: 4 },
  ampel_steps: { dateIndex: 0, cohortIndex: null },
  // SV table: only sv_visit, date in column H, no cohort (arm=test is not a 7-day test row).
  schnellversion_49: { dateIndex: 7, eventIndex: 0, eventName: "sv_visit" },
} as const;

export type MeasureCountTab = keyof typeof MEASURE_COUNT_TABS;
export type MeasureRetentionMode = "off" | "dry-run" | "execute";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function on(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "ja" || value === "on";
}

/** Both unset: off. Dry-run wins, so a test run cannot delete. */
export function measureRetentionMode(env: NodeJS.ProcessEnv = process.env): MeasureRetentionMode {
  const dry = on(env.MEASURE_RETENTION_DRY_RUN_ENABLED);
  const execute = on(env.MEASURE_RETENTION_EXECUTE_ENABLED);
  if (!dry && !execute) return "off";
  if (dry) return "dry-run";
  return "execute";
}

export function isMeasureCountTab(title: string): title is MeasureCountTab {
  return Object.prototype.hasOwnProperty.call(MEASURE_COUNT_TABS, title);
}

function formatUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDays(iso: string, days: number): string {
  if (!DAY.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  return formatUtc(new Date(Date.UTC(year, month - 1, day + days)));
}

export function shiftMonths(iso: string, months: number): string {
  if (!DAY.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
  return formatUtc(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(day, last))));
}

export function dayFromCell(value: string): string | null {
  const day = value.trim().slice(0, 10);
  return DAY.test(day) ? day : null;
}

/**
 * 1-based sheet rows to delete. Header row 1 is never included.
 * An unparseable date is kept. A cohort other than standard or test is kept.
 * Tabs without a cohort column use only the 24-month rule: a test row
 * cannot be told apart from a standard row there.
 * schnellversion_49: only rows whose event is sv_visit, date in column H,
 * 24-month cutoff, no cohort logic. Other SV events stay. Unparseable
 * sv_visit dates are kept and counted.
 */
export function countRowsToDelete(input: { tab: MeasureCountTab; values: string[][]; today: string }): {
  rows: number[];
  testRows: number;
  unparseable: number;
} {
  const rule = MEASURE_COUNT_TABS[input.tab];
  const dateIndex = rule.dateIndex;
  const eventName = "eventName" in rule ? rule.eventName : null;
  const eventIndex = "eventIndex" in rule ? rule.eventIndex : 0;
  const cohortIndex = "cohortIndex" in rule ? rule.cohortIndex : null;
  const valueCutoff = shiftMonths(input.today, -MEASURE_ROW_MONTHS);
  const testCutoff = shiftDays(input.today, -MEASURE_TEST_DAYS);
  const rows: number[] = [];
  let testRows = 0;
  let unparseable = 0;
  for (let index = 1; index < input.values.length; index += 1) {
    const raw = input.values[index] ?? [];
    if (eventName && (raw[eventIndex] ?? "").trim() !== eventName) continue;
    const day = dayFromCell(raw[dateIndex] ?? "");
    if (!day) {
      if (eventName) unparseable += 1;
      continue;
    }
    if (eventName || cohortIndex == null) {
      if (day < valueCutoff) rows.push(index + 1);
      continue;
    }
    const cohort = (raw[cohortIndex] ?? "").trim();
    if (cohort === "test" && day < testCutoff) {
      rows.push(index + 1);
      testRows += 1;
    } else if (cohort === "standard" && day < valueCutoff) {
      rows.push(index + 1);
    }
  }
  return { rows, testRows, unparseable };
}

/** Plan for sv_visit rows only: counts, date range of due days, no identifiers. */
export function planSvVisitPurge(values: string[][], today: string): {
  rows: number[];
  unparseable: number;
  dayMin: string | null;
  dayMax: string | null;
} {
  const plan = countRowsToDelete({ tab: "schnellversion_49", values, today });
  const days: string[] = [];
  for (const rowNumber of plan.rows) {
    const day = dayFromCell(values[rowNumber - 1]?.[7] ?? "");
    if (day) days.push(day);
  }
  days.sort();
  return {
    rows: plan.rows,
    unparseable: plan.unparseable,
    dayMin: days[0] ?? null,
    dayMax: days[days.length - 1] ?? null,
  };
}

export function markerDay(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { at?: unknown; date?: unknown };
    const raw = typeof parsed.at === "string" ? parsed.at : typeof parsed.date === "string" ? parsed.date : "";
    return dayFromCell(raw);
  } catch {
    return null;
  }
}

/**
 * HMAC markers under gobd/measure-claim/, except starts/….
 * Test claim files have no cohort, so they follow the 30-day marker rule.
 * starts/… is kept. An unreadable body is kept. Anything else is skipped.
 */
/** A marker path whose date or body cannot be read. Those files stay. `starts/…` is not counted. */
export function markerUnreadable(pathname: string, body: string): boolean {
  if (!pathname.startsWith(MEASURE_MARKER_PREFIX) || pathname.includes("..")) return false;
  if (pathname.startsWith(`${MEASURE_MARKER_PREFIX}starts/`) || pathname.includes("/starts/")) return false;
  return markerDay(body) == null;
}

export function markerAction(pathname: string, body: string, today: string): "keep" | "delete" | "skip" {
  if (!pathname.startsWith(MEASURE_MARKER_PREFIX) || pathname.includes("..")) return "skip";
  if (pathname.startsWith(`${MEASURE_MARKER_PREFIX}starts/`) || pathname.includes("/starts/")) return "skip";
  const day = markerDay(body);
  if (!day) return "keep";
  const cutoff = shiftDays(today, -MEASURE_MARKER_DAYS);
  return day < cutoff ? "delete" : "keep";
}
