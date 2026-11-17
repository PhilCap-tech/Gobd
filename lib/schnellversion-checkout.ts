/**
 * Checkout der Schnellversion. Live-Keys und fehlende Price-ID erzeugen
 * keinen Stripe-Aufruf. Der Stub spricht Stripe nicht an.
 */

import { getAppUrl, getStripeTaxRateId } from "@/lib/env";
import {
  schnellversionCheckoutPlan,
  schnellversionPriceId,
} from "@/lib/schnellversion-flag";

/** Zustimmung und offener Checkout. Die Session-Metadaten, kein Kauf. */
export function schnellversionCheckoutMetadata(input: {
  pendingId: string;
  consentAt: string;
  company: string;
}): Record<string, string> {
  return {
    sv49: "1",
    sv_pending: input.pendingId,
    sv_consent_at: input.consentAt,
    company: input.company.slice(0, 450),
    product: "schnellversion-49",
  };
}

/**
 * Nur bei Plan `test` (`sk_test_`). Legt eine Checkout-Session an und gibt
 * die ID zurück. Der Kauf entsteht erst, wenn die Session `paid` ist.
 */
export async function createSchnellversionTestSession(
  input: { pendingId: string; consentAt: string; company: string },
  env: Record<string, string | undefined> = process.env,
): Promise<{ sessionId: string; url: string } | null> {
  if (schnellversionCheckoutPlan(env) !== "test") return null;
  const origin = getAppUrl().replace(/\/$/, "");
  const thanks = `${origin}/schnellversion/danke`;
  const price = schnellversionPriceId(env);
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secret.startsWith("sk_test_") || !price) return null;
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret);
  const tax = getStripeTaxRateId();
  const metadata = schnellversionCheckoutMetadata(input);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price,
        quantity: 1,
        ...(tax ? { tax_rates: [tax] } : {}),
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    success_url: `${thanks}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/schnellversion/kauf`,
  });
  if (!session.id || !session.url) return null;
  return { sessionId: session.id, url: session.url };
}
