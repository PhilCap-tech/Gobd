/**
 * Kündigung und Rücknahme der Jahresmitgliedschaft, gemeinsam für den
 * Konto-Klick und die Erfassung per E-Mail im Admin (CoS 26.10. 14:25).
 * Gleiche Wirkung; Stichtag gilt ab Eingang (`receivedAt`), Kanal wird vermerkt.
 * Stripe wird injiziert (Checks ohne Netz).
 */
import { applyMemberCancelRecord, memberCancelPlan, planState, type PlanRow } from "@/lib/plan";

export type CancelStripe = {
  scheduleCancel: (subscriptionId: string, plan: { atCurrentPeriodEnd: boolean; effectiveAt: string }) => Promise<void>;
  clearCancel: (subscriptionId: string) => Promise<void>;
};

export type CancelOutcome =
  | { ok: true; row: PlanRow; status: "gekuendigt" | "widerrufen"; effectiveAt: string }
  | { ok: false; status: "kuendigung-keins" | "widerruf-zu-spaet" | "kuendigung-fehler" };

export async function cancelMembership(
  row: PlanRow,
  input: { channel: "konto" | "email"; receivedAt: string; stripe: CancelStripe; now?: Date },
): Promise<CancelOutcome> {
  const now = input.now ?? new Date();
  if (planState(row, now) !== "member" || !row.memberSubscriptionId) return { ok: false, status: "kuendigung-keins" };
  if (row.memberCancelAt) return { ok: true, row, status: "gekuendigt", effectiveAt: row.memberCancelAt };
  const received = new Date(Date.parse(input.receivedAt) || now.getTime());
  const plan = memberCancelPlan(row.memberPeriodEnd, received);
  if (!plan) return { ok: false, status: "kuendigung-fehler" };
  await input.stripe.scheduleCancel(row.memberSubscriptionId, plan);
  return {
    ok: true,
    status: "gekuendigt",
    effectiveAt: plan.effectiveAt,
    row: applyMemberCancelRecord(row, {
      effectiveAt: plan.effectiveAt,
      channel: input.channel,
      receivedAt: received.toISOString(),
      at: now.toISOString(),
    }),
  };
}

/** Rücknahme bis zum Ablauf (approvals 14:15, Punkt 3). */
export async function withdrawMembershipCancel(
  row: PlanRow,
  input: { channel: "konto" | "email"; receivedAt: string; stripe: CancelStripe; now?: Date },
): Promise<CancelOutcome> {
  const now = input.now ?? new Date();
  if (planState(row, now) !== "member" || !row.memberSubscriptionId) return { ok: false, status: "kuendigung-keins" };
  if (!row.memberCancelAt) return { ok: true, row, status: "widerrufen", effectiveAt: "" };
  const received = Date.parse(input.receivedAt) || now.getTime();
  if (Date.parse(row.memberCancelAt) <= received) return { ok: false, status: "widerruf-zu-spaet" };
  await input.stripe.clearCancel(row.memberSubscriptionId);
  return {
    ok: true,
    status: "widerrufen",
    effectiveAt: "",
    row: applyMemberCancelRecord(row, {
      effectiveAt: "",
      channel: input.channel,
      receivedAt: new Date(received).toISOString(),
      at: now.toISOString(),
    }),
  };
}
