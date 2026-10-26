/**
 * Checkout Preismodell v2. Nur bei PRICING_MODEL=v2 aufgerufen.
 *
 * - Einstieg mit Mitgliedschaft: EINE Session, `mode: subscription`, Einstieg
 *   (einmalig, landet auf der ersten Rechnung) + Jahrespreis. Das erste
 *   Mitgliedsjahr wird beim Kauf berechnet (CoS 26.10.).
 * - Einstieg ohne Mitgliedschaft: `mode: payment` mit Rechnung.
 * - Änderung (49 €): `mode: payment`, nur Konto, nur innerhalb der Frist.
 * - Mitgliedschaft nachträglich: `mode: subscription`, nur Jahrespreis (R7).
 *
 * Preis-IDs kommen aus der Umgebung (STRIPE_PRICE_ENTRY_ID,
 * STRIPE_PRICE_MEMBER_YEAR_ID, STRIPE_PRICE_CHANGE_ID). Steuer wie bisher:
 * manuelle Tax Rate 19 % exklusiv. Promotion-Codes bleiben technisch an (R6).
 */
import type Stripe from "stripe";
import { getAppUrl, getStripeTaxRateId } from "@/lib/env";
import { v2PriceIds } from "@/lib/pricing-model";

export type PlanCheckoutKind = "entry" | "change" | "member";

export type PlanCheckoutInput = {
  kind: PlanCheckoutKind;
  /** Nur für `entry`: Paket mit Jahresmitgliedschaft. */
  member?: boolean;
  email: string;
  company: string;
  entityId?: string;
  audience?: "kunde" | "steuerberater";
  customerId?: string;
};

export const PLAN_METADATA_KIND = "gobd_kind";
export const PLAN_METADATA_PLAN = "gobd_plan";
export const PLAN_PRODUCT = "gobd-verfahrensdoku";

/** Paketwahl aus Body oder Query: `mitglied` / `einstieg`, sonst Default. */
export function memberFromPackage(value: unknown, preselected: boolean): boolean {
  if (value === "mitglied" || value === true) return true;
  if (value === "einstieg" || value === false) return false;
  return preselected;
}

export function planCheckoutKind(value: unknown): PlanCheckoutKind {
  return value === "change" || value === "member" ? value : "entry";
}

function successUrl(kind: PlanCheckoutKind, entityId: string): string {
  const appUrl = getAppUrl();
  if (kind === "change") return `${appUrl}/account?kauf=aenderung`;
  if (kind === "member") return `${appUrl}/account/billing?kauf=mitglied`;
  return entityId
    ? `${appUrl}/intake?session_id={CHECKOUT_SESSION_ID}&entity_id=${encodeURIComponent(entityId)}`
    : `${appUrl}/intake?session_id={CHECKOUT_SESSION_ID}`;
}

function cancelUrl(kind: PlanCheckoutKind, audience: string): string {
  const appUrl = getAppUrl();
  if (kind === "change") return `${appUrl}/account`;
  if (kind === "member") return `${appUrl}/account/billing`;
  return audience === "steuerberater" ? `${appUrl}/steuerberater` : `${appUrl}/checkout`;
}

export function buildPlanCheckoutParams(
  input: PlanCheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  const ids = v2PriceIds();
  const kind = input.kind;
  const member = kind === "member" || (kind === "entry" && input.member === true);
  const entityId = input.entityId?.trim() ?? "";
  const audience = input.audience === "steuerberater" ? "steuerberater" : "kunde";
  const customerId = input.customerId?.trim() ?? "";
  const taxRateId = getStripeTaxRateId();
  if (!taxRateId) {
    console.warn("[stripe] STRIPE_TAX_RATE_ID fehlt — v2-Checkout ohne Umsatzsteuer.");
  }
  const taxRates = taxRateId ? { tax_rates: [taxRateId] } : {};
  const metadata: Record<string, string> = {
    company: input.company,
    product: PLAN_PRODUCT,
    audience,
    [PLAN_METADATA_KIND]: kind,
    [PLAN_METADATA_PLAN]: member ? "member" : "single",
    ...(entityId ? { entity_id: entityId } : {}),
  };

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  if (kind === "entry") lineItems.push({ price: ids.entry, quantity: 1, ...taxRates });
  if (kind === "change") lineItems.push({ price: ids.change, quantity: 1, ...taxRates });
  if (member) lineItems.push({ price: ids.memberYear, quantity: 1, ...taxRates });

  const base: Stripe.Checkout.SessionCreateParams = {
    currency: "eur",
    locale: "de",
    adaptive_pricing: { enabled: false },
    ...(customerId
      ? {
          customer: customerId,
          customer_update: { name: "auto" as const, address: "auto" as const },
        }
      : { customer_email: input.email }),
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    line_items: lineItems,
    success_url: successUrl(kind, entityId),
    cancel_url: cancelUrl(kind, audience),
    metadata,
  };

  if (member) {
    return {
      ...base,
      mode: "subscription",
      payment_method_collection: "always",
      subscription_data: {
        ...(taxRateId ? { default_tax_rates: [taxRateId] } : {}),
        metadata,
      },
    };
  }
  return {
    ...base,
    mode: "payment",
    // Einmalzahlung: ohne invoice_creation gäbe es keine Stripe-Rechnung.
    invoice_creation: { enabled: true, invoice_data: { metadata } },
    ...(customerId ? {} : { customer_creation: "always" as const }),
    payment_intent_data: { metadata },
  };
}

/** Fehlende Preis-IDs für diese Art. Leer = vollständig. */
export function missingPlanPriceIds(kind: PlanCheckoutKind, member: boolean): string[] {
  const ids = v2PriceIds();
  const missing: string[] = [];
  if (kind === "entry" && !ids.entry) missing.push("STRIPE_PRICE_ENTRY_ID");
  if (kind === "change" && !ids.change) missing.push("STRIPE_PRICE_CHANGE_ID");
  if ((kind === "member" || member) && !ids.memberYear) missing.push("STRIPE_PRICE_MEMBER_YEAR_ID");
  return missing;
}
