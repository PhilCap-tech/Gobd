/**
 * Checkout Preismodell v2. Nur bei PRICING_MODEL=v2 aufgerufen.
 *
 * - Einstieg mit Mitgliedschaft: EINE Session, `mode: subscription`, Einstieg
 *   (einmalig, landet auf der ersten Rechnung) + Jahrespreis. Das erste
 *   Mitgliedsjahr wird beim Kauf berechnet (CoS 26.10.).
 * - Einstieg ohne Mitgliedschaft: `mode: payment` mit Rechnung.
 * - Änderung (49 €): `mode: payment`, nur Konto, nur innerhalb der Frist.
 * - Mitgliedschaft nachträglich: `mode: subscription`, nur Jahrespreis (R7).
 *   Schon gekaufte Firmen ab der 3. kommen ohne Gutschrift dazu und kosten
 *   49 € erst ab der nächsten Verlängerung (approvals 14:15, Punkt 4): der
 *   Webhook setzt danach die Menge am Firmen-Posten ohne Anteilsrechnung.
 * - Weitere Firma (R1 neu, nur PRICING_EXTRA_FIRMS_ENABLED): `mode: payment`.
 *   Ohne Mitgliedschaft 99 € einmalig (STRIPE_PRICE_FIRM_ID, leer:
 *   STRIPE_PRICE_ENTRY_ID). Mitglied ab der 3. Firma: volle 49 € für das
 *   laufende Jahr, keine Anteilsrechnung (bestätigt 14:15); nach Zahlung setzt
 *   der Webhook die Menge am Firmen-Posten (49 €/Jahr) +1 ohne Anteilsrechnung.
 *
 * Preis-IDs kommen aus der Umgebung (STRIPE_PRICE_ENTRY_ID,
 * STRIPE_PRICE_MEMBER_YEAR_ID, STRIPE_PRICE_CHANGE_ID). Steuer wie bisher:
 * manuelle Tax Rate 19 % exklusiv. Promotion-Codes bleiben technisch an (R6).
 */
import type Stripe from "stripe";
import { checkoutReturnBaseUrl, getStripeTaxRateId } from "@/lib/env";
import { V2_MEMBER_FIRM_YEAR_CENTS } from "@/lib/pricing";
import { V3_YEAR_CENTS } from "@/lib/pricing";
import { addMonthsIso } from "@/lib/plan";
import { v2FirmPriceIds, v2PriceIds } from "@/lib/pricing-model";

/**
 * Neues Modell (28.10.): `entry` (Option 1 bzw. mit `member` Option 2),
 * `addon` (Jahrespaket 49 €/Jahr innerhalb der 30 Tage), `reactivate`
 * (99 € + 49 €/Jahr nach Ablauf). `change` / `member` / `firm` sind die
 * abgeschalteten v2-Arten vom 26.10.; der Code bleibt für Altbestand.
 */
export type PlanCheckoutKind = "entry" | "change" | "member" | "firm" | "addon" | "reactivate";

/** Preis-IDs des neuen Modells (aus Env oder zur Laufzeit per Lookup Key aufgelöst). */
export type V3Prices = { entry: string; year: string; addonYear: string };

export type PlanCheckoutInput = {
  kind: PlanCheckoutKind;
  /** Nur für `entry`: Paket mit Jahresmitgliedschaft. */
  member?: boolean;
  email: string;
  company: string;
  entityId?: string;
  audience?: "kunde" | "steuerberater";
  customerId?: string;
  /** Nur `firm`: Konto ist Mitglied (49 € laufendes Jahr statt 99 € einmalig). */
  memberFirm?: boolean;
  /** Zeitpunkt der AGB-Bestätigung im Checkout (ISO). Landet in den Metadaten (Session, Abo, Zahlung, Rechnung). */
  agbAcceptedAt?: string;
  /** Neues Modell: aufgelöste Preise. */
  prices?: V3Prices;
  /** Nur `addon`: erster Kauf (ISO). Das Jahr endet bei Erstkauf + 12 Monate. */
  firstPurchasedAt?: string;
  /** Widerspruch gegen Angebots-Mails. */
  offerOptOut?: boolean;
  /** Login zuerst: Entwurf (email:-Schlüssel) aus dem Fragebogen. */
  draftKey?: string;
};

/** Metadaten: Entwurf aus dem Fragebogen (Login zuerst), wird nach Zahlung übernommen. */
export const PLAN_METADATA_DRAFT_KEY = "gobd_draft_key";

export const PLAN_METADATA_AGB_ACCEPTED_AT = "agb_accepted_at";

export const PLAN_METADATA_FIRM = "gobd_firm";
/** Widerspruch gegen Angebots-Mails (Checkout-Häkchen), Wert `1`. */
export const PLAN_METADATA_OFFER_OPTOUT = "gobd_offer_optout";

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
  return value === "change" || value === "member" || value === "firm" || value === "addon" || value === "reactivate"
    ? value
    : "entry";
}

/**
 * Jahrespaket nachgebucht (Philip 28.10., c): das Jahr läuft ab dem ERSTEN
 * Kauf. Umsetzung ohne Anteilsrechnung: die 49 € für das erste Jahr sind ein
 * Einmalposten (`addon_year_v3`) auf der ersten Rechnung, das Jahres-Abo
 * (`year_v3`) startet mit `trial_end` = Erstkauf + 12 Monate und berechnet
 * erst ab dann 49 €/Jahr. Damit endet die erste Periode genau ein Jahr nach
 * dem Erstkauf. Stripe verlangt trial_end ≥ 48 h in der Zukunft; innerhalb
 * der 30 Tage ist das immer erfüllt (sonst: kein trial_end, Jahr ab Buchung).
 */
export function addonTrialEnd(firstPurchasedAt: string, now: Date = new Date()): number | null {
  const end = Date.parse(addMonthsIso(firstPurchasedAt, 12));
  if (!Number.isFinite(end) || end < now.getTime() + 48 * 60 * 60 * 1000) return null;
  return Math.floor(end / 1000);
}

function successUrl(kind: PlanCheckoutKind, entityId: string): string {
  const appUrl = checkoutReturnBaseUrl();
  if (kind === "change") return `${appUrl}/account?kauf=aenderung`;
  if (kind === "addon") return `${appUrl}/account?kauf=jahrespaket`;
  if (kind === "reactivate") return `${appUrl}/account?kauf=reaktiviert`;
  if (kind === "member") return `${appUrl}/account?kauf=mitglied`;
  if (kind === "firm") return `${appUrl}/account?kauf=firma#firmen`;
  return entityId
    ? `${appUrl}/intake?session_id={CHECKOUT_SESSION_ID}&entity_id=${encodeURIComponent(entityId)}`
    : `${appUrl}/intake?session_id={CHECKOUT_SESSION_ID}`;
}

function cancelUrl(kind: PlanCheckoutKind, audience: string): string {
  const appUrl = checkoutReturnBaseUrl();
  if (kind === "change") return `${appUrl}/account`;
  if (kind === "member" || kind === "firm" || kind === "addon" || kind === "reactivate") return `${appUrl}/account`;
  return audience === "steuerberater" ? `${appUrl}/steuerberater` : `${appUrl}/checkout`;
}

export function buildPlanCheckoutParams(
  input: PlanCheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  const ids = v2PriceIds();
  const kind = input.kind;
  const member =
    kind === "member" || kind === "addon" || kind === "reactivate" || (kind === "entry" && input.member === true);
  const v3 = input.prices;
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
    ...(kind === "firm" ? { [PLAN_METADATA_FIRM]: input.memberFirm ? "member" : "single" } : {}),
    ...(entityId ? { entity_id: entityId } : {}),
    ...(input.agbAcceptedAt ? { [PLAN_METADATA_AGB_ACCEPTED_AT]: input.agbAcceptedAt } : {}),
    ...(input.offerOptOut ? { [PLAN_METADATA_OFFER_OPTOUT]: "1" } : {}),
    ...(input.draftKey ? { [PLAN_METADATA_DRAFT_KEY]: input.draftKey.slice(0, 450) } : {}),
  };

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let trialEnd: number | null = null;
  if (v3) {
    // Neues Modell: nur entry / addon / reactivate.
    if (kind === "entry" || kind === "reactivate") lineItems.push({ price: v3.entry, quantity: 1, ...taxRates });
    if (kind === "addon") {
      lineItems.push(
        v3.addonYear
          ? { price: v3.addonYear, quantity: 1, ...taxRates }
          : {
              price_data: {
                currency: "eur",
                unit_amount: V3_YEAR_CENTS,
                tax_behavior: "exclusive",
                product_data: { name: "Jahrespaket, erstes Jahr ab Erstkauf" },
              },
              quantity: 1,
              ...taxRates,
            },
      );
      trialEnd = addonTrialEnd(input.firstPurchasedAt ?? "");
    }
    if (member) lineItems.push({ price: v3.year, quantity: 1, ...taxRates });
  }
  if (!v3 && kind === "entry") lineItems.push({ price: ids.entry, quantity: 1, ...taxRates });
  if (kind === "change") lineItems.push({ price: ids.change, quantity: 1, ...taxRates });
  if (kind === "firm" && input.memberFirm) {
    lineItems.push({
      price_data: {
        currency: "eur",
        unit_amount: V2_MEMBER_FIRM_YEAR_CENTS,
        tax_behavior: "exclusive",
        product_data: { name: "Weitere Firma im Jahrespaket" },
      },
      quantity: 1,
      ...taxRates,
    });
  } else if (kind === "firm") {
    lineItems.push({ price: v2FirmPriceIds().firm, quantity: 1, ...taxRates });
  }
  if (!v3 && member) lineItems.push({ price: ids.memberYear, quantity: 1, ...taxRates });

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
    success_url:
      kind === "entry" && input.draftKey
        ? `${checkoutReturnBaseUrl()}/fragebogen/bezahlt?session_id={CHECKOUT_SESSION_ID}`
        : successUrl(kind, entityId),
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
        ...(trialEnd ? { trial_end: trialEnd } : {}),
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
export function missingPlanPriceIds(kind: PlanCheckoutKind, member: boolean, memberFirm = false): string[] {
  const ids = v2PriceIds();
  const missing: string[] = [];
  if (kind === "entry" && !ids.entry) missing.push("STRIPE_PRICE_ENTRY_ID");
  if (kind === "change" && !ids.change) missing.push("STRIPE_PRICE_CHANGE_ID");
  if ((kind === "member" || member) && !ids.memberYear) missing.push("STRIPE_PRICE_MEMBER_YEAR_ID");
  if (kind === "firm" && !memberFirm && !v2FirmPriceIds().firm) missing.push("STRIPE_PRICE_FIRM_ID");
  if (kind === "firm" && memberFirm && !v2FirmPriceIds().memberFirmYear) {
    missing.push("STRIPE_PRICE_MEMBER_FIRM_YEAR_ID");
  }
  return missing;
}

/**
 * Menge am Firmen-Posten (49 €/Jahr) setzen, immer ohne Anteilsrechnung:
 * der laufende Betrag ist schon bezahlt (weitere Firma) bzw. fällt erst ab
 * der nächsten Verlängerung an (Mitgliedschaft nachträglich, Punkt 4).
 */
export function memberFirmQuantityParams(input: {
  itemId: string;
  quantity: number;
  priceId: string;
  taxRateId: string;
}): Stripe.SubscriptionUpdateParams {
  const quantity = Math.max(0, Math.trunc(input.quantity));
  const item: Stripe.SubscriptionUpdateParams.Item = input.itemId
    ? quantity > 0
      ? { id: input.itemId, quantity }
      : { id: input.itemId, deleted: true }
    : {
        price: input.priceId,
        quantity,
        ...(input.taxRateId ? { tax_rates: [input.taxRateId] } : {}),
      };
  return { items: [item], proration_behavior: "none" };
}
