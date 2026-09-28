import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { planDelivery } from "@/lib/delivery";
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
/**
 * Ops 2026-09-28, Stripe: promo_1UKcN56UvAzri3dMrW7Wn7Y2, coupon J7BECQxI,
 * percent_off 100, duration repeating, duration_in_months 2, max_redemptions 50.
 * After promo: list Abo 49 €/Mo if not cancelled; list Setup 149 €.
 */
const PROMO_MONTHS = 2;
const PROMO_MAX_REDEMPTIONS = 50;

function PilotKlartextSentence() {
  return (
    <>
      Mit Code <strong className="promo-code">{PROMO_CODE}</strong>:{" "}
      {PROMO_MONTHS}&nbsp;Monate 0&nbsp;€ (100&nbsp;% Rabatt); danach{" "}
      {MONTHLY_EUR}&nbsp;€/Monat, wenn Sie nicht kündigen — kein
      Überraschungs-Abo hinter ‚gratis‘.
    </>
  );
}

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
      <a className="btn" href="#fragen-demo">
        Fragenprozess testen
      </a>
      <a className="btn" href="#muster">
        Muster-Dokumentation ansehen
      </a>
    </div>
  );
}

export default function SteuerberaterPage() {
  return (
    <>
      <SiteHeader
        ctaHref="#fragen-demo"
        ctaLabel="Fragenprozess testen"
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
            Keine Steuerberatung · Sie füllen nicht für Mandanten aus · Muster
            aus dem Generator
          </p>
        </section>

        <section className="block" id="rolle">
          <h2>Ihre Rolle im Partner-Pilot</h2>
          <p className="prose">
            Sie testen mit Parametern, bewerten Fragen und Muster-Ergebnis —
            und leiten bei Überzeugung an Mandanten weiter.
          </p>
          <p className="prose">
            <strong>
              Sie füllen die Dokumentation nicht für das Unternehmen aus.
            </strong>{" "}
            Der Mandant liefert die Betriebsdaten.
          </p>
        </section>

        <section className="block" id="fragen-demo">
          <h2>Fragen im produktiven Ablauf</h2>
          <p className="prose">
            Eine zweite Beispiel-Tabelle gibt es hier nicht. Den Fragebogen
            sehen Sie im Live-Test: dieselben Fragen und dieselbe Prüfung vor
            „Weiter“ wie im produktiven Ablauf. Der Test ist linear und
            verzweigt nicht. Ersetzendes Scannen und „was hat sich geändert“
            sind dort keine eigenen Fragen.
          </p>
          <p className="prose">
            Im Pilot spielen Sie die Parameter selbst durch. Beim Mandanten
            antwortet der Mandant — nicht die Kanzlei stellvertretend. Die Demo
            speichert keine Eingaben.
          </p>
          <div className="actions">
            <Link className="btn" href={PARTNER_DEMO_PATH}>
              Fragenprozess live testen
            </Link>
          </div>
        </section>

        <section className="block" id="muster">
          <h2>Muster aus dem Generator</h2>
          <p className="prose">
            Das ist der Beleg auf dieser Seite: die Kapitel und die offenen
            Punkte, die der Generator aus festen Beispieldaten erzeugt. Dieselbe
            Quelle wie das Muster-PDF. Keine zweite Gliederung und keine
            Beispielzeilen daneben.
          </p>
          <p className="hint">
            Beispiel GmbH (anonymisiert) · DATEV · Eingang „E-Mail / PDF“ ·
            Ausgang „aus Buchhaltungssoftware“ · Version 1.0 · kein echtes
            Mandantendokument · keine Konformitätszusage
          </p>
          <h3>Kapitel</h3>
          <ol className="prose-list">
            {musterPlan.chapters.map((chapter) => (
              <li key={chapter.id}>{chapter.title}</li>
            ))}
          </ol>
          <h3>Offene Punkte</h3>
          <p className="prose">
            Diese Liste erzeugt der Regelsatz aus den leeren Beispielfeldern.
            Dieselbe Tabelle steht im PDF (Kapitel Offene Punkte). Schweregrade
            bleiben high, medium und low — so schreibt sie der Generator. Das
            Muster zeigt Transparenz bei Lücken, nicht „fertig für jeden
            Betrieb“.
          </p>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Schwere</th>
                  <th scope="col">Offener Punkt aus dem Generator</th>
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
          <div className="actions">
            <a className="btn" href={PARTNER_MUSTER_PDF_PATH}>
              Muster-PDF herunterladen
            </a>
            <Link className="btn ghost" href={PARTNER_MUSTER_PATH}>
              Musterseite mit den Beispieldaten
            </Link>
          </div>
        </section>

        <section className="block" id="prozess">
          <h2>Von den Fragen zum gepflegten Stand</h2>
          <ol className="prose-list">
            <li>
              <strong>Fragen / Parameter</strong> — Sie im Test, später der
              Mandant.
            </li>
            <li>
              <strong>Ergebnis</strong> — PDF-Entwurf + Offene-Punkte-Liste.
            </li>
            <li>
              <strong>Versionierung</strong> — neue Fassung bei Änderungen;
              Historie statt Dateichaos.
            </li>
          </ol>
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
                  <td>Oft geeignet — nur leere Angaben werden Punkte</td>
                </tr>
                <tr>
                  <td>Sehr individuelle Konzernprozesse, Sonderfälle</td>
                  <td>Grenzen — manuell ergänzen oder anderes Vorgehen</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="prose">
            Das Tool ist keine Steuerberatung. Offene Punkte markieren leere
            Angaben. Widersprüche prüft es nicht, und eine Bestätigung durch den
            Mandanten ist nicht eingebaut. Für die meisten Betriebe reicht die
            Fassung aus den Angaben. Anpassungen bei besonderen Verfahren sind
            möglich.
          </p>
        </section>

        <section className="block" id="versionierung">
          <h2>Versionierung</h2>
          <p className="prose">
            Ein Einmal-PDF veraltet, wenn Software oder Prozesse wechseln.
            Setup: erste Fassung. Abo: Fassungen halten und erneut exportieren.
            Im Muster-PDF steht eine Fassung mit Gültig-ab und Änderungstext.
            Weitere Fassungen legt der Mandant nach dem Kauf an — nicht in
            dieser Vorschau.
          </p>
        </section>

        <section className="block" id="daten">
          <h2>Daten und Konditionen</h2>
          <ul className="prose-list">
            <li>
              <strong>Datenfluss.</strong> Die Website läuft bei Vercel. Die
              Zahlung läuft über Stripe. Angaben aus dem Intake und die erzeugte
              Verfahrensdokumentation speichern wir zur Abwicklung der
              Bestellung; der Mandant erreicht das PDF in seinem Konto.
              Transaktionsmails zur Bestellung (Zugang, Lieferung) gehen an die
              E-Mail der Bestellung. Die{" "}
              <Link href="/datenschutz">Datenschutzerklärung</Link> benennt als
              Empfänger heute Vercel und Stripe. Weitere Dienstleister sind
              dort nicht genannt. Eine ausführlichere Beschreibung der
              Verarbeitung ist Zukunft und auf dieser Seite nicht verfügbar.
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
              <strong>AVV.</strong> Ein ausführlicher
              Auftragsverarbeitungsvertrag liegt nicht zum Download und ist
              heute nicht veröffentlicht. Die Datenschutzerklärung markiert den
              AVV mit Vercel als noch zu prüfen. Eine vollständigere AVV- und
              Prozessbeschreibung ist Zukunft und auf dieser Seite nicht
              verfügbar. Anfragen:{" "}
              <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
              .
            </li>
            <li>
              <strong>Kosten im ersten Jahr ohne Code:</strong> {SETUP_EUR} €
              Setup plus {MONTHLY_EUR} € pro Monat (
              <Link href="/#preise">Produktseite</Link>).{" "}
              <PilotKlartextSentence /> Das Listen-Setup von {SETUP_EUR}&nbsp;€
              ist einmalig und wird nach der Promo nicht monatlich
              nachberechnet. Keine Kanzlei-Pakete auf dieser Seite.
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
          <div className="value-note">
            <p className="prose">
              <PilotKlartextSentence />
            </p>
          </div>
          <h3>100&nbsp;% für {PROMO_MONTHS}&nbsp;Monate</h3>
          <ul className="prose-list">
            <li>
              Setup und Abo zum vollen Nachlass (100&nbsp;%) für{" "}
              {PROMO_MONTHS}&nbsp;Abrechnungsmonate ab Einlösung — nicht nur für
              eine einzelne Rechnung.
            </li>
            <li>
              Den Code lösen Sie im Checkout ein. Höchstens{" "}
              {PROMO_MAX_REDEMPTIONS}&nbsp;Einlösungen insgesamt.
            </li>
          </ul>
          <h3>Zahlungsmethode</h3>
          <ul className="prose-list">
            <li>
              Der Checkout lässt Aktionscodes zu. Eine Zahlungsmethode wird nur
              verlangt, wenn ein Betrag fällig ist — nicht in jedem Fall.
            </li>
            <li>
              Liegt der fällige Betrag durch den 100-%-Nachlass bei 0&nbsp;€,
              erfasst Stripe in diesem Schritt keine Karte.
            </li>
            <li>
              Nach den {PROMO_MONTHS}&nbsp;Monaten läuft das Abo mit{" "}
              {MONTHLY_EUR}&nbsp;€/Monat weiter, wenn Sie nicht kündigen.
              Dafür brauchen Sie eine Zahlungsmethode, sonst kann die Rechnung
              nicht eingezogen werden. Hinterlegen im Kundenportal („Abo
              verwalten“).
            </li>
            <li>
              Konto und Fragen laufen danach wie im normalen Ablauf.
            </li>
          </ul>
          <h3>
            Danach: {MONTHLY_EUR}&nbsp;€/Monat, keine Gratis-Verlängerung
          </h3>
          <ul className="prose-list">
            <li>
              Nach {PROMO_MONTHS}&nbsp;Monaten endet der Nachlass. Keine
              automatische kostenlose Verlängerung. Der Checkout beendet das
              Abo nicht von selbst: es läuft mit {MONTHLY_EUR}&nbsp;€/Monat
              weiter, wenn Sie nicht kündigen.
            </li>
            <li>
              Listenpreis ohne Code: {SETUP_EUR}&nbsp;€ Setup einmalig plus{" "}
              {MONTHLY_EUR}&nbsp;€/Monat (
              <Link href="/#preise">Produktseite</Link>
              ). Wer den Code nutzt, zahlt das Setup in der Promo nicht. Danach
              ist nur das Abo fällig: {MONTHLY_EUR}&nbsp;€/Monat. Das Setup wird
              nicht monatlich nachberechnet.
            </li>
            <li>
              Kündigung und Zahlungsdaten: Stripe-Kundenportal im Konto.{" "}
              <Link href="/faq">FAQ</Link>.
            </li>
            <li>
              14 Tage Geld-zurück stehen in der FAQ für zahlungspflichtige
              Käufe. Liegt der gezahlte Betrag bei 0&nbsp;€, gibt es keinen
              Betrag zu erstatten.
            </li>
          </ul>
          <h3>Was der Pilot nicht ist</h3>
          <ul className="prose-list">
            <li>Keine Steuer- oder Rechtsberatung.</li>
            <li>Kein dauerhaft kostenloses Produkt.</li>
            <li>Keine Konformitäts- oder Prüfungszusage.</li>
          </ul>
          <p className="prose">
            <PilotKlartextSentence />
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
              Keine Konformitätszusage. Offene Punkte zeigen leere Angaben. Die
              gelieferte Fassung reicht in der Regel; bei besonderen Verfahren
              ergänzt der Mandant die Dokumentation selbst. Eine zusätzliche
              Abstimmung durch die Kanzlei ist freiwillig und nur im Rahmen
              eines gesonderten Auftrags. Die Weiterempfehlung begründet keinen
              solchen Auftrag.
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
              <PilotKlartextSentence /> Listen-Setup {SETUP_EUR}&nbsp;€ einmalig
              — in der Promo ebenfalls 0&nbsp;€, danach nicht monatlich
              nachberechnet. Höchstens {PROMO_MAX_REDEMPTIONS}&nbsp;Einlösungen.
              Keine automatische Kündigung.
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
          <div className="faq-item">
            <h3>Was kostet das erste Jahr?</h3>
            <p className="prose">
              Ohne Code: {SETUP_EUR}&nbsp;€ Setup einmalig plus {MONTHLY_EUR}
              &nbsp;€/Monat. <PilotKlartextSentence />
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>
            Selbst testen — Fragen und Muster prüfen — dann entscheiden
          </h2>
          <p className="prose">
            <PilotKlartextSentence />
          </p>
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
            Bewertung durch die Kanzlei. Die Weiterempfehlung begründet keinen
            Auftrag zur Prüfung. Die Verfahrensdokumentation bleibt in der
            Verantwortung des Mandanten.
          </p>
        </section>
      </main>
      <div className="sticky-cta tall">
        <a className="btn" href="#fragen-demo">
          Fragenprozess testen
        </a>
        <a className="btn" href="#muster">
          Muster-Dokumentation ansehen
        </a>
      </div>
      <SiteFooter />
    </>
  );
}
