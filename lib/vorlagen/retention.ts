import { timingSafeEqual } from "node:crypto";
import { MAGNET_DOI_TTL_MS, MAGNET_DOWNLOAD_TTL_MS } from "@/lib/vorlagen/ids";
import type { MagnetLead } from "@/lib/vorlagen/lead";
import { berlinTimestamp } from "@/lib/vorlagen/time";

/**
 * Legal may change these numbers. One place, used by the daily cron only.
 * Days are 24-hour periods from the stored timestamp.
 * Marketing proof is kept until the end of the Berlin calendar year of the
 * proof, plus marketingProofYears, and deleted from the next 1 January.
 * Step rows are deleted once their Berlin date is at least stepsMonths old.
 */
export const MAGNET_RETENTION = {
  unconfirmedDays: 30,
  confirmedWithoutMarketingDays: 90,
  marketingProofYears: 3,
  stepsMonths: 24,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MagnetRetentionCounts = {
  deletedUnconfirmed: number;
  deletedConfirmed: number;
  deletedMarketingProof: number;
  clearedCalc: number;
  deletedSteps: number;
};

export type MagnetRetentionPlan = MagnetRetentionCounts & {
  deleteLeadIds: string[];
  clearCalcLeadIds: string[];
  /** Indexes into the step-date list passed to the planner. Header is not included. */
  deleteStepIndexes: number[];
};

export function berlinRetentionDate(now: number): string {
  return berlinTimestamp(new Date(now)).slice(0, 10);
}

function berlinParts(now: number): { y: number; m: number; d: number } {
  const [y, m, d] = berlinRetentionDate(now).split("-").map(Number);
  return { y, m, d };
}

/** 1 January after (proof year + marketingProofYears), 00:00 Europe/Berlin. January is CET. */
export function marketingProofDeleteAt(proofMs: number): number {
  const year = berlinParts(proofMs).y + MAGNET_RETENTION.marketingProofYears + 1;
  return Date.parse(`${year}-01-01T00:00:00+01:00`);
}

function shiftMonths(y: number, m: number, d: number, months: number): string {
  const index = y * 12 + (m - 1) - months;
  const ny = Math.floor(index / 12);
  const nm = index - ny * 12 + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, last);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function stepCutoffDate(now: number): string {
  const parts = berlinParts(now);
  return shiftMonths(parts.y, parts.m, parts.d, MAGNET_RETENTION.stepsMonths);
}

function proofMs(lead: MagnetLead): number | null {
  if (lead.marketingOptIn === "withdrawn") {
    const times = [Date.parse(lead.withdrawnAt), Date.parse(lead.marketingConfirmedAt)].filter((value) =>
      Number.isFinite(value),
    );
    return times.length > 0 ? Math.max(...times) : null;
  }
  if (lead.marketingOptIn === "yes") {
    const confirmed = Date.parse(lead.marketingConfirmedAt);
    return Number.isFinite(confirmed) ? confirmed : null;
  }
  return null;
}

function confirmedMs(lead: MagnetLead): number | null {
  if (lead.status !== "confirmed" && lead.status !== "downloaded" && lead.status !== "expired") return null;
  const at = Date.parse(lead.doiConfirmedAt);
  return Number.isFinite(at) ? at : null;
}

function requestedMs(lead: MagnetLead): number | null {
  const at = Date.parse(lead.timestamp);
  return Number.isFinite(at) ? at : null;
}

/** DOI link for an open request, download link after confirmation. */
function calcLinkExpired(lead: MagnetLead, now: number): boolean {
  if (!lead.calcJson.trim()) return false;
  const confirmed = confirmedMs(lead);
  if (confirmed != null) return now >= confirmed + MAGNET_DOWNLOAD_TTL_MS;
  const sent = Date.parse(lead.doiSentAt);
  const start = Number.isFinite(sent) ? sent : requestedMs(lead);
  if (start == null) return false;
  return now >= start + MAGNET_DOI_TTL_MS;
}

export function planMagnetRetention(input: {
  leads: MagnetLead[];
  stepDates: string[];
  now: number;
}): MagnetRetentionPlan {
  const deleteLeadIds: string[] = [];
  const clearCalcLeadIds: string[] = [];
  const counts: MagnetRetentionCounts = {
    deletedUnconfirmed: 0,
    deletedConfirmed: 0,
    deletedMarketingProof: 0,
    clearedCalc: 0,
    deletedSteps: 0,
  };
  const unconfirmedMs = MAGNET_RETENTION.unconfirmedDays * DAY_MS;
  const confirmedLimitMs = MAGNET_RETENTION.confirmedWithoutMarketingDays * DAY_MS;

  for (const lead of input.leads) {
    const proof = proofMs(lead);
    if (proof != null) {
      if (input.now >= marketingProofDeleteAt(proof)) {
        deleteLeadIds.push(lead.leadId);
        counts.deletedMarketingProof += 1;
        continue;
      }
    } else {
      const confirmed = confirmedMs(lead);
      if (confirmed != null) {
        if (input.now >= confirmed + confirmedLimitMs) {
          deleteLeadIds.push(lead.leadId);
          counts.deletedConfirmed += 1;
          continue;
        }
      } else {
        const requested = requestedMs(lead);
        if (requested != null && input.now >= requested + unconfirmedMs) {
          deleteLeadIds.push(lead.leadId);
          counts.deletedUnconfirmed += 1;
          continue;
        }
      }
    }
    if (calcLinkExpired(lead, input.now)) {
      clearCalcLeadIds.push(lead.leadId);
      counts.clearedCalc += 1;
    }
  }

  const cutoff = stepCutoffDate(input.now);
  const deleteStepIndexes: number[] = [];
  input.stepDates.forEach((date, index) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= cutoff) {
      deleteStepIndexes.push(index);
      counts.deletedSteps += 1;
    }
  });

  return { ...counts, deleteLeadIds, clearCalcLeadIds, deleteStepIndexes };
}

export function retentionLeadMutations(
  rows: { leadId: string; sheetIndex: number }[],
  plan: Pick<MagnetRetentionPlan, "deleteLeadIds" | "clearCalcLeadIds">,
): { deleteIndexes: number[]; clearRows: number[] } {
  const drop = new Set(plan.deleteLeadIds);
  const clear = new Set(plan.clearCalcLeadIds);
  const deleteIndexes: number[] = [];
  const clearRows: number[] = [];
  for (const row of rows) {
    if (drop.has(row.leadId)) deleteIndexes.push(row.sheetIndex);
    else if (clear.has(row.leadId)) clearRows.push(row.sheetIndex + 1);
  }
  deleteIndexes.sort((left, right) => right - left);
  return { deleteIndexes, clearRows };
}

/** Data indexes from an A2:A read become 0-based sheet indexes, highest first. */
export function retentionStepDeleteIndexes(dataIndexes: number[]): number[] {
  return dataIndexes.map((index) => index + 1).sort((left, right) => right - left);
}

const SKIPPED = new Set(["", "preview", "not-production", "automated", "unconfigured"]);

function countToken(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) return "0";
  return String(value);
}

/** Counts, type, and date only. No address, id, or calculator value. */
export function magnetRetentionLog(input: MagnetRetentionCounts & {
  date: string;
  skipped?: string;
}): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : "0000-00-00";
  const skipped = input.skipped && SKIPPED.has(input.skipped) && input.skipped !== "" ? ` skipped=${input.skipped}` : "";
  return [
    `[magnet-retention] date=${date}`,
    "type=counts",
    `deleted_unconfirmed=${countToken(input.deletedUnconfirmed)}`,
    `deleted_confirmed=${countToken(input.deletedConfirmed)}`,
    `deleted_marketing_proof=${countToken(input.deletedMarketingProof)}`,
    `cleared_calc=${countToken(input.clearedCalc)}`,
    `deleted_steps=${countToken(input.deletedSteps)}`,
  ].join(" ") + skipped;
}

export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  const expectedSecret = secret?.trim() ?? "";
  if (!expectedSecret) return false;
  const got = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
