import Link from "next/link";
import { ProductDisclaimer } from "@/components/product-disclaimer";
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
            Online und geführt — statt leerer Word-Vorlage oder teurer
            Beratungstage. Kurzes Intake, dann PDF plus Liste offener Punkte.
            Zur Abstimmung mit deinem Steuerberater.
          </p>
          <div className="actions">
            <Link className="btn" href="/readiness">
              Readiness-Check starten (kostenlos)
            </Link>
            <a className="btn ghost" href="#so-funktionierts">
              So funktioniert’s
            </a>
          </div>
          <p className="hint">
            Ca. 2–3 Minuten · Keine Kreditkarte · Keine Steuerberatung
          </p>
          <p className="disclaimer" role="note">
            Keine Steuerberatung. Das Ergebnis ist ein Entwurf zur Abstimmung
            mit deinem Steuerberater.
          </p>
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

        <section className="block" id="nutzen">
          <h2>Was du bekommst</h2>
          <ul className="prose-list">
            <li>
              In unter einer Stunde von „nichts Greifbares“ zu einer
              strukturierten Verfahrensdokumentation als PDF
            </li>
            <li>
              Prüfbare Struktur zu Belegen, Systemen und Verantwortlichkeiten —
              statt Fragmente in Ordnern
            </li>
            <li>
              Offene-Punkte-Liste: du siehst, was noch fehlt, bevor der Prüfer
              fragt
            </li>
            <li>
              Geführt für KMU, Handwerk und Freiberufler (DATEV, sevdesk,
              lexoffice &amp; Co.)
            </li>
            <li>
              Entwurf zur Abstimmung mit dem Steuerberater — kein Ersatz für
              Beratung
            </li>
          </ul>
        </section>

        <section className="block" id="so-funktionierts">
          <h2>So funktioniert’s</h2>
          <ol className="prose-list">
            <li>
              <strong>Readiness-Check</strong> — Kurze Fragen zu Branche,
              Software, Belegwegen, IT und Verantwortlichen.
            </li>
            <li>
              <strong>Dokumentation erzeugen</strong> — Du erhältst eine
              strukturierte GoBD-Verfahrensdokumentation als PDF plus eine
              Offene-Punkte-Liste.
            </li>
            <li>
              <strong>Mit dem Steuerberater abstimmen</strong> — Entwurf prüfen,
              Lücken schließen, ablegen.
            </li>
          </ol>
        </section>

        <section className="block" id="preise">
          <h2>Was es kostet</h2>
          <div className="price-grid">
            <div className="price-card stacked">
              <p className="step-label">Setup</p>
              <div className="price">
                {SETUP_EUR}&nbsp;€ <small>einmalig</small>
              </div>
              <p className="prose">
                Einrichtung, erstes PDF und Offene-Punkte-Liste.
              </p>
            </div>
            <div className="price-card stacked">
              <p className="step-label">Abo</p>
              <div className="price">
                {MONTHLY_EUR}&nbsp;€ <small>/ Monat</small>
              </div>
              <p className="prose">
                Updates bei System- oder Prozessänderungen und erneute Exporte.
              </p>
            </div>
          </div>
          <p className="prose framing">
            Weniger als ein Beratungstag — und du hast ein Dokument, das du
            aktualisieren kannst.
          </p>
          <div className="actions">
            <Link className="btn" href="/readiness">
              Readiness-Check starten (kostenlos)
            </Link>
            <Link className="btn ghost" href="/checkout">
              Direkt starten — 149 € + 49 €/Mo
            </Link>
          </div>
          <p className="hint">
            Keine Steuerberatung · Entwurf zur Abstimmung mit deinem
            Steuerberater
          </p>
          <p className="trust-line">14 Tage Geld-zurück-Garantie</p>
          <p className="disclaimer" role="note">
            Keine Steuerberatung. Das Ergebnis ist ein Entwurf zur Abstimmung
            mit deinem Steuerberater.
          </p>
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Muss das der Steuerberater machen?</h3>
            <p className="prose">
              Nicht zwingend. Viele Betriebe liefern dem Berater bisher nur
              Fragmente. Hier bekommst du einen strukturierten Entwurf — der
              Berater prüft und ergänzt, statt bei Null anzufangen.
            </p>
          </div>
          <div className="faq-item">
            <h3>Brauch ich eine Verfahrensdokumentation überhaupt?</h3>
            <p className="prose">
              Die GoBD erwarten eine nachvollziehbare Verfahrensdokumentation.
              Bei einer Betriebsprüfung wird oft genau danach gefragt. Wer nur
              Vorlagen oder gar nichts hat, steht schlechter da.
            </p>
          </div>
          <div className="faq-item">
            <h3>Haftet ihr — ist das rechtssicher / GoBD-konform?</h3>
            <p className="prose">
              Nein. Wir leisten keine Steuer- oder Rechtsberatung. Das PDF ist
              ein geführter Entwurf zur Abstimmung mit deinem Steuerberater. Die
              Verantwortung für GoBD-Konformität liegt bei dir bzw. bei der
              beratenen Freigabe.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das nur eine Vorlage zum Download?</h3>
            <p className="prose">
              Nein. Du beantwortest kurze Fragen zu deinem Betrieb und erhältst
              ein individuelles PDF plus eine Offene-Punkte-Liste — keine
              Blanko-Datei.
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>Bereit für eine prüfbare Verfahrensdokumentation?</h2>
          <div className="actions">
            <Link className="btn" href="/readiness">
              Readiness-Check starten (kostenlos)
            </Link>
            <a className="btn ghost" href="#preise">
              Preise ansehen
            </a>
          </div>
          <p className="hint">
            Kurzes Intake · PDF + Offene Punkte · Keine Steuerberatung
          </p>
        </section>

        <section className="block" id="disclaimer">
          <ProductDisclaimer />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
