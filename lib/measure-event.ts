import { AMPEL_STEP_QUESTION_MAX, AMPEL_STEP_QUESTION_MIN, type AmpelStepFields } from "@/lib/ampel-step-event";
import { isMeasureChannel, type MeasureChannel } from "@/lib/measure-channel";

/**
 * Cookieless aggregate rows for Messlücken. One row is one event.
 * Cells are the Berlin day, the metric, the question number (answers only),
 * the channel class and the cohort. No email, IP, click id or draft key.
 *
 * Messbeginn is the Berlin day of the first production write for that
 * metric, stored once and never moved earlier. Days before it, and every
 * day while that marker is missing, stay out of the counts. Nothing is
 * backfilled. The sheet itself is not trimmed; the admin window is 14 days,
 * same as the Ampel step and homepage counters.
 *
 * Every channel is the class of that event's own request, not of an
 * earlier landing.
 */

export const MEASURE_METRICS = [
  "intake_start",
  "magic_link_first_login",
  "ampel_start",
  "ampel_answer",
  "ampel_result",
] as const;

export type MeasureMetric = (typeof MEASURE_METRICS)[number];

export const MEASURE_COHORTS = ["standard", "test"] as const;

export type MeasureCohort = (typeof MEASURE_COHORTS)[number];

export const MEASURE_COLUMNS = ["date", "metric", "n", "channel", "cohort"] as const;

export const MEASURE_WINDOW_DAYS = 14;

export const MEASURE_NOT_MEASURED_LABEL = "nicht gemessen";

export const MEASURE_LABELS: Record<MeasureMetric, string> = {
  intake_start: "Fragebogen-Start",
  magic_link_first_login: "Erster erfolgreicher Magic-Link-Login (neues Konto)",
  ampel_start: "Ampel-Start",
  ampel_answer: "Ampel-Antworten",
  ampel_result: "Ampel-Ergebnis",
};

/** Shown on every metric. This is not the channel of an earlier visit. */
export const MEASURE_CHANNEL_BASIS_LABEL = "Kanal des Ereignis-Requests";

export const MEASURE_CHANNEL_LABELS: Record<MeasureChannel, string> = {
  search_unklar: "Suche, unklar",
  paid: "Bezahlt",
  direct: "Direkt",
  unknown: "Unbekannt",
};

export type MeasureRow = {
  date: string;
  metric: MeasureMetric;
  n: string;
  channel: MeasureChannel;
  cohort: MeasureCohort;
};

export type MeasureChannelCounts = Record<MeasureChannel, number>;

export type MeasureAnswerStat = {
  n: number;
  standard: MeasureChannelCounts;
  test: MeasureChannelCounts;
};

export type MeasureDayStat = {
  date: string;
  measured: boolean;
  standard: MeasureChannelCounts;
  test: MeasureChannelCounts;
  answers: MeasureAnswerStat[];
};

export type MeasureStarts = Partial<Record<MeasureMetric, string | null>>;

export type MeasureMetricReport = {
  metric: MeasureMetric;
  label: string;
  /** Berlin day of the first production write, or null when none exists yet. */
  from: string | null;
  channelBasis: "ereignis-request";
  channelBasisLabel: string;
  days: MeasureDayStat[];
  total: { standard: MeasureChannelCounts; test: MeasureChannelCounts };
};

export type MeasureReport = {
  timezone: "Europe/Berlin";
  windowDays: typeof MEASURE_WINDOW_DAYS;
  metrics: MeasureMetricReport[];
  hasRows: boolean;
};

const METRIC_SET = new Set<string>(MEASURE_METRICS);
const COHORT_SET = new Set<string>(MEASURE_COHORTS);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const BERLIN_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((item) => item.type === type)?.value ?? "0");
}

/** Calendar day in Europe/Berlin, `YYYY-MM-DD`. */
export function measureDate(now: Date): string {
  const parts = BERLIN_DAY.formatToParts(now);
  const year = part(parts, "year");
  const month = String(part(parts, "month")).padStart(2, "0");
  const day = String(part(parts, "day")).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyChannelCounts(): MeasureChannelCounts {
  return { search_unklar: 0, paid: 0, direct: 0, unknown: 0 };
}

export function channelTotal(counts: MeasureChannelCounts): number {
  return counts.search_unklar + counts.paid + counts.direct + counts.unknown;
}

export function addChannelCounts(left: MeasureChannelCounts, right: MeasureChannelCounts): MeasureChannelCounts {
  return {
    search_unklar: left.search_unklar + right.search_unklar,
    paid: left.paid + right.paid,
    direct: left.direct + right.direct,
    unknown: left.unknown + right.unknown,
  };
}

/** A questionnaire start is the first create. A later autosave is not. */
export function shouldCountIntakeStart(stored: unknown): boolean {
  return stored == null;
}

/**
 * Ampel funnel on top of the existing step beacon.
 * Start is question 1 shown. Answers keep the question number.
 * The result is the no-email result view, or a v1 submit that came back
 * ok / pending_ok. Other step events stay on the old sheet only.
 */
export function measureMetricFromAmpelStep(fields: AmpelStepFields): { metric: MeasureMetric; n: string } | null {
  if (fields.event === "ampel_q_view" && fields.n === "1") return { metric: "ampel_start", n: "" };
  if (fields.event === "ampel_q_answer") return { metric: "ampel_answer", n: fields.n };
  if (fields.event === "ampel_result_view") return { metric: "ampel_result", n: "" };
  if (fields.event === "ampel_submit_result" && (fields.status === "ok" || fields.status === "pending_ok")) {
    return { metric: "ampel_result", n: "" };
  }
  return null;
}

export function measureCells(row: MeasureRow): string[] {
  return [row.date, row.metric, row.n, row.channel, row.cohort];
}

function cell(raw: string[] | undefined, index: number): string {
  return (raw?.[index] ?? "").trim();
}

function parseStoredRow(raw: string[]): MeasureRow | null {
  const date = cell(raw, 0);
  const metric = cell(raw, 1);
  const n = cell(raw, 2);
  const channel = cell(raw, 3);
  const cohort = cell(raw, 4);
  if (!DATE_ONLY.test(date) || date.includes("T") || date.includes(":")) return null;
  if (!METRIC_SET.has(metric)) return null;
  if (!isMeasureChannel(channel)) return null;
  if (!COHORT_SET.has(cohort)) return null;
  if (metric === "ampel_answer") {
    if (!/^(?:[1-9]|10)$/.test(n)) return null;
  } else if (n) {
    return null;
  }
  return {
    date,
    metric: metric as MeasureMetric,
    n: metric === "ampel_answer" ? String(Number(n)) : "",
    channel,
    cohort: cohort as MeasureCohort,
  };
}

export function measureRowsFromValues(values: string[][]): MeasureRow[] {
  if (values.length === 0) return [];
  const header = values[0].map((item) => item.trim());
  const headerOk =
    MEASURE_COLUMNS.every((column, index) => header[index] === column) &&
    header.slice(MEASURE_COLUMNS.length).every((item) => item === "");
  if (!headerOk) return [];
  const rows: MeasureRow[] = [];
  for (const raw of values.slice(1)) {
    const row = parseStoredRow(raw);
    if (row) rows.push(row);
  }
  return rows;
}

function addCalendarDays(iso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function measureWindowDates(now: Date): string[] {
  const today = measureDate(now);
  const dates: string[] = [];
  for (let offset = MEASURE_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    dates.push(addCalendarDays(today, -offset));
  }
  return dates;
}

function emptyAnswers(): MeasureAnswerStat[] {
  const stats: MeasureAnswerStat[] = [];
  for (let n = AMPEL_STEP_QUESTION_MIN; n <= AMPEL_STEP_QUESTION_MAX; n += 1) {
    stats.push({ n, standard: emptyChannelCounts(), test: emptyChannelCounts() });
  }
  return stats;
}

function bump(counts: MeasureChannelCounts, channel: MeasureChannel): void {
  counts[channel] += 1;
}

function startDate(starts: MeasureStarts | undefined, metric: MeasureMetric): string | null {
  const value = starts?.[metric];
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function buildMeasureReport(rows: MeasureRow[], options: { now: Date; starts?: MeasureStarts }): MeasureReport {
  const dates = measureWindowDates(options.now);
  const inWindow = new Set(dates);
  let hasRows = false;
  const metrics = MEASURE_METRICS.map((metric) => {
    const from = startDate(options.starts, metric);
    const days: MeasureDayStat[] = dates.map((date) => ({
      date,
      measured: from != null && date >= from,
      standard: emptyChannelCounts(),
      test: emptyChannelCounts(),
      answers: metric === "ampel_answer" ? emptyAnswers() : [],
    }));
    const byDate = new Map(days.map((day) => [day.date, day]));
    for (const row of rows) {
      if (row.metric !== metric || !inWindow.has(row.date) || from == null || row.date < from) continue;
      const day = byDate.get(row.date);
      if (!day || !day.measured) continue;
      hasRows = true;
      bump(row.cohort === "test" ? day.test : day.standard, row.channel);
      if (metric === "ampel_answer") {
        const answer = day.answers.find((item) => item.n === Number(row.n));
        if (answer) bump(row.cohort === "test" ? answer.test : answer.standard, row.channel);
      }
    }
    const total = days.reduce(
      (sum, day) => {
        if (!day.measured) return sum;
        return {
          standard: addChannelCounts(sum.standard, day.standard),
          test: addChannelCounts(sum.test, day.test),
        };
      },
      { standard: emptyChannelCounts(), test: emptyChannelCounts() },
    );
    return {
      metric,
      label: MEASURE_LABELS[metric],
      from,
      channelBasis: "ereignis-request" as const,
      channelBasisLabel: MEASURE_CHANNEL_BASIS_LABEL,
      days,
      total,
    };
  });
  return {
    timezone: "Europe/Berlin",
    windowDays: MEASURE_WINDOW_DAYS,
    metrics,
    hasRows,
  };
}

export function formatMeasureDay(iso: string): string {
  if (iso === "Summe") return "Summe";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatMeasureFrom(iso: string | null): string {
  if (!iso) return "Messbeginn: noch kein Produktiv-Ereignis";
  return `Messbeginn ${formatMeasureDay(iso)}`;
}
