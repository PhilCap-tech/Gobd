import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className="hero">
          <p className="kicker">Für KMU &amp; Handwerk</p>
          <h1>GoBD-Verfahrensdokumentation erstellen</h1>
          <p className="lead">
            Online und strukturiert — statt Tage in Beratung oder leerer
            Word-Vorlage. Kurzes Intake, dann PDF plus Liste offener Punkte.
          </p>
          <div className="actions">
            <Link className="btn" href="/checkout">
              Dokumentation starten
            </Link>
            <a className="btn ghost" href="#outcome">
              So funktioniert’s
            </a>
          </div>
          <div className="tags" aria-label="Themen">
            <span>Verfahrensdokumentation erstellen</span>
            <span>digitale Verfahrensdokumentation</span>
            <span>Vorlage / Muster als Benefit</span>
            <span>für KMU &amp; Handwerk</span>
          </div>
        </section>

        <section className="block" id="problem">
          <h2>Problem: Betriebsprüfung &amp; GoBD</h2>
          <p className="prose">
            Die GoBD verlangen eine nachvollziehbare Verfahrensdokumentation zu
            Belegen, Systemen und Verantwortlichkeiten. Viele Betriebe haben nur
            Fragmente — oder gar nichts Greifbares für die Prüfung.
          </p>
          <ul className="prose-list">
            <li>Unklare Belegwege und Systeme</li>
            <li>Keine einheitliche Beschreibung für den Prüfer</li>
            <li>Klassische Vorlagen bleiben oft unausgefüllt liegen</li>
          </ul>
        </section>

        <section className="block" id="outcome">
          <h2>Ergebnis: digitale Verfahrensdokumentation</h2>
          <p className="prose">
            Du beantwortest kurze Fragen zu Branche, Software, Belegwegen, IT
            und Verantwortlichen. Du erhältst eine strukturierte
            GoBD-Verfahrensdokumentation als PDF sowie eine Offene-Punkte-Liste
            — als Entwurf zur Abstimmung mit deinem Steuerberater.
          </p>
          <ul className="prose-list">
            <li>
              <strong>Verfahrensdokumentation erstellen</strong> — geführt statt
              Blanko-Dokument
            </li>
            <li>
              <strong>Digitale Verfahrensdokumentation</strong> — PDF zum Ablegen
            </li>
            <li>
              <strong>Vorlage / Muster</strong> — Nutzen der Struktur, kein
              Fake-Download
            </li>
            <li>
              <strong>Für KMU &amp; Handwerk</strong> — 1–20 MA, DATEV / sevdesk
              / lexoffice &amp; Co.
            </li>
          </ul>
        </section>

        <section className="block" id="preis">
          <h2>Preis</h2>
          <div className="price-card">
            <div>
              <div className="price">
                {SETUP_EUR}&nbsp;€ <small>Setup</small> + {MONTHLY_EUR}&nbsp;€{" "}
                <small>/ Monat</small>
              </div>
            </div>
            <Link className="btn" href="/checkout">
              Dokumentation starten
            </Link>
          </div>
          <p className="disclaimer" role="note">
            <strong>Disclaimer:</strong> Kein Steuerberatungsersatz. Die erzeugte
            Dokumentation ist ein Entwurf zur Abstimmung mit deinem
            Steuerberater — keine individuelle Steuer- oder Rechtsberatung.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
