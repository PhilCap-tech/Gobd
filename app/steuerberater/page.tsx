import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { PARTNER_DEMO_PATH, PARTNER_MUSTER_PATH } from "@/lib/partner-muster";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";

const PILOT_HREF =
  "/checkout?utm_source=partner&utm_medium=landing&utm_campaign=steuerberater";

const PROMO_CODE = "KANZLEI-PILOT";
const PILOT_LABEL = "Pilot starten";

const PAGE_TITLE =
  "Für Steuerberater: Verfahrensdokumentation testen, Prozess & Versionierung | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Muster-PDF und Fragenprozess vor dem Partner-Pilot. Pflicht-Entlastung, Prozess, Versionierung. Keine Steuerberatung.";

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

function ProofCtas() {
  return (
    <div className="cta-pair">
      <div className="cta-paid">
        <Link className="btn" href={PARTNER_MUSTER_PATH}>
          Muster ansehen
        </Link>
      </div>
      <div className="cta-soft">
        <Link className="btn ghost" href={PARTNER_DEMO_PATH}>
          Fragenprozess testen
        </Link>
      </div>
      <p className="hint" style={{ flexBasis: "100%" }}>
        <Link href={PILOT_HREF}>{PILOT_LABEL}</Link>
        {" · "}Code <strong className="promo-code">{PROMO_CODE}</strong> im
        Checkout — was der Code zusichert, steht unter{" "}
        <a href="#promo">Promo</a>
      </p>
    </div>
  );
}

export default function SteuerberaterPage() {
  return (
    <>
      <SiteHeader
        ctaHref={PARTNER_MUSTER_PATH}
        ctaLabel="Muster ansehen"
        links={[
          { href: "#saeulen", label: "Säulen" },
          { href: PARTNER_DEMO_PATH, label: "Fragen" },
          { href: "#daten", label: "Daten" },
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
          <ProofCtas />
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
            <Link href="/#preise">Produktseite</Link>. Einstieg hier: Muster
            und Fragenprozess, danach optional der Pilot.
          </p>
        </section>

        <section className="block" id="pilot">
          <h2>So arbeiten Sie mit dem Partner-Pilot</h2>
          <ol className="prose-list">
            <li>
              <strong>Muster ansehen</strong> — anonymisierte Beispiel GmbH:
              PDF und Offene Punkte, ohne Login.
            </li>
            <li>
              <strong>Fragenprozess testen</strong> — die produktiven
              Intake-Fragen mit Beispieldaten durchklicken. Die Demo speichert
              nichts.
            </li>
            <li>
              <strong>Pilot starten</strong> — erst danach, mit dem Code im
              Checkout, wenn Sie das Ergebnis selbst durchspielen wollen.
            </li>
            <li>
              <strong>Weiterempfehlen</strong> — überzeugt der Test:
              Empfehlungsweg an Mandanten — der Mandant arbeitet selbst weiter.
            </li>
          </ol>
          <p className="hint">
            Nicht: die Verfahrensdokumentation stellvertretend für den
            Mandanten ausfüllen.
          </p>
          <ProofCtas />
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

        <section className="block" id="qualitaet">
          <h2>Was der Generator heute ausgibt</h2>
          <ul className="prose-list">
            <li>
              Leere Angaben werden zu Offenen Punkten. Leer ist, was der
              Regelsatz als leer wertet (unter anderem „nicht angegeben“ und
              „offen“). Die Backup-Auswahl „Unklar“ zählt nicht als leer.
            </li>
            <li>
              Die Kapitel sind die feste Vorlage. Die Intake-Werte werden
              eingesetzt. Ein eigener Ablauf wird daraus nicht gebaut — und
              fehlende Prozessschritte werden nicht zusätzlich als offene
              Punkte markiert.
            </li>
            <li>
              Nach dem Kauf erzeugt erneutes Ausfüllen oder Bearbeiten des
              Kapiteltexts eine neue Fassung: Gültig-ab, Kurz-Changelog,
              „Geändert durch“. Ältere PDFs bleiben downloadbar.
            </li>
          </ul>
          <p className="hint">
            Sichtbar am{" "}
            <Link href={PARTNER_MUSTER_PATH}>Muster</Link> und im{" "}
            <Link href={PARTNER_DEMO_PATH}>Fragenprozess</Link>.
          </p>
        </section>

        <section className="block" id="daten">
          <h2>Daten: Hosting, Zugriff, Kündigung, Export</h2>
          <p className="prose">
            Kurzfassung aus Datenschutzerklärung, AGB und dem laufenden Betrieb.
            Maßgeblich bleiben{" "}
            <Link href="/datenschutz">Datenschutz</Link> und{" "}
            <Link href="/agb">AGB</Link>.
          </p>
          <div className="stack">
            <article className="card">
              <h3>Hosting</h3>
              <p className="prose">
                Die Website wird bei Vercel gehostet (Datenschutzerklärung,
                Abschnitt Hosting). PDFs liegen in Vercel Blob, wenn der
                Blob-Token gesetzt ist, sonst als Datei-Fallback. Intake-Zeilen
                liegen in Google Sheets, wenn das Sheet konfiguriert ist, sonst
                in einer Datei. Transaktionsmails laufen über Resend, wenn der
                API-Key gesetzt ist. Zahlung läuft über Stripe Checkout. Die
                veröffentlichte Datenschutzerklärung benennt Vercel und Stripe;
                Sheets, Blob und Resend stehen dort noch nicht namentlich.
              </p>
            </article>
            <article className="card">
              <h3>Zugriff</h3>
              <p className="prose">
                Das Dokument erreicht der Mandant über das Konto (Magic-Link an
                die E-Mail der Bestellung) oder mit der Checkout-Session. Ein
                Rollenmodell für Kanzleimitarbeiter ist nicht eingebaut.
              </p>
            </article>
            <article className="card">
              <h3>Kündigung</h3>
              <p className="prose">
                Das Abo verwaltet der Kunde im Stripe-Kundenportal („Abo
                verwalten“ im Konto). Zurück aus diesem Portal weist die
                Oberfläche auf Änderungen an Zahlungsmittel und Kündigung hin.
                AGB Abschnitt 11 nennt die außerordentliche Kündigung aus
                wichtigem Grund. Eine konkrete Kündigungsfrist für das
                Monatsabo steht in den AGB nicht.
              </p>
            </article>
            <article className="card">
              <h3>Export</h3>
              <p className="prose">
                Die Verfahrensdokumentation gibt es als PDF-Download im Konto.
                Eine Selbstbedienung für die Auskunft über alle
                personenbezogenen Daten gibt es nicht. Die Rechte aus der
                Datenschutzerklärung laufen per E-Mail an{" "}
                <a href={`mailto:${LEGAL_OPERATOR.email}`}>
                  {LEGAL_OPERATOR.email}
                </a>
                .
              </p>
            </article>
            <article className="card">
              <h3>Änderungsprotokoll</h3>
              <p className="prose">
                Jede neue Fassung speichert Gültig-ab, optionales Gültig-bis,
                einen Kurz-Changelog und „Geändert durch“. Diese Zeile steht in
                Kapitel 7 der Vorlage. Ein Feld-für-Feld-Vergleich wird nicht
                geführt.
              </p>
            </article>
            <article className="card">
              <h3>AVV</h3>
              <p className="prose">
                Ein Auftragsverarbeitungsvertrag liegt hier nicht zum Download.
                Die Datenschutzerklärung markiert den AVV mit Vercel als noch
                zu prüfen. Auf Anfrage:{" "}
                <a href={`mailto:${LEGAL_OPERATOR.email}`}>
                  {LEGAL_OPERATOR.email}
                </a>
                .
              </p>
            </article>
          </div>
        </section>

        <section className="block" id="promo">
          <h2>Partner-Code {PROMO_CODE}</h2>
          <p className="prose">
            Im Checkout können Sie einen Aktionscode eingeben. Der Bezahlvorgang
            verlangt ein Zahlungsmittel nur, wenn ein Betrag fällig wird
            (Einstellung: Zahlungsmittel nur falls erforderlich). Setzt ein
            Rabatt den fälligen Betrag auf 0&nbsp;€, ist für diesen Vorgang kein
            Zahlungsmittel nötig.
          </p>
          <p className="prose">
            Was <strong className="promo-code">{PROMO_CODE}</strong> genau
            rabattiert — Prozent, Setup, Monatsabo, Dauer — steht nicht im
            Programm. Eine automatische Kündigung nach einer Pilotphase ist im
            Checkout nicht gesetzt. Ob das Abo nach einem befristeten Rabatt zu
            den regulären Preisen ({SETUP_EUR}&nbsp;€ Setup + {MONTHLY_EUR}
            &nbsp;€/Monat) weiterläuft, entscheidet die Coupon-Einstellung bei
            Stripe. Maßgeblich ist der Betrag, den der Checkout nach Eingabe
            des Codes anzeigt. Ohne Code gelten die Preise auf der{" "}
            <Link href="/#preise">Produktseite</Link>.
          </p>
          <p className="hint">
            Checkout-Link des Pilots behält die Kampagne{" "}
            <span className="promo-code">partner / landing / steuerberater</span>.
          </p>
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
              Das hängt vom Code <strong className="promo-code">{PROMO_CODE}</strong>{" "}
              im Checkout ab. Ein Zahlungsmittel wird nur verlangt, wenn ein
              Betrag fällig ist. Prozent und Dauer des Codes sind hier nicht
              hinterlegt — siehe <a href="#promo">Promo</a>. Reguläre Preise:{" "}
              <Link href="/#preise">Produktseite</Link>.
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>Muster und Fragen zuerst — dann entscheiden Sie über den Pilot</h2>
          <ProofCtas />
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
      <div className="sticky-cta tall">
        <Link className="btn" href={PARTNER_MUSTER_PATH}>
          Muster ansehen
        </Link>
        <Link className="btn ghost" href={PARTNER_DEMO_PATH}>
          Fragenprozess testen
        </Link>
        <p className="trust-line">
          <Link href={PILOT_HREF}>{PILOT_LABEL}</Link>
          {" · "}
          <strong className="promo-code">{PROMO_CODE}</strong>
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
