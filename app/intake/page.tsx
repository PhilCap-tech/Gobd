import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isStripeConfigured } from "@/lib/env";
import {
  resolveCheckoutSession,
  type CheckoutResolveError,
} from "@/lib/stripe";
import { IntakeForm } from "./intake-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intake",
  robots: { index: false, follow: false },
};

const GATE_COPY: Record<
  CheckoutResolveError,
  { title: string; body: string }
> = {
  missing: {
    title: "Zuerst Dokumentation starten",
    body: "Das Intake folgt nach dem Checkout. Ohne gültige Stripe-Session (bezahlt) geht es hier nicht weiter.",
  },
  not_paid: {
    title: "Zahlung noch nicht bestätigt",
    body: "Die Stripe-Session ist vorhanden, aber noch nicht als bezahlt oder abgeschlossen markiert. Wenn du gerade bezahlt hast, warte kurz und prüfe erneut — das hängt nicht vom Webhook ab.",
  },
  lookup_failed: {
    title: "Session konnte nicht geladen werden",
    body: "Die Checkout-Session konnte gerade nicht bei Stripe geprüft werden. Das ist oft vorübergehend. Bitte erneut versuchen.",
  },
};

function IntakeGate({
  error,
  sessionId,
}: {
  error: CheckoutResolveError;
  sessionId?: string;
}) {
  const copy = GATE_COPY[error];
  const retryHref =
    sessionId && error !== "missing"
      ? `/intake?session_id=${encodeURIComponent(sessionId)}`
      : null;

  return (
    <div className="card">
      <h1>{copy.title}</h1>
      <p className="prose">{copy.body}</p>
      <div className="actions" style={{ marginTop: 16 }}>
        {retryHref && (
          <a className="btn" href={retryHref}>
            Erneut versuchen
          </a>
        )}
        <Link className={retryHref ? "btn ghost" : "btn"} href="/checkout">
          Dokumentation starten
        </Link>
      </div>
    </div>
  );
}

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => item && item.trim()) || undefined;
  }
  return value;
}

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string | string[];
    email?: string | string[];
    company?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const sessionId = firstQueryValue(params.session_id);
  const email = firstQueryValue(params.email);
  const company = firstQueryValue(params.company);
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
          <IntakeGate error={session.error} sessionId={sessionId} />
        ) : (
          <IntakeForm session={session} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
