import type { Metadata } from "next";
import Link from "next/link";
import { ProductDisclaimer } from "@/components/product-disclaimer";
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
        <p className="kicker">Kostenlos · 2–3 Minuten · ohne Stripe</p>
        <h1>GoBD-Readiness-Check</h1>
        <p className="lead">
          Kurze Fragen zu Branche, Größe und Belegweg. Danach erhältst du ein
          PDF „GoBD-Grundlagen“ für deine Branche — als Arbeitshilfe, nicht als
          fertige Verfahrensdokumentation.
        </p>
        <ReadinessForm />
        <p className="hint back-links">
          <Link href="/">Zur Startseite</Link>
          {" · "}
          <Link href="/checkout">Direkt die Dokumentation starten — 149 € + 49 €/Mo</Link>
        </p>
        <div style={{ marginTop: 28 }}>
          <ProductDisclaimer />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
