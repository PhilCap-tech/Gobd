import type Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  getStripeWebhookSecret,
  isProductionRuntime,
  isStripeSecretConfigured,
} from "@/lib/env";
import {
  deliverBuyerOnboarding,
  type BuyerOnboardingStatus,
} from "@/lib/buyer-onboarding";
import { notifyCheckoutPaid } from "@/lib/checkout-notice";
import { isTestEntity, matchingTestEntityId } from "@/lib/test-entities";
import { ensureBuyerFirmForCheckout } from "@/lib/checkout-firm";
import {
  checkoutContactFromCustomerDetails,
  handleFailedJob,
  handleFailedPayment,
} from "@/lib/ops";
import {
  recordCheckoutSubscription,
  recordSubscriptionEvent,
  subscriptionEventEmail,
} from "@/lib/kuendigung-stripe";
import { ownerNoticeFromStripeEvent, queueOwnerNotice } from "@/lib/owner-notice";
import { appendRecord, findRowByStripeSessionId } from "@/lib/store";
import {
  billingAddressFromCustomerDetails,
  getStripe,
  listStripeCustomerIdByEmail,
  retrieveCustomerEmail,
  stripeCustomerIdFrom,
  ustIdFromCustomerDetails,
} from "@/lib/stripe";
import { toSheetRow } from "@/lib/types";
import {
  isAnnualPlanSubscription,
  planKindFromMetadata,
  recordPlanCheckout,
  recordPlanRefund,
  recordPlanSubscriptionEvent,
} from "@/lib/plan-webhook";
import { planAccessEnabled } from "@/lib/pricing-model";

export const runtime = "nodejs";

/**
 * Stripe retries a non-2xx. A fresh claiming marker is still in flight, so
 * 500 is the signal to try again. A settled send stays 200.
 */
export function checkoutWelcomeHttpStatus(mailed: BuyerOnboardingStatus): 200 | 500 {
  if (mailed === "failed" || mailed === "inflight") return 500;
  return 200;
}

function idFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : "";
  }
  return "";
}

function eventTimeIso(created: number): string {
  return new Date((created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
}

function metadataEntityId(metadata: { entity_id?: string | null } | null | undefined): string {
  return metadata?.entity_id?.trim() ?? "";
}

/** Firm id copied onto the invoice or its subscription. No extra Stripe read. */
function invoiceEntityId(invoice: {
  metadata?: { entity_id?: string | null } | null;
  parent?: {
    subscription_details?: { metadata?: { entity_id?: string | null } | null } | null;
  } | null;
  subscription_details?: { metadata?: { entity_id?: string | null } | null } | null;
}): string {
  return (
    metadataEntityId(invoice.metadata) ||
    metadataEntityId(invoice.parent?.subscription_details?.metadata) ||
    metadataEntityId(invoice.subscription_details?.metadata)
  );
}

function missingSecretResponse() {
  const production = isProductionRuntime();
  if (production) {
    console.error(
      "[webhook] STRIPE_WEBHOOK_SECRET fehlt in Produktion. Endpoint: https://www.gobd-doku-erstellen.de/api/stripe/webhook",
    );
  } else {
    console.warn(
      "[webhook] STRIPE_WEBHOOK_SECRET fehlt. Lokal: stripe listen --forward-to localhost:3000/api/stripe/webhook",
    );
  }

  return NextResponse.json(
    {
      error: "STRIPE_WEBHOOK_SECRET fehlt",
      production,
      hint: production
        ? "Setze STRIPE_WEBHOOK_SECRET in Vercel aus Stripe Dashboard → Webhooks (Signing secret). URL: https://www.gobd-doku-erstellen.de/api/stripe/webhook"
        : "Lokal: stripe listen --forward-to localhost:3000/api/stripe/webhook und den ausgegebenen whsec_…-Wert als STRIPE_WEBHOOK_SECRET setzen.",
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const secret = getStripeWebhookSecret();
  if (!secret) {
    return missingSecretResponse();
  }

  if (!isStripeSecretConfigured()) {
    console.error("[webhook] STRIPE_SECRET_KEY fehlt");
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY fehlt" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Keine Signatur" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("[webhook] Signatur ungültig", error);
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        let email =
          session.customer_details?.email || session.customer_email || "";
        const company = session.metadata?.company || "";
        let customerId = stripeCustomerIdFrom(session.customer);
        if (!email && customerId) {
          email = await retrieveCustomerEmail(customerId);
        }
        if (!customerId && email) {
          customerId = (await listStripeCustomerIdByEmail(email)) || "";
        }

        // Preismodell v2: Änderung und nachträgliche Mitgliedschaft sind kein neuer Einstieg.
        // Keine Kaufzeile, keine Onboarding-Mail, kein alter Lifecycle.
        const planKind = planKindFromMetadata(session.metadata);
        if (planKind === "change" || planKind === "member") {
          await recordPlanCheckout({
            session,
            kind: planKind,
            email,
            customerId,
            eventId: event.id,
            at: eventTimeIso(event.created),
          });
          try {
            await notifyCheckoutPaid({
              livemode: session.livemode,
              paymentStatus: session.payment_status,
              entityId: session.metadata?.entity_id?.trim() ?? "",
              sessionId: session.id,
              company: company,
              email,
              amountTotal: session.amount_total,
              currency: session.currency,
              created: session.created,
            });
          } catch (error) {
            console.error(
              "[webhook] Kaufhinweis nicht gesendet",
              error instanceof Error ? error.name : "error",
            );
          }
          break;
        }

        const existing = await findRowByStripeSessionId(session.id);
        const buyerEmail = (email || existing?.email || "").trim();
        if (existing) {
          console.info(
            "[webhook] checkout.session.completed bereits verarbeitet",
            session.id,
          );
          if (!existing.stripeCustomerId.trim() && customerId) {
            await appendRecord(
              toSheetRow({
                identity: {
                  email: buyerEmail || existing.email,
                  company: company || existing.company,
                  stripeSessionId: session.id,
                  stripeCustomerId: customerId,
                  stub: false,
                },
                status: "paid",
                deliveryStatus: existing.deliveryStatus || "",
              }),
            );
          }
        } else {
          await appendRecord(
            toSheetRow({
              identity: {
                email: buyerEmail,
                company,
                stripeSessionId: session.id,
                stripeCustomerId: customerId,
                stub: false,
              },
              status: "paid",
              deliveryStatus: "",
            }),
          );
        }

        const metadataEntityId = session.metadata?.entity_id?.trim() ?? "";
        let linkedEntityId = metadataEntityId;
        try {
          const address = billingAddressFromCustomerDetails(session.customer_details);
          const linked = await ensureBuyerFirmForCheckout({
            email: buyerEmail,
            company: company || existing?.company || "",
            entityId: metadataEntityId,
            sessionId: session.id,
            street: address?.line1,
            zip: address?.postalCode,
            city: address?.city,
            ustId: ustIdFromCustomerDetails(session.customer_details),
          });
          if (linked) linkedEntityId = linked;
        } catch (error) {
          console.error(
            "[webhook] Firma für den Käufer nicht angelegt",
            error instanceof Error ? error.name : "error",
          );
        }

        const checkoutEntityId =
          matchingTestEntityId(metadataEntityId, linkedEntityId) ||
          linkedEntityId ||
          metadataEntityId;
        try {
          await notifyCheckoutPaid({
            livemode: session.livemode,
            paymentStatus: session.payment_status,
            entityId: checkoutEntityId,
            sessionId: session.id,
            company: company || existing?.company || "",
            email: buyerEmail,
            amountTotal: session.amount_total,
            currency: session.currency,
            created: session.created,
          });
        } catch (error) {
          console.error(
            "[webhook] Kaufhinweis nicht gesendet",
            error instanceof Error ? error.name : "error",
          );
        }
        const stripeContact = checkoutContactFromCustomerDetails(session.customer_details);
        if (!isTestEntity(checkoutEntityId)) {
          const mailed = await deliverBuyerOnboarding({
            email: buyerEmail,
            company: company || existing?.company || "",
            sessionId: session.id,
            checkoutNames: stripeContact.checkoutNames,
            extraCompanyNames: stripeContact.extraCompanyNames,
            entityId: checkoutEntityId,
            audience:
              session.metadata?.audience === "steuerberater" ? "steuerberater" : "kunde",
          });
          if (checkoutWelcomeHttpStatus(mailed) !== 200) {
            throw new Error(
              mailed === "inflight"
                ? "Onboarding-Mail noch nicht abgeschlossen"
                : "Onboarding-Mail nicht gesendet",
            );
          }
        } else {
          console.info("[webhook] Onboarding übersprungen — Testfirma");
        }
        if (planKind === "entry") {
          // v2-Einstieg: Plan statt Abo-Lifecycle (ein Jahresplan-Abo darf nicht in die 30-Tage-Logik).
          await recordPlanCheckout({
            session,
            kind: "entry",
            email: buyerEmail,
            customerId,
            eventId: event.id,
            at: eventTimeIso(event.created),
          });
          break;
        }
        await recordCheckoutSubscription({
          eventId: event.id,
          at: eventTimeIso(event.created),
          email: buyerEmail,
          customerId,
          subscriptionId: idFrom(session.subscription),
          entityId: checkoutEntityId,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        if (isAnnualPlanSubscription(event.data.object)) {
          await recordPlanSubscriptionEvent({
            subscription: event.data.object,
            eventId: event.id,
            at: eventTimeIso(event.created),
            deleted: event.type === "customer.subscription.deleted",
          });
        } else {
        await recordSubscriptionEvent({
          eventId: event.id,
          at: eventTimeIso(event.created),
          subscription: event.data.object,
          deleted: event.type === "customer.subscription.deleted",
        });
        }
        // Inhaber-Hinweis nur bei echter Änderung (previous_attributes), nicht bei Verlängerung.
        if (ownerNoticeFromStripeEvent(event)) {
          let subscriberEmail = "";
          try {
            subscriberEmail = await subscriptionEventEmail(event.data.object);
          } catch {
            subscriberEmail = "";
          }
          const notice = ownerNoticeFromStripeEvent(event, { email: subscriberEmail });
          if (notice) queueOwnerNotice(notice);
        }
        break;
      }
      // Preismodell v2: Verlängerung des Jahresplans. Alte Abos ignorieren dieses Ereignis.
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & {
          parent?: { subscription_details?: { subscription?: string | { id?: string } | null; metadata?: Record<string, string> | null } | null } | null;
        };
        const details = invoice.parent?.subscription_details;
        if (details?.metadata?.gobd_plan !== "member") break;
        const subscriptionId = idFrom(details.subscription);
        if (!subscriptionId) break;
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await recordPlanSubscriptionEvent({
          subscription,
          eventId: event.id,
          at: eventTimeIso(event.created),
          deleted: false,
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = stripeCustomerIdFrom(invoice.customer);
        let email = invoice.customer_email || "";
        if (!email && customerId) {
          email = await retrieveCustomerEmail(customerId);
        }
        await handleFailedPayment({
          email: email || undefined,
          invoiceId: invoice.id,
          eventId: event.id,
          customerId: customerId || undefined,
          reason: invoice.last_finalization_error?.message,
          entityId: invoiceEntityId(invoice as Parameters<typeof invoiceEntityId>[0]),
        });
        const failedNotice = ownerNoticeFromStripeEvent(event, {
          email,
          entityId: invoiceEntityId(invoice as Parameters<typeof invoiceEntityId>[0]),
        });
        if (failedNotice) queueOwnerNotice(failedNotice);
        break;
      }
      // Legacy: nur Inhaber-Hinweis, keine Zugangsänderung. In Stripe noch zu aktivieren.
      case "charge.refunded": {
        const charge = event.data.object;
        let email = charge.billing_details?.email || charge.receipt_email || "";
        const customerId = stripeCustomerIdFrom(charge.customer);
        if (!email && customerId) {
          try {
            email = await retrieveCustomerEmail(customerId);
          } catch {
            email = "";
          }
        }
        // Preismodell v2 (R5): Erstattung sperrt den Zugang und beendet den Jahresplan.
        // Ohne v2-Metadaten und ohne PLAN_ACCESS_ENABLED bleibt es beim Inhaber-Hinweis.
        if (planKindFromMetadata(charge.metadata) || planAccessEnabled()) {
          await recordPlanRefund({
            charge,
            email,
            eventId: event.id,
            at: eventTimeIso(event.created),
            cancelSubscription: async (subscriptionId) => {
              await getStripe().subscriptions.cancel(subscriptionId, {
                invoice_now: false,
                prorate: false,
              });
            },
          });
        }
        const notice = ownerNoticeFromStripeEvent(event, {
          email,
          entityId: charge.metadata?.entity_id ?? "",
        });
        if (notice) queueOwnerNotice(notice);
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object;
        let email = "";
        let entityId = "";
        try {
          const charge = await getStripe().charges.retrieve(idFrom(dispute.charge));
          email = charge.billing_details?.email || charge.receipt_email || "";
          entityId = charge.metadata?.entity_id ?? "";
          const customerId = stripeCustomerIdFrom(charge.customer);
          if (!email && customerId) email = await retrieveCustomerEmail(customerId);
        } catch {
          email = email || "";
        }
        const notice = ownerNoticeFromStripeEvent(event, { email, entityId });
        if (notice) queueOwnerNotice(notice);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[webhook] Verarbeitung fehlgeschlagen", error);
    await handleFailedJob({
      job: `stripe-webhook:${event.type}`,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Webhook-Verarbeitung fehlgeschlagen" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
