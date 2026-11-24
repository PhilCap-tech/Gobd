/**
 * Checkout der Schnellversion. Ohne Flag oder ohne gültige Price-ID kein
 * Stripe-Aufruf. Plan `test` braucht `sk_test_`, Plan `live` braucht `sk_live_`.
 * Der Stub spricht Stripe nicht an.
 */

import { checkoutReturnBaseUrl, getStripeTaxRateId } from "@/lib/env";
import { CREDIT_RESERVE_MS } from "@/lib/schnellversion-credit";
import {
  schnellversionCheckoutPlan,
  schnellversionPriceId,
} from "@/lib/schnellversion-flag";

const SV_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Gültige Adresse oder leer. Leer heißt: Stripe fragt die E-Mail selbst ab. */
export function svValidEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && SV_EMAIL_RE.test(email) ? email : "";
}

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
 * Dieselben Rechnungsfelder wie der 99-€-Checkout (`buildPlanCheckoutParams`).
 * Die Tax Rate kommt aus `STRIPE_TAX_RATE_ID`. `tax_behavior: exclusive` steht
 * am Preis, nicht hier.
 */
export function schnellversionSessionParams(
  input: { pendingId: string; consentAt: string; company: string; downloadToken: string; email: string },
  env: Record<string, string | undefined> = process.env,
): import("stripe").Stripe.Checkout.SessionCreateParams | null {
  const plan = schnellversionCheckoutPlan(env);
  if (plan !== "test" && plan !== "live") return null;
  const origin = checkoutReturnBaseUrl().replace(/\/$/, "");
  const thanks = `${origin}/schnellversion/danke`;
  const expiresAt = Math.floor(Date.now() / 1000) + Math.floor(CREDIT_RESERVE_MS / 1000);
  const price = schnellversionPriceId(env);
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  if (!price) return null;
  if (plan === "test" && !secret.startsWith("sk_test_")) return null;
  if (plan === "live" && !secret.startsWith("sk_live_")) return null;
  const tax = (env.STRIPE_TAX_RATE_ID ?? getStripeTaxRateId()).trim();
  const metadata = schnellversionCheckoutMetadata(input);
  const email = svValidEmail(input.email);
  return {
    mode: "payment",
    currency: "eur",
    locale: "de",
    adaptive_pricing: { enabled: false },
    ...(email ? { customer_email: email } : {}),
    customer_creation: "always",
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    line_items: [
      {
        price,
        quantity: 1,
        ...(tax ? { tax_rates: [tax] } : {}),
      },
    ],
    invoice_creation: { enabled: true, invoice_data: { metadata } },
    metadata,
    payment_intent_data: { metadata },
    expires_at: expiresAt,
    success_url: `${thanks}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/schnellversion/kauf`,
  };
}

/**
 * Plan `test` (`sk_test_`) oder `live` (`sk_live_`), jeweils nur mit Flag und Preis.
 * Der Kauf entsteht erst, wenn die Session `paid` ist.
 */
export async function createSchnellversionTestSession(
  input: { pendingId: string; consentAt: string; company: string; downloadToken: string; email: string },
  env: Record<string, string | undefined> = process.env,
): Promise<{ sessionId: string; url: string } | null> {
  const params = schnellversionSessionParams(input, env);
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  if (!params || !secret) return null;
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret);
  const session = await stripe.checkout.sessions.create(params);
  if (!session.id || !session.url) return null;
  return { sessionId: session.id, url: session.url };
}
