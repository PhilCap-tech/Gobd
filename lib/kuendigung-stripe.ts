import { applyLifecycleEvent } from "@/lib/kuendigung-apply";
import {
  subscriptionPeriodEndUnix,
  unixToIso,
  type LifecycleEvent,
} from "@/lib/kuendigung";
import { findLifecycleBySubscription } from "@/lib/kuendigung-store";
import { getStripe, retrieveCustomerEmail, stripeCustomerIdFrom } from "@/lib/stripe";
import type Stripe from "stripe";

const OPEN_STATUS = new Set(["active", "trialing", "past_due", "unpaid"]);

export type CancellationPreview = {
  stripeReady: boolean;
  customerId: string;
  subscriptionId: string;
  periodEnd: string;
  status: string;
  alreadyScheduled: boolean;
  lookupFailed: boolean;
};

export function periodEndIso(subscription: Stripe.Subscription): string {
  return unixToIso(subscriptionPeriodEndUnix(subscription));
}

export async function listOpenSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
  const list = await getStripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  return list.data.filter((item) => OPEN_STATUS.has(item.status));
}

export async function loadCancellationPreview(customerId: string): Promise<CancellationPreview> {
  const empty: CancellationPreview = {
    stripeReady: true,
    customerId,
    subscriptionId: "",
    periodEnd: "",
    status: "",
    alreadyScheduled: false,
    lookupFailed: false,
  };
  if (!customerId) return { ...empty, stripeReady: false };
  try {
    const open = await listOpenSubscriptions(customerId);
    const pending = open.find((item) => !item.cancel_at_period_end) ?? open[0];
    if (!pending) return empty;
    return {
      stripeReady: true,
      customerId,
      subscriptionId: pending.id,
      periodEnd: periodEndIso(pending),
      status: pending.status,
      alreadyScheduled: pending.cancel_at_period_end === true,
      lookupFailed: false,
    };
  } catch (error) {
    console.error("[kuendigung] Abo lesen fehlgeschlagen", error);
    return { ...empty, lookupFailed: true };
  }
}

export async function scheduleCancelAtPeriodEnd(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function createCancellationPortalSession(input: {
  customerId: string;
  subscriptionId: string;
  returnUrl: string;
}): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: input.customerId,
    locale: "de",
    return_url: input.returnUrl,
    flow_data: {
      type: "subscription_cancel",
      subscription_cancel: { subscription: input.subscriptionId },
    },
  });
  if (!session.url) throw new Error("Stripe Customer Portal ohne URL");
  return session.url;
}

function customerIdOf(customer: Stripe.Subscription["customer"]): string {
  return stripeCustomerIdFrom(customer);
}

export async function subscriptionEventEmail(
  subscription: Stripe.Subscription,
): Promise<string> {
  const stored = await findLifecycleBySubscription(subscription.id);
  if (stored?.email) return stored.email;
  const customerId = customerIdOf(subscription.customer);
  return customerId ? retrieveCustomerEmail(customerId) : "";
}

export function lifecycleEventFromSubscription(input: {
  eventId: string;
  at: string;
  email: string;
  subscription: Stripe.Subscription;
  deleted: boolean;
}): LifecycleEvent {
  const customerId = customerIdOf(input.subscription.customer);
  const periodEnd = periodEndIso(input.subscription);
  const reason = input.subscription.cancellation_details?.reason ?? "";
  if (input.deleted) {
    const endedUnix = input.subscription.ended_at || input.subscription.canceled_at;
    return {
      id: input.eventId,
      type: "subscription_deleted",
      at: input.at,
      email: input.email,
      customerId,
      subscriptionId: input.subscription.id,
      periodEnd,
      endedAt: endedUnix ? unixToIso(endedUnix) : input.at,
      cancellationReason: reason,
    };
  }
  return {
    id: input.eventId,
    type: "subscription_updated",
    at: input.at,
    email: input.email,
    customerId,
    subscriptionId: input.subscription.id,
    periodEnd,
    status: input.subscription.status,
    cancelAtPeriodEnd: input.subscription.cancel_at_period_end === true,
    cancellationReason: reason,
  };
}

export async function recordSubscriptionEvent(input: {
  eventId: string;
  at: string;
  subscription: Stripe.Subscription;
  deleted: boolean;
  email?: string;
}): Promise<void> {
  const email = input.email?.trim() || (await subscriptionEventEmail(input.subscription));
  if (!email) {
    console.error("[kuendigung] Abo-Ereignis ohne E-Mail", input.subscription.id);
    return;
  }
  await applyLifecycleEvent(
    lifecycleEventFromSubscription({
      eventId: input.eventId,
      at: input.at,
      email,
      subscription: input.subscription,
      deleted: input.deleted,
    }),
  );
}

export async function recordCheckoutSubscription(input: {
  eventId: string;
  at: string;
  email: string;
  customerId: string;
  subscriptionId: string;
}): Promise<void> {
  if (!input.subscriptionId || !input.email) return;
  let periodEnd = "";
  try {
    const subscription = await getStripe().subscriptions.retrieve(input.subscriptionId);
    periodEnd = periodEndIso(subscription);
  } catch (error) {
    console.error("[kuendigung] Periodenende nicht gelesen", error);
  }
  await applyLifecycleEvent({
    id: input.eventId,
    type: "checkout_completed",
    at: input.at,
    email: input.email,
    customerId: input.customerId,
    subscriptionId: input.subscriptionId,
    periodEnd,
  });
}

/**
 * Hebt die Schreibsperre auf, wenn diese Checkout-Session ein noch laufendes
 * Abo trägt. Eine ältere, bereits beendete Session bleibt gesperrt.
 */
export async function reopenIfActiveCheckout(email: string, sessionId: string): Promise<void> {
  if (!email.trim() || !sessionId.trim()) return;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    if (session.payment_status !== "paid") return;
    const subscription = session.subscription;
    if (!subscription || typeof subscription === "string") return;
    if (subscription.status !== "active" && subscription.status !== "trialing") return;
    await recordCheckoutSubscription({
      eventId: `checkout-reopen-${session.id}`,
      at: new Date().toISOString(),
      email,
      customerId: stripeCustomerIdFrom(session.customer) || customerIdOf(subscription.customer),
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("[kuendigung] Wiederherstellung aus Checkout fehlgeschlagen", error);
  }
}
