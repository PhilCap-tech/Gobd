import Stripe from "stripe";
import { getAppUrl, isStripeConfigured } from "@/lib/env";
import type { CheckoutIdentity } from "@/lib/types";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY fehlt");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export async function createCheckoutSession(input: {
  email: string;
  company: string;
}): Promise<{ url: string; stub: boolean }> {
  if (!isStripeConfigured()) {
    const sessionId = `mock_${Date.now()}`;
    const params = new URLSearchParams({
      session_id: sessionId,
      email: input.email,
      company: input.company,
    });
    console.warn(
      "[stripe] Keys fehlen — Stub-Checkout. Setze STRIPE_SECRET_KEY, STRIPE_PRICE_SETUP_ID, STRIPE_PRICE_MONTHLY_ID.",
    );
    return { url: `${getAppUrl()}/intake?${params}`, stub: true };
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    locale: "de",
    customer_email: input.email,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    line_items: [
      { price: process.env.STRIPE_PRICE_SETUP_ID, quantity: 1 },
      { price: process.env.STRIPE_PRICE_MONTHLY_ID, quantity: 1 },
    ],
    success_url: `${appUrl}/intake?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/`,
    metadata: {
      company: input.company,
      product: "gobd-verfahrensdoku",
    },
    subscription_data: {
      metadata: {
        company: input.company,
        product: "gobd-verfahrensdoku",
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe Session ohne URL");
  }

  return { url: session.url, stub: false };
}

export async function resolveCheckoutSession(
  sessionId: string | undefined,
): Promise<CheckoutIdentity | { error: "missing" | "not_paid" | "lookup_failed" }> {
  if (!sessionId) {
    return { error: "missing" };
  }

  if (!isStripeConfigured()) {
    return {
      email: "",
      company: "",
      stripeSessionId: sessionId,
      stripeCustomerId: "",
      stub: true,
    };
  }

  if (sessionId.startsWith("mock_")) {
    return { error: "not_paid" };
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.status !== "complete") {
      return { error: "not_paid" };
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || "";

    return {
      email: session.customer_details?.email || session.customer_email || "",
      company: session.metadata?.company || "",
      stripeSessionId: session.id,
      stripeCustomerId: customerId,
      stub: false,
    };
  } catch (error) {
    console.error("[stripe] Session-Lookup fehlgeschlagen", error);
    return { error: "lookup_failed" };
  }
}
