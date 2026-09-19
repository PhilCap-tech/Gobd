import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/env";
import {
  handleFailedJob,
  handleFailedPayment,
  triggerOnboardingMail,
} from "@/lib/ops";
import { appendRecord } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { toSheetRow } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe nicht konfiguriert", stub: true },
      { status: 503 },
    );
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook] STRIPE_WEBHOOK_SECRET fehlt");
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET fehlt" },
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
        const email =
          session.customer_details?.email || session.customer_email || "";
        const company = session.metadata?.company || "";
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || "";

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
        await handleFailedPayment({
          email: invoice.customer_email || undefined,
          invoiceId: invoice.id,
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
