import type { CancelStripe } from "@/lib/plan-cancel";
import { getStripe } from "@/lib/stripe";

/** Stripe-Anbindung für Kündigung/Rücknahme (Konto und Admin). */
export function planCancelStripe(): CancelStripe {
  return {
    scheduleCancel: async (subscriptionId, plan) => {
      await getStripe().subscriptions.update(
        subscriptionId,
        plan.atCurrentPeriodEnd
          ? { cancel_at_period_end: true }
          : { cancel_at: Math.floor(Date.parse(plan.effectiveAt) / 1000) },
      );
    },
    clearCancel: async (subscriptionId) => {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await stripe.subscriptions.update(
        subscriptionId,
        subscription.cancel_at_period_end ? { cancel_at_period_end: false } : { cancel_at: "" },
      );
    },
  };
}
