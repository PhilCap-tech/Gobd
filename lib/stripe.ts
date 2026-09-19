import Stripe from "stripe";
import { getAppUrl, isStripeConfigured } from "@/lib/env";
import type { CheckoutIdentity } from "@/lib/types";

export type PortalStatus = "returned" | "missing" | "unavailable" | "error";

let stripeClient: Stripe | null = null;

export type CheckoutResolveError = "missing" | "not_paid" | "lookup_failed";

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

export function isCheckoutSessionFulfilled(
  session: Pick<Stripe.Checkout.Session, "status" | "payment_status">,
): boolean {
  if (session.status === "complete") {
    return true;
  }
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"
  );
}

function isRetryableStripeError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const e = error as { type?: string; statusCode?: number };
  if (
    e.type === "StripeConnectionError" ||
    e.type === "StripeAPIError" ||
    e.type === "StripeRateLimitError"
  ) {
    return true;
  }
  if (e.statusCode === 429) {
    return true;
  }
  return typeof e.statusCode === "number" && e.statusCode >= 500;
}

async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (!isRetryableStripeError(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    return stripe.checkout.sessions.retrieve(sessionId);
  }
}

export async function createCheckoutSession(input: {
  email: string;
  company: string;
}): Promise<{ url: string; stub: boolean }> {
  const appUrl = getAppUrl();
  const successUrl = `${appUrl}/intake?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/`;

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
    return { url: `${appUrl}/intake?${params}`, stub: true };
  }

  const stripe = getStripe();

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
    success_url: successUrl,
    cancel_url: cancelUrl,
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

/**
 * Resolves a Checkout session from the success redirect (`session_id` query).
 * Does not depend on webhooks — redirect must work without STRIPE_WEBHOOK_SECRET.
 */
export async function resolveCheckoutSession(
  sessionId: string | undefined,
): Promise<CheckoutIdentity | { error: CheckoutResolveError }> {
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
    const session = await retrieveCheckoutSession(sessionId);
    if (!isCheckoutSessionFulfilled(session)) {
      return { error: "not_paid" };
    }

    const customerId = stripeCustomerIdFrom(session.customer);

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

export function stripeCustomerIdFrom(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string {
  if (!customer) return "";
  if (typeof customer === "string") return customer;
  return customer.id || "";
}

export async function retrieveCustomerEmail(customerId: string): Promise<string> {
  if (!customerId) return "";
  try {
    const customer = await getStripe().customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) return "";
    return customer.email || "";
  } catch (error) {
    console.error("[stripe] Customer-Lookup fehlgeschlagen", error);
    return "";
  }
}

export async function createBillingPortalSession(
  customerId: string,
): Promise<{ url: string }> {
  const id = customerId.trim();
  if (!id) {
    throw new Error("stripe_customer_id fehlt");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: id,
    locale: "de",
    return_url: `${getAppUrl()}/meine-dokumente?portal=returned`,
  });

  if (!session.url) {
    throw new Error("Stripe Customer Portal ohne URL");
  }

  return { url: session.url };
}

export function portalStatusFromQuery(
  value: string | undefined,
): PortalStatus | null {
  if (
    value === "returned" ||
    value === "missing" ||
    value === "unavailable" ||
    value === "error"
  ) {
    return value;
  }
  return null;
}

export function portalStatusCopy(status: PortalStatus): {
  text: string;
  tone: "ok" | "warn";
} {
  switch (status) {
    case "returned":
      return {
        text: "Zurück aus der Abo-Verwaltung. Änderungen (Zahlungsmittel, Kündigung) können kurz brauchen, bis sie sichtbar sind.",
        tone: "ok",
      };
    case "missing":
      return {
        text: "Kein Stripe-Kunde zu dieser E-Mail. Das Portal ist nach einem Checkout mit Stripe verfügbar.",
        tone: "warn",
      };
    case "unavailable":
      return {
        text: "Stripe ist nicht konfiguriert — Abo-Verwaltung im Demo-Pfad nicht verfügbar.",
        tone: "warn",
      };
    case "error":
      return {
        text: "Abo-Verwaltung konnte nicht geöffnet werden. Bitte später erneut versuchen.",
        tone: "warn",
      };
  }
}
