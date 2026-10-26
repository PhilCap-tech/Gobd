/**
 * Stripe-Webhooks für Preismodell v2. Greift nur bei Metadaten aus dem
 * v2-Checkout (`gobd_kind`, `gobd_plan=member`). Bestehende Abos ohne diese
 * Metadaten laufen unverändert über den alten Lifecycle.
 */
import type Stripe from "stripe";
import {
  applyChangePurchase,
  applyEntryPurchase,
  applyMemberEnded,
  applyMemberPurchase,
  applyMemberSubscriptionUpdate,
  applyRefund,
  emptyPlanRow,
  type PlanRow,
} from "@/lib/plan";
import { PLAN_METADATA_KIND, PLAN_METADATA_PLAN, type PlanCheckoutKind } from "@/lib/plan-checkout";
import { findPlanByEmailStrict, findPlanBySubscription, savePlanRow } from "@/lib/plan-store";
import { periodEndIso } from "@/lib/kuendigung-stripe";

type Metadata = Record<string, string> | null | undefined;

/** v2-Art aus Session-Metadaten, sonst `null` (alter Checkout). */
export function planKindFromMetadata(metadata: Metadata): PlanCheckoutKind | null {
  const kind = metadata?.[PLAN_METADATA_KIND];
  return kind === "entry" || kind === "change" || kind === "member" ? kind : null;
}

/** Jahresplan-Abo (v2). Alte Monatsabos haben dieses Merkmal nicht. */
export function isAnnualPlanSubscription(subscription: { metadata?: Metadata }): boolean {
  return subscription.metadata?.[PLAN_METADATA_PLAN] === "member";
}

function unixIso(value: number | null | undefined): string {
  return typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : "";
}

/** Reiner Übergang für checkout.session.completed (testbar ohne Store). */
export function planAfterCheckout(
  previous: PlanRow | null,
  input: {
    kind: PlanCheckoutKind;
    member: boolean;
    email: string;
    at: string;
    sessionId: string;
    eventId: string;
    customerId: string;
    subscriptionId: string;
  },
): PlanRow | null {
  if (input.kind === "entry") {
    return applyEntryPurchase(previous, input);
  }
  // Änderung und Mitgliedschaft nachträglich setzen einen bestehenden Plan voraus.
  if (!previous || previous.deletedAt) return null;
  if (input.kind === "change") return applyChangePurchase(previous, input);
  return applyMemberPurchase(previous, input);
}

export async function recordPlanCheckout(input: {
  session: Pick<Stripe.Checkout.Session, "id" | "metadata" | "subscription">;
  kind: PlanCheckoutKind;
  email: string;
  customerId: string;
  eventId: string;
  at: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("v2-Kauf ohne E-Mail");
  const previous = await findPlanByEmailStrict(email);
  const subscription = input.session.subscription;
  const subscriptionId =
    typeof subscription === "string" ? subscription : subscription?.id ?? "";
  const next = planAfterCheckout(previous, {
    kind: input.kind,
    member: input.session.metadata?.[PLAN_METADATA_PLAN] === "member",
    email,
    at: input.at,
    sessionId: input.session.id,
    eventId: input.eventId,
    customerId: input.customerId,
    subscriptionId,
  });
  if (!next) {
    // Bezahlte Änderung ohne Plan: nicht verlieren, sondern als Plan mit Guthaben anlegen.
    console.error("[plans] Kauf ohne bestehenden Plan", { kind: input.kind });
    const fallback = planAfterCheckout(emptyPlanRow(email, input.at), {
      kind: input.kind,
      member: input.kind === "member",
      email,
      at: input.at,
      sessionId: input.session.id,
      eventId: input.eventId,
      customerId: input.customerId,
      subscriptionId,
    });
    if (fallback) await savePlanRow(fallback);
    return;
  }
  if (next !== previous) await savePlanRow(next);
}

function cancelAtIso(subscription: Stripe.Subscription): string {
  if (subscription.cancel_at) return unixIso(subscription.cancel_at);
  if (subscription.cancel_at_period_end) return periodEndIso(subscription);
  return "";
}

/** customer.subscription.updated / deleted / invoice.paid für Jahrespläne. */
export async function recordPlanSubscriptionEvent(input: {
  subscription: Stripe.Subscription;
  eventId: string;
  at: string;
  deleted: boolean;
}): Promise<void> {
  const row = await findPlanBySubscription(input.subscription.id);
  if (!row) {
    console.warn("[plans] Jahresplan-Abo ohne Plan-Zeile");
    return;
  }
  if (row.lastEventId === input.eventId) return;
  const next = input.deleted || input.subscription.status === "canceled"
    ? applyMemberEnded(row, {
        at: input.at,
        eventId: input.eventId,
        endedAt: unixIso(input.subscription.ended_at) || input.at,
      })
    : applyMemberSubscriptionUpdate(row, {
        at: input.at,
        eventId: input.eventId,
        status: input.subscription.status,
        periodEnd: periodEndIso(input.subscription),
        cancelAt: cancelAtIso(input.subscription),
      });
  await savePlanRow(next);
}

/**
 * charge.refunded unter v2 (R5): volle Erstattung eines Einstiegs beendet die
 * Mitgliedschaft (Abo sofort kündigen, ohne Anteilsrechnung) und sperrt den
 * Zugang dauerhaft, wie die DS24-Rückgabe (on_refund → permanentBlock).
 * Erstattungen selbst bleiben manuell; hier wird nie erstattet.
 */
export async function recordPlanRefund(input: {
  charge: Pick<Stripe.Charge, "refunded" | "metadata">;
  email: string;
  eventId: string;
  at: string;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
}): Promise<"locked" | "ignored"> {
  if (input.charge.refunded !== true) return "ignored"; // Teilerstattung: nur Inhaber-Hinweis.
  if (input.charge.metadata?.[PLAN_METADATA_KIND] === "change") return "ignored";
  const email = input.email.trim().toLowerCase();
  if (!email) return "ignored";
  const row = await findPlanByEmailStrict(email);
  if (!row || row.refundedAt) return "ignored";
  if (row.memberSubscriptionId && row.plan === "member" && row.memberStatus !== "canceled") {
    await input.cancelSubscription(row.memberSubscriptionId);
  }
  await savePlanRow(applyRefund(row, { at: input.at, eventId: input.eventId }));
  return "locked";
}
