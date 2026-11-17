/**
 * Löschlauf für PDF und Token-Link der Schnellversion.
 * Ohne SCHNELLVERSION_49_PURGE=1|true nur ein Dry-Run. Kein Cron schaltet ihn ein.
 */

import { SV_PURGE_AFTER_DAYS } from "@/lib/schnellversion-copy";
import { clearSvPurchaseDelivery, type SvPurchase } from "@/lib/schnellversion-record";

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

export type SvPurgeResult = { due: number; deleted: number; dryRun: boolean };

/** Dry-Run, solange der Schalter aus ist. Es werden nur Schnellversion-Käufe angefasst. */
export async function runSvPurge(
  rows: SvPurchase[],
  now: Date,
  env: FlagEnv = process.env,
): Promise<SvPurgeResult> {
  const due = rows.filter((row) => svPurgeDue(row.purchasedAt, now) && (row.pdfPath.trim() || row.downloadTokenHash.trim()));
  if (!schnellversionPurgeEnabled(env)) return { due: due.length, deleted: 0, dryRun: true };
  let deleted = 0;
  for (const row of due) {
    await clearSvPurchaseDelivery(row);
    deleted += 1;
  }
  return { due: due.length, deleted, dryRun: false };
}
