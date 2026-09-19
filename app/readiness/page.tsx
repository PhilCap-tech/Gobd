import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";
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
        <p className="lead">
          Kurze Fragen zu Branche und Belegen — du erhältst eine
          branchenbezogene GoBD-Kurzrichtlinie als PDF.
        </p>
        <p className="prose">
          Keine Zahlung, kein Stripe. Name und E-Mail reichen; die Firma ist
          optional.
        </p>
        <ReadinessForm />
        <p className="hint back-links">
          <Link href="/">Zur Startseite</Link>
          {" · "}
          <Link href="/checkout">
            Direkt starten — {SETUP_EUR} € + {MONTHLY_EUR} €/Mo
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
