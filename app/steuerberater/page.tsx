import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { planDelivery } from "@/lib/delivery";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  evaluateOpenPoints,
  openPointChapterLabel,
  openPointDueLabel,
} from "@/lib/open-points";
import {
  PARTNER_DEMO_PATH,
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_PATH,
  PARTNER_MUSTER_PDF_PATH,
} from "@/lib/partner-muster";
import { PartnerInquiryForm } from "./partner-inquiry-form";

const PAGE_TITLE =
  "Für Steuerberater: Fragen und Muster ansehen, bevor Sie empfehlen | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Mandanten erfassen ihre Abläufe geführt. Entwurf, Offene Punkte und Versionen. Fragen und ein Musterergebnis ansehen. Für Kanzleien ohne Zahlung auf dieser Seite. Keine Steuerberatung.";

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
      <a className="btn ghost" href="#anfrage">
        VD für mehrere Mandanten
      </a>
    </div>
  );
}

export default function SteuerberaterPage() {
  return (
    <>
      <SiteHeader
        ctaHref="#anfrage"
        ctaLabel="Anfrage senden"
        links={[
          { href: "#fragen-demo", label: "Fragen" },
          { href: "#muster", label: "Muster" },
          { href: "#prozess", label: "Ablauf" },
          { href: "#anfrage", label: "Anfrage" },
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
            und ein Musterergebnis an, bevor Sie etwas empfehlen. Für die
            Kanzlei ist diese Seite ohne Zahlung: es gibt hier keinen
            Bestellweg.
          </p>
          <HeroProofButtons />
          <p className="trust-line">
            Keine Steuerberatung · Sie füllen nicht für Mandanten aus · Muster
            und Demo sind Beispiele und speichern keine Eingaben
          </p>
        </section>

        <section className="block" id="rolle">
          <h2>Ihre Rolle</h2>
          <p className="prose">
            Sie prüfen Fragen und Muster — und leiten bei Überzeugung an
            Mandanten weiter.
          </p>
          <p className="prose">
            <strong>
              Sie füllen die Dokumentation nicht für das Unternehmen aus.
            </strong>{" "}
            Der Mandant liefert die Betriebsdaten.
          </p>
          <p className="prose">
            Diese Seite nimmt keine Zahlung entgegen und führt nicht in eine
            Bestellung.
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
            In der Demo spielen Sie die Parameter selbst durch. Beim Mandanten
            antwortet der Mandant — nicht die Kanzlei stellvertretend. Die Demo
            ist ein Beispiel und speichert keine Eingaben.
          </p>
          <div className="actions">
            <Link className="btn" href={PARTNER_DEMO_PATH}>
              Fragenprozess live testen
            </Link>
          </div>
        </section>

        <section className="block" id="muster">
          <h2>Herleitung der Verfahrensdokumentation</h2>
          <p className="prose">
            Das Muster zeigt, wie der Generator aus festen Beispieldaten die
            Kapitel und die offenen Punkte ableitet. Dieselbe Quelle wie das
            Muster-PDF. Keine zweite Gliederung und keine Beispielzeilen
            daneben. Das Muster ist ein Beispiel und speichert keine Eingaben.
          </p>
          <p className="hint">
            Beispiel GmbH (fiktiv) · DATEV · Eingang E-Mail und PDF · Ausgang
            Rechnungssoftware · kein Papierweg · Gliederung am detaillierten
            Muster ausgerichtet · kein echtes Mandantendokument · keine
            Konformitätszusage · keine Freigabe durch die Geschäftsführung.
          </p>
          <h3>Kapitel</h3>
          <ol className="prose-list">
            {musterPlan.chapters.map((chapter) => (
              <li key={chapter.id}>{chapter.title}</li>
            ))}
          </ol>
          <h3>Offene Punkte</h3>
          <p className="prose">
            Diese Liste erzeugt der Regelsatz aus leeren oder unbestätigten
            Angaben und aus Schritten, die der Fragebogen nicht abfragt.
            Dieselbe Tabelle steht im PDF (Kapitel Offene Punkte), mit
            Priorität hoch, mittel oder niedrig und Zieltermin „nicht
            festgelegt“. Das Muster zeigt Transparenz bei Lücken, nicht „fertig
            für jeden Betrieb“.
          </p>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Priorität</th>
                  <th scope="col">Offener Punkt aus dem Generator</th>
                  <th scope="col">Kapitel</th>
                  <th scope="col">Zieltermin</th>
                </tr>
              </thead>
              <tbody>
                {musterOpenPoints.map((point) => (
                  <tr key={point.id}>
                    <td>{point.priority}</td>
                    <td>{point.text}</td>
                    <td>{openPointChapterLabel(point.chapter)}</td>
                    <td>{point.dueDate ?? openPointDueLabel()}</td>
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
              <strong>Fragen / Parameter</strong> — Sie in der Demo, später der
              Mandant.
            </li>
            <li>
              <strong>Ergebnis</strong> — PDF-Entwurf und Offene-Punkte-Liste,
              abgeleitet aus den Angaben.
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
                  <td>Fragen-Demo und Muster zum eigenen Prüfen</td>
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
                  <td>
                    Oft geeignet — leere Angaben und nicht abgefragte Schritte
                    werden Punkte
                  </td>
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
            oder unbestätigte Angaben und Schritte, die der Fragebogen nicht
            erfasst. Ein Hinweis erscheint, wenn ersetzendes Scannen genannt
            ist und ein Papierweg fehlt. Das ist kein allgemeiner
            Widerspruchs-Check und keine Freigabe. Eine Bestätigung durch den
            Mandanten ist nicht eingebaut. Für die meisten Betriebe reicht die
            Fassung aus den Angaben. Anpassungen bei besonderen Verfahren sind
            möglich.
          </p>
        </section>

        <section className="block" id="versionierung">
          <h2>Versionierung</h2>
          <p className="prose">
            Ein einzelnes PDF veraltet, wenn Software oder Prozesse wechseln.
            Im Produkt legt der Mandant eine neue Fassung an: Gültig-ab,
            optional Gültig-bis, ein Kurztext zur Änderung und wer sie
            eingetragen hat. Bisherige Fassungen bleiben erhalten. Das
            Muster-PDF ist ein Beispiel aus festen Daten, keine gespeicherte
            Mandantenfassung. Präsens steht nur bei bestätigten Angaben. Die
            Erzeugung ist keine Freigabe durch die Geschäftsführung. Gültig-ab
            setzt der Mandant im Produkt, nicht in dieser Vorschau.
          </p>
        </section>

        <section className="block" id="daten">
          <h2>Daten</h2>
          <ul className="prose-list">
            <li>
              <strong>Datenfluss.</strong> Die Website läuft bei Vercel. Muster
              und Demo auf dieser Seite speichern keine Eingaben. Die Anfrage
              „VD für mehrere Mandanten“ übermittelt nur die Formularfelder per
              E-Mail an{" "}
              <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
              . Die <Link href="/datenschutz">Datenschutzerklärung</Link> benennt
              die heutigen Empfänger. Weitere Dienstleister sind dort nicht
              genannt. Eine ausführlichere Beschreibung der Verarbeitung ist
              Zukunft und auf dieser Seite nicht verfügbar.
            </li>
            <li>
              <strong>Zugriff.</strong> Sie sehen Mandantendaten nicht
              automatisch — nur wenn der Mandant sie teilt. Ein Rollenmodell für
              Kanzleimitarbeiter ist nicht eingebaut.
            </li>
            <li>
              <strong>Auskunft.</strong> Keine Selbstbedienung für die Auskunft
              über alle personenbezogenen Daten — Rechte per E-Mail an{" "}
              <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
              .
            </li>
            <li>
              <strong>Änderungsprotokoll.</strong> Jede neue Fassung im Produkt
              speichert Gültig-ab, optionales Gültig-bis, einen Kurztext zur
              Änderung und wer sie eingetragen hat. Ein Feld-für-Feld-Vergleich
              wird nicht geführt. Diese Vorschau speichert keine Fassung.
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
              <strong>Zahlung.</strong> Für Steuerberater entsteht auf dieser
              Seite keine Zahlung. Es gibt keinen Bestellweg.
            </li>
          </ul>
        </section>

        <section className="block" id="anfrage">
          <h2>VD für mehrere Mandanten</h2>
          <p className="prose">
            Wenn Sie die Verfahrensdokumentation für mehrere Mandanten ansprechen
            möchten, schreiben Sie uns. Die Anfrage ist unverbindlich. Muster
            und Demo bleiben Beispiele und speichern keine Eingaben.
          </p>
          <PartnerInquiryForm />
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
              Demo und Muster sind zum eigenen Prüfen. Danach arbeitet der
              Mandant selbst. Sie füllen nicht für ihn aus.
            </p>
          </div>
          <div className="faq-item">
            <h3>Was, wenn nach der Weiterempfehlung etwas fehlt?</h3>
            <p className="prose">
              Keine Konformitätszusage. Offene Punkte zeigen leere oder
              unbestätigte Angaben und nicht abgefragte Schritte. Die
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
            <h3>Entsteht für die Kanzlei eine Zahlung?</h3>
            <p className="prose">
              Nein. Diese Seite hat keinen Bestellweg. Muster und Demo sind
              Beispiele und speichern keine Eingaben. Für mehrere Mandanten
              nutzen Sie das Formular „VD für mehrere Mandanten“.
            </p>
          </div>
          <div className="faq-item">
            <h3>Welche Daten brauche ich für Muster und Fragen?</h3>
            <p className="prose">
              Keine Mandanten-Geheimnisse. Muster und Demo auf dieser Seite
              speichern nichts. In der Demo geben Sie ein, was Sie selbst
              durchspielen.
            </p>
          </div>
          <div className="faq-item">
            <h3>Für welche Mandanten?</h3>
            <p className="prose">
              Typisch KMU, Handwerk, Freiberufler, kleine GmbH. In der Demo
              können Sie die Beispieldaten ansehen und verändern. Sehr
              individuelle Konzernprozesse stoßen an die Grenze oben.
            </p>
          </div>
          <div className="faq-item">
            <h3>Muss ich die Software schulen?</h3>
            <p className="prose">Nein.</p>
          </div>
          <div className="faq-item">
            <h3>Was wird aus unbekannten Angaben?</h3>
            <p className="prose">
              Leere Angaben und nicht abgefragte Schritte werden Offene Punkte.
              Das Muster zeigt das an der Beispiel GmbH. Widersprüche zwischen
              ausgefüllten Feldern prüft das Tool nicht.
            </p>
          </div>
          <div className="faq-item">
            <h3>Kann ich Muster und Demo ohne Bestellung ansehen?</h3>
            <p className="prose">
              Ja. Beides sind Beispiele auf dieser Seite. Es wird nichts
              gespeichert und nichts bestellt.
            </p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>Fragen und Muster prüfen — bei mehreren Mandanten schreiben Sie uns</h2>
          <p className="prose">
            Muster und Demo speichern keine Eingaben. Die Anfrage über das
            Formular ist unverbindlich.
          </p>
          <div className="actions">
            <a className="btn" href="#anfrage">
              VD für mehrere Mandanten
            </a>
            <a className="btn ghost" href="#fragen-demo">
              Fragenprozess testen
            </a>
            <a className="btn ghost" href="#muster">
              Muster ansehen
            </a>
          </div>
          <p className="hint back-links">
            <a href="#fragen-demo">Fragen</a>
            {" · "}
            <a href="#muster">Muster</a>
            {" · "}
            <a href="#anfrage">Anfrage</a>
            {" · "}
            <Link href="/datenschutz">Datenschutz</Link>
            {" · "}
            <Link href="/impressum">Impressum</Link>
          </p>
          <p className="disclaimer">
            Keine Steuer- oder Rechtsberatung. Muster und Demo dienen der
            eigenen Bewertung durch die Kanzlei. Die Weiterempfehlung begründet
            keinen Auftrag zur Prüfung. Die Verfahrensdokumentation bleibt in
            der Verantwortung des Mandanten.
          </p>
        </section>
      </main>
      <div className="sticky-cta tall">
        <a className="btn" href="#anfrage">
          Anfrage senden
        </a>
        <a className="btn" href="#muster">
          Muster-Dokumentation ansehen
        </a>
      </div>
      <SiteFooter />
    </>
  );
}
