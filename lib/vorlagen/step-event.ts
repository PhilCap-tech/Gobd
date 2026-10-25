import { ampelStepDate, ampelStepDevice, ampelStepWindowDates, type AmpelStepDevice } from "@/lib/ampel-step-event";

export const MAGNET_STEP_COLUMNS = ["date", "event", "n", "status", "choice", "valid", "v", "device"] as const;

export const MAGNET_STEP_EVENTS = [
  "magnet_view",
  "magnet_calc_used",
  "magnet_gate_view",
  "magnet_submit_click",
  "magnet_submit_result",
  "magnet_doi_confirmed",
  "magnet_download",
  "consent_choice",
] as const;

export const MAGNET_STEP_BODY_MAX_BYTES = 512;
export const MAGNET_STEP_NUMBERS = ["1", "2", "3"] as const;

const EVENTS = new Set<string>(MAGNET_STEP_EVENTS);
const SUBMIT_STATUS = new Set(["ok", "400", "429", "5xx", "timeout"]);
const DOI_STATUS = new Set(["ok", "expired"]);
const CHOICES = new Set(["accept", "reject"]);
const ALLOWED = new Set(["event", "n", "status", "choice", "valid"]);

export type MagnetStepEventName = (typeof MAGNET_STEP_EVENTS)[number];

export type MagnetStepFields = {
  event: MagnetStepEventName;
  n: string;
  status: string;
  choice: string;
  valid: string;
  /** Always `default`. Campaign variant is not stored. */
  v: string;
};

export type MagnetStepRow = MagnetStepFields & {
  date: string;
  device: AmpelStepDevice;
};

function stepNumber(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 3) return null;
  return String(value);
}

export function parseMagnetStepBody(input: unknown): MagnetStepFields | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED.has(key)) return null;
  }
  const event = record.event;
  if (typeof event !== "string" || !EVENTS.has(event)) return null;
  const base = { v: "default", n: "", status: "", choice: "", valid: "" };

  if (event === "magnet_view" || event === "magnet_calc_used" || event === "magnet_gate_view") {
    const n = stepNumber(record.n);
    if (!n) return null;
    if (Object.keys(record).some((key) => key !== "event" && key !== "n")) return null;
    return { ...base, event, n };
  }
  if (event === "magnet_submit_click") {
    const n = stepNumber(record.n);
    if (!n || typeof record.valid !== "boolean") return null;
    if (Object.keys(record).some((key) => key !== "event" && key !== "n" && key !== "valid")) return null;
    return { ...base, event, n, valid: record.valid ? "true" : "false" };
  }
  if (event === "magnet_submit_result") {
    const n = stepNumber(record.n);
    if (!n || typeof record.status !== "string" || !SUBMIT_STATUS.has(record.status)) return null;
    return { ...base, event, n, status: record.status };
  }
  if (event === "magnet_doi_confirmed") {
    const n = stepNumber(record.n);
    if (!n || typeof record.status !== "string" || !DOI_STATUS.has(record.status)) return null;
    return { ...base, event, n, status: record.status };
  }
  if (event === "magnet_download") return null;
  if (typeof record.choice !== "string" || !CHOICES.has(record.choice)) return null;
  const n = "n" in record ? stepNumber(record.n) : "";
  if ("n" in record && !n) return null;
  return { ...base, event: "consent_choice", n: n || "", choice: record.choice };
}

export function magnetStepCells(row: MagnetStepRow): string[] {
  return [row.date, row.event, row.n, row.status, row.choice, row.valid, row.v, row.device];
}

export function magnetStepDate(now: Date): string {
  return ampelStepDate(now);
}

export function magnetStepDevice(userAgent: string): AmpelStepDevice {
  return ampelStepDevice(userAgent);
}

export function countMagnetSteps(rows: MagnetStepRow[], now: Date): Record<string, number> {
  const window = new Set(ampelStepWindowDates(now));
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!window.has(row.date)) continue;
    counts[row.event] = (counts[row.event] ?? 0) + 1;
  }
  return counts;
}
