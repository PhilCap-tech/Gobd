/**
 * Einmaliger Seed (CoS 31.10., approvals Z.505; Muster #298): zwei NEUE Testzeilen
 * im Tab `plans` plus je eine Firma (Tab `entities`), damit der reguläre
 * 7-Tage-Hinweis am 01.11. 07:00 UTC genau eine e-7 (+lu7, ohne Widerspruch)
 * und eine e-7N (+lu7n, mit offerOptOutAt) sendet (List-Unsubscribe-Beleg per Versand-Log).
 * Neues purchasedAt -> neue Dedupe-Schlüssel. Nur anhängen, nie bestehende Zeilen
 * ändern/löschen. Logs ohne Adressen. Cron einmalig 01.11. 05:30 UTC; Entfernung per Folge-PR.
 * (Vorher, 31.10.: gobd-test+e7f, erledigt.)
 */
import { createEntity, listEntitiesByEmail } from "@/lib/store";
import type { Entity, EntityInput } from "@/lib/entities";
import { listPlanRowsStrict, savePlanRow } from "@/lib/plan-store";
import type { PlanRow } from "@/lib/plan";
import { isRetentionTestEmail } from "@/lib/retention-guards";
import { emailsEqual } from "@/lib/types";
import { controlCount, seedRow, type SeedDates } from "@/lib/addon-test-seed-shared";

export const ADDON_TEST_SEED_DATES: SeedDates = {
  purchasedAt: "2026-10-08T07:00:00Z",
  accessUntil: "2026-11-07T07:00:00Z",
  retentionUntil: "2027-10-08T07:00:00Z",
};

/** Widerspruch der e-7N-Testzeile (fester Wert, damit der Seed deterministisch ist). */
export const ADDON_TEST_SEED_OPTOUT_AT = "2026-10-31T12:00:00Z";

export const ADDON_TEST_SEEDS: ReadonlyArray<{ key: "lu7" | "lu7n"; email: string; optOut: boolean }> = [
  { key: "lu7", email: "gobd-test+lu7@mail.grokbot.com", optOut: false },
  { key: "lu7n", email: "gobd-test+lu7n@mail.grokbot.com", optOut: true },
];

export const ADDON_TEST_SEED_FIRM: EntityInput = {
  name: "Muster Test GmbH",
  street: "Musterstraße 1",
  zip: "12345",
  city: "Musterstadt",
};

type SeedOne = { plan: boolean; entity: boolean; skippedExisting: boolean };

export type AddonTestSeedFirmResult = {
  controlCount: number;
  seeds: Record<"lu7" | "lu7n", SeedOne>;
  errors: number;
};

export type SeedFirmIo = {
  rows: () => Promise<PlanRow[]>;
  entities: (email: string) => Promise<Entity[]>;
  appendPlan: (row: PlanRow) => Promise<void>;
  createEntity: (email: string, input: EntityInput) => Promise<unknown>;
};

const defaultIo: SeedFirmIo = {
  rows: listPlanRowsStrict,
  entities: listEntitiesByEmail,
  appendPlan: savePlanRow,
  createEntity: (email, input) => createEntity(email, input),
};

/** Lesefehler werden geworfen (fail closed). Je Adresse: schreibt nur, wenn weder Planzeile noch Firma existiert. */
export async function runAddonTestSeedFirm(io: SeedFirmIo = defaultIo): Promise<AddonTestSeedFirmResult> {
  for (const s of ADDON_TEST_SEEDS) if (!isRetentionTestEmail(s.email)) throw new Error(`seed ${s.key}: keine Testadresse, Abbruch`);
  const rows = await io.rows();
  const result: AddonTestSeedFirmResult = {
    controlCount: controlCount(rows),
    seeds: {
      lu7: { plan: false, entity: false, skippedExisting: false },
      lu7n: { plan: false, entity: false, skippedExisting: false },
    },
    errors: 0,
  };
  for (const s of ADDON_TEST_SEEDS) {
    const out = result.seeds[s.key];
    const entities = await io.entities(s.email);
    if (rows.some((row) => emailsEqual(row.email, s.email)) || entities.length > 0) {
      out.skippedExisting = true;
      continue;
    }
    try {
      await io.createEntity(s.email, ADDON_TEST_SEED_FIRM);
      out.entity = true;
    } catch (error) {
      result.errors += 1;
      console.error(`[addon-test-seed-firm] Firma ${s.key} fehlgeschlagen`, error instanceof Error ? error.name : "error");
      continue;
    }
    try {
      await io.appendPlan(seedRow(s.email, s.optOut ? ADDON_TEST_SEED_OPTOUT_AT : "", ADDON_TEST_SEED_DATES));
      out.plan = true;
    } catch (error) {
      result.errors += 1;
      console.error(`[addon-test-seed-firm] Planzeile ${s.key} fehlgeschlagen`, error instanceof Error ? error.name : "error");
    }
  }
  return result;
}
