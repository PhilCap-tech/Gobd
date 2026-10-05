import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CATALOG_STEPS } from "@/lib/intake-catalog";
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { MODULE, TEIL_TITEL } from "@/lib/module/katalog";
import { MUSTER_INDEX_PATH } from "@/lib/bereich-muster";
import {
  ALL_AREAS_DETAIL,
  ALL_AREAS_LINE,
  CTA_CHECK,
  CTA_CHECK_HERO,
  CTA_CREATE,
  CTA_CREATE_WITH_PRICE,
  CTA_MUSTER,
  CTA_MUSTER_HERO,
  DISCLAIMER_ONCE,
  GELD_ZURUECK_HREF,
  GELD_ZURUECK_MICRO,
  HERO_OUTCOME_LINE,
  PRICE_FRAME_LINE,
  PRICE_MICRO,
  RESULT_PROMISE,
} from "@/lib/offer-copy";
import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "@/lib/pricing";
import { canonicalUrl } from "@/lib/seo";
import {
  PARTNER_DEMO_PATH,
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_PATH,
  PARTNER_MUSTER_PDF_PATH,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl("/") },
};

const EXAMPLE_QUESTION_IDS = ["B01", "C01", "F01", "G02"];

const MUSTER_STRUCTURE = [
  "Dokumentenlenkung",
  "Zweck, Geltungsbereich und Verantwortung",
  "Unternehmen, Rollen und Aufgaben",
  "Systemlandschaft und Datenfluss",
  "Belegarten und Eingangskanäle",
];

const EXAMPLE_OPEN_POINTS = [
  "Offener Punkt: Wer verwaltet die Zugriffsrechte im Archiv? Bitte Verantwortliche benennen.",
  "Offener Punkt: Die Berechtigungsliste und der Mandatsumfang der Steuerkanzlei sind noch nicht als mitgeltende Unterlagen abgelegt.",
  "Offener Punkt: IT- und Systemverantwortung (Backup, Rechteverwaltung) sind nicht benannt.",
  "Offener Punkt: Die technische Prüfung strukturierter E-Rechnungen ist noch nicht bestätigt — bitte Praxis kurz beschreiben.",
];

function exampleQuestions(): string[] {
  const byId = new Map(
    CATALOG_STEPS.flatMap((step) =>
      step.questions.map((question) => [question.id, question.prompt] as const),
    ),
  );
  return EXAMPLE_QUESTION_IDS.flatMap((id) => {
    const prompt = byId.get(id);
    return prompt ? [prompt] : [];
  });
}

function plainExcerpt(markdown: string, maxChars = 520): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s+.*(?:\n+|$)/, "")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxChars) return plain;
  const cut = plain.slice(0, maxChars);
  const lastSentence = cut.lastIndexOf(". ");
  const end = lastSentence > 240 ? lastSentence + 1 : cut.length;
  return `${cut.slice(0, end).trimEnd()} …`;
}

function PriceLine({
  guarantee = "short",
}: {
  guarantee?: "short" | "bedingungen" | "none";
}) {
  return (
    <p className="trust-line">
      {PRICE_MICRO}
      {guarantee === "none" ? null : (
        <>
          {" · "}
          <Link href={GELD_ZURUECK_HREF}>{GELD_ZURUECK_MICRO}</Link>
        </>
      )}
    </p>
  );
}

export default function HomePage() {
  const sample = renderDeliveryDocument({
    identity: PARTNER_MUSTER_IDENTITY,
    answers: PARTNER_MUSTER_ANSWERS,
    documentId: PARTNER_MUSTER_DOCUMENT_ID,
    version: 1,
    versionMeta: PARTNER_MUSTER_VERSION_META,
  });
  const excerptChapter =
    sample.chapters.find((chapter) => chapter.id === "01-zweck-geltung") ??
    sample.chapters[0];
  const questions = exampleQuestions();

  return (
    <>
      <SiteHeader
        ctaHref="/checkout"
        ctaLabel={CTA_CREATE}
        ctaNote={PRICE_MICRO}
        links={[
          { href: "#muster", label: "Muster" },
          { href: "#bereiche", label: "Module" },
          { href: "#ablauf", label: "Ablauf" },
          { href: "#preise", label: "Preise" },
          { href: "/readiness", label: "3-Minuten-Check" },
        ]}
      />
      <main className="home-wrap">
        <section className="hero">
          <p className="hook">Buchhaltungsabläufe nachvollziehbar dokumentieren</p>
          <h1>GoBD-Verfahrensdokumentation online erstellen</h1>
          <p className="outcome-line">{HERO_OUTCOME_LINE}</p>
          <p className="lead">
            Geführte Fragen zu deinen Abläufen. {RESULT_PROMISE} Schritt für
            Schritt online erstellen.
          </p>
          <div className="cta-stack">
            <div className="hero-cta-row">
              <div className="cta-paid">
                <Link className="btn" href="/checkout">
                  {CTA_CREATE}
                </Link>
                <PriceLine />
              </div>
            </div>
            <div className="hero-secondary">
              <Link className="btn ghost" href="/readiness">
                {CTA_CHECK_HERO}
              </Link>
              <Link className="btn ghost" href="#muster">
                {CTA_MUSTER_HERO}
              </Link>
            </div>
          </div>
          <p className="advisor-note">
            Steuerberater oder Kanzlei? →{" "}
            <Link href="/steuerberater">Seite für Berater</Link>
          </p>
          <p className="disclaimer" role="note">
            {DISCLAIMER_ONCE}
          </p>
        </section>

        <section className="block" id="muster">
          <h2>So sieht das Ergebnis aus</h2>
          <div className="proof-grid">
            <article className="proof-card">
              <h3>Muster-Dokumentation</h3>
              <p className="prose">
                Ausschnitt einer Verfahrensdokumentation als PDF — Struktur,
                Abschnitte, Versionierungshinweis.
              </p>
              <ol className="prose-list">
                {MUSTER_STRUCTURE.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ol>
              <a className="btn" href={PARTNER_MUSTER_PDF_PATH}>
                Muster-PDF öffnen
              </a>
            </article>

            <article className="proof-card" id="fragen">
              <h3>Beispielfragen</h3>
              <p className="prose">
                Typische geführte Fragen zu Belegwegen, Systemen und
                Verantwortlichen. Die Demo speichert keine Eingaben.
              </p>
              <ul className="prose-list">
                {questions.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
              <Link className="btn ghost" href={PARTNER_DEMO_PATH}>
                Beispielfragen ansehen
              </Link>
            </article>

            <article className="proof-card">
              <h3>Beispiel offene Punkte</h3>
              <p className="prose">
                So können Hinweise nach dem Durchlauf aussehen — was du noch
                prüfen oder ergänzen solltest.
              </p>
              <ol className="prose-list">
                {EXAMPLE_OPEN_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ol>
              <Link className="btn ghost" href={`${PARTNER_MUSTER_PATH}#offene-punkte`}>
                Beispiel öffnen
              </Link>
            </article>
          </div>
          <p className="prose framing">
            Unsicher? Schau zuerst Muster und Offene Punkte. Überzeugt? Starte
            direkt mit der Dokumentation.
          </p>
        </section>

        <section className="block" id="bereiche">
          <h2>24 Module für die komplette Verfahrensdokumentation</h2>
          <p className="prose">
            Der Maßstab: alle steuerrelevanten Prozesse von der Entstehung eines
            Geschäftsvorfalls bis zur Aufbewahrung und Prüfung. Ein Betriebs-Check
            ermittelt zu Beginn, welche Module bei dir vorkommen. Systeme und
            Verantwortliche gibst du einmal an; sie werden in alle Module
            übernommen. Vorhandene Bereiche werden nicht stillschweigend
            ausgelassen — sie sind im Tool beschrieben, durch bestehende
            Dokumentation abgedeckt oder als offener Punkt ausgewiesen.
          </p>
          <div className="bereich-grid muster-grid">
            {([1, 2, 3, 4] as const).map((teil) => (
              <div key={teil}>
                <h3>{TEIL_TITEL[teil]}</h3>
                <ul>
                  {MODULE.filter((modul) => modul.teil === teil).map((modul) => (
                    <li key={modul.id}>
                      <strong>
                        {modul.nr}. {modul.titel}
                      </strong>
                      <span>{modul.kurz}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="hint">
            Muster-Gesamtdokumente (Dienstleister, Handel, E-Commerce, Gastronomie, Handwerk/Bau) und Fragebögen:{" "}
            <Link href={MUSTER_INDEX_PATH}>alle Muster im Überblick</Link>.
            Bisherige Bereichs-Muster leiten auf die passenden Module weiter.
          </p>
          <p className="price-frame">
            <strong>{ALL_AREAS_LINE}</strong> {ALL_AREAS_DETAIL}
          </p>
        </section>

        <section className="block" id="ablauf">
          <h2>So läuft’s ab</h2>
          <ol className="prose-list">
            <li>
              Du startest mit dem Betriebs-Check und beantwortest die Fragen zu
              den für dich aktiven Modulen.
            </li>
            <li>
              Du erhältst PDF + Liste offener Punkte — individuell aus deinen
              Angaben.
            </li>
            <li>
              Du prüfst und ergänzt vor der Verwendung; Abstimmung mit dem
              Steuerberater bleibt bei dir.
            </li>
            <li>
              Weitere Module kannst du später im Konto ergänzen, ohne neue
              Bestellung. Mit dem Abo bleiben Versionen und Anpassungen verfügbar.
            </li>
          </ol>
          {excerptChapter ? (
            <figure className="doc-excerpt">
              <figcaption>
                Beispiel-Ausschnitt — dein Dokument entsteht aus deinen Angaben.
              </figcaption>
              <blockquote>
                <p className="prose">
                  <strong>{excerptChapter.title}</strong>
                </p>
                <p className="prose">{plainExcerpt(excerptChapter.body)}</p>
              </blockquote>
              <p className="hint">
                Beispiel GmbH (fiktiv), dieselbe Quelle wie das{" "}
                <a href={PARTNER_MUSTER_PDF_PATH}>Muster-PDF</a>.
              </p>
            </figure>
          ) : null}
        </section>

        <section className="block" id="outcome">
          <h2>Was du mitnimmst</h2>
          <ul className="prose-list">
            <li>Individuelle Verfahrensdokumentation als PDF (aus deinen Angaben)</li>
            <li>
              Ein Gesamtdokument mit allen aktiven Modulen, gemeinsamer
              Versionierung — 24 Module, alle inklusive
            </li>
            <li>Liste offener Punkte zum Prüfen und Ergänzen</li>
            <li>Geführter Frageprozess statt leerer Vorlage</li>
            <li>
              Versionierung und Speicherung über das Abo ({MONTHLY_EUR} € zzgl.
              USt pro Monat nach dem ersten Monat)
            </li>
          </ul>
        </section>

        <section className="block" id="preise">
          <h2>Was du heute zahlst</h2>
          <div className="price-split">
            <table className="price-table">
              <tbody>
                <tr>
                  <th scope="row">Einrichtung</th>
                  <td>{SETUP_EUR}&nbsp;€ zzgl. USt</td>
                </tr>
                <tr>
                  <th scope="row">Erster Monat</th>
                  <td>{MONTHLY_EUR}&nbsp;€ zzgl. USt</td>
                </tr>
                <tr>
                  <th scope="row">Heute fällig</th>
                  <td>{TODAY_EUR}&nbsp;€ zzgl. USt</td>
                </tr>
                <tr>
                  <th scope="row">Danach</th>
                  <td>{MONTHLY_EUR}&nbsp;€ zzgl. USt pro Monat</td>
                </tr>
              </tbody>
            </table>
            <p className="prose">
              <strong>{ALL_AREAS_LINE}</strong> {ALL_AREAS_DETAIL}
            </p>
            <p className="hint">
              Alle Preise zzgl. USt. Monatlich kündbar zum Ende des laufenden
              Abrechnungsmonats.
            </p>
            <p className="prose">{RESULT_PROMISE}</p>
          </div>
          <p className="price-frame">{PRICE_FRAME_LINE}</p>
          <h3>Mit dem Abo</h3>
          <ul className="prose-list">
            <li>Weitere Module derselben Firma ohne Aufpreis</li>
            <li>Versionierung deiner Dokumentation</li>
            <li>Zugang zu bisherigen Fassungen</li>
            <li>Anpassungen, wenn sich Systeme oder Abläufe ändern</li>
            <li>Erneute Exporte bei Bedarf</li>
          </ul>
          <div className="cta-stack">
            <div className="cta-paid">
              <Link className="btn" href="/checkout">
                {CTA_CREATE_WITH_PRICE}
              </Link>
              <p className="trust-line">
                <Link href={GELD_ZURUECK_HREF}>{GELD_ZURUECK_MICRO}</Link>
              </p>
            </div>
            <Link className="btn ghost" href="#muster">
              {CTA_MUSTER}
            </Link>
          </div>
        </section>

        <section className="block" id="check">
          <h2>Noch unsicher, ob du starten willst?</h2>
          <p className="prose">
            Mach den kostenlosen 3-Minuten-Check. Du siehst, welche Themen
            deine Dokumentation typischerweise abdecken sollte — und wo bei dir
            noch Klärungsbedarf liegen kann. Kein Kaufzwang.
          </p>
          <p className="prose">
            Was rauskommt: kurze Einschätzung zu relevanten Themenfeldern und
            ein Hinweis auf nächste Schritte (Muster ansehen oder Dokumentation
            erstellen).
          </p>
          <Link className="btn ghost" href="/readiness">
            {CTA_CHECK}
          </Link>
        </section>

        <section className="block" id="faq">
          <h2>Häufige Fragen</h2>
          <div className="faq-item">
            <h3>Brauch ich eine Verfahrensdokumentation?</h3>
            <p className="prose">
              Die GoBD erwarten eine nachvollziehbare Verfahrensdokumentation.
              Viele Betriebe schieben sie auf, weil Vorlagen leer bleiben. Ein
              geführter Entwurf schafft einen greifbaren Stand.
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das fertig / reicht das für die Prüfung?</h3>
            <p className="prose">
              Nein — du erhältst PDF und offene Punkte aus deinen Angaben. Du
              prüfst und ergänzt vor der Verwendung. Die fachliche Prüfung
              bleibt bei dir bzw. deinem Steuerberater.
            </p>
          </div>
          <div className="faq-item">
            <h3>Reicht ein einmaliges PDF?</h3>
            <p className="prose">
              Für den Moment vielleicht — bis sich Software, Belegwege oder
              Verantwortliche ändern. Das Abo hält Versionen und Updates
              verfügbar.
            </p>
          </div>
          <div className="faq-item">
            <h3>Deckt das auch Kasse, Warenwirtschaft oder Lohn ab?</h3>
            <p className="prose">
              Ja. Neben dem Belegfluss kannst du Kasse, Warenwirtschaft,
              Einkauf, Verkauf, Retouren, Zeiterfassung, Lohn, E-Commerce,
              Bank, Anlagen und weitere Vorsysteme jeweils als eigene
              Verfahrensdokumentation anlegen. {ALL_AREAS_LINE}
            </p>
          </div>
          <div className="faq-item">
            <h3>Ist das Steuerberatung?</h3>
            <p className="prose">Nein. Wir leisten keine Steuerberatung.</p>
          </div>
        </section>

        <section className="block" id="abschluss">
          <h2>Bereit, deine Abläufe nachvollziehbar zu dokumentieren?</h2>
          <div className="cta-stack">
            <Link className="btn" href="/checkout">
              {CTA_CREATE_WITH_PRICE}
            </Link>
            <Link className="btn ghost" href="#muster">
              {CTA_MUSTER}
            </Link>
            <Link className="text-cta" href="/readiness">
              {CTA_CHECK}
            </Link>
            <p className="trust-line">
              <Link href={GELD_ZURUECK_HREF}>{GELD_ZURUECK_MICRO}</Link>
              {" · "}
              Keine Steuerberatung
            </p>
          </div>
        </section>
      </main>
      <div className="sticky-cta tall">
        <Link className="btn" href="/checkout">
          {CTA_CREATE}
        </Link>
        <PriceLine />
      </div>
      <SiteFooter />
    </>
  );
}
