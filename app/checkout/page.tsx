import type { Metadata } from "next";
import { ProductDisclaimer } from "@/components/product-disclaimer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isStripeConfigured } from "@/lib/env";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dokumentation starten",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zurück zur Landing" />
      <main className="wrap page">
        <h1>Dokumentation starten</h1>
        <p className="lead">
          149&nbsp;€ Setup plus 49&nbsp;€/Monat. Danach kurzes Intake.
        </p>
        <CheckoutForm stripeReady={isStripeConfigured()} />
        <ProductDisclaimer />
      </main>
      <SiteFooter />
    </>
  );
}
