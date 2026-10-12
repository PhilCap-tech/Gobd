import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CTA_CREATE_WITH_PRICE, CTA_MUSTER, READINESS_EFFORT_NOTE } from "@/lib/offer-copy";
import { ReadinessForm } from "./readiness-form";

export const metadata: Metadata = {
  title: "3-Minuten-Check",
  robots: { index: false, follow: false },
};

export default function ReadinessPage() {
  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zurück zur Landing" />
      <main className="wrap page">
        <p className="kicker">Kostenlos · kein Kaufzwang</p>
        <h1>Kostenloser 3-Minuten-Check</h1>
        <p className="lead">
          Sie sehen, welche Themen Ihre Dokumentation typischerweise abdecken
          sollte — und wo bei Ihnen noch Klärungsbedarf liegen kann. Kein
          Kaufzwang. Danach eine kurze Einschätzung zu relevanten Themenfeldern
          und ein Hinweis auf nächste Schritte: Muster ansehen oder
          Dokumentation erstellen.
        </p>
        <p className="prose">{READINESS_EFFORT_NOTE}</p>
        <ReadinessForm />
        <p className="hint back-links">
          <Link href="/#muster">{CTA_MUSTER}</Link>
          {" · "}
          <Link href="/checkout">{CTA_CREATE_WITH_PRICE}</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
