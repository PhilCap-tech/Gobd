/**
 * Checkout der Schnellversion. Live-Keys und fehlende Price-ID erzeugen
 * keinen Stripe-Aufruf. Der Stub liefert nur die lokale Danke-Seite.
 */

import { getAppUrl, getStripeTaxRateId } from "@/lib/env";
import {
  schnellversionCheckoutPlan,
  schnellversionPriceId,
  type SchnellversionCheckoutPlan,
} from "@/lib/schnellversion-flag";

export type SchnellversionCheckoutResult = { ready: false } | { ready: true; url: string };

export async function startSchnellversionCheckout(
  env: Record<string, string | undefined> = process.env,
): Promise<SchnellversionCheckoutResult> {
  const plan: SchnellversionCheckoutPlan = schnellversionCheckoutPlan(env);
  if (plan === "refuse") return { ready: false };
  if (plan === "stub") return { ready: true, url: "/schnellversion/danke" };
  const origin = getAppUrl().replace(/\/$/, "");
  const thanks = `${origin}/schnellversion/danke`;
  const price = schnellversionPriceId(env);
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret);
  const tax = getStripeTaxRateId();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price,
        quantity: 1,
        ...(tax ? { tax_rates: [tax] } : {}),
      },
    ],
    success_url: `${thanks}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/schnellversion/kauf`,
  });
  if (!session.url) return { ready: false };
  return { ready: true, url: session.url };
}
