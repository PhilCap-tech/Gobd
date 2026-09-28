import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_OPERATOR } from "@/lib/legal";

const PILOT_HREF =
  "/checkout?utm_source=partner&utm_medium=landing&utm_campaign=steuerberater";

const PROMO_CODE = "KANZLEI-PILOT";
const PRIMARY_CTA = "Pilot selbst testen";

const PAGE_TITLE =
  "GoBD-Verfahrensdokumentation testen — Partner-Pilot für Steuerberater";
const PAGE_DESCRIPTION =
  "Als Steuerberater selbst testen: Entwurf mit Versionierung und Offenen Punkten bewerten — dann an Mandanten weiterempfehlen.";

export const metadata: Metadata = {
  metadataBase: new URL(LEGAL_OPERATOR.siteUrl),
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: true },
  alternates: { canonical: "/steuerberater" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/steuerberater",
    locale: "de_DE",
    type: "website",
  },
};

function PilotCta({ showSecondary = false }: { showSecondary?: boolean }) {
  return (
    <div className="cta-pair">
      <div className="cta-paid">
        <Link className="btn" href={PILOT_HREF}>
          {PRIMARY_CTA}
        </Link>
        <p className="trust-line">
          Keine Verpflichtung · Keine Steuerberatung · Mehrere Rechtsformen
        </p>
        <p className="hint">
          Promo-Code im Checkout:{" "}
          <strong className="promo-code">{PROMO_CODE}</strong>
          <br />
          100 % für Setup + Abo, 2 Monate (Partner-Pilot).
        </p>
      </div>
      {showSecondary ? (
        <div className="cta-soft">
          <a className="btn ghost" href="#pilot">
            So läuft der Test
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default function SteuerberaterPage() {
  return (
    <>
      <SiteHeader
        ctaHref={PILOT_HREF}
        ctaLabel={PRIMARY_CTA}
        links={[
          { href: "#fuer-wen", label: "Für wen" },
          { href: "#pilot", label: "Pilot" },
          { href: "#faq", label: "FAQ" },
        ]}
      />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Für Steuerberater &amp; Kanzleien</p>
          <h1>
            Testen Sie die Verfahrensdokumentation selbst — bevor Sie sie
            weiterempfehlen
          </h1>
          <p className="lead">
            Mit Ihren Parametern und verschiedenen Rechtsformen einen Entwurf
            erzeugen, prüfen und entscheiden, ob Sie ihn Mandanten empfehlen.
          </p>
          <PilotCta showSecondary />
        </section>

        <section className="block" id="fuer-wen">
          <h2>Für die Kanzlei, die erst prüft — dann empfiehlt</h2>
          <div className="stack">
            <article className="card">
              <h3>Selbst testen</h3>
              <p className="prose">
                Sie legen Parameter und Rechtsform fest und sehen, was der
                Entwurf liefert.
              </p>
            </article>
            <article className="card">
              <h3>Ergebnis bewerten</h3>
              <p className="prose">
                Prüfbarkeit, Versionierung, Offene Punkte — Sie entscheiden
                fachlich.
              </p>
            </article>
            <article className="card">
              <h3>Weiterempfehlen</h3>
              <p className="prose">
                Überzeugt der Pilot, leiten Sie Mandanten weiter
                (Empfehlungslink).
              </p>
            </article>
          </div>
          <p className="hint">
            Sie füllen <strong>nicht</strong> die Verfahrensdokumentation für
            Ihre Mandanten aus.
          </p>
        </section>

        <section className="block" id="trust">
          <h2>Was Sie im Pilot prüfen können</h2>
          <div className="stack">
            <article className="card">
              <h3>Prüfbarkeit</h3>
              <p className="prose">
                Strukturierter Entwurf statt leerer Vorlage.
              </p>
            </article>
            <article className="card">
              <h3>Versionierung &amp; Historie</h3>
              <p className="prose">Änderungen nachvollziehbar.</p>
            </article>
            <article className="card">
              <h3>Offene Punkte</h3>
              <p className="prose">
                Lücken sichtbar, bevor jemand empfiehlt.
              </p>
            </article>
            <article className="card">
              <h3>Weiterempfehlung</h3>
              <p className="prose">
                Klarer Weg vom eigenen Test zum Mandanten-Link.
              </p>
            </article>
          </div>
        </section>

        <section className="block" id="pilot">
          <h2>Pilot-Test in drei Schritten</h2>
          <ol className="prose-list">
            <li>
              <strong>Selbst testen</strong> — Partner-Pilot starten, Parameter
              und Rechtsform wählen (z. B. Freiberufler, GmbH, Handwerk).
            </li>
            <li>
              <strong>Ergebnis bewerten</strong> — Entwurf + Offene Punkte +
              Versionierung ansehen und fachlich einordnen.
            </li>
            <li>
              <strong>Weiterleiten / empfehlen</strong> — Wenn es passt:
              Empfehlungslink an Mandanten — der Mandant arbeitet selbst
              weiter.
            </li>
          </ol>
          <div className="value-note">
            <p className="prose">
              Der Pilot ist Ihr Test- und Empfehlungseinstieg. Reguläre Preise
              gelten erst beim Kauf durch den Mandanten bzw. nach dem Pilot —
              nicht als Hero auf dieser Seite.
            </p>
          </div>
        </section>

        <section className="block" id="empfehlung">
          <div className="value-note">
            <h2>Empfehlen, wenn Ihr Test überzeugt</h2>
            <p className="prose">
              Nach dem eigenen Pilot erhalten Sie einen Empfehlungslink für
              Mandanten. Cash-Affiliate kommt später — zuerst Qualität und
              Vertrauen.
            </p>
          </div>
        </section>

        <section className="block" id="grenzen">
          <h2>Was wir nicht sind</h2>
          <ul className="prose-list">
            <li>Keine Steuerberatung und keine Rechtsberatung.</li>
            <li>Kein Ersatz für Ihre fachliche Prüfung.</li>
            <li>Kein „Sie füllen für den Mandanten aus“.</li>
            <li>Keine leere GoBD-Vorlage zum Abhaken.</li>
            <li>
              Keine Claims „rechtssicher“ / „automatisch GoBD-konform“.
            </li>
            <li>Kein Fake-DATEV/KPMG.</li>
          </ul>
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Muss ich für Mandanten ausfüllen?</h3>
            <p className="prose">
              Nein. Sie testen selbst, bewerten das Ergebnis und empfehlen bei
              Bedarf weiter. Der Mandant nutzt den Link selbst.
            </p>
          </div>
          <div className="faq-item">
            <h3>Kostet der Pilot etwas?</h3>
            <p className="prose">
              Partner-Pilot ist kostenlos über die Partner-Promo{" "}
              <strong className="promo-code">{PROMO_CODE}</strong> (100 % für
              Setup + Abo, 2 Monate). Produktpreise gelten erst beim Kauf.
            </p>
          </div>
          <div className="faq-item">
            <h3>Welche Rechtsformen?</h3>
            <p className="prose">
              Im Pilot gezielt mehrere testen (z. B. Freiberufler, GmbH,
              Handwerk).
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das DATEV / zertifiziert?</h3>
            <p className="prose">
              Nein. IKAT GmbH; optionales eigenes Partner-Siegel — keine
              Fremd-Zertifizierung.
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>Selbst testen — dann entscheiden, ob Sie weiterempfehlen</h2>
          <PilotCta />
          <p className="hint back-links">
            <Link href="/faq">FAQ</Link>
            {" · "}
            <Link href="/datenschutz">Datenschutz</Link>
            {" · "}
            <Link href="/impressum">Impressum</Link>
          </p>
          <p className="disclaimer">
            Dies ist keine Steuer- oder Rechtsberatung. Der Pilot dient der
            eigenen Bewertung durch die Kanzlei; eine Weiterempfehlung ersetzt
            keine fachliche Prüfung.
          </p>
        </section>
      </main>
      <div className="sticky-cta">
        <Link className="btn" href={PILOT_HREF}>
          {PRIMARY_CTA}
        </Link>
        <p className="trust-line">
          Promo-Code im Checkout:{" "}
          <strong className="promo-code">{PROMO_CODE}</strong>
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
