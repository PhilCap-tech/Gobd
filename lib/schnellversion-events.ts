/**
 * Ereignisse ohne Personenbezogene Daten. Erlaubte Felder: arm, variante,
 * branche_vorlage, value, step, ziel. Kein Name, keine E-Mail, kein gclid.
 */

import type { MusterVorlageId } from "@/lib/module-muster";
import { MUSTER_VORLAGEN } from "@/lib/module-muster";

export const SV_EVENT_NAMES = [
  "sv_block_view",
  "sv_click",
  "sv_question_step",
  "sv_questions_complete",
  "sv_checkout_view",
  "sv_switch_to_fragebogen",
  "sv_checkout_start",
  "sv_purchase",
  "sv_pdf_download",
  "sv_upgrade_view",
  "sv_upgrade_purchase",
  "sv_home_view",
  "sv_visit",
  "fragebogen_start",
  "checkout_99",
  "purchase_99",
] as const;

export type SvEventName = (typeof SV_EVENT_NAMES)[number];

export type SvEventRow = {
  name: SvEventName;
  /** Leer nur bei sv_visit (Aufruf ohne Einwilligung, ohne Arm). */
  arm: "control" | "test" | "";
  variante: "b";
  branche_vorlage: MusterVorlageId | "";
  value: number;
  step: number;
  ziel: "einmalig" | "dauerhaft" | "";
};

const EVENT_KEYS = ["name", "arm", "variante", "branche_vorlage", "value", "step", "ziel"] as const;

const NAME_SET = new Set<string>(SV_EVENT_NAMES);
const VORLAGE_SET = new Set<string>(MUSTER_VORLAGEN);

export function parseSvEvent(input: unknown): SvEventRow | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!(EVENT_KEYS as readonly string[]).includes(key)) return null;
  }
  if (typeof raw.name !== "string" || !NAME_SET.has(raw.name)) return null;
  const visit = raw.name === "sv_visit";
  if (visit) {
    if (raw.arm !== undefined && raw.arm !== "") return null;
  } else if (raw.arm !== "control" && raw.arm !== "test") return null;
  if (!visit && raw.variante !== "b") return null;
  if (visit && raw.variante !== undefined && raw.variante !== "b") return null;
  let branche: SvEventRow["branche_vorlage"] = "";
  if (raw.branche_vorlage !== undefined && raw.branche_vorlage !== "") {
    if (typeof raw.branche_vorlage !== "string" || !VORLAGE_SET.has(raw.branche_vorlage)) return null;
    branche = raw.branche_vorlage as MusterVorlageId;
  }
  let value = 0;
  if (raw.value !== undefined) {
    if (typeof raw.value !== "number" || !Number.isFinite(raw.value) || raw.value < 0 || raw.value > 200) {
      return null;
    }
    value = raw.value;
  }
  let step = 0;
  if (raw.step !== undefined) {
    if (typeof raw.step !== "number" || !Number.isInteger(raw.step) || raw.step < 1 || raw.step > 6) return null;
    step = raw.step;
  }
  let ziel: SvEventRow["ziel"] = "";
  if (raw.ziel !== undefined && raw.ziel !== "") {
    if (raw.ziel !== "einmalig" && raw.ziel !== "dauerhaft") return null;
    ziel = raw.ziel;
  }
  return {
    name: raw.name as SvEventName,
    arm: visit ? "" : raw.arm === "test" ? "test" : "control",
    variante: "b",
    branche_vorlage: branche,
    value,
    step,
    ziel,
  };
}

/** Konzept 4.5 und 4.6. Nichts schaltet das Flag ab. */
export const SV_MIN_VISITORS_PER_ARM = 1000;
export const SV_MIN_PURCHASES = 30;
export const SV_RPV_ABORT_SHARE = 0.15;
export const SV_CONV99_ABORT_SHARE = 0.25;

const REVENUE_NAMES = new Set<SvEventName>(["sv_purchase", "purchase_99", "sv_upgrade_purchase"]);

export type SvArmStat = {
  visitors: number;
  revenueNet: number;
  rpv: number | null;
  purchases49: number;
  purchases99: number;
  conv49: number | null;
  conv99: number | null;
  upgrades: number;
  fragebogenStarts: number;
};

export type SvEvaluation = {
  control: SvArmStat;
  test: SvArmStat;
  purchasesTotal: number;
  /** Aufrufe der Startseite, auch ohne Einwilligung. */
  visits: number;
  /** Aufrufe mit Einwilligung und Arm. */
  consented: number;
  /** consented / visits, oder null wenn keine Aufrufe gezählt sind. */
  consentShare: number | null;
  minReached: boolean;
  /** Test-RPV mehr als 15 % unter der Kontrolle. */
  rpvAbort: boolean;
  /** 99-€-Conversion mehr als 25 % unter der Kontrolle, ohne dass der RPV steigt. */
  conv99Abort: boolean;
  /** Die Auswertung schaltet nichts ab. */
  schaltetAb: false;
};

function emptyStat(): SvArmStat {
  return {
    visitors: 0,
    revenueNet: 0,
    rpv: null,
    purchases49: 0,
    purchases99: 0,
    conv49: null,
    conv99: null,
    upgrades: 0,
    fragebogenStarts: 0,
  };
}

function statFor(rows: SvEventRow[], arm: "control" | "test"): SvArmStat {
  const stat = emptyStat();
  for (const row of rows) {
    if (row.arm !== arm) continue;
    if (row.name === "sv_home_view") stat.visitors += 1;
    if (row.name === "sv_purchase") stat.purchases49 += 1;
    if (row.name === "purchase_99") stat.purchases99 += 1;
    if (row.name === "sv_upgrade_purchase") stat.upgrades += 1;
    if (row.name === "fragebogen_start") stat.fragebogenStarts += 1;
    if (REVENUE_NAMES.has(row.name)) stat.revenueNet += row.value;
  }
  if (stat.visitors > 0) {
    stat.rpv = stat.revenueNet / stat.visitors;
    stat.conv49 = stat.purchases49 / stat.visitors;
    stat.conv99 = stat.purchases99 / stat.visitors;
  }
  return stat;
}

export function evaluateSvEvents(rows: SvEventRow[]): SvEvaluation {
  const control = statFor(rows, "control");
  const test = statFor(rows, "test");
  const visits = rows.filter((row) => row.name === "sv_visit").length;
  const consented = rows.filter((row) => row.name === "sv_home_view").length;
  const purchasesTotal = control.purchases49 + control.purchases99 + test.purchases49 + test.purchases99;
  const minReached =
    control.visitors >= SV_MIN_VISITORS_PER_ARM &&
    test.visitors >= SV_MIN_VISITORS_PER_ARM &&
    purchasesTotal >= SV_MIN_PURCHASES;
  const rpvAbort =
    minReached &&
    control.rpv !== null &&
    test.rpv !== null &&
    control.rpv > 0 &&
    test.rpv < control.rpv * (1 - SV_RPV_ABORT_SHARE);
  const rpvRises = control.rpv !== null && test.rpv !== null && test.rpv > control.rpv;
  const conv99Abort =
    minReached &&
    control.conv99 !== null &&
    test.conv99 !== null &&
    control.conv99 > 0 &&
    test.conv99 < control.conv99 * (1 - SV_CONV99_ABORT_SHARE) &&
    !rpvRises;
  return {
    control,
    test,
    purchasesTotal,
    visits,
    consented,
    consentShare: visits > 0 ? consented / visits : null,
    minReached,
    rpvAbort,
    conv99Abort,
    schaltetAb: false,
  };
}
