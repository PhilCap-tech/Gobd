import { NextResponse } from "next/server";
import {
  getStripeWebhookSecret,
  isProductionRuntime,
  isStripeSecretConfigured,
} from "@/lib/env";
import {
  handleFailedJob,
  handleFailedPayment,
  triggerOnboardingMail,
} from "@/lib/ops";
import { appendRecord, findRowByStripeSessionId } from "@/lib/store";
import {
  getStripe,
  listStripeCustomerIdByEmail,
  retrieveCustomerEmail,
  stripeCustomerIdFrom,
} from "@/lib/stripe";
import { toSheetRow } from "@/lib/types";

export const runtime = "nodejs";

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

        const existing = await findRowByStripeSessionId(session.id);
        if (existing) {
          console.info(
            "[webhook] checkout.session.completed bereits verarbeitet",
            session.id,
          );
          if (!existing.stripeCustomerId.trim() && customerId) {
            await appendRecord(
              toSheetRow({
                identity: {
                  email: email || existing.email,
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
          break;
        }

        await appendRecord(
          toSheetRow({
            identity: {
              email,
              company,
              stripeSessionId: session.id,
              stripeCustomerId: customerId,
              stub: false,
            },
            status: "paid",
            deliveryStatus: "",
          }),
        );

        await triggerOnboardingMail({
          email,
          company,
          sessionId: session.id,
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
          customerId: customerId || undefined,
          reason: invoice.last_finalization_error?.message,
        });
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
