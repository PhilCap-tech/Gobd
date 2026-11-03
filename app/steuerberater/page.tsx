import type { Metadata } from "next";
import Link from "next/link";
import { CrumbJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { CTA_DEMO, CTA_SAMPLE, PARTNER_EFFORT_LINE } from "@/lib/offer-copy";
import { V2_ENTRY_LABEL, V2_MEMBER_YEAR_LABEL } from "@/lib/pricing";
import { withOgImage } from "@/lib/seo";
import {
  PARTNER_DEMO_PATH,
  PARTNER_MUSTER_PATH,
  PARTNER_MUSTER_PDF_PATH,
} from "@/lib/partner-muster";
import styles from "../home.module.css";
import { MerkblattForm } from "./merkblatt-form";
import { PartnerInquiryForm } from "./partner-inquiry-form";

const PAGE_TITLE =
  "Für Steuerberater: kostenloser Kanzleizugang | GoBD Verfahrensdoku";
// Neutral (Philip 29.10.): keine Kanzlei-Preise, keine Konditionen, keine Provision.
const PAGE_DESCRIPTION =
  "Kostenloser Kanzleizugang: Ihr Mandant lädt die Kanzlei als Mitwirkende ein. Die Kanzlei sieht die freigegebenen Module und füllt offene Angaben aus. Mit Mandanten-Merkblatt als PDF. Keine Steuerberatung.";

export const metadata: Metadata = {
  metadataBase: new URL(LEGAL_OPERATOR.siteUrl),
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: "/steuerberater" },
  openGraph: withOgImage({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/steuerberater",
    locale: "de_DE",
    type: "website",
  }),
};

const PARTNER_MAIL = `mailto:${LEGAL_OPERATOR.email}?subject=${encodeURIComponent("Anfrage Kanzlei")}`;

const FAQ = [
  {
    q: "Was kostet der Kanzleizugang?",
    a: "Nichts. Der Mandant lädt die Kanzlei in seinem Konto als Mitwirkende ein. Für die Kanzlei entstehen dabei keine Kosten.",
  },
  {
    q: "Was kann die Kanzlei als Mitwirkende tun?",
    a: "Die Kanzlei sieht die Module, die der Mandant freigegeben hat, füllt dort offene Angaben aus und speichert Entwürfe. Die PDF-Fassung erzeugt der Mandant. Für Mitwirkende ist sie nicht lesbar.",
  },
  {
    q: "Was zahlen Mandanten?",
    a: "Mandanten bestellen eines der normalen Pakete über die öffentliche Seite. Die Pakete und Preise stehen auf der Startseite unter „Preise“.",
  },
  {
    q: "Ist das Steuerberatung?",
    a: "Nein. Keine Steuerberatung. Das Produkt ersetzt keine steuerliche Beratung und keine Prüfung durch die Kanzlei.",
  },
  {
    q: "Muss die Kanzlei die Dokumentation für den Mandanten ausfüllen?",
    a: "Nein. Sie füllen die Dokumentation nicht für den Mandanten aus. Der Mandant liefert die Betriebsdaten.",
  },
  {
    q: "Kann ich das Muster ohne Bestellung ansehen?",
    a: "Ja. Das Muster-PDF und die Fragen-Demo sind Beispiele. Sie speichern keine Eingaben und lösen keine Bestellung aus.",
  },
] as const;

export default function SteuerberaterPage() {
  return (
    <div className={`${styles.page} kanzlei-home`}>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "Für Steuerberater", path: "/steuerberater" },
        ]}
      />
      <SiteHeader
        ctaHref="#anfrage"
        ctaLabel="Anfrage"
        links={[
          { href: "#muster", label: "Muster" },
          { href: "#modell", label: "Kanzleizugang" },
          { href: "#ablauf", label: "Ablauf" },
        ]}
      />
      <main>
        <section className={styles.hero}>
          <div className={`shell ${styles.heroInner}`}>
            <p className={styles.eyebrow}>Für Steuerberater und Kanzleien</p>
            <h1>Kostenloser Kanzleizugang</h1>
            <p className={styles.lead}>
              Ihr Mandant lädt die Kanzlei in seinem Konto als Mitwirkende ein. Die
              Kanzlei sieht die freigegebenen Module und füllt dort offene Angaben aus.
              Die PDF-Fassung erzeugt der Mandant.
            </p>
            <div className={styles.ctas}>
              <a className="btn" href={PARTNER_MUSTER_PDF_PATH}>
                {CTA_SAMPLE}
              </a>
              <Link className={`btn ${styles.btnSec}`} href={PARTNER_DEMO_PATH}>
                {CTA_DEMO}
              </Link>
            </div>
            <p className={styles.advisor}>
              <a className={styles.inlineLink} href="#merkblatt">
                Mandanten-Merkblatt
              </a>
            </p>
            <ul className={styles.trust}>
              <li>Keine Steuerberatung</li>
              <li>Kanzleizugang ohne Kosten</li>
              <li>Muster-PDF ohne Anmeldung</li>
            </ul>
          </div>
        </section>

        <p className={`shell ${styles.factBar}`}>
          Einladung durch den Mandanten · freigegebene Module ausfüllen · Muster-PDF ohne
          Anmeldung
        </p>

        {/* Reihenfolge (Philip 02.11.): Ergebnis ansehen → Fragenprozess prüfen → Zusammenarbeit verstehen → Merkblatt/Kontakt. */}
        <section className={styles.section} id="muster">
          <div className="shell">
            <div className={styles.reviewGrid}>
              <article className={styles.card}>
                <h3>Muster ansehen</h3>
                <p>
                  Das Muster-PDF stammt aus festen Beispieldaten einer fiktiven
                  GmbH. Es speichert nichts und ist keine Freigabe.
                </p>
                <a className={styles.cardLink} href={PARTNER_MUSTER_PDF_PATH}>
                  {CTA_SAMPLE}
                </a>
                <Link className={styles.cardLink} href={PARTNER_MUSTER_PATH}>
                  Musterseite mit den Beispieldaten
                </Link>
              </article>
              <article className={styles.card} id="demo">
                <h3>Fragenprozess prüfen</h3>
                <p>Die Demo speichert keine Eingaben.</p>
                <Link className={styles.cardLink} href={PARTNER_DEMO_PATH}>
                  {CTA_DEMO}
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.alt}`} id="modell">
          <div className={`shell ${styles.split}`}>
            <div>
              <h2>Was der Kanzleizugang umfasst</h2>
              <p className={styles.sub}>Der Mandant lädt ein. Die Kanzlei braucht kein eigenes Paket.</p>
              <ol className={styles.steps} role="list">
                <li>
                  <strong>Einladung als Mitwirkende.</strong> Der Mandant lädt die Kanzlei im Konto unter „Mitwirkende“ per E-Mail
                  ein und wählt alle aktiven Module oder einzelne Module. Höchstens fünf
                  aktive Personen je Firma.
                </li>
                <li>
                  <strong>Offene Angaben ausfüllen.</strong> Die Kanzlei sieht die freigegebenen Module, füllt offene Angaben aus
                  und speichert Entwürfe. Die PDF-Fassung erzeugt der Mandant. Für
                  Mitwirkende ist sie nicht lesbar.
                </li>
              </ol>
              <p className={styles.note}>
                Keine Steuerberatung. Das Produkt ersetzt keine steuerliche Beratung.
                Sie füllen die Dokumentation nicht für den Mandanten aus.
              </p>
            </div>
            <div id="ablauf">
              <h2>So läuft es ab</h2>
              <ol className={styles.steps} role="list">
                <li>Der Mandant beantwortet die Fragen im Fragebogen.</li>
                <li>Der Mandant wählt ein Paket und bezahlt.</li>
                <li>
                  Der Mandant lädt die Kanzlei im Konto unter „Mitwirkende“ ein. Die
                  Kanzlei füllt offene Angaben in den freigegebenen Modulen aus.
                </li>
                <li>Der Mandant erzeugt das PDF.</li>
              </ol>
              <p className={styles.fine}>{PARTNER_EFFORT_LINE}</p>
              <p className={styles.prose} id="preise">
                <strong>Was Mandanten zahlen:</strong> {V2_ENTRY_LABEL}&nbsp;€ einmalig bzw.{" "}
                {V2_ENTRY_LABEL}&nbsp;€ + {V2_MEMBER_YEAR_LABEL}&nbsp;€/Jahr zzgl. USt.{" "}
                <Link className={styles.inlineLink} href="/#preise">
                  Vergleich der Pakete
                </Link>
              </p>
              <aside className={styles.scopeBox} aria-labelledby="leistungsumfang">
                <h3 id="leistungsumfang">Leistungsumfang und Verantwortung</h3>
                <p>
                  Keine Steuerberatung und keine Rechtsberatung. Keine Zusage, dass
                  eine Dokumentation einer Prüfung standhält. Die Verantwortung für
                  die Angaben bleibt beim Mandanten.
                </p>
              </aside>
            </div>
          </div>
        </section>

        <section className={styles.section} id="merkblatt">
          <div className="shell">
            <MerkblattForm />
          </div>
        </section>

        <section className={`${styles.section} ${styles.alt}`} id="anfrage">
          <div className={`shell ${styles.split} ${styles.inquiry}`}>
            <div>
              <h2>Anfrage</h2>
              <p className={styles.prose}>
                Schreiben Sie uns, wenn Sie Fragen zum Kanzleizugang haben. Die Anfrage
                ist unverbindlich.
              </p>
              <p className={styles.fine}>
                <a href={PARTNER_MAIL}>
                  {LEGAL_OPERATOR.email} mit dem Betreff „Anfrage Kanzlei“
                </a>
              </p>
            </div>
            <PartnerInquiryForm />
          </div>
        </section>

        <section className={styles.section} id="faq">
          <div className={`shell ${styles.faqGrid}`}>
            <h2>Häufige Fragen</h2>
            <div className={styles.faqList}>
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>
                    <h3>{item.q}</h3>
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.final} id="abschluss">
          <div className="shell">
            <h2>Kostenloser Kanzleizugang</h2>
            <p>
              Der Mandant lädt die Kanzlei als Mitwirkende ein. Mandanten bestellen die
              normalen Pakete. Keine Steuerberatung.
            </p>
            <div className={styles.ctas}>
              <a className={`btn ${styles.btnOnDark}`} href={PARTNER_MUSTER_PDF_PATH}>
                {CTA_SAMPLE}
              </a>
              <a className={styles.textLink} href="#anfrage">
                Anfrage
              </a>
            </div>
          </div>
        </section>
      </main>
      <div className="sticky-cta">
        <a className="btn" href="#anfrage">
          Anfrage
        </a>
      </div>
      <SiteFooter />
    </div>
  );
}
