/**
 * Einmaliger Seed (CoS 29.10.): zwei Testzeilen im Tab `plans` für den
 * 7-Tage-Hinweis (e-7 / e-7N) mit ADDON_NOTICE_TEST_ONLY. Nur anhängen, nie
 * bestehende Zeilen ändern/löschen. Logs ohne Adressen (nur Labels/Zahlen).
 * Cron einmalig 30.10. 05:30 UTC; Entfernung per Folge-PR.
 */
import { coercePlanRow, listPlanRowsStrict, savePlanRow } from "@/lib/plan-store";
import type { PlanRow } from "@/lib/plan";
import { isRetentionTestEmail } from "@/lib/retention-guards";
import { emailsEqual } from "@/lib/types";

export const ADDON_TEST_SEED_CONTROL_BEFORE = "2026-11-20T00:00:00Z";

const BASE = {
  plan: "single",
  purchasedAt: "2026-10-07T07:00:00Z",
  accessUntil: "2026-11-05T07:00:00Z",
  retentionUntil: "2027-10-07T07:00:00Z",
  pricingModel: "v3",
} as const;

export const ADDON_TEST_SEEDS: readonly { label: "e7" | "e7n"; email: string; offerOptOutAt: string }[] = [
  { label: "e7", email: "gobd-test@mail.grokbot.com", offerOptOutAt: "" },
  { label: "e7n", email: "gobd-test+e7n@mail.grokbot.com", offerOptOutAt: "2026-10-29T20:00:00Z" },
];

export type AddonTestSeedResult = { controlCount: number; created: string[]; skippedExisting: string[]; errors: number };

type SeedIo = { rows: () => Promise<PlanRow[]>; append: (row: PlanRow) => Promise<void> };

export function seedRow(seed: (typeof ADDON_TEST_SEEDS)[number]): PlanRow {
  const row = coercePlanRow({ email: seed.email, plan: BASE.plan });
  if (!row) throw new Error("seed row invalid");
  return {
    ...row,
    purchasedAt: BASE.purchasedAt,
    accessUntil: BASE.accessUntil,
    retentionUntil: BASE.retentionUntil,
    pricingModel: BASE.pricingModel,
    offerOptOutAt: seed.offerOptOutAt,
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

/** Lesefehler werden geworfen (fail closed). */
export async function runAddonTestSeed(io: SeedIo = { rows: listPlanRowsStrict, append: savePlanRow }): Promise<AddonTestSeedResult> {
  for (const seed of ADDON_TEST_SEEDS) {
    if (!isRetentionTestEmail(seed.email)) throw new Error(`seed ${seed.label}: keine Testadresse, Abbruch`);
  }
  const rows = await io.rows();
  const result: AddonTestSeedResult = { controlCount: controlCount(rows), created: [], skippedExisting: [], errors: 0 };
  for (const seed of ADDON_TEST_SEEDS) {
    // Anforderung: überspringen bei gleicher E-Mail + plan=single. Strenger: jede Zeile mit
    // gleicher E-Mail überspringen, weil savePlanRow sonst eine bestehende Zeile überschreiben würde.
    if (rows.some((row) => emailsEqual(row.email, seed.email))) {
      result.skippedExisting.push(seed.label);
      continue;
    }
    try {
      await io.append(seedRow(seed));
      result.created.push(seed.label);
    } catch (error) {
      result.errors += 1;
      console.error("[addon-test-seed] append fehlgeschlagen", seed.label, error instanceof Error ? error.name : "error");
    }
  }
  return result;
}
