import type { Metadata } from "next";
import Link from "next/link";
import { CampaignLink } from "@/components/campaign-link";
import { HomeCtaLink, HomeViewBeacon } from "@/components/home-cta-link";
import { CrumbJsonLd, JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CATALOG_STEPS } from "@/lib/intake-catalog";
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { MUSTER_INDEX_PATH } from "@/lib/bereich-muster";
import { AMPEL_INTRO } from "@/lib/ampel-questions";
import {
  ALL_AREAS_DETAIL,
  ALL_AREAS_LINE,
  CTA_CHECK,
  CTA_CREATE,
  CTA_CREATE_WITH_PRICE,
  CTA_MUSTER,
  CTA_MUSTER_HERO,
  GELD_ZURUECK_HREF,
  GELD_ZURUECK_MICRO,
  HERO_FACTS_LINE,
  HERO_PRICE_BOX,
  PRICE_AFTER_MICRO,
  PRICE_CTA_SUFFIX,
  PRICE_FRAME_LINE,
  PRICE_INCLUSION_LINE,
  INTAKE_EFFORT_LINE,
  READINESS_EFFORT_NOTE,
  RESULT_PROMISE,
} from "@/lib/offer-copy";
import {
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  SETUP_GROSS_LABEL,
  TODAY_EUR,
  TODAY_GROSS_LABEL,
  V2_ENTRY_LABEL,
  V2_MEMBER_YEAR_LABEL,
} from "@/lib/pricing";
import {
  PLAN_B2B_NOTICE,
} from "@/lib/plan-copy";
import { isPricingV2 } from "@/lib/pricing-model";

/** Preismodell v2 (PRICING_MODEL=v2). Ohne Variable bleibt die Seite wie bisher. */
const V2 = isPricingV2();
/** Variante D2 (Philip 29.10.): Wortlaut Hero und #preise. */
const D2_HERO_HEADLINE = "Erst ausfüllen. Dann einmalig 99 € zahlen.";
const D2_HERO_SUBLINE =
  "Sie melden sich an und beantworten den Fragebogen kostenlos. Erst nach der letzten Frage zahlen Sie 99 € je Firma, dann wird Ihre Verfahrensdokumentation als PDF erstellt.";
const D2_HERO_STEPS = [
  { title: "Anmelden", text: "Login-Link per E-Mail" },
  { title: "Fragebogen", text: "kostenlos, in Etappen" },
  { title: "Einmalig 99 €", text: "erst vor der Erstellung" },
];
const D2_HERO_MICRO = "zzgl. 19 % USt · nur für Unternehmen · Keine Steuer- oder Rechtsberatung.";
const D2_FOOT =
  "Alle Preise netto zzgl. 19 % USt, nur für Unternehmen. Jede weitere Firma buchen Sie gesondert zum vollen Preis. Erstattung nur, wenn die Erstellung Ihrer Dokumentation fehlschlägt (Einzelheiten in den AGB). Keine Steuer- oder Rechtsberatung.";
/** Startseite: v3-Widerspruch „weitere Firmen dazubuchen“ durch D2-Wortlaut ersetzt. */
const HOME_AREAS_DETAIL = V2
  ? ALL_AREAS_DETAIL.replace(
      "weitere Firmen können Sie dazubuchen",
      "jede weitere Firma buchen Sie gesondert zum vollen Preis",
    )
  : ALL_AREAS_DETAIL;
const V2_HEADLINE = `${V2_ENTRY_LABEL} € einmalig · Jahrespaket optional ${V2_MEMBER_YEAR_LABEL} €/Jahr`;
import { HOME_CRUMBS, HOME_FAQ } from "@/lib/home-faq";
import { faqPageJsonLd, productOfferJsonLd } from "@/lib/jsonld";
import {
  HOME_DESCRIPTION,
  HOME_OPEN_GRAPH,
  HOME_TITLE,
  HOME_TWITTER,
  canonicalUrl,
} from "@/lib/seo";
import { TEIL_TITEL, moduleImTeil } from "@/lib/module/katalog";
import type { ModulTeil } from "@/lib/module/typen";
import {
  PARTNER_DEMO_PATH,
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_PATH,
  PARTNER_MUSTER_PDF_PATH,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  openGraph: HOME_OPEN_GRAPH,
  twitter: HOME_TWITTER,
};

const EXAMPLE_QUESTION_IDS = ["B01", "C01", "F01", "G02"];
const HOME_MODULE_PREFIX = "home-modul";
const TEILE: ModulTeil[] = [1, 2, 3, 4];
const AMPEL_HREF = "/ampel-check";
const AMPEL_HERO_HREF = "/ampel-check?src=hero&v=a";
const AMPEL_LABEL = "GoBD-Ampel";
const HERO_HEADLINE = "GoBD-Verfahrensdokumentation Schritt für Schritt online erstellen";
const HERO_SUBLINE =
  "Geführte Fragen statt leerer Vorlage: Sie erhalten einen PDF-Entwurf Ihrer Verfahrensdokumentation und eine Liste offener Punkte. Erst prüfen? Der kostenlose Ampel-Check zeigt in rund 2 Minuten mit 10 Ja/Nein-Fragen, ob die GoBD-Anforderungen bei Ihnen erfüllt sind und wo Sie nachbessern sollten.";
const HERO_PRIMARY = "Kostenlosen Ampel-Check starten";
const HERO_MICRO =
  "Selbsteinschätzung auf Basis Ihrer Angaben · Ergebnis mit Quellen, zusätzlich als PDF per E-Mail · Keine Steuer- oder Rechtsberatung.";
const HERO_DISCLAIMER =
  "Der Ampel-Check ist eine Selbsteinschätzung zur Orientierung. Er ersetzt keine Steuer- oder Rechtsberatung und bestätigt nicht, dass Ihre Buchführung ordnungsgemäß ist.";

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
  "Offener Punkt: Die technische Prüfung strukturierter E-Rechnungen ist noch nicht angegeben — bitte Praxis kurz beschreiben.",
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

function cleanInline(value: string): string {
  return value
    .replace(/[*_`]/g, "")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function clipSentence(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const cut = value.slice(0, maxChars);
  const lastSentence = cut.lastIndexOf(". ");
  const end = lastSentence > 80 ? lastSentence + 1 : cut.length;
  return `${cut.slice(0, end).trimEnd()} …`;
}

function excerptSections(markdown: string): { title: string; sections: { heading: string; text: string }[] } {
  const lines = markdown.replace(/```[\s\S]*?```/g, "\n").split("\n");
  let title = "";
  const sections: { heading: string; text: string }[] = [];
  let current: { heading: string; text: string } | null = null;
  const flush = () => {
    if (current?.text) sections.push(current);
  };
  for (const line of lines) {
    if (line.startsWith("# ")) {
      title = cleanInline(line.slice(2));
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      current = { heading: cleanInline(line.slice(3)), text: "" };
      continue;
    }
    if (line.startsWith("#") || !current) continue;
    const cleaned = cleanInline(line);
    if (!cleaned) continue;
    current.text = current.text ? `${current.text} ${cleaned}` : cleaned;
  }
  flush();
  return {
    title,
    sections: sections.slice(0, 2).map((section) => ({
      heading: section.heading,
      text: clipSentence(section.text, 360),
    })),
  };
}

function modulAnzahl(count: number): string {
  return count === 1 ? "1 Modul" : `${count} Module`;
}

function euro(amount: number): string {
  return `${amount}\u00A0€`;
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
  const excerpt = excerptChapter ? excerptSections(excerptChapter.body) : null;
  const questions = exampleQuestions();

  return (
    <div className={`${styles.page} kanzlei-home`}>
      <HomeViewBeacon />
      <link rel="canonical" href={canonicalUrl("/")} />
      <meta property="og:url" content={canonicalUrl("/")} />
      <CrumbJsonLd items={HOME_CRUMBS} />
      <JsonLd data={faqPageJsonLd(HOME_FAQ)} />
      <JsonLd data={productOfferJsonLd()} />
      <SiteHeader
        ctaHref="/checkout"
        ctaLabel={CTA_CREATE}
        links={[
          { href: "#muster", label: "Muster" },
          { href: "#bereiche", label: "Module" },
          { href: "#ablauf", label: "Ablauf" },
          { href: "#preise", label: "Preise" },
          { href: "/readiness", label: "3-Minuten-Check" },
        ]}
      />
      <main>
        {V2 ? (
        <section className={styles.hero}>
          <div className={`shell ${styles.heroInner}`}>
            <h1>{D2_HERO_HEADLINE}</h1>
            <p className={styles.lead}>{D2_HERO_SUBLINE}</p>
          </div>
          <div className={`shell ${styles.d2Steps}`}>
            {D2_HERO_STEPS.map((step, index) => (
              <div className={styles.d2Step} key={step.title}>
                <span className={styles.d2Num}>{index + 1}</span>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            ))}
          </div>
          <div className={`shell ${styles.heroInner}`}>
            <div className={styles.ctas}>
              <CampaignLink className="btn" cta="hero_checkout" href="/checkout">
                Kostenlos anmelden und starten
              </CampaignLink>
              <HomeCtaLink className={`btn ${styles.btnSec}`} cta="hero_muster" href="#muster">
                Muster ansehen
              </HomeCtaLink>
            </div>
            <p className={styles.micro}>{D2_HERO_MICRO}</p>
            <p className={styles.advisor}>
              Steuerberater oder Kanzlei?{" "}
              <Link className={styles.inlineLink} href="/steuerberater">
                Seite für Berater
              </Link>
            </p>
          </div>
        </section>
        ) : (
        <section className={styles.hero}>
          <div className={`shell ${styles.heroInner}`}>
            <p className={styles.eyebrow}>
              Geführte Fragen führen zu einem PDF-Entwurf und offenen Punkten.
            </p>
            <h1>{HERO_HEADLINE}</h1>
            <p className={styles.lead}>{HERO_SUBLINE}</p>
            <p className={styles.priceBanner}>
              {V2 ? (
                <>
                  <strong>{V2_HEADLINE}</strong>
                  <span>Alle 24 Module inklusive · {PLAN_B2B_NOTICE}</span>
                </>
              ) : (
                <>
                  <strong>
                    {euro(SETUP_EUR)} Einrichtung + {euro(MONTHLY_EUR)}/Monat
                  </strong>
                  <span>
                    Alle 24 Module inklusive · bis zu 5 Firmen · keine Jahresvorauszahlung · monatlich kündbar
                  </span>
                </>
              )}
              <span>{HERO_PRICE_BOX}</span>
            </p>
            <div className={styles.ctas}>
              <CampaignLink className="btn" cta="hero_ampel" href={AMPEL_HERO_HREF}>
                {HERO_PRIMARY}
              </CampaignLink>
              <CampaignLink className={`btn ${styles.btnSec}`} cta="hero_checkout" href="/checkout">
                {CTA_CREATE}
              </CampaignLink>
              <HomeCtaLink className={`btn ${styles.btnSec}`} cta="hero_muster" href="#muster">
                {CTA_MUSTER_HERO}
              </HomeCtaLink>
            </div>
            <p className={styles.micro}>{HERO_MICRO}</p>
            <p className={styles.guarantee}>
              <Link href={GELD_ZURUECK_HREF}>{GELD_ZURUECK_MICRO}</Link>
            </p>
            <ul className={styles.trust}>
              <li>Sichere Zahlung über Stripe</li>
              {V2 ? null : <li>Monatlich kündbar</li>}
            </ul>
            <p className={styles.advisor}>
              Steuerberater oder Kanzlei?{" "}
              <Link className={styles.inlineLink} href="/steuerberater">
                Seite für Berater
              </Link>
            </p>
          </div>
        </section>
        )}

        <p className={`shell ${styles.heroDisclaimer}`}>{HERO_DISCLAIMER}</p>

        <p className={`shell ${styles.factBar}`}>
          {V2
            ? "24 Module · Ampel-Check in ~2 Min · Muster-PDF ohne Anmeldung"
            : "24 Module · bis zu 5 Firmen · Ampel-Check in ~2 Min · Muster-PDF ohne Anmeldung"}
        </p>

        <section className={styles.section} id="muster">
          <div className="shell">
            <h2>So sieht das Ergebnis aus</h2>
            <p className={styles.sub}>{HERO_FACTS_LINE}</p>
            <div className={styles.grid3}>
              <article className={styles.card}>
                <h3>Muster-Dokumentation</h3>
                <p>
                  Ausschnitt einer Verfahrensdokumentation als PDF — Struktur,
                  Abschnitte, Versionierungshinweis.
                </p>
                <ol className={styles.cardList}>
                  {MUSTER_STRUCTURE.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ol>
                <a className={styles.cardLink} href={PARTNER_MUSTER_PDF_PATH}>
                  Muster-PDF öffnen
                </a>
              </article>

              <article className={styles.card} id="fragen">
                <h3>Beispielfragen</h3>
                <p>
                  Typische geführte Fragen zu Belegwegen, Systemen und
                  Verantwortlichen. Die Demo speichert keine Eingaben.
                </p>
                <ul className={styles.cardList}>
                  {questions.map((prompt) => (
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
                <Link className={styles.cardLink} href={PARTNER_DEMO_PATH}>
                  Beispielfragen ansehen
                </Link>
              </article>

              <article className={styles.card}>
                <h3>Beispiel offene Punkte</h3>
                <p>
                  So können Hinweise nach dem Durchlauf aussehen — was Sie noch
                  prüfen oder ergänzen sollten.
                </p>
                <ol className={styles.cardList}>
                  {EXAMPLE_OPEN_POINTS.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ol>
                <Link className={styles.cardLink} href={`${PARTNER_MUSTER_PATH}#offene-punkte`}>
                  Beispiel öffnen
                </Link>
              </article>
            </div>
            <p className={styles.note}>
              Unsicher? Schauen Sie zuerst Muster und Offene Punkte. Überzeugt? Starten Sie
              direkt mit der Dokumentation.
            </p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.alt}`} id="bereiche">
          <div className="shell">
            <div className={styles.intro}>
              <h2>24 Module für die komplette Verfahrensdokumentation</h2>
              <p>
                Der Maßstab: alle steuerrelevanten Prozesse von der Entstehung eines
                Geschäftsvorfalls bis zur Aufbewahrung und Prüfung. Ein Betriebs-Check
                ermittelt zu Beginn, welche Module bei Ihnen vorkommen. Firmendaten,
                Programme und Ansprechpartner geben Sie einmal an – wo möglich,
                füllen wir sie in den Themen vor. Vorhandene Bereiche werden nicht stillschweigend
                ausgelassen — sie tragen den Status „Im Tool beschreiben“, sind durch
                bestehende Dokumentation abgedeckt oder haben den Status „Später ausfüllen“.
              </p>
            </div>
            <div className={styles.modgrid}>
              {TEILE.map((teil) => {
                const eintraege = moduleImTeil(teil);
                return (
                  <div className={styles.part} key={teil}>
                    <h3>
                      {TEIL_TITEL[teil]} <small>{modulAnzahl(eintraege.length)}</small>
                    </h3>
                    <ol className={styles.mods}>
                      {eintraege.map((modul) => (
                        <li key={modul.id} id={`${HOME_MODULE_PREFIX}-${modul.id}`}>
                          <span className={styles.modNum}>
                            {String(modul.nr).padStart(2, "0")}
                          </span>
                          <div>
                            <strong>{modul.titel}</strong>
                            <p>{modul.kurz}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
            <p className={styles.note}>
              Muster-Gesamtdokumente (Dienstleister, Handel, E-Commerce, Gastronomie, Handwerk/Bau) und Fragebögen:{" "}
              <Link href={MUSTER_INDEX_PATH}>alle Muster im Überblick</Link>.
              {" "}
              Branchenseiten:{" "}
              <Link href="/verfahrensdokumentation-friseure">Verfahrensdokumentation für Friseure</Link>
              {" · "}
              <Link href="/verfahrensdokumentation-einzelhandel">Verfahrensdokumentation im Einzelhandel</Link>
              {" · "}
              <Link href="/verfahrensdokumentation-taxi">Taxi</Link>
              {" · "}
              <Link href="/verfahrensdokumentation-kiosk">Kiosk</Link>
              {" · "}
              <Link href="/verfahrensdokumentation-verein">Verein</Link>
              {" · "}
              <Link href="/verfahrensdokumentation-apotheke">Apotheke</Link>
              .
            </p>
            <p className={styles.fine}>
              <strong>{ALL_AREAS_LINE}</strong> {HOME_AREAS_DETAIL}
            </p>
          </div>
        </section>

        <section className={styles.section} id="ablauf">
          <div className={`shell ${styles.split}`}>
            <div>
              <h2>So läuft es ab</h2>
              <ol className={styles.steps} role="list">
                <li>
                  Sie starten mit dem Betriebs-Check und beantworten die Fragen zu
                  den für Sie aktiven Modulen.
                </li>
                <li>
                  Sie erhalten PDF + Liste offener Punkte — individuell aus Ihren
                  Angaben.
                </li>
                <li>
                  Sie prüfen und ergänzen vor der Verwendung; Abstimmung mit dem
                  Steuerberater bleibt bei Ihnen.
                </li>
                {V2 ? null : (
                  <li>
                    Weitere Module können Sie später im Konto ergänzen, ohne neue
                    Bestellung. Mit dem Abo bleiben Versionen und Anpassungen verfügbar.
                  </li>
                )}
              </ol>
              <p className={styles.fine}>{INTAKE_EFFORT_LINE}</p>
            </div>
            {excerpt && (excerpt.title || excerpt.sections.length > 0) ? (
              <figure className={styles.excerpt}>
                <figcaption className={styles.excerptCaption}>
                  Beispiel-Ausschnitt — Ihr Dokument entsteht aus Ihren Angaben.
                </figcaption>
                {excerpt.title || excerptChapter?.title ? (
                  <p className={styles.excerptTitle}>
                    {excerpt.title || excerptChapter?.title}
                  </p>
                ) : null}
                {excerpt.sections.map((section) => (
                  <div key={section.heading}>
                    <p className={styles.excerptSection}>{section.heading}</p>
                    <p>{section.text}</p>
                  </div>
                ))}
                <p className={styles.excerptHint}>
                  Beispiel GmbH (fiktiv), dieselbe Quelle wie das{" "}
                  <a href={PARTNER_MUSTER_PDF_PATH}>Muster-PDF</a>.
                </p>
              </figure>
            ) : null}
          </div>
        </section>

        <section className={`${styles.section} ${styles.alt}`} id="outcome">
          <div className="shell">
            <h2>Was Sie mitnehmen</h2>
            <ul className={styles.checks} role="list">
              <li>Individuelle Verfahrensdokumentation als PDF (aus Ihren Angaben)</li>
              <li>
                Ein Gesamtdokument mit allen aktiven Modulen, gemeinsamer
                Versionierung — 24 Module, alle inklusive
              </li>
              <li>Liste offener Punkte zum Prüfen und Ergänzen</li>
              <li>Geführter Frageprozess statt leerer Vorlage</li>
              {V2 ? (
                <li>
                  Versionierung und Speicherung mit dem Paket „Dauerhaft“ ({V2_MEMBER_YEAR_LABEL} €/Jahr
                  zzgl. USt)
                </li>
              ) : (
                <li>
                  Versionierung und Speicherung über das Abo ({MONTHLY_EUR} € netto,{" "}
                  {MONTHLY_GROSS_LABEL} € brutto pro Monat nach dem ersten Monat,
                  inkl. 19 % USt)
                </li>
              )}
            </ul>
          </div>
        </section>

        {V2 ? (
        <section className={`${styles.section} ${styles.d2Prices}`} id="preise">
          <div className="shell">
            <p className={styles.d2Kick}>Was Sie zahlen</p>
            <h2>Einmalig 99 €. Mehr nur, wenn Sie es wollen.</h2>
            <p className={styles.d2Intro}>
              Jedes Paket gilt für eine Firma und enthält alle 24 Module. Der Fragebogen ist kostenlos,
              Sie zahlen erst nach der letzten Frage.
            </p>
            <p className={styles.d2Decide}>
              <strong>Sie müssen sich jetzt nicht entscheiden:</strong> Die Wahl treffen Sie erst nach der
              letzten Frage, direkt vor der Erstellung. Keine Abo-Pflicht.
            </p>
            <div className={styles.d2Grid}>
              <article className={styles.d2Card}>
                <p className={styles.d2Tag}>Einmalig</p>
                <p className={styles.d2Price}>99 €</p>
                <p className={styles.d2Small}>einmalig je Firma · zzgl. USt (117,81 € brutto)</p>
                <ul>
                  <li>Ihre Verfahrensdokumentation als PDF mit Liste offener Punkte</li>
                  <li>30 Tage Dashboard: Angaben anpassen, PDF neu erstellen, Personen einladen</li>
                  <li>Keine Abo-Pflicht</li>
                </ul>
                <CampaignLink className="btn" cta="price_checkout" href="/checkout">
                  Einmalig starten
                </CampaignLink>
              </article>
              <article className={styles.d2Card}>
                <p className={styles.d2Tag}>Dauerhaft</p>
                <p className={styles.d2Price}>99 € + 49 €/Jahr</p>
                <p className={styles.d2Small}>je Firma · zzgl. USt (im ersten Jahr 148 €, brutto 176,12 €)</p>
                <ul>
                  <li>
                    <strong>
                      Lückenlose Dokumentation aller Änderungen und Anpassungen Ihrer
                      Verfahrensdokumentation, jede Version mit Datum
                    </strong>
                  </li>
                  <li>Alles aus „Einmalig“</li>
                  <li>Zugang zu Dashboard und PDFs, solange das Jahrespaket läuft</li>
                  <li>Änderungen jederzeit einpflegen und neue Version erstellen</li>
                  <li>Personen jederzeit einladen</li>
                  <li>Verlängert sich jährlich, kündbar laut AGB</li>
                </ul>
                <CampaignLink className="btn" cta="price_checkout" href="/checkout">
                  Dauerhaft starten
                </CampaignLink>
              </article>
            </div>
            <div className={styles.d2Diff}>
              <h3>Was ist der Unterschied?</h3>
              <p>
                Beide Pakete liefern dieselbe Verfahrensdokumentation als PDF mit allen für Sie relevanten
                Modulen. Der Unterschied ist, wie lange Sie danach Zugriff haben.
              </p>
              <ul>
                <li>
                  <strong>Einmalig:</strong> 30 Tage Zugang zum Dashboard. In dieser Zeit können Sie Angaben
                  anpassen, das PDF neu erstellen und Personen einladen. Danach ist der Zugang gesperrt, auch
                  der PDF-Download.
                </li>
                <li>
                  <strong>Dauerhaft:</strong> Ihr Zugang bleibt bestehen, solange das Jahrespaket läuft. Sie
                  können Angaben jederzeit ändern, neue Versionen erstellen und Personen einladen. Jede
                  Version wird mit Datum gespeichert, so sind alle Änderungen lückenlos dokumentiert. Die
                  Änderungen pflegen Sie selbst ein.
                </li>
              </ul>
              <p>
                <strong>Wann lohnt sich was?</strong> „Einmalig“ passt, wenn sich Ihre Abläufe selten ändern
                und Sie das PDF selbst ablegen. „Dauerhaft“ lohnt sich, wenn sich Software, Belegwege oder
                Zuständigkeiten in Ihrem Betrieb öfter ändern.
              </p>
            </div>
            <p className={styles.d2Foot}>{D2_FOOT}</p>
          </div>
        </section>
        ) : (
        <section className={styles.section} id="preise">
          <div className={`shell ${styles.priceLayout}`}>
            <div className={styles.priceBox}>
              <p className={styles.eyebrow}>Was Sie heute zahlen</p>
              {
                <>
              <h2>
                {euro(SETUP_EUR)} Einrichtung + {euro(MONTHLY_EUR)}/Monat
              </h2>
              <p>
                Alle 24 Module inklusive · bis zu 5 Firmen · keine Jahresvorauszahlung · monatlich kündbar
              </p>
              <p>
                <strong>Ein Abo umfasst bis zu 5 Firmen.</strong> {ALL_AREAS_LINE}
              </p>
              <table className={styles.priceTable}>
                <tbody>
                  <tr>
                    <th scope="row">Einrichtung</th>
                    <td>
                      {euro(SETUP_EUR)} netto ({SETUP_GROSS_LABEL}&nbsp;€ brutto)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Erster Monat</th>
                    <td>
                      {euro(MONTHLY_EUR)} netto ({MONTHLY_GROSS_LABEL}&nbsp;€ brutto)
                    </td>
                  </tr>
                  <tr className={styles.due}>
                    <th scope="row">Zum Start (Einrichtung + 1. Monat)</th>
                    <td>
                      {euro(TODAY_EUR)} zzgl. USt. ({TODAY_GROSS_LABEL}&nbsp;€ brutto)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Danach</th>
                    <td>
                      {euro(MONTHLY_EUR)} netto ({MONTHLY_GROSS_LABEL}&nbsp;€ brutto) pro Monat
                    </td>
                  </tr>
                </tbody>
              </table>
                </>
              }
              <div className={styles.ctas}>
                <div className={styles.priceCta}>
                  <CampaignLink className={`btn ${styles.btnOnDark}`} cta="price_checkout" href="/checkout">
                    {CTA_CREATE}
                  </CampaignLink>
                  <p className={styles.fine}>{PRICE_CTA_SUFFIX}</p>
                </div>
                <Link className={styles.textLink} href="#muster">
                  {CTA_MUSTER}
                </Link>
              </div>
              <p className={styles.fine}>
                {V2 ? `${PRICE_INCLUSION_LINE}.` : `${PRICE_INCLUSION_LINE} zum Ende des laufenden Abrechnungsmonats.`}
                Alle Preise netto, zuzüglich 19 % Umsatzsteuer. Die Beträge in
                Klammern sind brutto.
              </p>
            </div>
            <div className={styles.side}>
              <h3>Mit dem Abo</h3>
              <ul className={styles.checks} role="list">
                <li>Weitere Module derselben Firma ohne Aufpreis</li>
                <li>Versionierung Ihrer Dokumentation</li>
                <li>Zugang zu bisherigen Fassungen</li>
                <li>Anpassungen, wenn sich Systeme oder Abläufe ändern</li>
                <li>Erneute Exporte bei Bedarf</li>
              </ul>
              <p className={styles.prose}>{RESULT_PROMISE}</p>
              {PRICE_FRAME_LINE ? <p className={styles.fine}>{PRICE_FRAME_LINE}</p> : null}
              <p className={styles.fine}>
                <strong>{ALL_AREAS_LINE}</strong> {HOME_AREAS_DETAIL}
              </p>
            </div>
          </div>
        </section>
        )}

        <section className={`${styles.section} ${styles.alt}`} id="check">
          <div className={`shell ${styles.split}`}>
            <div>
              <h2>Noch unsicher, ob Sie starten wollen?</h2>
              <p className={styles.prose}>
                Machen Sie den kostenlosen 3-Minuten-Check. Sie sehen, welche Themen
                Ihre Dokumentation typischerweise abdecken sollte — und wo bei Ihnen
                noch Klärungsbedarf liegen kann. Kein Kaufzwang.
              </p>
            </div>
            <div>
              <p className={styles.prose}>
                Was Sie erhalten: kurze Einschätzung zu relevanten Themenfeldern und
                ein Hinweis auf nächste Schritte (Muster ansehen oder Dokumentation
                erstellen).
              </p>
              <p className={styles.fine}>{READINESS_EFFORT_NOTE}</p>
              <div className={styles.ctas}>
                <HomeCtaLink className="btn" cta="unsure_readiness" href="/readiness">
                  {CTA_CHECK}
                </HomeCtaLink>
              </div>
              <div className={styles.ampelBlock}>
                <h3>{AMPEL_LABEL}</h3>
                <p className={styles.prose}>{AMPEL_INTRO}</p>
                <div className={styles.ctas}>
                  <CampaignLink className={`btn ${styles.btnSec}`} cta="unsure_ampel" href={AMPEL_HREF}>
                    {AMPEL_LABEL}
                  </CampaignLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="faq">
          <div className={`shell ${styles.faqGrid}`}>
            <h2>Häufige Fragen</h2>
            <div className={styles.faqList}>
              {HOME_FAQ.map((item) => (
                <details key={item.question}>
                  <summary>
                    <h3>{item.question}</h3>
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.final} id="abschluss">
          <div className="shell">
            <h2>Bereit, Ihre Abläufe nachvollziehbar zu dokumentieren?</h2>
            <p>
              {V2 ? (
                `${V2_HEADLINE} · ${PLAN_B2B_NOTICE}`
              ) : (
                <>
                  {euro(SETUP_EUR)} Einrichtung + {euro(MONTHLY_EUR)}/Monat · Ein Abo umfasst bis zu 5 Firmen.
                </>
              )}
            </p>
            <div className={styles.ctas}>
              <div className={styles.priceCta}>
                <CampaignLink className={`btn ${styles.btnOnDark}`} cta="final_checkout" href="/checkout">
                  {CTA_CREATE_WITH_PRICE}
                </CampaignLink>
                <p className={styles.fine}>{PRICE_AFTER_MICRO}</p>
              </div>
              <CampaignLink className={`btn ${styles.btnSecOnDark}`} cta="final_ampel" href={AMPEL_HREF}>
                {AMPEL_LABEL}
              </CampaignLink>
              <Link className={styles.textLink} href="#muster">
                {CTA_MUSTER}
              </Link>
              <Link className={styles.textLink} href="/readiness">
                {CTA_CHECK}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <div className="sticky-cta">
        <CampaignLink className="btn" cta="sticky_checkout" href="/checkout">
          {CTA_CREATE}
        </CampaignLink>
      </div>
      <SiteFooter />
    </div>
  );
}
