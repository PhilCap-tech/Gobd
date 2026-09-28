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
  "Für Steuerberater: Verfahrensdokumentation testen, Prozess & Versionierung | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Partner-Pilot: Produkt mit Parametern testen, Prozess und Versionierung prüfen, bei Überzeugung an Mandanten weiterleiten. Pflicht-Entlastung. Keine Steuerberatung.";

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

function PromoHint() {
  return (
    <>
      <p className="trust-line">
        Partner-Promo <strong className="promo-code">{PROMO_CODE}</strong>
        {" · "}Keine Steuerberatung · Sie füllen nicht für Mandanten aus
      </p>
      <p className="hint">100 % für Setup + Abo, 2 Monate (Partner-Pilot).</p>
    </>
  );
}

function PilotCta({ showSecondary = false }: { showSecondary?: boolean }) {
  return (
    <div className="cta-pair">
      <div className="cta-paid">
        <Link className="btn" href={PILOT_HREF}>
          {PRIMARY_CTA}
        </Link>
        <PromoHint />
      </div>
      {showSecondary ? (
        <div className="cta-soft">
          <a className="btn ghost" href="#pilot">
            So funktioniert’s
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
          { href: "#saeulen", label: "Säulen" },
          { href: "#pilot", label: "Pilot" },
          { href: "#faq", label: "FAQ" },
        ]}
      />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Für Steuerberater &amp; Kanzleien</p>
          <h1>
            Die Verfahrensdokumentation ist Pflicht — Ihre Mandanten schieben
            sie auf, weil sie zu aufwendig wirkt
          </h1>
          <p className="lead">
            Sie weisen darauf hin. Wir liefern das Tool, mit dem Mandanten der
            gesetzlichen GoBD-Verfahrensdokumentations-Pflicht schnell,
            unkompliziert und nachhaltig nachkommen — mit Versionierung statt
            Dateichaos.
          </p>
          <PilotCta showSecondary />
        </section>

        <section className="block" id="problem">
          <h2>Warum die Pflicht oft liegen bleibt</h2>
          <p className="prose">
            <strong>Problem:</strong> GoBD-Verfahrensdokumentation betrifft
            Ihre Mandanten. Sie sprechen es an — Umsetzung scheitert am
            Aufwand: leere Vorlagen, unklare Struktur, keine Historie.
          </p>
          <p className="prose">
            <strong>Lösung:</strong> Ein geführter Prozess: Mandant liefert die
            Betriebsdaten, heraus kommt ein strukturierter Entwurf plus Offene
            Punkte — versioniert und bei Bedarf aktualisierbar.
          </p>
        </section>

        <section className="block" id="positionierung">
          <h2>Das Tool für die Pflicht — nicht die Steuerberatung</h2>
          <p className="prose">
            Wir sind kein DATEV-Ersatz und keine Kanzlei-Software. Wir sind das
            Werkzeug, mit dem Mandanten ihre Verfahrensdokumentation anlegen
            und pflegen können — damit der Hinweis aus der Kanzlei nicht in
            einer leeren Word-Datei endet.
          </p>
          <p className="prose">
            Ihre Rolle: Tester und Empfehler — nicht Ausfüller fürs
            Unternehmen.
          </p>
          <p className="hint">
            Sie füllen die Dokumentation <strong>nicht</strong> für Ihre
            Mandanten aus.
          </p>
        </section>

        <section className="block" id="saeulen">
          <h2>Worauf es ankommt</h2>
          <div className="stack">
            <article className="card">
              <h3>Pflicht-Entlastung</h3>
              <p className="prose">
                Mandanten brauchen eine nachvollziehbare
                Verfahrensdokumentation. Sie entlasten Kanzlei und Mandant,
                wenn Struktur und Aktualisierung nicht als manuelle
                Dauerbaustelle bei Ihnen liegen — ohne dass Sie für den
                Mandanten ausfüllen.
              </p>
            </article>
            <article className="card">
              <h3>Prozess</h3>
              <p className="prose">
                Kurzer, geführter Ablauf: Intake → strukturiertes PDF →
                Offene-Punkte-Liste. Sie prüfen den Ablauf im Pilot; der
                Mandant nutzt ihn mit echten Daten nach Ihrer Weiterleitung.
              </p>
            </article>
            <article className="card">
              <h3>Versionierung</h3>
              <p className="prose">
                Fassungen, Historie, erneute Exporte. Weil Software und
                Belegwege sich ändern — und ein einzelnes PDF das nicht
                abbildet.
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
                  <td>
                    Pflicht-Entlastung über klaren Prozess + Versionierung
                  </td>
                  <td>
                    Prüfungs-Fear / „sonst kommt der Prüfer“-Verkauf; Sie
                    füllen für den Mandanten aus
                  </td>
                </tr>
                <tr>
                  <td>Sie testen mit Parametern, dann ggf. weiterleiten</td>
                  <td>Sie füllen für den Mandanten aus</td>
                </tr>
                <tr>
                  <td>PDF + Offene Punkte als strukturierter Entwurf</td>
                  <td>Steuer-/Rechts-/Prüfungsberatung durch uns</td>
                </tr>
                <tr>
                  <td>Versionen &amp; erneute Exporte (Pflege/Abo)</td>
                  <td>„GoBD-konform per Klick“ / Prüfungsgarantie</td>
                </tr>
                <tr>
                  <td>Klare Grenzen für Empfehlung</td>
                  <td>Ersatz für Ihre Freigabe oder Haftung</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="prose">
            Entlastung durch Prozess und Pflege — nicht durch Angst vor der
            Prüfung.
          </p>
        </section>

        <section className="block" id="versionierung">
          <h2>Versionierung: der eigentliche Entlastungshebel</h2>
          <p className="prose">
            Ein einmal erzeugtes PDF ist schnell veraltet, sobald Systeme oder
            Zuständigkeiten wechseln. Die Pflicht bleibt — der Stand nicht.
          </p>
          <p className="prose">Prozess der Pflege:</p>
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
              <strong>Änderung nachziehen</strong> — Mandant aktualisiert; neue
              Fassung zur Abstimmung mit Ihnen.
            </li>
          </ol>
          <p className="prose">
            Für die Kanzlei: weniger Dateichaos, klarere Ausgangslage für Ihre
            fachliche Arbeit — ohne Beratungsersatz und ohne Fear-Story.
          </p>
          <p className="hint">
            Reguläre Preise (Setup + Monat) stehen auf der{" "}
            <Link href="/#preise">Produktseite</Link>. Der Pilot zum Testen
            bleibt der Einstieg hier.
          </p>
        </section>

        <section className="block" id="pilot">
          <h2>So arbeiten Sie mit dem Partner-Pilot</h2>
          <ol className="prose-list">
            <li>
              <strong>Selbst testen</strong> — Parameter und Rechtsformen
              durchspielen (z. B. Freiberufler, GmbH, Handwerk).
            </li>
            <li>
              <strong>Ergebnis bewerten</strong> — Entwurf, Offene Punkte,
              Versionierung fachlich einordnen.
            </li>
            <li>
              <strong>Weiterempfehlen</strong> — Überzeugt der Test:
              Empfehlungslink an Mandanten — der Mandant arbeitet selbst
              weiter.
            </li>
          </ol>
          <p className="hint">
            Nicht: die Verfahrensdokumentation stellvertretend für den
            Mandanten ausfüllen.
          </p>
          <PilotCta />
        </section>

        <section className="block" id="empfehlung">
          <div className="value-note">
            <h2>Weiterleiten, wenn Prozess und Versionierung überzeugen</h2>
            <p className="prose">
              Nach Ihrem OK: Empfehlungsweg für Mandanten. Affiliate/Cash kann
              später kommen — zuerst Qualität. Sie bleiben Berater und
              Qualitätsfilter, nicht Ausfüllhilfe.
            </p>
          </div>
        </section>

        <section className="block" id="grenzen">
          <h2>Was wir nicht sind</h2>
          <ul className="prose-list">
            <li>Keine Steuer- oder Rechtsberatung.</li>
            <li>Kein Ersatz für Ihre fachliche Freigabe.</li>
            <li>Kein Modell „Kanzlei füllt für den Mandanten aus“.</li>
            <li>Kein Fear-Marketing über Betriebsprüfung.</li>
            <li>Keine leere Vorlage „fertig abhaken“.</li>
            <li>
              Keine Claims „rechtssicher“ / „automatisch GoBD-konform“.
            </li>
            <li>Keine Fake-Siegel fremder Marken.</li>
          </ul>
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Warum „Pflicht-Entlastung“?</h3>
            <p className="prose">
              Weil die Verfahrensdokumentation eine wiederkehrende Anforderung
              an Mandanten ist. Entlastung heißt: klarer Prozess und
              Versionierung statt Dauer-Flickwerk — nicht Angstverkauf.
            </p>
          </div>
          <div className="faq-item">
            <h3>Muss ich für Mandanten ausfüllen?</h3>
            <p className="prose">
              Nein. Testen, bewerten, bei OK weiterleiten. Betriebsdaten:
              Mandant.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ersetzt das meine Beratung?</h3>
            <p className="prose">Nein.</p>
          </div>
          <div className="faq-item">
            <h3>Ist das DATEV / behördlich zertifiziert?</h3>
            <p className="prose">
              Nein. Eigenes Produkt; optionales eigenes Siegel nur als unseres.
            </p>
          </div>
          <div className="faq-item">
            <h3>Haften Sie für GoBD-Konformität?</h3>
            <p className="prose">Nein.</p>
          </div>
          <div className="faq-item">
            <h3>Kostet der Pilot etwas?</h3>
            <p className="prose">
              Partner-Promo <strong className="promo-code">{PROMO_CODE}</strong>{" "}
              (100 % für Setup + Abo, 2 Monate; Details im Checkout). Reguläre
              Preise erst beim Kauf — siehe{" "}
              <Link href="/#preise">Produktseite</Link>.
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
            Zusicherung von GoBD-Konformität. Partner-Rolle: testen und ggf.
            empfehlen — nicht ausfüllen für Mandanten. Kein Fear-Claim.
            Fachliche Freigabe beim Mandanten bzw. bei beraterischer Leistung.
          </p>
        </section>
      </main>
      <div className="sticky-cta">
        <Link className="btn" href={PILOT_HREF}>
          {PRIMARY_CTA}
        </Link>
        <p className="trust-line">
          Partner-Promo <strong className="promo-code">{PROMO_CODE}</strong>
          {" · "}100 % für Setup + Abo, 2 Monate
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
