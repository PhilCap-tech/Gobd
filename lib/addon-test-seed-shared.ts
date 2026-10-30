/** Gemeinsame Bausteine der einmaligen Test-Seeds (Muster aus #293). */
import { coercePlanRow } from "@/lib/plan-store";
import type { PlanRow } from "@/lib/plan";
import { isRetentionTestEmail } from "@/lib/retention-guards";

export const ADDON_TEST_SEED_CONTROL_BEFORE = "2026-11-20T00:00:00Z";

const BASE = {
  plan: "single",
  purchasedAt: "2026-10-07T07:00:00Z",
  accessUntil: "2026-11-05T07:00:00Z",
  retentionUntil: "2027-10-07T07:00:00Z",
  pricingModel: "v3",
} as const;

export function seedRow(email: string, offerOptOutAt: string): PlanRow {
  const row = coercePlanRow({ email, plan: BASE.plan });
  if (!row) throw new Error("seed row invalid");
  return {
    ...row,
    purchasedAt: BASE.purchasedAt,
    accessUntil: BASE.accessUntil,
    retentionUntil: BASE.retentionUntil,
    pricingModel: BASE.pricingModel,
    offerOptOutAt,
  };
}

/** Kontrollzahl: echte (Nicht-Test-)Zeilen mit access_until vor dem Stichtag. */
export function controlCount(rows: PlanRow[]): number {
  const limit = Date.parse(ADDON_TEST_SEED_CONTROL_BEFORE);
  return rows.filter((row) => {
    if (!row.accessUntil?.trim()) return false;
    const t = Date.parse(row.accessUntil);
    return Number.isFinite(t) && t < limit && !isRetentionTestEmail(row.email);
  }).length;
}
