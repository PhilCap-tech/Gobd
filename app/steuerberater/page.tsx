import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_OPERATOR } from "@/lib/legal";

const PILOT_HREF =
  "/checkout?utm_source=partner&utm_medium=landing&utm_campaign=steuerberater";

const PAGE_TITLE =
  "Verfahrensdokumentation für Mandanten — Partner-Pilot für Steuerberater";
const PAGE_DESCRIPTION =
  "Prüfbare GoBD-Verfahrensdokumentation mit Versionierung. Kostenloser Pilot für Kanzleien — ohne Softwareschulung, ohne Fake-Siegel.";

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
          Kostenlosen Pilot starten
        </Link>
        <p className="trust-line">
          Keine Verpflichtung · Keine Steuerberatung · Pilot für mehrere
          Rechtsformen
        </p>
        <p className="hint">Promo-Code im Checkout eingeben</p>
      </div>
      {showSecondary ? (
        <div className="cta-soft">
          <a className="btn ghost" href="#pilot">
            So funktioniert der Pilot
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
        ctaLabel="Kostenlosen Pilot starten"
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
            Wenn der Prüfer nach der Verfahrensdokumentation fragt — helfen Sie
            dem Mandanten mit einem prüfbaren Entwurf
          </h1>
          <p className="lead">
            Keine leere Vorlage. PDF-Entwurf plus Offene-Punkte zur Abstimmung
            mit der Kanzlei — mit Versionierung und Historie.
          </p>
          <PilotCta showSecondary />
        </section>

        <section className="block" id="fuer-wen">
          <h2>Gebaut für die Kanzlei — nicht für Panik-Marketing</h2>
          <div className="stack">
            <article className="card">
              <h3>Steuerberater / Kanzlei</h3>
              <p className="prose">
                Mandant braucht eine Verfahrensdokumentation, Sie wollen einen
                nachvollziehbaren Entwurf statt einer leeren Word-Datei.
              </p>
            </article>
            <article className="card">
              <h3>Mandanten-Empfehlung</h3>
              <p className="prose">
                Sie empfehlen den Pilot weiter; der Mandant füllt den Intake,
                Sie sehen den Entwurf zur Abstimmung.
              </p>
            </article>
            <article className="card">
              <h3>Mehrere Rechtsformen testen</h3>
              <p className="prose">
                Freiberufler, GmbH, Handwerk: ein Pilot-Flow, klar abgegrenzt.
              </p>
            </article>
          </div>
        </section>

        <section className="block" id="leistung">
          <h2>Was unser Produkt für Ihre Mandanten leistet</h2>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Ja</th>
                  <th scope="col">Nein</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Geführtes Intake (Branche, Software, Belegwege, IT,
                    Verantwortliche)
                  </td>
                  <td>Steuer-, Rechts- oder Prüfungsberatung</td>
                </tr>
                <tr>
                  <td>Individuelles PDF + Offene-Punkte-Liste</td>
                  <td>Blanko-„Muster fertig“ ohne Betriebsbezug</td>
                </tr>
                <tr>
                  <td>Versionen &amp; erneute Exporte über das Abo (Pflege)</td>
                  <td>„GoBD-konform per Klick“ / Prüfungsgarantie</td>
                </tr>
                <tr>
                  <td>Entwurf zur Abstimmung mit Ihnen</td>
                  <td>Ersatz für Ihre Freigabe oder Haftung</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="prose">
            Der Mandant liefert Struktur und Transparenz über Lücken. Die
            fachliche Bewertung bleibt bei Ihnen.
          </p>
        </section>

        <section className="block" id="trust">
          <h2>Worauf es in der Prüfung ankommt</h2>
          <div className="stack">
            <article className="card">
              <h3>Prüfbarkeit</h3>
              <p className="prose">
                Strukturierte Verfahrensdokumentation als Entwurf, den Sie mit
                dem Mandanten abstimmen können.
              </p>
            </article>
            <article className="card">
              <h3>Versionierung &amp; Historie</h3>
              <p className="prose">
                Änderungen nachvollziehbar; kein „welche Datei war die letzte?“
              </p>
            </article>
            <article className="card">
              <h3>Offene Punkte</h3>
              <p className="prose">
                Lücken sichtbar, damit Kanzlei und Mandant gezielt nachziehen.
              </p>
            </article>
            <article className="card">
              <h3>Empfehlungsweg</h3>
              <p className="prose">
                Klarer Pilot für Ihre Mandanten — ohne dass Sie Software
                schulen müssen.
              </p>
            </article>
          </div>
        </section>

        <section className="block" id="versionierung">
          <h2>Warum Versionierung — und warum kein Einmal-PDF reicht</h2>
          <p className="prose">
            Ein einmal erzeugtes PDF veraltet, sobald Software, Belegwege oder
            Verantwortliche wechseln. Betriebsprüfung und GoBD sind kein
            Einmal-Event.
          </p>
          <p className="prose">So denken wir Pflege:</p>
          <ol className="prose-list">
            <li>
              <strong>Erste Fassung</strong> — Setup: geführte Struktur, PDF +
              Offene Punkte.
            </li>
            <li>
              <strong>Fassungen halten</strong> — Abo: Speicherung, Versionen,
              erneute Exporte.
            </li>
            <li>
              <strong>Änderung sichtbar</strong> — der Mandant aktualisiert das
              Intake; Sie sehen, was sich geändert hat, und erhalten die neue
              Fassung zur erneuten Abstimmung.
            </li>
          </ol>
          <p className="prose">
            Für die Kanzlei heißt das: weniger „final_final3.pdf“ im
            E-Mail-Verlauf, klarere Ausgangslage für die fachliche Prüfung —
            ohne dass wir Ihre Beratung ersetzen.
          </p>
        </section>

        <section className="block" id="pilot">
          <h2>Kostenloser Pilot — in wenigen Schritten</h2>
          <ol className="prose-list">
            <li>Sie starten den Partner-Pilot (Promo-Flow).</li>
            <li>Sie wählen einen Test-Mandanten / eine Rechtsform.</li>
            <li>Intake ausfüllen → Entwurf + Offene-Punkte.</li>
            <li>Sie prüfen, kommentieren, entscheiden über Empfehlung.</li>
          </ol>
          <div className="value-note">
            <p className="prose">
              Der Pilot ist unser Partner-Einstieg. Reguläre Preise (Setup +
              Monatsgebühr) gelten erst nach dem Pilot — nicht der Einstieg auf
              dieser Seite.
            </p>
            <p className="hint">
              Die Beträge stehen auf der{" "}
              <Link href="/#preise">Produktseite</Link>.
            </p>
          </div>
        </section>

        <section className="block" id="empfehlung">
          <div className="value-note">
            <h2>Empfehlen, wenn der Pilot überzeugt</h2>
            <p className="prose">
              Nach dem Pilot erhalten Sie einen Empfehlungslink für Mandanten.
              Cash-Affiliate kommt später — zuerst Qualität und Vertrauen.
            </p>
          </div>
        </section>

        <section className="block" id="grenzen">
          <h2>Was wir nicht sind</h2>
          <ul className="prose-list">
            <li>Keine Steuerberatung und keine Rechtsberatung.</li>
            <li>Kein Ersatz für Ihre fachliche Prüfung.</li>
            <li>Keine leere „GoBD-Vorlage zum Abhaken“.</li>
            <li>
              Keine Behauptung „rechtssicher“ oder „automatisch GoBD-konform“.
            </li>
          </ul>
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Kostet der Pilot etwas?</h3>
            <p className="prose">
              Nein — Partner-Pilot ist kostenlos. Danach gelten die
              Produktpreise nur bei Kauf.
            </p>
          </div>
          <div className="faq-item">
            <h3>Muss ich Software lernen?</h3>
            <p className="prose">
              Nein. Sie steuern Abstimmung und Empfehlung; der Mandant liefert
              die Betriebsdaten im Intake.
            </p>
          </div>
          <div className="faq-item">
            <h3>Für welche Mandanten?</h3>
            <p className="prose">
              Pilot gezielt mit mehreren Rechtsformen testen (z. B.
              Freiberufler, GmbH, Handwerk).
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das DATEV / offiziell zertifiziert?</h3>
            <p className="prose">
              Nein. Eigenes Produkt der IKAT GmbH; optionales eigenes
              Partner-Siegel — keine Fremd-Zertifizierung.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ersetzt das meine Beratung?</h3>
            <p className="prose">
              Nein. Es liefert einen strukturierten Entwurf und macht Lücken
              sichtbar. Freigabe und Beratung bleiben bei Ihnen.
            </p>
          </div>
          <div className="faq-item">
            <h3>Haften Sie für GoBD-Konformität?</h3>
            <p className="prose">
              Nein. Keine Steuer- oder Rechtsberatung, keine Konformitäts- oder
              Prüfungsgarantie.
            </p>
          </div>
          <div className="faq-item">
            <h3>Müssen Mandanten das Abo nehmen?</h3>
            <p className="prose">
              Die erste Fassung entsteht mit dem Setup. Pflege und weitere
              Versionen hängen am Abo — sinnvoll, wenn sich Systeme ändern.
              Die regulären Preise stehen auf der{" "}
              <Link href="/#preise">Produktseite</Link>.
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>Pilot starten — prüfen Sie den Entwurf selbst</h2>
          <PilotCta />
          <p className="hint back-links">
            <Link href="/faq">FAQ</Link>
            {" · "}
            <Link href="/datenschutz">Datenschutz</Link>
            {" · "}
            <Link href="/impressum">Impressum</Link>
          </p>
          <p className="disclaimer">
            Dies ist keine Steuer- oder Rechtsberatung. Die
            Verfahrensdokumentation ist ein Arbeitsentwurf zur Abstimmung mit
            Ihrer Kanzlei. Allgemeine Produkt- und Partnerinformation von
            gobd-doku-erstellen.de (IKAT GmbH): keine Steuer-, Rechts- oder
            Prüfungsberatung und keine Zusicherung von GoBD-Konformität oder
            Prüfungsergebnis. Fachliche Bewertung und Freigabe liegen beim
            Mandanten bzw. bei der steuerberatenden Freigabe.
          </p>
        </section>
      </main>
      <div className="sticky-cta">
        <Link className="btn" href={PILOT_HREF}>
          Kostenlosen Pilot starten
        </Link>
        <p className="trust-line">Promo-Code im Checkout eingeben</p>
      </div>
      <SiteFooter />
    </>
  );
}
