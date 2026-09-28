import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { planDelivery } from "@/lib/delivery";
import { INTAKE_PREVIEW_ROWS } from "@/lib/intake-questions";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { evaluateOpenPoints } from "@/lib/open-points";
import {
  PARTNER_DEMO_PATH,
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_PATH,
  PARTNER_MUSTER_PDF_PATH,
} from "@/lib/partner-muster";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";

const PILOT_HREF =
  "/checkout?utm_source=partner&utm_medium=landing&utm_campaign=steuerberater";

const PROMO_CODE = "KANZLEI-PILOT";

const PAGE_TITLE =
  "Für Steuerberater: Fragen und Muster ansehen, bevor Sie empfehlen | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Mandanten erfassen ihre Abläufe geführt. Entwurf, Offene Punkte und Versionen. Fragen und ein Musterergebnis ansehen, bevor Sie etwas empfehlen. Keine Steuerberatung.";

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

const musterPlan = planDelivery(
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_IDENTITY,
  1,
);
const musterOpenPoints = evaluateOpenPoints({
  answers: PARTNER_MUSTER_ANSWERS,
  identity: PARTNER_MUSTER_IDENTITY,
});

function HeroProofButtons() {
  return (
    <div className="actions">
      <a className="btn" href="#muster">
        Muster-Dokumentation ansehen
      </a>
      <a className="btn" href="#fragen-demo">
        Fragenprozess testen
      </a>
    </div>
  );
}

export default function SteuerberaterPage() {
  return (
    <>
      <SiteHeader
        ctaHref="#muster"
        ctaLabel="Muster-Dokumentation ansehen"
        links={[
          { href: "#fragen-demo", label: "Fragen" },
          { href: "#muster", label: "Muster" },
          { href: "#daten", label: "Daten" },
          { href: "#faq", label: "FAQ" },
        ]}
      />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Für Steuerberater und Kanzleien</p>
          <h1>
            Ihre Mandanten wissen, dass sie ihre Buchhaltungsprozesse
            dokumentieren müssen. Trotzdem bleibt die Verfahrensdokumentation
            oft liegen.
          </h1>
          <p className="lead">
            Mit gobd-doku-erstellen.de erfassen Mandanten ihre Abläufe geführt.
            Herauskommen Entwurf, Offene Punkte und Versionen. Sehen Sie Fragen
            und ein Musterergebnis an, bevor Sie etwas empfehlen.
          </p>
          <HeroProofButtons />
          <p className="trust-line">
            Keine Steuerberatung · Sie füllen nicht für Mandanten aus
          </p>
        </section>

        <section className="block" id="mandant">
          <h2>Was Ihre Mandanten machen</h2>
          <p className="prose">
            Mandanten beantworten geführte Fragen zu Software, Belegen, Abläufen
            und Verantwortlichen. Kein leeres Word-Dokument zum „irgendwie
            Ausfüllen“.
          </p>
          <p className="prose">
            Sie als Berater müssen das <strong>nicht</strong> für sie erledigen
            — Sie können Fragen und Muster vorher selbst ansehen und den Weg
            durchspielen.
          </p>
        </section>

        <section className="block" id="fragen-demo">
          <h2>So sehen die Fragen aus</h2>
          <p className="prose">
            Kurzer Einblick — damit Sie den Aufwand einschätzen können, bevor
            Sie den Partner-Pilot starten. Die Zeilen sind die Fragen aus dem
            produktiven Ablauf, mit Beispieldaten durchklickbar.
          </p>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Frage</th>
                  <th scope="col">Wozu</th>
                </tr>
              </thead>
              <tbody>
                {INTAKE_PREVIEW_ROWS.map((row, index) => (
                  <tr key={row.question}>
                    <td>{index + 1}</td>
                    <td>{row.question}</td>
                    <td>{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Im Pilot spielen Sie solche Parameter selbst durch. Beim Mandanten
            beantwortet der Mandant — nicht die Kanzlei stellvertretend.
          </p>
          <div className="actions">
            <Link className="btn" href={PARTNER_DEMO_PATH}>
              Fragenprozess live testen
            </Link>
          </div>
        </section>

        <section className="block" id="muster">
          <h2>So sieht ein Muster-Ergebnis aus</h2>
          <p className="prose">
            Kein Blanko-Roman — strukturierter Entwurf plus sichtbare Offene
            Punkte. Dies ist ein <strong>Beispiel</strong> (Beispiel GmbH,
            anonymisiert), kein Dokument eines echten Mandanten. Keine
            Konformitätszusage.
          </p>
          <p className="prose">
            Am Ende liegen ein PDF-Entwurf, die Liste der Offenen Punkte und —
            nach einem Kauf — Versionen, wenn sich etwas ändert.
          </p>
          <h3>Gliederung in diesem Muster</h3>
          <ol className="prose-list">
            {musterPlan.chapters.map((chapter) => (
              <li key={chapter.id}>{chapter.title}</li>
            ))}
          </ol>
          <h3>Offene Punkte in diesem Muster</h3>
          <p className="hint">
            Ausgabe des Generators für die Beispieldaten, dieselbe Tabelle wie
            im PDF. Leere Angaben werden Punkte. Die Beispiel GmbH lässt weitere
            Systeme und die IT-Rolle leer; eine Bestellung gibt es in diesem
            Muster nicht.
          </p>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Schwere</th>
                  <th scope="col">Offener Punkt</th>
                  <th scope="col">Kapitel</th>
                </tr>
              </thead>
              <tbody>
                {musterOpenPoints.map((point) => (
                  <tr key={point.id}>
                    <td>{point.severity}</td>
                    <td>{point.title}</td>
                    <td>{point.chapter || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Das Muster zeigt Format und Transparenz — nicht „fertig für jeden
            Betrieb“.
          </p>
          <div className="actions">
            <a className="btn" href={PARTNER_MUSTER_PDF_PATH}>
              Muster-Dokumentation ansehen
            </a>
            <Link className="btn ghost" href={PARTNER_MUSTER_PATH}>
              Musterseite mit den Beispieldaten
            </Link>
          </div>
        </section>

        <section className="block" id="eignung">
          <h2>Geeignet — und wo die Grenze liegt</h2>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Geeignet</th>
                  <th scope="col">Nicht unser Anspruch</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Fragen-Demo und Muster zum eigenen Test</td>
                  <td>Prüfungsangst als Verkauf</td>
                </tr>
                <tr>
                  <td>Weiterleiten nach Ihrer Bewertung</td>
                  <td>Ausfüllen für den Mandanten</td>
                </tr>
                <tr>
                  <td>Versionierung und erneute Exporte</td>
                  <td>Steuerberatung oder Konformitätsversprechen</td>
                </tr>
                <tr>
                  <td>KMU, Handwerk, Freiberufler typisch</td>
                  <td>Blanko-„Muster fertig“ ohne Betriebsbezug</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Situation</th>
                  <th scope="col">Eignung</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Freiberufler, kleine GmbH, Handwerk mit überschaubarer IT
                  </td>
                  <td>Gut geeignet</td>
                </tr>
                <tr>
                  <td>
                    Mehrere Systeme, viele Standorte, viele interne
                    Zuständigkeiten
                  </td>
                  <td>Oft geeignet — Offene Punkte werden sichtbar</td>
                </tr>
                <tr>
                  <td>Sehr individuelle Konzernprozesse, Sonderfälle</td>
                  <td>Grenzen — manuell ergänzen oder anderes Vorgehen</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="prose">
            Das Tool ersetzt keine individuelle Beratung. Offene Punkte zeigen,
            was noch geklärt werden muss.
          </p>
        </section>

        <section className="block" id="qualitaet">
          <h2>Wie Qualität entsteht</h2>
          <ul className="prose-list">
            <li>Geführte Fragen statt leerer Vorlage</li>
            <li>Offene Punkte machen Lücken sichtbar — leere Angaben werden Punkte</li>
            <li>Versionen halten den Stand nachvollziehbar</li>
            <li>
              Sie können Muster und Fragen prüfen, <strong>bevor</strong> Sie
              empfehlen
            </li>
          </ul>
          <p className="prose">Von den Fragen zum gepflegten Stand:</p>
          <ol className="prose-list">
            <li>
              <strong>Fragen</strong> — Sie im Test, später der Mandant.
            </li>
            <li>
              <strong>Ergebnis</strong> — PDF-Entwurf und Offene-Punkte-Liste.
            </li>
            <li>
              <strong>Versionierung</strong> — neue Fassung bei Änderungen;
              Historie statt Dateichaos.
            </li>
          </ol>
          <p className="prose">
            Ein Einmal-PDF veraltet, wenn Software oder Prozesse wechseln.
            Setup: erste Fassung. Abo: Fassungen halten und erneut exportieren.
            Pflege ist Teil des Produkts.
          </p>
        </section>

        <section className="block" id="rolle">
          <h2>Ihre Rolle: Empfehlung und Weiterleiten</h2>
          <ul className="prose-list">
            <li>
              Sie testen mit Parametern, bewerten Fragen und Muster — und leiten
              bei Überzeugung an Mandanten weiter.
            </li>
            <li>
              Eine Empfehlung ist keine Prüfungspflicht und keine Übernahme der
              Dokumentation.
            </li>
            <li>
              Fachliche Bewertung und Verantwortung bleiben bei Mandant und
              Kanzlei, wie bisher.
            </li>
            <li>
              Sie füllen die Verfahrensdokumentation <strong>nicht</strong> für
              den Mandanten aus. Der Mandant liefert die Betriebsdaten.
            </li>
          </ul>
        </section>

        <section className="block" id="daten">
          <h2>Daten und Konditionen</h2>
          <ul className="prose-list">
            <li>
              <strong>Hosting.</strong> Website bei Vercel. PDFs in Vercel Blob,
              wenn der Token gesetzt ist, sonst als Datei. Ausgefüllte Angaben
              in Google Sheets, wenn das Sheet konfiguriert ist, sonst in einer
              Datei. Transaktionsmails über Resend, wenn der API-Key gesetzt
              ist. Zahlung über Stripe. Die{" "}
              <Link href="/datenschutz">Datenschutzerklärung</Link> benennt
              Vercel und Stripe; Sheets, Blob und Resend stehen dort noch nicht
              namentlich.
            </li>
            <li>
              <strong>Zugriff.</strong> Der Mandant erreicht das Dokument über
              sein Konto (Magic-Link an die E-Mail der Bestellung). Sie sehen
              Mandantendaten nicht automatisch — nur wenn der Mandant sie teilt.
              Ein Rollenmodell für Kanzleimitarbeiter ist nicht eingebaut.
            </li>
            <li>
              <strong>Kündigung.</strong> Im Stripe-Kundenportal („Abo
              verwalten“ im Konto). Die{" "}
              <Link href="/agb">AGB</Link> nennen die außerordentliche Kündigung
              aus wichtigem Grund. Eine konkrete Frist für das Monatsabo steht
              dort nicht.
            </li>
            <li>
              <strong>Export.</strong> PDF-Download im Konto. Keine
              Selbstbedienung für die Auskunft über alle personenbezogenen
              Daten — Rechte per E-Mail an{" "}
              <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
              .
            </li>
            <li>
              <strong>Änderungsprotokoll.</strong> Jede neue Fassung speichert
              Gültig-ab, optionales Gültig-bis, einen Kurztext zur Änderung und
              wer sie eingetragen hat. Ein Feld-für-Feld-Vergleich wird nicht
              geführt.
            </li>
            <li>
              <strong>AVV.</strong> Ein Auftragsverarbeitungsvertrag liegt hier
              nicht zum Download. Die Datenschutzerklärung markiert den AVV mit
              Vercel als noch zu prüfen. Auf Anfrage:{" "}
              <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
              .
            </li>
            <li>
              <strong>Kosten im ersten Jahr ohne Code:</strong> {SETUP_EUR} €
              Setup plus {MONTHLY_EUR} € pro Monat (
              <Link href="/#preise">Produktseite</Link>). Der Code{" "}
              <strong className="promo-code">{PROMO_CODE}</strong> gilt nur im
              Checkout des Pilots unten. Keine Kanzlei-Pakete auf dieser Seite.
            </li>
          </ul>
        </section>

        <section className="block" id="pilot">
          <h2>Wenn Fragen und Muster überzeugen</h2>
          <ol className="prose-list">
            <li>
              <strong>Partner-Pilot starten</strong>
            </li>
            <li>
              <strong>Parameter durchspielen</strong> — Rechtsform und die
              Fragen selbst.
            </li>
            <li>
              <strong>Bewerten</strong> — Fragenablauf und Muster.
            </li>
            <li>
              <strong>Weiterleiten</strong> — bei Überzeugung an Mandanten. Der
              Mandant arbeitet selbst weiter.
            </li>
          </ol>
          <p className="prose">
            Mit dem Code <strong className="promo-code">{PROMO_CODE}</strong>{" "}
            gelten die Partner-Konditionen im Checkout — maßgeblich ist, was
            dort nach Eingabe des Codes steht. Der Bezahlvorgang verlangt ein
            Zahlungsmittel nur, wenn ein Betrag fällig wird. Setzt ein Rabatt
            den fälligen Betrag auf 0 €, ist für diesen Vorgang kein
            Zahlungsmittel nötig.
          </p>
          <p className="prose">
            Was der Code genau rabattiert — Prozent, Setup, Monatsabo, Dauer —
            steht nicht im Programm. Eine automatische Kündigung nach einer
            Pilotphase ist nicht gesetzt. Ob das Abo danach zu {SETUP_EUR} €
            Setup und {MONTHLY_EUR} €/Monat weiterläuft, entscheidet die
            Einstellung bei Stripe.
          </p>
          <div className="actions">
            <Link className="btn" href={PILOT_HREF}>
              Partner-Pilot starten
            </Link>
            <a className="btn ghost" href="#fragen-demo">
              Nochmals Fragen
            </a>
            <a className="btn ghost" href="#muster">
              Nochmals Muster
            </a>
          </div>
        </section>

        <section className="block" id="grenzen">
          <h2>Grenzen</h2>
          <p className="prose">
            Wir leisten keine Steuer- oder Rechtsberatung und geben keine
            Konformitäts- oder Prüfungszusage.
          </p>
          <p className="prose">
            Eigenes Produkt der IKAT GmbH — keine fremden Zertifikat-Siegel;
            optionales eigenes Zeichen nur klar als unseres.
          </p>
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Kostet mich das Zeit mit jedem Mandanten?</h3>
            <p className="prose">
              Der Pilot ist zum eigenen Durchspielen. Danach arbeitet der
              Mandant selbst. Sie füllen nicht für ihn aus.
            </p>
          </div>
          <div className="faq-item">
            <h3>Was, wenn nach der Weiterempfehlung etwas fehlt?</h3>
            <p className="prose">
              Keine Konformitätszusage. Offene Punkte zeigen Lücken. Die
              fachliche Einschätzung bleibt bei Ihnen und beim Mandanten.
            </p>
          </div>
          <div className="faq-item">
            <h3>Warum nicht eine Word-Vorlage?</h3>
            <p className="prose">
              Geführte Fragen, ein Ergebnis aus diesen Angaben, und Versionen
              statt einer einzelnen Datei.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das DATEV oder behördlich zertifiziert?</h3>
            <p className="prose">
              Nein. Eigenes Produkt. Ein optionales Zeichen nur als unseres.
            </p>
          </div>
          <div className="faq-item">
            <h3>Bin ich nach dem Pilot im Abo fest?</h3>
            <p className="prose">
              Der Code dient zum Testen im Checkout. Was er rabattiert und wie
              lange, zeigt der Checkout. Eine automatische Kündigung nach dem
              Pilot ist nicht hinterlegt. Reguläre Preise: {SETUP_EUR} € Setup
              plus {MONTHLY_EUR} €/Monat.
            </p>
          </div>
          <div className="faq-item">
            <h3>Welche Daten brauche ich für Muster und Fragen?</h3>
            <p className="prose">
              Keine Mandanten-Geheimnisse. Muster und Demo auf dieser Seite
              speichern nichts. Im Pilot geben Sie ein, was Sie selbst
              durchspielen.
            </p>
          </div>
          <div className="faq-item">
            <h3>Für welche Mandanten?</h3>
            <p className="prose">
              Typisch KMU, Handwerk, Freiberufler, kleine GmbH. Im Pilot können
              Sie mehrere Szenarien ansehen. Sehr individuelle Konzernprozesse
              stoßen an die Grenze oben.
            </p>
          </div>
          <div className="faq-item">
            <h3>Muss ich die Software schulen?</h3>
            <p className="prose">Nein.</p>
          </div>
          <div className="faq-item">
            <h3>Was wird aus unbekannten Angaben?</h3>
            <p className="prose">
              Leere Angaben werden Offene Punkte. Das Muster zeigt das an der
              Beispiel GmbH. Widersprüche zwischen ausgefüllten Feldern prüft
              das Tool nicht.
            </p>
          </div>
          <div className="faq-item">
            <h3>Kann ich das Muster ohne Kauf sehen?</h3>
            <p className="prose">
              Ja. Muster und Fragenprozess auf dieser Seite, ohne Checkout.
            </p>
          </div>
          <div className="faq-item">
            <h3>Wie kündigt man?</h3>
            <p className="prose">
              Über das Stripe-Kundenportal im Konto. Eine konkrete Frist steht
              in den AGB nicht. Die außerordentliche Kündigung aus wichtigem
              Grund steht in den AGB.
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>
            Selbst testen — Fragen und Muster prüfen — dann entscheiden
          </h2>
          <div className="actions">
            <Link className="btn" href={PILOT_HREF}>
              Partner-Pilot starten
            </Link>
          </div>
          <p className="hint back-links">
            <a href="#fragen-demo">Fragen</a>
            {" · "}
            <a href="#muster">Muster</a>
            {" · "}
            <Link href="/datenschutz">Datenschutz</Link>
            {" · "}
            <Link href="/impressum">Impressum</Link>
          </p>
          <p className="disclaimer">
            Keine Steuer- oder Rechtsberatung. Partner-Pilot zur eigenen
            Bewertung durch die Kanzlei. Weiterempfehlung ersetzt keine
            fachliche Beratung. Die Verfahrensdokumentation bleibt in der
            Verantwortung des Mandanten.
          </p>
        </section>
      </main>
      <div className="sticky-cta tall">
        <a className="btn" href="#muster">
          Muster-Dokumentation ansehen
        </a>
        <a className="btn" href="#fragen-demo">
          Fragenprozess testen
        </a>
      </div>
      <SiteFooter />
    </>
  );
}
