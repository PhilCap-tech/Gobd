/**
 * Einmaliger Seed (CoS 30.10.): eine Testzeile im Tab `plans` plus genau eine
 * Firma (Tab `entities`) für gobd-test+e7f@mail.grokbot.com, damit der
 * 7-Tage-Hinweis am 31.10. 07:00 UTC den Firmennamen in Betreff und Text zeigt.
 * Nur anhängen, nie bestehende Zeilen ändern/löschen. Logs ohne Adressen.
 * Cron einmalig 31.10. 05:30 UTC; Entfernung per Folge-PR.
 */
import { createEntity, listEntitiesByEmail } from "@/lib/store";
import type { Entity, EntityInput } from "@/lib/entities";
import { listPlanRowsStrict, savePlanRow } from "@/lib/plan-store";
import type { PlanRow } from "@/lib/plan";
import { isRetentionTestEmail } from "@/lib/retention-guards";
import { emailsEqual } from "@/lib/types";
import { controlCount, seedRow } from "@/lib/addon-test-seed-shared";

export const ADDON_TEST_SEED_FIRM_EMAIL = "gobd-test+e7f@mail.grokbot.com";

export const ADDON_TEST_SEED_FIRM: EntityInput = {
  name: "Muster Test GmbH",
  street: "Musterstraße 1",
  zip: "12345",
  city: "Musterstadt",
};

export type AddonTestSeedFirmResult = {
  controlCount: number;
  created: { plan: boolean; entity: boolean };
  skippedExisting: boolean;
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

/** Lesefehler werden geworfen (fail closed). Schreibt nur, wenn weder Planzeile noch Firma existiert. */
export async function runAddonTestSeedFirm(io: SeedFirmIo = defaultIo): Promise<AddonTestSeedFirmResult> {
  const email = ADDON_TEST_SEED_FIRM_EMAIL;
  if (!isRetentionTestEmail(email)) throw new Error("seed e7f: keine Testadresse, Abbruch");
  const rows = await io.rows();
  const entities = await io.entities(email);
  const result: AddonTestSeedFirmResult = {
    controlCount: controlCount(rows),
    created: { plan: false, entity: false },
    skippedExisting: false,
    errors: 0,
  };
  if (rows.some((row) => emailsEqual(row.email, email)) || entities.length > 0) {
    result.skippedExisting = true;
    return result;
  }
  try {
    await io.createEntity(email, ADDON_TEST_SEED_FIRM);
    result.created.entity = true;
  } catch (error) {
    result.errors += 1;
    console.error("[addon-test-seed-firm] Firma anlegen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return result;
  }
  try {
    await io.appendPlan(seedRow(email, ""));
    result.created.plan = true;
  } catch (error) {
    result.errors += 1;
    console.error("[addon-test-seed-firm] Planzeile fehlgeschlagen", error instanceof Error ? error.name : "error");
  }
  return result;
}
