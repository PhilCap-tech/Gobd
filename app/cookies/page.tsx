import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookies",
  robots: { index: false, follow: false },
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie-Hinweis">
      <p className="prose">
        Diese Seite nutzt Cookies und ähnliche Techniken nur, soweit sie für
        Betrieb, Sicherheit und den Zahlungsabschluss nötig sind.
      </p>

      <h2>Technisch notwendige Cookies</h2>
      <p className="prose">
        Beim Aufruf kann das Hosting (Vercel) Sitzungs- und Sicherheitscookies
        setzen. Im Checkout kann Stripe Cookies setzen, um die Zahlung
        durchzuführen und Betrug zu verhindern. Ohne diese Techniken sind
        Checkout und geschützte Weiterleitungen nicht zuverlässig möglich.
        Rechtsgrundlage: §&nbsp;25 Abs.&nbsp;2 TDDDG, Art.&nbsp;6 Abs.&nbsp;1
        lit.&nbsp;b und lit.&nbsp;f DSGVO.
      </p>

      <h2>Keine Marketing-Cookies</h2>
      <p className="prose">
        Wir setzen derzeit keine eigenen Marketing- oder Tracking-Cookies
        (kein Google Analytics auf dieser Site). Der kostenlose
        Readiness-Check speichert lokal im Browser, bis du absendest; er lädt
        kein Stripe.
      </p>

      <h2>Verwaltung</h2>
      <p className="prose">
        Du kannst Cookies in deinem Browser löschen oder blockieren. Dann
        können Teile des Dienstes, insbesondere der Checkout, eingeschränkt
        sein. Fragen:{" "}
        <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>.
        Weitere Informationen: <a href="/datenschutz">Datenschutz</a>.
      </p>
    </LegalPage>
  );
}
