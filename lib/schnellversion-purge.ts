/**
 * Löschlauf der Schnellversion, nur mit SCHNELLVERSION_49_PURGE=1|true.
 * Nach 30 Tagen: PDF und Download-Token. Nach 12 Monaten (dieselbe Frist wie
 * DOC_RETENTION_MONTHS für Option 1): der Kaufdatensatz und die Marker unter gobd/sv49/.
 * sv_visit-Zählzeilen: 24 Monate nach dem Zähltag (Spalte H), keine Kohorte.
 * Andere SV-Ereignisse bleiben. Ohne Schalter kein Lesen und kein Löschen. Kein Stripe.
 * `dryRun` (Trockenlauf, auch bei PURGE=1) zählt nur und löscht nichts.
 */

import { measureDate } from "@/lib/measure-event";
import { planSvVisitPurge } from "@/lib/measure-retention";
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

const EMPTY_VISITS = {
  visitsDue: 0,
  visitsDeleted: 0,
  visitsUnparseable: 0,
  visitDayMin: null as string | null,
  visitDayMax: null as string | null,
};

export type SvVisitPurgeIo = {
  list: () => Promise<string[][]>;
  remove: (rows: number[]) => Promise<void>;
};

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
  visitsDue: number;
  visitsDeleted: number;
  visitsUnparseable: number;
  visitDayMin: string | null;
  visitDayMax: string | null;
  dryRun: boolean;
};

function visitCounts(plan: ReturnType<typeof planSvVisitPurge>, deleted: number) {
  return {
    visitsDue: plan.rows.length,
    visitsDeleted: deleted,
    visitsUnparseable: plan.unparseable,
    visitDayMin: plan.dayMin,
    visitDayMax: plan.dayMax,
  };
}

/** Ohne Schalter oder mit `dryRun` nur zählen. PDF und Token nach 30 Tagen, der Datensatz nach 12 Monaten. */
export async function runSvPurge(
  rows: SvPurchase[],
  now: Date,
  env: FlagEnv = process.env,
  opts: { dryRun?: boolean } = {},
): Promise<SvPurgeResult> {
  const delivery = rows.filter((row) => svPurgeDue(row.purchasedAt, now) && (row.pdfPath.trim() || row.downloadTokenHash.trim()));
  const records = rows.filter((row) => svRecordPurgeDue(row.purchasedAt, now));
  if (!schnellversionPurgeEnabled(env) || opts.dryRun) {
    return { due: delivery.length, deleted: 0, recordsDue: records.length, recordsDeleted: 0, ...EMPTY_VISITS, dryRun: true };
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
  return { due: delivery.length, deleted, recordsDue: records.length, recordsDeleted, ...EMPTY_VISITS, dryRun: false };
}

async function defaultVisitIo(): Promise<SvVisitPurgeIo> {
  const store = await import("@/lib/schnellversion-store");
  return {
    list: () => store.listSvEventSheetValues(),
    remove: (rows) => store.deleteSvEventSheetRows(rows),
  };
}

/** Ohne Schalter kein Lesen und kein Löschen. Mit `dryRun` (Trockenlauf) nur zählen, auch bei PURGE=1. */
export async function runScheduledSvPurge(
  now: Date = new Date(),
  env: FlagEnv = process.env,
  list: () => Promise<SvPurchase[]> = listAllSvPurchases,
  opts: { dryRun?: boolean; visits?: SvVisitPurgeIo } = {},
): Promise<SvPurgeResult | null> {
  if (!schnellversionPurgeEnabled(env)) return null;
  const purchases = await runSvPurge(await list(), now, env, opts);
  const visitIo = opts.visits ?? (await defaultVisitIo());
  const plan = planSvVisitPurge(await visitIo.list(), measureDate(now));
  const dryRun = Boolean(opts.dryRun) || !schnellversionPurgeEnabled(env);
  if (dryRun) {
    return { ...purchases, ...visitCounts(plan, 0), dryRun: true };
  }
  if (plan.rows.length > 0) await visitIo.remove([...plan.rows].sort((a, b) => b - a));
  return { ...purchases, ...visitCounts(plan, plan.rows.length), dryRun: false };
}
