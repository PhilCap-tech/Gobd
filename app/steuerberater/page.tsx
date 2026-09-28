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
  "Für Steuerberater: Produkt testen, dann an Mandanten weiterleiten | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Partner-Pilot: mit Parametern testen, Ergebnis prüfen, bei Überzeugung an Mandanten weiterleiten. Kein Ausfüllen fürs Unternehmen. Keine Steuerberatung.";

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
          Tester + Empfehler · Kein Ausfüllen für Mandanten · Keine
          Steuerberatung · Keine Konformitätsversprechen
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
          { href: "#rolle", label: "Rolle" },
          { href: "#pilot", label: "Pilot" },
          { href: "#faq", label: "FAQ" },
        ]}
      />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">
            Für Steuerberaterinnen &amp; Steuerberater · Partner-Pilot
          </p>
          <h1>
            Testen Sie die Verfahrensdokumentation selbst — bevor Sie sie
            weiterempfehlen
          </h1>
          <p className="lead">
            Sie sind nicht der Ausfüller fürs Unternehmen. Im Partner-Pilot
            prüfen Sie mit eigenen Test-Parametern, ob PDF und
            Offene-Punkte-Liste für Ihre Qualitätsansprüche taugen. Überzeugt
            das Ergebnis, leiten Sie den Weg an Mandanten weiter — die
            Betriebsdaten kommen vom Mandanten. Wir ersetzen keine
            Steuerberatung.
          </p>
          <PilotCta showSecondary />
        </section>

        <section className="block" id="rolle">
          <h2>So ist Ihre Rolle gedacht</h2>
          <ol className="prose-list">
            <li>
              <strong>Testen mit Parametern</strong> — Rechtsform, Branche,
              typische Software/Belegwege als Szenario. Sie sehen, was das
              Produkt aus einem Intake macht.
            </li>
            <li>
              <strong>Ergebnis prüfen</strong> — PDF-Struktur und
              Offene-Punkte-Liste: nachvollziehbar? Lücken sichtbar? Für Sie
              als Berater brauchbar?
            </li>
            <li>
              <strong>Weiterleiten an Mandanten</strong> — nur wenn es passt:
              Empfehlungslink / Pilot-Weg. Der Mandant liefert die echten
              Betriebsdaten.
            </li>
          </ol>
          <p className="prose">
            Nicht Ihre Aufgabe im Produkt: die Verfahrensdokumentation
            stellvertretend für den Mandanten ausfüllen oder „fertig beraten“
            liefern.
          </p>
        </section>

        <section className="block" id="fuer-wen">
          <h2>Tester und Empfehler — nicht Ausfüller</h2>
          <div className="stack">
            <article className="card">
              <h3>Sie testen</h3>
              <p className="prose">
                Parameter wählen, Durchlauf machen, Entwurf sehen — ohne ein
                Mandantenmandat im Intake so zu simulieren, als wäre es Ihre
                Dateneingabe für deren Betrieb.
              </p>
            </article>
            <article className="card">
              <h3>Ergebnis ok?</h3>
              <p className="prose">
                Sie bewerten Qualität und Brauchbarkeit. Kein
                „GoBD-konform“-Stempel von uns — Ihre fachliche Einschätzung
                zählt für die Empfehlung.
              </p>
            </article>
            <article className="card">
              <h3>An Mandanten weiterleiten</h3>
              <p className="prose">
                Empfehlungsweg erst nach Ihrem OK. Der Mandant füllt sein
                Intake; Sie bleiben Berater, nicht Datenerfasser.
              </p>
            </article>
          </div>
        </section>

        <section className="block" id="leistung">
          <h2>Was das Produkt leistet — und was nicht</h2>
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
                  <td>Sie testen mit Parametern / Szenarien</td>
                  <td>Sie füllen die Doku für den Mandanten aus</td>
                </tr>
                <tr>
                  <td>
                    Strukturiertes PDF + Offene-Punkte zum Qualitätscheck
                  </td>
                  <td>Steuer-, Rechts- oder Prüfungsberatung durch uns</td>
                </tr>
                <tr>
                  <td>Weiterleiten an Mandanten nach Ihrem OK</td>
                  <td>Blanko-Muster „fertig“ ohne Betriebsbezug</td>
                </tr>
                <tr>
                  <td>
                    Versionierung &amp; erneute Exporte (Pflege über Abo)
                  </td>
                  <td>„GoBD-konform per Klick“ / Prüfungsgarantie</td>
                </tr>
                <tr>
                  <td>Klare Produktgrenzen für Empfehlung</td>
                  <td>Ersatz für Ihre Freigabe oder Haftung</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="prose">
            Sie entscheiden, ob das Ergebnis empfehlenswert ist. Ausfüllen und
            Freigabe der betrieblichen Realität bleiben beim Mandanten bzw. bei
            Ihrer Beratung — nicht im Sinne von „Kanzlei tippt den
            Mandantenbetrieb ein“.
          </p>
        </section>

        <section className="block" id="versionierung">
          <h2>Warum Versionierung — und warum kein Einmal-PDF reicht</h2>
          <p className="prose">
            Ein einmal erzeugtes PDF veraltet, wenn Software, Belegwege oder
            Verantwortliche wechseln.
          </p>
          <p className="prose">
            <strong>Für Ihren Test relevant:</strong> Sie sehen, dass Fassungen
            und Historie zum Produkt gehören — nicht nur ein einmaliger Export.
          </p>
          <p className="prose">Für Mandanten nach Weiterleitung:</p>
          <ol className="prose-list">
            <li>
              <strong>Erste Fassung</strong> (Setup): Struktur, PDF + Offene
              Punkte.
            </li>
            <li>
              <strong>Pflege</strong> (Abo): Speicherung, Versionen, erneute
              Exporte.
            </li>
            <li>
              <strong>Änderung:</strong> Der Mandant aktualisiert; neue Fassung
              zur erneuten Abstimmung mit Ihnen.
            </li>
          </ol>
          <p className="prose">
            Weniger „final_final3.pdf“ im Postfach — ohne dass wir Ihre
            Beratung ersetzen.
          </p>
        </section>

        <section className="block" id="pilot">
          <h2>Pilot-Test in drei Schritten</h2>
          <ol className="prose-list">
            <li>
              <strong>Selbst testen</strong> — Partner-Pilot starten, Parameter
              und Rechtsform wählen (z. B. Freiberufler, GmbH, Handwerk). Das
              ist Ihr Testszenario, nicht die echten Bücher eines Mandanten.
            </li>
            <li>
              <strong>Ergebnis bewerten</strong> — Entwurf + Offene Punkte +
              Versionierung ansehen und fachlich einordnen.
            </li>
            <li>
              <strong>Weiterleiten / empfehlen</strong> — Wenn es passt:
              Empfehlungslink an Mandanten. Der Mandant arbeitet selbst weiter
              und trägt die Betriebsdaten im eigenen Intake ein.
            </li>
          </ol>
          <div className="value-note">
            <p className="prose">
              Der Pilot ist Ihr Test- und Empfehlungseinstieg. Reguläre Preise
              gelten beim Kauf durch den Mandanten — Details auf der{" "}
              <Link href="/#preise">Produktseite</Link>. Nicht als Hero auf
              dieser Seite.
            </p>
          </div>
        </section>

        <section className="block" id="empfehlung">
          <div className="value-note">
            <h2>Weiterleiten, wenn der Pilot überzeugt</h2>
            <p className="prose">
              Nach Ihrem OK erhalten Sie den Weg, Mandanten einzuladen.
              Cash-Affiliate kann später kommen — zuerst Qualität und
              Vertrauen. Keine Empfehlungspflicht.
            </p>
          </div>
        </section>

        <section className="block" id="grenzen">
          <h2>Was wir nicht sind</h2>
          <ul className="prose-list">
            <li>Keine Steuerberatung und keine Rechtsberatung.</li>
            <li>Kein Ersatz für Ihre fachliche Prüfung.</li>
            <li>Kein Modell „Kanzlei füllt für den Mandanten aus“.</li>
            <li>Keine leere „GoBD-Vorlage zum Abhaken“.</li>
            <li>
              Keine Claims „rechtssicher“ / „automatisch GoBD-konform“.
            </li>
            <li>
              Keine Fake-Siegel fremder Marken; eigenes Badge nur klar als
              unseres.
            </li>
          </ul>
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Muss ich für Mandanten ausfüllen?</h3>
            <p className="prose">
              Nein. Sie testen mit Parametern und empfehlen bei Bedarf weiter.
              Die betrieblichen Angaben macht der Mandant.
            </p>
          </div>
          <div className="faq-item">
            <h3>Muss ich Software lernen / Intake schulen?</h3>
            <p className="prose">
              Nein. Kurz testen, Ergebnis bewerten, bei Überzeugung
              weiterleiten.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ersetzt das meine Beratung?</h3>
            <p className="prose">
              Nein. Strukturierter Entwurf + sichtbare Lücken. Freigabe und
              Beratung bleiben bei Ihnen.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das DATEV / offiziell zertifiziert?</h3>
            <p className="prose">
              Nein. Eigenes Produkt der IKAT GmbH; optionales eigenes Siegel —
              keine Fremd-Zertifizierung.
            </p>
          </div>
          <div className="faq-item">
            <h3>Haften Sie für GoBD-Konformität?</h3>
            <p className="prose">
              Nein. Keine Konformitäts- oder Prüfungsgarantie.
            </p>
          </div>
          <div className="faq-item">
            <h3>Kostet der Pilot etwas?</h3>
            <p className="prose">
              Partner-Pilot ist kostenlos über die Partner-Promo{" "}
              <strong className="promo-code">{PROMO_CODE}</strong> (100 % für
              Setup + Abo, 2 Monate). Produktpreise gelten erst beim Kauf —
              Details auf der <Link href="/#preise">Produktseite</Link>.
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
            Allgemeine Partnerinformation von gobd-doku-erstellen.de (IKAT
            GmbH). Keine Steuer-, Rechts- oder Prüfungsberatung. Keine
            Zusicherung von GoBD-Konformität. Steuerberater im Pilot = Tester
            und ggf. Empfehler; nicht Ausfüller für Mandantenunternehmen.
            Fachliche Freigabe beim Mandanten bzw. bei beraterischer Leistung.
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
