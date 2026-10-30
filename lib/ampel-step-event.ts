import { sanitizeVariantValue } from "@/lib/campaign-params";

/**
 * Variants already linked to /ampel-check (`v=a` on the homepage hero).
 * Anything else that still matches the src/v character whitelist is stored
 * as the fallback, so a free-form token never becomes a row value.
 */
export const AMPEL_STEP_KNOWN_VARIANTS = ["a", "default"] as const;

export const AMPEL_STEP_VARIANT_FALLBACK = "default";

export const AMPEL_STEP_COLUMNS = ["date", "event", "n", "status", "choice", "valid", "v", "device"] as const;

export const AMPEL_STEP_EVENTS = [
  "ampel_q_view",
  "ampel_q_answer",
  "ampel_email_view",
  "ampel_submit_click",
  "ampel_submit_result",
  "consent_choice",
  // Ampel ohne E-Mail (nur mit Flag AMPEL_NO_EMAIL_ENABLED / Preview-Override)
  "ampel_result_view",
  "ampel_report_offer_view",
  "ampel_report_submit",
  "ampel_report_sent",
  "ampel_product_click",
] as const;

/** Flag-on events without extra fields. */
const V2_PLAIN_EVENTS = new Set<string>(["ampel_result_view", "ampel_report_offer_view", "ampel_product_click"]);

export const AMPEL_STEP_RESULT_STATUSES = ["ok", "pending_ok", "400", "429", "5xx", "timeout"] as const;

export const AMPEL_STEP_CHOICES = ["accept", "reject"] as const;

export const AMPEL_STEP_QUESTION_MIN = 1;
export const AMPEL_STEP_QUESTION_MAX = 10;

export const AMPEL_STEP_BODY_MAX_BYTES = 512;

export const AMPEL_STEP_WINDOW_DAYS = 14;

export type AmpelStepEvent = (typeof AMPEL_STEP_EVENTS)[number];
export type AmpelStepResultStatus = (typeof AMPEL_STEP_RESULT_STATUSES)[number];
export type AmpelStepChoice = (typeof AMPEL_STEP_CHOICES)[number];
export type AmpelStepDevice = "mobile" | "desktop";
export type AmpelStepDeviceLabel = "gesamt" | AmpelStepDevice;

export type AmpelStepFields = {
  event: AmpelStepEvent;
  n: string;
  status: string;
  choice: string;
  valid: string;
  v: string;
};

export type AmpelStepRow = AmpelStepFields & {
  date: string;
  device: AmpelStepDevice;
};

const EVENT_SET = new Set<string>(AMPEL_STEP_EVENTS);
const STATUS_SET = new Set<string>(AMPEL_STEP_RESULT_STATUSES);
const CHOICE_SET = new Set<string>(AMPEL_STEP_CHOICES);
const KNOWN_VARIANT_SET = new Set<string>(AMPEL_STEP_KNOWN_VARIANTS);
const ALLOWED_KEYS = new Set(["event", "n", "status", "choice", "valid", "v"]);

const MOBILE_UA = /Mobile|Android|iPhone|iPad|iPod|IEMobile|Opera Mini|BlackBerry|webOS/i;

const BERLIN_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((item) => item.type === type)?.value ?? "0");
}

/** Calendar day in Europe/Berlin, `YYYY-MM-DD`, with no time. */
export function ampelStepDate(now: Date): string {
  const parts = BERLIN_DAY.formatToParts(now);
  const year = part(parts, "year");
  const month = String(part(parts, "month")).padStart(2, "0");
  const day = String(part(parts, "day")).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isAmpelStepDate(value: string): boolean {
  return DATE_ONLY.test(value);
}

export function isKnownAmpelStepVariant(value: string): boolean {
  return KNOWN_VARIANT_SET.has(value);
}

/**
 * Missing `v` becomes `default`. A known variant is kept. A well-formed
 * unknown variant becomes `default` and is not stored. Garbage returns null.
 */
export function resolveAmpelStepVariant(present: boolean, value: unknown): string | null {
  if (!present) return AMPEL_STEP_VARIANT_FALLBACK;
  if (typeof value !== "string") return null;
  const cleaned = sanitizeVariantValue(value);
  if (!cleaned) return null;
  if (KNOWN_VARIANT_SET.has(cleaned)) return cleaned;
  return AMPEL_STEP_VARIANT_FALLBACK;
}

export function ampelStepDevice(userAgent: string): AmpelStepDevice {
  return MOBILE_UA.test(userAgent) ? "mobile" : "desktop";
}

function isQuestionNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= AMPEL_STEP_QUESTION_MIN && value <= AMPEL_STEP_QUESTION_MAX;
}

function rejectedKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keep = new Set(allowed);
  return Object.keys(record).some((key) => !keep.has(key));
}

export function parseAmpelStepBody(input: unknown): AmpelStepFields | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) return null;
  }
  const event = record.event;
  if (typeof event !== "string" || !EVENT_SET.has(event)) return null;
  const variant = resolveAmpelStepVariant("v" in record, record.v);
  if (!variant) return null;
  const base = { v: variant, n: "", status: "", choice: "", valid: "" };

  if (event === "ampel_q_view" || event === "ampel_q_answer") {
    if (rejectedKeys(record, ["event", "n", "v"])) return null;
    if (!isQuestionNumber(record.n)) return null;
    return { ...base, event, n: String(record.n) };
  }
  if (event === "ampel_email_view") {
    if (rejectedKeys(record, ["event", "v"])) return null;
    return { ...base, event };
  }
  if (V2_PLAIN_EVENTS.has(event)) {
    if (rejectedKeys(record, ["event", "v"])) return null;
    return { ...base, event: event as AmpelStepEvent };
  }
  if (event === "ampel_submit_click" || event === "ampel_report_submit") {
    if (rejectedKeys(record, ["event", "valid", "v"])) return null;
    if (typeof record.valid !== "boolean") return null;
    return { ...base, event, valid: record.valid ? "true" : "false" };
  }
  if (event === "ampel_submit_result" || event === "ampel_report_sent") {
    if (rejectedKeys(record, ["event", "status", "v"])) return null;
    if (typeof record.status !== "string" || !STATUS_SET.has(record.status)) return null;
    return { ...base, event, status: record.status };
  }
  if (rejectedKeys(record, ["event", "choice", "v"])) return null;
  if (typeof record.choice !== "string" || !CHOICE_SET.has(record.choice)) return null;
  return { ...base, event: "consent_choice", choice: record.choice };
}

export function ampelSubmitResultStatus(input: {
  status: number;
  pending?: boolean;
  timedOut?: boolean;
}): AmpelStepResultStatus | null {
  if (input.timedOut) return "timeout";
  if (input.status === 400) return "400";
  if (input.status === 429) return "429";
  if (input.status >= 500 && input.status <= 599) return "5xx";
  if (input.status >= 200 && input.status < 300) return input.pending ? "pending_ok" : "ok";
  return null;
}

export function ampelStepCells(row: AmpelStepRow): string[] {
  return [row.date, row.event, row.n, row.status, row.choice, row.valid, row.v, row.device];
}

function cell(raw: string[] | undefined, index: number): string {
  return (raw?.[index] ?? "").trim();
}

function parseStoredRow(raw: string[]): AmpelStepRow | null {
  const date = cell(raw, 0);
  const event = cell(raw, 1);
  const n = cell(raw, 2);
  const status = cell(raw, 3);
  const choice = cell(raw, 4);
  const valid = cell(raw, 5);
  const variant = cell(raw, 6);
  const device = cell(raw, 7);
  if (!isAmpelStepDate(date) || date.includes("T") || date.includes(":")) return null;
  if (!EVENT_SET.has(event)) return null;
  if (device !== "mobile" && device !== "desktop") return null;
  if (!variant || !KNOWN_VARIANT_SET.has(variant)) return null;
  const fields: AmpelStepFields = {
    event: event as AmpelStepEvent,
    n: "",
    status: "",
    choice: "",
    valid: "",
    v: variant,
  };
  if (event === "ampel_q_view" || event === "ampel_q_answer") {
    if (!/^(?:[1-9]|10)$/.test(n) || status || choice || valid) return null;
    fields.n = String(Number(n));
  } else if (n) {
    return null;
  }
  if (event === "ampel_submit_result" || event === "ampel_report_sent") {
    if (!STATUS_SET.has(status) || choice || valid) return null;
    fields.status = status;
  } else if (status) {
    return null;
  }
  if (event === "consent_choice") {
    if (!CHOICE_SET.has(choice) || valid) return null;
    fields.choice = choice;
  } else if (choice) {
    return null;
  }
  if (event === "ampel_submit_click" || event === "ampel_report_submit") {
    if (valid !== "true" && valid !== "false") return null;
    fields.valid = valid;
  } else if (valid) {
    return null;
  }
  if (event === "ampel_email_view" && (n || status || choice || valid)) return null;
  return { ...fields, date, device };
}

/** Data rows under an exact 8-column header. A wrong header yields nothing. */
export function ampelStepRowsFromValues(values: string[][]): AmpelStepRow[] {
  if (values.length === 0) return [];
  const header = values[0].map((item) => item.trim());
  const headerOk =
    AMPEL_STEP_COLUMNS.every((column, index) => header[index] === column) &&
    header.slice(AMPEL_STEP_COLUMNS.length).every((item) => item === "");
  if (!headerOk) return [];
  const rows: AmpelStepRow[] = [];
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

export function ampelStepWindowDates(now: Date): string[] {
  const today = ampelStepDate(now);
  const dates: string[] = [];
  for (let offset = AMPEL_STEP_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    dates.push(addCalendarDays(today, -offset));
  }
  return dates;
}

export type AmpelStepResultCounts = Record<AmpelStepResultStatus, number>;

export type AmpelStepDeviceStat = {
  device: AmpelStepDeviceLabel;
  pageview: number;
  emailView: number;
  submitValid: number;
  submitInvalid: number;
  results: AmpelStepResultCounts;
  consentAccept: number;
  consentReject: number;
  resultView: number;
  reportOfferView: number;
  reportSubmitValid: number;
  reportSubmitInvalid: number;
  reportSent: AmpelStepResultCounts;
  productClick: number;
};

export type AmpelStepQuestionStat = {
  n: number;
  viewed: number;
  viewedMobile: number;
  viewedDesktop: number;
  answered: number;
  answeredMobile: number;
  answeredDesktop: number;
  dropPct: number | null;
  dropPctMobile: number | null;
  dropPctDesktop: number | null;
};

export type AmpelStepDayStat = {
  date: string;
  devices: AmpelStepDeviceStat[];
  questions: AmpelStepQuestionStat[];
};

export type AmpelStepReport = {
  days: AmpelStepDayStat[];
  total: AmpelStepDayStat;
  variants: string[];
  variant: string;
  hasRows: boolean;
};

type Bucket = {
  pageview: number;
  emailView: number;
  submitValid: number;
  submitInvalid: number;
  results: AmpelStepResultCounts;
  consentAccept: number;
  consentReject: number;
  resultView: number;
  reportOfferView: number;
  reportSubmitValid: number;
  reportSubmitInvalid: number;
  reportSent: AmpelStepResultCounts;
  productClick: number;
  viewed: number[];
  answered: number[];
};

function emptyResults(): AmpelStepResultCounts {
  return { ok: 0, pending_ok: 0, "400": 0, "429": 0, "5xx": 0, timeout: 0 };
}

function emptyBucket(): Bucket {
  return {
    pageview: 0,
    emailView: 0,
    submitValid: 0,
    submitInvalid: 0,
    results: emptyResults(),
    consentAccept: 0,
    consentReject: 0,
    resultView: 0,
    reportOfferView: 0,
    reportSubmitValid: 0,
    reportSubmitInvalid: 0,
    reportSent: emptyResults(),
    productClick: 0,
    viewed: Array.from({ length: AMPEL_STEP_QUESTION_MAX + 1 }, () => 0),
    answered: Array.from({ length: AMPEL_STEP_QUESTION_MAX + 1 }, () => 0),
  };
}

function addBucket(left: Bucket, right: Bucket): Bucket {
  const viewed = left.viewed.map((value, index) => value + right.viewed[index]);
  const answered = left.answered.map((value, index) => value + right.answered[index]);
  const results = emptyResults();
  const reportSent = emptyResults();
  for (const status of AMPEL_STEP_RESULT_STATUSES) {
    results[status] = left.results[status] + right.results[status];
    reportSent[status] = left.reportSent[status] + right.reportSent[status];
  }
  return {
    pageview: left.pageview + right.pageview,
    emailView: left.emailView + right.emailView,
    submitValid: left.submitValid + right.submitValid,
    submitInvalid: left.submitInvalid + right.submitInvalid,
    results,
    consentAccept: left.consentAccept + right.consentAccept,
    consentReject: left.consentReject + right.consentReject,
    resultView: left.resultView + right.resultView,
    reportOfferView: left.reportOfferView + right.reportOfferView,
    reportSubmitValid: left.reportSubmitValid + right.reportSubmitValid,
    reportSubmitInvalid: left.reportSubmitInvalid + right.reportSubmitInvalid,
    reportSent,
    productClick: left.productClick + right.productClick,
    viewed,
    answered,
  };
}

function countRow(bucket: Bucket, row: AmpelStepRow): void {
  if (row.event === "ampel_q_view" || row.event === "ampel_q_answer") {
    const n = Number(row.n);
    if (row.event === "ampel_q_view") {
      bucket.viewed[n] += 1;
      if (n === 1) bucket.pageview += 1;
    } else {
      bucket.answered[n] += 1;
    }
    return;
  }
  if (row.event === "ampel_email_view") bucket.emailView += 1;
  if (row.event === "ampel_submit_click") {
    if (row.valid === "true") bucket.submitValid += 1;
    else bucket.submitInvalid += 1;
  }
  if (row.event === "ampel_submit_result" && STATUS_SET.has(row.status)) {
    bucket.results[row.status as AmpelStepResultStatus] += 1;
  }
  if (row.event === "ampel_result_view") bucket.resultView += 1;
  if (row.event === "ampel_report_offer_view") bucket.reportOfferView += 1;
  if (row.event === "ampel_product_click") bucket.productClick += 1;
  if (row.event === "ampel_report_submit") {
    if (row.valid === "true") bucket.reportSubmitValid += 1;
    else bucket.reportSubmitInvalid += 1;
  }
  if (row.event === "ampel_report_sent" && STATUS_SET.has(row.status)) {
    bucket.reportSent[row.status as AmpelStepResultStatus] += 1;
  }
  if (row.event === "consent_choice") {
    if (row.choice === "accept") bucket.consentAccept += 1;
    if (row.choice === "reject") bucket.consentReject += 1;
  }
}

function dropPct(previous: number | null, viewed: number): number | null {
  if (previous == null || previous <= 0) return null;
  return Math.round(((previous - viewed) / previous) * 1000) / 10;
}

function questionStats(mobile: Bucket, desktop: Bucket): AmpelStepQuestionStat[] {
  const stats: AmpelStepQuestionStat[] = [];
  for (let n = AMPEL_STEP_QUESTION_MIN; n <= AMPEL_STEP_QUESTION_MAX; n += 1) {
    const viewedMobile = mobile.viewed[n] ?? 0;
    const viewedDesktop = desktop.viewed[n] ?? 0;
    const answeredMobile = mobile.answered[n] ?? 0;
    const answeredDesktop = desktop.answered[n] ?? 0;
    const previousMobile = n === 1 ? null : (mobile.viewed[n - 1] ?? 0);
    const previousDesktop = n === 1 ? null : (desktop.viewed[n - 1] ?? 0);
    const previous = n === 1 ? null : (previousMobile ?? 0) + (previousDesktop ?? 0);
    stats.push({
      n,
      viewed: viewedMobile + viewedDesktop,
      viewedMobile,
      viewedDesktop,
      answered: answeredMobile + answeredDesktop,
      answeredMobile,
      answeredDesktop,
      dropPct: dropPct(previous, viewedMobile + viewedDesktop),
      dropPctMobile: dropPct(previousMobile, viewedMobile),
      dropPctDesktop: dropPct(previousDesktop, viewedDesktop),
    });
  }
  return stats;
}

function deviceStat(device: AmpelStepDeviceLabel, bucket: Bucket): AmpelStepDeviceStat {
  return {
    device,
    pageview: bucket.pageview,
    emailView: bucket.emailView,
    submitValid: bucket.submitValid,
    submitInvalid: bucket.submitInvalid,
    results: bucket.results,
    consentAccept: bucket.consentAccept,
    consentReject: bucket.consentReject,
    resultView: bucket.resultView,
    reportOfferView: bucket.reportOfferView,
    reportSubmitValid: bucket.reportSubmitValid,
    reportSubmitInvalid: bucket.reportSubmitInvalid,
    reportSent: bucket.reportSent,
    productClick: bucket.productClick,
  };
}

function dayStat(date: string, mobile: Bucket, desktop: Bucket): AmpelStepDayStat {
  const gesamt = addBucket(mobile, desktop);
  return {
    date,
    devices: [deviceStat("gesamt", gesamt), deviceStat("mobile", mobile), deviceStat("desktop", desktop)],
    questions: questionStats(mobile, desktop),
  };
}

export function ampelStepFilterVariant(value: string | undefined): string {
  if (!value) return "";
  const cleaned = sanitizeVariantValue(value);
  if (!cleaned || !KNOWN_VARIANT_SET.has(cleaned)) return "";
  return cleaned;
}

export function buildAmpelStepReport(
  rows: AmpelStepRow[],
  options: { now: Date; variant?: string },
): AmpelStepReport {
  const dates = ampelStepWindowDates(options.now);
  const inWindow = new Set(dates);
  const variant = options.variant && KNOWN_VARIANT_SET.has(options.variant) ? options.variant : "";
  const variants = new Set<string>();
  const byDate = new Map<string, { mobile: Bucket; desktop: Bucket }>();
  for (const date of dates) byDate.set(date, { mobile: emptyBucket(), desktop: emptyBucket() });
  let hasRows = false;
  for (const row of rows) {
    if (!inWindow.has(row.date)) continue;
    variants.add(row.v);
    if (variant && row.v !== variant) continue;
    const day = byDate.get(row.date);
    if (!day) continue;
    hasRows = true;
    countRow(row.device === "mobile" ? day.mobile : day.desktop, row);
  }
  if (variant) variants.add(variant);
  const days = dates.map((date) => {
    const day = byDate.get(date) ?? { mobile: emptyBucket(), desktop: emptyBucket() };
    return dayStat(date, day.mobile, day.desktop);
  });
  const totalMobile = days.reduce((sum, day) => addBucket(sum, bucketFromStat(day, "mobile")), emptyBucket());
  const totalDesktop = days.reduce((sum, day) => addBucket(sum, bucketFromStat(day, "desktop")), emptyBucket());
  return {
    days,
    total: dayStat("Summe", totalMobile, totalDesktop),
    variants: [...variants].sort((left, right) => left.localeCompare(right, "de")),
    variant,
    hasRows,
  };
}

function bucketFromStat(day: AmpelStepDayStat, device: AmpelStepDevice): Bucket {
  const stat = day.devices.find((item) => item.device === device);
  const bucket = emptyBucket();
  if (!stat) return bucket;
  bucket.pageview = stat.pageview;
  bucket.emailView = stat.emailView;
  bucket.submitValid = stat.submitValid;
  bucket.submitInvalid = stat.submitInvalid;
  bucket.results = { ...stat.results };
  bucket.consentAccept = stat.consentAccept;
  bucket.consentReject = stat.consentReject;
  bucket.resultView = stat.resultView;
  bucket.reportOfferView = stat.reportOfferView;
  bucket.reportSubmitValid = stat.reportSubmitValid;
  bucket.reportSubmitInvalid = stat.reportSubmitInvalid;
  bucket.reportSent = { ...stat.reportSent };
  bucket.productClick = stat.productClick;
  for (const question of day.questions) {
    if (device === "mobile") {
      bucket.viewed[question.n] = question.viewedMobile;
      bucket.answered[question.n] = question.answeredMobile;
    } else {
      bucket.viewed[question.n] = question.viewedDesktop;
      bucket.answered[question.n] = question.answeredDesktop;
    }
  }
  return bucket;
}

export function formatAmpelStepDay(iso: string): string {
  if (iso === "Summe") return "Summe";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatAmpelStepDrop(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const text = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
  return `${text} %`;
}

export function ampelStepDeviceLabel(device: AmpelStepDeviceLabel): string {
  if (device === "gesamt") return "Gesamt";
  if (device === "mobile") return "Mobil";
  return "Desktop";
}
