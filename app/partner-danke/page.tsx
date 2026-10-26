import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Dankeseite für Digistore24-Käufe (Produkte 751404/751419).
// Nicht verlinkt, nicht in Navigation/Sitemap; erst als DS24-Dankeseite eintragen,
// wenn die DS24-IPN (A1) live ist. Keine Links auf /checkout oder Stripe.
export const metadata: Metadata = {
  title: "Vielen Dank für Ihre Bestellung",
  robots: { index: false, follow: false },
};

export default function PartnerDankePage() {
  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Startseite" />
      <main className="wrap page legal">
        <h1>Vielen Dank für Ihre Bestellung.</h1>
        <p>Die Abbuchung erfolgt durch Digistore24.</p>

        <h2>So erhalten Sie Zugang</h2>
        <p>
          Sie bekommen nichts per Post. GoBD-Doku ist ein Online-Dienst: Sie erstellen Ihre
          Verfahrensdokumentation im Browser und laden sie als PDF herunter.
        </p>
        <ol>
          <li>Digistore24 sendet Ihnen eine Bestellbestätigung mit Rechnung und Bestell-ID.</li>
          <li>
            In wenigen Minuten erhalten Sie von info@gobd-doku-erstellen.de eine E-Mail mit Ihrem
            persönlichen Anmeldelink. Ihr Zugang gilt für die E-Mail-Adresse aus dem Bestellformular.
          </li>
          <li>
            Sie können sich jederzeit auch unter{" "}
            <Link href="/login">gobd-doku-erstellen.de/login</Link> mit derselben E-Mail-Adresse
            anmelden. Sie erhalten dann einen Anmeldelink, ein Passwort brauchen Sie nicht.
          </li>
          <li>
            Nach der Anmeldung legen Sie Ihre Firma an, beantworten die Fragen der 24 Module und
            erzeugen Ihr PDF. Die laufende Aktualisierung (49 € pro Monat zzgl. USt, ab dem zweiten
            Monat) hält Ihre Dokumentation aktuell. Sie können sie monatlich über Digistore24
            kündigen.
          </li>
        </ol>

        <h2>Keine E-Mail erhalten?</h2>
        <p>
          Prüfen Sie Ihren Spam-Ordner oder schreiben Sie an{" "}
          <a href="mailto:info@gobd-doku-erstellen.de">info@gobd-doku-erstellen.de</a> und nennen
          Sie Ihre Bestell-ID.
        </p>

        <h2 id="rueckgabe">Rückgabe</h2>
        <p>
          14 Tage Rückgaberecht über Digistore24: Innerhalb von 14 Tagen nach dem Kauf können Sie
          Ihre Bestellung über Digistore24 zurückgeben (Link zur Soforthilfe in Ihrer
          Bestellbestätigung) und erhalten den vollen Kaufpreis zurück. Bei Käufen über
          Digistore24 Inc. (USA) bzw. Digistore24 LTD (UK) gilt die im Bestellformular angezeigte
          Frist von 60 Tagen.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
