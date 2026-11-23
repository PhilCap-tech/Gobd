/**
 * Löschlauf der Schnellversion, nur mit SCHNELLVERSION_49_PURGE=1|true.
 * Nach 30 Tagen: PDF und Download-Token. Nach 12 Monaten (dieselbe Frist wie
 * DOC_RETENTION_MONTHS für Option 1): der Kaufdatensatz und die Marker unter gobd/sv49/.
 * Ohne Schalter kein Lesen und kein Löschen. Kein Stripe.
 */

import { addMonthsIso } from "@/lib/plan";
import { DOC_RETENTION_MONTHS } from "@/lib/retention-decision";
import { SV_PURGE_AFTER_DAYS } from "@/lib/schnellversion-copy";
import {
  clearSvPurchaseDelivery,
  deleteSvPurchaseRecord,
  listAllSvPurchases,
  type SvPurchase,
} from "@/lib/schnellversion-record";

type FlagEnv = Record<string, string | undefined>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function schnellversionPurgeEnabled(env: FlagEnv = process.env): boolean {
  const raw = (env.SCHNELLVERSION_49_PURGE ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export function svPurgeDue(purchasedAt: string, now: Date): boolean {
  const bought = Date.parse(purchasedAt);
  if (!Number.isFinite(bought)) return false;
  return now.getTime() >= bought + SV_PURGE_AFTER_DAYS * DAY_MS;
}

/** 12 Monate nach dem Kauf, dieselbe Monatsrechnung wie die Dokumentenfrist der Option 1. */
export function svRecordPurgeDue(purchasedAt: string, now: Date): boolean {
  const bought = Date.parse(purchasedAt);
  if (!Number.isFinite(bought)) return false;
  const due = Date.parse(addMonthsIso(new Date(bought).toISOString(), DOC_RETENTION_MONTHS));
  return Number.isFinite(due) && now.getTime() >= due;
}

export type SvPurgeResult = {
  due: number;
  deleted: number;
  recordsDue: number;
  recordsDeleted: number;
  dryRun: boolean;
};

/** Ohne Schalter Dry-Run. PDF und Token nach 30 Tagen, der Datensatz nach 12 Monaten. */
export async function runSvPurge(
  rows: SvPurchase[],
  now: Date,
  env: FlagEnv = process.env,
): Promise<SvPurgeResult> {
  const delivery = rows.filter((row) => svPurgeDue(row.purchasedAt, now) && (row.pdfPath.trim() || row.downloadTokenHash.trim()));
  const records = rows.filter((row) => svRecordPurgeDue(row.purchasedAt, now));
  if (!schnellversionPurgeEnabled(env)) {
    return { due: delivery.length, deleted: 0, recordsDue: records.length, recordsDeleted: 0, dryRun: true };
  }
  let deleted = 0;
  for (const row of delivery) {
    if (!svRecordPurgeDue(row.purchasedAt, now) && (await clearSvPurchaseDelivery(row))) deleted += 1;
  }
  let recordsDeleted = 0;
  for (const row of records) {
    await deleteSvPurchaseRecord(row);
    recordsDeleted += 1;
  }
  return { due: delivery.length, deleted, recordsDue: records.length, recordsDeleted, dryRun: false };
}

/** Ohne Schalter kein Lesen und kein Löschen. */
export async function runScheduledSvPurge(
  now: Date = new Date(),
  env: FlagEnv = process.env,
  list: () => Promise<SvPurchase[]> = listAllSvPurchases,
): Promise<SvPurgeResult | null> {
  if (!schnellversionPurgeEnabled(env)) return null;
  return runSvPurge(await list(), now, env);
}
