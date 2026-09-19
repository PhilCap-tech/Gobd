import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isStripeConfigured } from "@/lib/env";
import { resolveCheckoutSession } from "@/lib/stripe";
import { IntakeForm } from "./intake-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intake",
  robots: { index: false, follow: false },
};

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    email?: string;
    company?: string;
  }>;
}) {
  const {
    session_id: sessionId,
    email,
    company,
  } = await searchParams;
  const session = sessionId
    ? await resolveCheckoutSession(sessionId)
    : isStripeConfigured()
      ? ({ error: "missing" } as const)
      : {
          email: email || "",
          company: company || "",
          stripeSessionId: "mock_direct",
          stripeCustomerId: "",
          stub: true,
        };

  if (!("error" in session) && session.stub) {
    session.email = email || session.email;
    session.company = company || session.company;
  }

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        {"error" in session ? (
          <div className="card">
            <h1>Zuerst Dokumentation starten</h1>
            <p className="prose">
              Das Intake folgt nach dem Checkout. Ohne gültige
              Stripe-Session (bezahlt) geht es hier nicht weiter.
            </p>
            <Link className="btn" href="/checkout">
              Dokumentation starten
            </Link>
          </div>
        ) : (
          <IntakeForm session={session} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
