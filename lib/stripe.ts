import Stripe from "stripe";
import { getAppUrl, isStripeConfigured, isStripeSecretConfigured } from "@/lib/env";
import type { CheckoutIdentity } from "@/lib/types";

const CUSTOMER_LIST_TTL_MS = 60_000;
const CUSTOMER_LIST_EMPTY_TTL_MS = 5_000;
const CUSTOMER_VERIFY_TTL_MS = 60_000;

export type PortalStatus =
  | "returned"
  | "missing"
  | "unavailable"
  | "error"
  | "config";

export type PortalErrorKind = "missing_customer" | "portal_config" | "api";
export type StripeCustomerVerifyResult = "valid" | "invalid" | "error";

type CustomerListLookup = {
  id: string | null;
  lookupFailed: boolean;
};

const customerListCache = new Map<
  string,
  { result: CustomerListLookup; at: number; ttl: number }
>();
const customerListInflight = new Map<string, Promise<CustomerListLookup>>();
const customerVerifyCache = new Map<
  string,
  { result: StripeCustomerVerifyResult; at: number }
>();

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

function stripeErrorFields(error: unknown): {
  type?: string;
  code?: string;
  message?: string;
  param?: string;
  statusCode?: number;
} {
  if (!error || typeof error !== "object") return {};
  return error as {
    type?: string;
    code?: string;
    message?: string;
    param?: string;
    statusCode?: number;
  };
}

function isRetryableStripeError(error: unknown): boolean {
  const e = stripeErrorFields(error);
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

export function isStripeResourceMissingError(error: unknown): boolean {
  const e = stripeErrorFields(error);
  if (e.code === "resource_missing") return true;
  const message = (e.message || "").toLowerCase();
  return message.includes("no such customer") || message.includes("no such");
}

export function isStripeCustomerMissingError(error: unknown): boolean {
  if (
    error instanceof Error &&
    /stripe_customer_id fehlt/i.test(error.message)
  ) {
    return true;
  }
  if (!isStripeResourceMissingError(error)) return false;
  const e = stripeErrorFields(error);
  const param = (e.param || "").toLowerCase();
  const message = (e.message || "").toLowerCase();
  if (param === "customer" || param === "customer_id") return true;
  return message.includes("no such customer") || message.includes("customer");
}

export function isStripePortalConfigurationError(error: unknown): boolean {
  const e = stripeErrorFields(error);
  const param = (e.param || "").toLowerCase();
  const message = (e.message || "").toLowerCase();
  if (
    param === "configuration" ||
    param === "configuration_id" ||
    param === "billing_portal_configuration"
  ) {
    return true;
  }
  return (
    (message.includes("portal") && message.includes("config")) ||
    (message.includes("configure") && message.includes("portal")) ||
    message.includes("default configuration") ||
    message.includes("portal configuration")
  );
}

export function classifyBillingPortalError(error: unknown): PortalErrorKind {
  if (isStripePortalConfigurationError(error)) return "portal_config";
  if (isStripeCustomerMissingError(error)) return "missing_customer";
  return "api";
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
  entityId?: string;
}): Promise<{ url: string; stub: boolean }> {
  const appUrl = getAppUrl();
  const entityId = input.entityId?.trim() ?? "";
  const successUrl = entityId
    ? `${appUrl}/intake?session_id={CHECKOUT_SESSION_ID}&entity_id=${encodeURIComponent(entityId)}`
    : `${appUrl}/intake?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/`;

  if (!isStripeConfigured()) {
    const sessionId = `mock_${Date.now()}`;
    const params = new URLSearchParams({
      session_id: sessionId,
      email: input.email,
      company: input.company,
    });
    if (entityId) params.set("entity_id", entityId);
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
      ...(entityId ? { entity_id: entityId } : {}),
    },
    subscription_data: {
      metadata: {
        company: input.company,
        product: "gobd-verfahrensdoku",
        ...(entityId ? { entity_id: entityId } : {}),
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

    const email =
      session.customer_details?.email || session.customer_email || "";
    let customerId = stripeCustomerIdFrom(session.customer);
    if (!customerId && email) {
      customerId = (await listStripeCustomerIdByEmail(email)) || "";
    }

    return {
      email,
      company: session.metadata?.company || "",
      stripeSessionId: session.id,
      stripeCustomerId: customerId,
      stub: false,
      entityId: session.metadata?.entity_id?.trim() || "",
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

/**
 * Lookup a Stripe customer id by e-mail. Successful hits are cached briefly
 * to avoid customers.list on every account refresh (rate-limit). Empty /
 * failed lookups use a short TTL so a later Live customer can recover.
 */
export async function lookupStripeCustomerIdByEmail(
  email: string,
): Promise<CustomerListLookup> {
  const key = email.trim().toLowerCase();
  if (!key) return { id: null, lookupFailed: false };
  if (!isStripeSecretConfigured()) return { id: null, lookupFailed: false };

  const cached = customerListCache.get(key);
  if (cached && Date.now() - cached.at < cached.ttl) {
    return cached.result;
  }

  const inflight = customerListInflight.get(key);
  if (inflight) return inflight;

  const pending = (async (): Promise<CustomerListLookup> => {
    try {
      const result = await getStripe().customers.list({
        email: key,
        limit: 10,
      });
      const live = result.data.filter(
        (customer) => !("deleted" in customer && customer.deleted),
      );
      live.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
      const id = live[0]?.id || null;
      const lookup: CustomerListLookup = { id, lookupFailed: false };
      customerListCache.set(key, {
        result: lookup,
        at: Date.now(),
        ttl: id ? CUSTOMER_LIST_TTL_MS : CUSTOMER_LIST_EMPTY_TTL_MS,
      });
      return lookup;
    } catch (error) {
      console.error("[stripe] customers.list fehlgeschlagen", error);
      return { id: null, lookupFailed: true };
    } finally {
      customerListInflight.delete(key);
    }
  })();

  customerListInflight.set(key, pending);
  return pending;
}

export async function listStripeCustomerIdByEmail(
  email: string,
): Promise<string | null> {
  const lookup = await lookupStripeCustomerIdByEmail(email);
  return lookup.id;
}

/**
 * Confirm a stored `cus_…` exists in the mode of the current STRIPE_SECRET_KEY.
 * Test-mode ids fail with resource_missing against Live keys (and vice versa).
 */
export async function verifyStripeCustomerId(
  customerId: string,
): Promise<StripeCustomerVerifyResult> {
  const id = customerId.trim();
  if (!id) return "invalid";
  if (!isStripeSecretConfigured()) return "error";

  const cached = customerVerifyCache.get(id);
  if (
    cached &&
    cached.result !== "error" &&
    Date.now() - cached.at < CUSTOMER_VERIFY_TTL_MS
  ) {
    return cached.result;
  }

  try {
    const customer = await getStripe().customers.retrieve(id);
    if ("deleted" in customer && customer.deleted) {
      console.warn("[stripe] Customer gelöscht — ID ungültig");
      customerVerifyCache.set(id, { result: "invalid", at: Date.now() });
      return "invalid";
    }
    customerVerifyCache.set(id, { result: "valid", at: Date.now() });
    return "valid";
  } catch (error) {
    if (isStripeCustomerMissingError(error)) {
      console.warn(
        "[stripe] Customer fehlt oder andere Stripe-Mode — ID ungültig",
      );
      customerVerifyCache.set(id, { result: "invalid", at: Date.now() });
      return "invalid";
    }
    console.error("[stripe] Customer-Verify fehlgeschlagen", error);
    return "error";
  }
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
    return_url: `${getAppUrl()}${accountBillingPath("returned")}`,
  });

  if (!session.url) {
    throw new Error("Stripe Customer Portal ohne URL");
  }

  return { url: session.url };
}

export type BillingSubscriptionStatus = "active" | "past_due" | "none";

export type BillingInvoice = {
  id: string;
  number: string;
  created: number;
  total: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string;
  invoicePdf: string;
};

export type CustomerBilling = {
  subscriptionStatus: BillingSubscriptionStatus;
  invoices: BillingInvoice[];
  lookupFailed: boolean;
  customerMissing: boolean;
  resolvedCustomerId: string;
};

const RECENT_INVOICE_LIMIT = 12;

export function accountBillingPath(status?: PortalStatus): string {
  return status
    ? `/account/billing?portal=${encodeURIComponent(status)}`
    : "/account/billing";
}

function httpsUrl(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return /^https:\/\//i.test(trimmed) ? trimmed : "";
}

export function billingSubscriptionStatusFrom(
  subscriptions: Array<Pick<Stripe.Subscription, "status">>,
): BillingSubscriptionStatus {
  const statuses = subscriptions.map((item) => item.status);
  if (statuses.some((status) => status === "past_due" || status === "unpaid")) {
    return "past_due";
  }
  if (statuses.some((status) => status === "active" || status === "trialing")) {
    return "active";
  }
  return "none";
}

export function billingInvoiceFrom(invoice: Stripe.Invoice): BillingInvoice {
  const id = invoice.id ?? "";
  return {
    id,
    number: (invoice.number || id).trim(),
    created: invoice.created ?? 0,
    total: invoice.total ?? 0,
    currency: (invoice.currency || "eur").toUpperCase(),
    status: invoice.status || "open",
    hostedInvoiceUrl: httpsUrl(invoice.hosted_invoice_url),
    invoicePdf: httpsUrl(invoice.invoice_pdf),
  };
}

export function formatStripeMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency || "EUR"}`;
  }
}

export function formatStripeDate(created: number): string {
  if (!created) return "—";
  return new Date(created * 1000).toLocaleDateString("de-DE");
}

export function invoiceStatusCopy(status: string): string {
  switch (status) {
    case "paid":
      return "Bezahlt";
    case "open":
      return "Offen";
    case "draft":
      return "Entwurf";
    case "void":
      return "Storniert";
    case "uncollectible":
      return "Uneinbringlich";
    default:
      return status || "—";
  }
}

export function subscriptionStatusCopy(status: BillingSubscriptionStatus): {
  label: string;
  text: string;
  tone: "ok" | "warn" | "muted";
} {
  switch (status) {
    case "active":
      return {
        label: "Aktiv",
        text: "Dein Abo ist aktiv.",
        tone: "ok",
      };
    case "past_due":
      return {
        label: "Zahlungsrückstand",
        text: "Dein Abo hat einen Zahlungsrückstand. Bitte Zahlungsmittel im Stripe-Portal prüfen.",
        tone: "warn",
      };
    case "none":
      return {
        label: "Kein Abo",
        text: "Kein aktives Abo zu diesem Konto.",
        tone: "muted",
      };
  }
}

function emptyCustomerBilling(
  extras: Partial<CustomerBilling> = {},
): CustomerBilling {
  return {
    subscriptionStatus: "none",
    invoices: [],
    lookupFailed: false,
    customerMissing: false,
    resolvedCustomerId: "",
    ...extras,
  };
}

/**
 * Subscription status + recent Stripe invoices for the account billing hub.
 * No custom invoice store — Stripe Invoice API only.
 * Invalid / wrong-mode customer ids are not treated as "no invoices".
 */
export async function loadCustomerBilling(
  customerId: string,
  options?: { email?: string },
): Promise<CustomerBilling> {
  const id = customerId.trim();
  if (!id || !isStripeSecretConfigured()) {
    return emptyCustomerBilling({ customerMissing: !id });
  }

  const loadForId = async (customer: string): Promise<CustomerBilling> => {
    try {
      const stripe = getStripe();
      const [subsResult, invoicesResult] = await Promise.allSettled([
        stripe.subscriptions.list({ customer, limit: 20 }),
        stripe.invoices.list({ customer, limit: RECENT_INVOICE_LIMIT }),
      ]);

      const customerMissing =
        (subsResult.status === "rejected" &&
          isStripeCustomerMissingError(subsResult.reason)) ||
        (invoicesResult.status === "rejected" &&
          isStripeCustomerMissingError(invoicesResult.reason));

      if (subsResult.status === "rejected") {
        console.error(
          customerMissing
            ? "[stripe] subscriptions.list: Customer fehlt oder andere Mode"
            : "[stripe] subscriptions.list fehlgeschlagen",
          subsResult.reason,
        );
      }
      if (invoicesResult.status === "rejected") {
        console.error(
          customerMissing
            ? "[stripe] invoices.list: Customer fehlt oder andere Mode"
            : "[stripe] invoices.list fehlgeschlagen",
          invoicesResult.reason,
        );
      }

      if (customerMissing) {
        return emptyCustomerBilling({ customerMissing: true });
      }

      return {
        subscriptionStatus:
          subsResult.status === "fulfilled"
            ? billingSubscriptionStatusFrom(subsResult.value.data)
            : "none",
        invoices:
          invoicesResult.status === "fulfilled"
            ? invoicesResult.value.data
                .filter((invoice) => invoice.id && invoice.status !== "draft")
                .map(billingInvoiceFrom)
            : [],
        lookupFailed:
          subsResult.status === "rejected" ||
          invoicesResult.status === "rejected",
        customerMissing: false,
        resolvedCustomerId: customer,
      };
    } catch (error) {
      if (isStripeCustomerMissingError(error)) {
        console.error(
          "[stripe] Billing-Lookup: Customer fehlt oder andere Mode",
          error,
        );
        return emptyCustomerBilling({ customerMissing: true });
      }
      console.error("[stripe] Billing-Lookup fehlgeschlagen", error);
      return emptyCustomerBilling({ lookupFailed: true });
    }
  };

  const first = await loadForId(id);
  if (!first.customerMissing) return first;

  const email = options?.email?.trim() ?? "";
  if (!email) return first;

  const recovered = await lookupStripeCustomerIdByEmail(email);
  if (recovered.lookupFailed) {
    return emptyCustomerBilling({ lookupFailed: true });
  }
  if (!recovered.id || recovered.id === id) {
    return first;
  }
  return loadForId(recovered.id);
}

export function portalStatusFromQuery(
  value: string | undefined,
): PortalStatus | null {
  if (
    value === "returned" ||
    value === "missing" ||
    value === "unavailable" ||
    value === "error" ||
    value === "config"
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
    case "config":
      return {
        text: "Das Stripe-Kundenportal ist noch nicht eingerichtet. Bitte später erneut versuchen.",
        tone: "warn",
      };
  }
}
