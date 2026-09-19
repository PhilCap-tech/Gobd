import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ReadinessForm } from "./readiness-form";

export const metadata: Metadata = {
  title: "Readiness-Check",
  robots: { index: false, follow: false },
};

export default function ReadinessPage() {
  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zurück zur Landing" />
      <main className="wrap page">
        <h1>Readiness-Check (kostenlos)</h1>
        <p className="lead">Readiness-Check — kommt als Nächstes</p>
        <p className="prose">
          Kurzes Intake zu deinem Betrieb — ohne Zahlung und ohne Stripe.
          Hinterlasse Name und E-Mail, optional die Firma.
        </p>
        <ReadinessForm />
        <p className="hint back-links">
          <Link href="/">Zur Startseite</Link>
          {" · "}
          <Link href="/checkout">Direkt starten — 149 € + 49 €/Mo</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
