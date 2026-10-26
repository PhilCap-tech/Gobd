import type { Metadata } from "next";
import Link from "next/link";
import { CrumbJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { ALL_AREAS_LINE, PARTNER_EFFORT_LINE } from "@/lib/offer-copy";
import { withOgImage } from "@/lib/seo";
import {
  PARTNER_DEMO_PATH,
  PARTNER_MUSTER_PATH,
  PARTNER_MUSTER_PDF_PATH,
} from "@/lib/partner-muster";
import {
  KANZLEI_MONTHLY_EUR,
  KANZLEI_MONTHLY_GROSS_LABEL,
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  SETUP_GROSS_LABEL,
  V2_ENTRY_CENTS,
  V2_MEMBER_YEAR_CENTS,
  netWithGrossCents,
} from "@/lib/pricing";
import { isPricingV2 } from "@/lib/pricing-model";
import { CUSTOMER_PRICE_SHORT } from "@/lib/offer-copy";
import styles from "../home.module.css";
import { MerkblattForm } from "./merkblatt-form";
import { PartnerInquiryForm } from "./partner-inquiry-form";

const PAGE_TITLE =
  "Für Steuerberater: Logo im Mandanten-PDF, auf Anfrage | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Kanzleien zahlen 49 € netto pro Monat auf Anfrage für das Logo im PDF der Mandanten und eine Übersicht der Mandanten, die zugestimmt haben. Keine Provision. Mandanten zahlen den Listenpreis direkt an die IKAT GmbH. Keine Steuerberatung.";

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

const PARTNER_MAIL = `mailto:${LEGAL_OPERATOR.email}?subject=${encodeURIComponent("Partneranfrage Kanzlei")}`;

const FAQ = [
  {
    q: "Was zahlt die Kanzlei?",
    a: `${KANZLEI_MONTHLY_EUR} € netto pro Monat (${KANZLEI_MONTHLY_GROSS_LABEL} € brutto, inkl. 19 % USt), auf Anfrage. Darin liegen das Logo der Kanzlei im PDF der Mandanten und eine Übersicht der Mandanten, die der Weitergabe zugestimmt haben. Ein Bereich zum Hochladen des Logos oder zum Abruf der Übersicht ist hier nicht eingerichtet.`,
  },
  {
    q: "Erhält die Kanzlei eine Provision?",
    a: "Nein. Die Kanzlei erhält keine Provision. Mandanten zahlen den Listenpreis direkt an die IKAT GmbH.",
  },
  {
    q: "Was zahlen Mandanten?",
    a: isPricingV2()
      ? `Einstieg ${netWithGrossCents(V2_ENTRY_CENTS)}, optional Jahresmitgliedschaft ${netWithGrossCents(V2_MEMBER_YEAR_CENTS)} pro Jahr. Die Bestellung läuft über die öffentliche Seite, nicht über diese Partnerschaft.`
      : `${SETUP_EUR} € netto Einrichtung (${SETUP_GROSS_LABEL} € brutto) plus ${MONTHLY_EUR} € netto pro Monat (${MONTHLY_GROSS_LABEL} € brutto). Ein Abo umfasst bis zu ${MAX_ENTITIES_PER_ACCOUNT} Firmen. Die Bestellung läuft über die öffentliche Seite, nicht über diese Partnerschaft.`,
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

function euro(amount: number): string {
  return `${amount}\u00A0€`;
}

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
        ctaLabel="Partneranfrage"
        links={[
          { href: "#modell", label: "Modell" },
          { href: "#muster", label: "Muster" },
          { href: "#ablauf", label: "Ablauf" },
          { href: "#anfrage", label: "Anfrage" },
        ]}
      />
      <main>
        <section className={styles.hero}>
          <div className={`shell ${styles.heroInner}`}>
            <p className={styles.eyebrow}>Für Steuerberater und Kanzleien</p>
            <h1>Logo der Kanzlei im PDF der Mandanten</h1>
            <p className={styles.lead}>
              Die Kanzlei zahlt {euro(KANZLEI_MONTHLY_EUR)} netto pro Monat, auf Anfrage.
              Dafür erscheint das Logo im PDF der Mandanten, und die Kanzlei erhält
              eine Übersicht der Mandanten, die der Weitergabe zugestimmt haben.
              Mandanten zahlen den Listenpreis direkt an die {LEGAL_OPERATOR.name}.
              Die Kanzlei erhält keine Provision.
            </p>
            <p className={styles.priceBanner}>
              <strong>{euro(KANZLEI_MONTHLY_EUR)} netto / Monat für die Kanzlei</strong>
              <span>
                Auf Anfrage · keine Provision · Mandanten:{" "}
                {isPricingV2() ? (
                  CUSTOMER_PRICE_SHORT
                ) : (
                  <>
                    {euro(SETUP_EUR)} Einrichtung + {euro(MONTHLY_EUR)}/Monat
                  </>
                )}{" "}
                direkt an die {LEGAL_OPERATOR.name}
              </span>
            </p>
            <div className={styles.ctas}>
              <a className="btn" href="#anfrage">
                Partneranfrage
              </a>
              <a className={`btn ${styles.btnSec}`} href={PARTNER_MUSTER_PDF_PATH}>
                Muster-PDF öffnen
              </a>
              <Link className={`btn ${styles.btnSec}`} href={PARTNER_DEMO_PATH}>
                Fragen ansehen
              </Link>
            </div>
            <ul className={styles.trust}>
              <li>Keine Steuerberatung</li>
              <li>Keine Provision</li>
              <li>Kein Bestellweg für die Kanzlei auf dieser Seite</li>
            </ul>
          </div>
        </section>

        <p className={`shell ${styles.factBar}`}>
          Logo im Mandanten-PDF · Übersicht nur bei Zustimmung · keine Provision ·
          Muster-PDF ohne Anmeldung
        </p>

        <section className={styles.section} id="modell">
          <div className="shell">
            <h2>Was die Partnerschaft umfasst</h2>
            <p className={styles.sub}>Auf Anfrage. Kein Selbstbedienungsbereich.</p>
            <div className={styles.grid3}>
              <article className={styles.card}>
                <h3>Logo im PDF</h3>
                <p>
                  Das Logo der Kanzlei erscheint im PDF der Mandanten. Den Upload
                  richten wir auf Anfrage ein. Ein Formular dafür gibt es auf
                  dieser Seite nicht.
                </p>
              </article>
              <article className={styles.card}>
                <h3>Übersicht der Mandanten</h3>
                <p>
                  Die Übersicht zeigt nur Mandanten, die der Weitergabe zugestimmt
                  haben. Sie sehen Mandantendaten nicht automatisch. Der Abruf ist
                  auf Anfrage, nicht als Kontofunktion.
                </p>
              </article>
              <article className={styles.card} id="muster">
                <h3>Muster ansehen</h3>
                <p>
                  Das Muster-PDF stammt aus festen Beispieldaten einer fiktiven
                  GmbH. Es speichert nichts und ist keine Freigabe.
                </p>
                <a className={styles.cardLink} href={PARTNER_MUSTER_PDF_PATH}>
                  Muster-PDF herunterladen
                </a>
                <Link className={styles.cardLink} href={PARTNER_MUSTER_PATH}>
                  Musterseite mit den Beispieldaten
                </Link>
              </article>
            </div>
            <p className={styles.note}>
              Keine Steuerberatung. Das Produkt ersetzt keine steuerliche Beratung.
              Sie füllen die Dokumentation nicht für den Mandanten aus.
            </p>
          </div>
        </section>

        <section className={styles.section} id="merkblatt">
          <div className="shell">
            <MerkblattForm />
          </div>
        </section>

        <section className={`${styles.section} ${styles.alt}`} id="preise">
          <div className={`shell ${styles.priceLayout}`}>
            <div className={styles.priceBox}>
              <p className={styles.eyebrow}>Kanzlei, auf Anfrage</p>
              <h2>{euro(KANZLEI_MONTHLY_EUR)} netto / Monat</h2>
              <p>
                {KANZLEI_MONTHLY_GROSS_LABEL}&nbsp;€ brutto, inkl. 19&nbsp;% USt. Keine
                Provision. Kein Bestellbutton.
              </p>
              <table className={styles.priceTable}>
                <tbody>
                  <tr>
                    <th scope="row">Logo im PDF</th>
                    <td>auf Anfrage</td>
                  </tr>
                  <tr>
                    <th scope="row">Mandantenübersicht</th>
                    <td>nur bei Zustimmung, auf Anfrage</td>
                  </tr>
                  <tr>
                    <th scope="row">Provision</th>
                    <td>keine</td>
                  </tr>
                </tbody>
              </table>
              <div className={styles.ctas}>
                <a className={`btn ${styles.btnOnDark}`} href={PARTNER_MAIL}>
                  Partneranfrage per E-Mail
                </a>
                <a className={styles.textLink} href="#anfrage">
                  Oder das Formular nutzen
                </a>
              </div>
            </div>
            <div className={styles.side}>
              <h3>Was Mandanten zahlen</h3>
              <p className={styles.prose}>
                Den Listenpreis, direkt an die {LEGAL_OPERATOR.name}. Die Kanzlei
                erhält keine Provision.
              </p>
              <ul className={styles.checks} role="list">
                {isPricingV2() ? (
                  <>
                    <li>Einstieg {netWithGrossCents(V2_ENTRY_CENTS)}</li>
                    <li>Optional Jahresmitgliedschaft {netWithGrossCents(V2_MEMBER_YEAR_CENTS)} pro Jahr</li>
                  </>
                ) : (
                  <>
                    <li>
                      {euro(SETUP_EUR)} netto Einrichtung ({SETUP_GROSS_LABEL}&nbsp;€ brutto)
                    </li>
                    <li>
                      {euro(MONTHLY_EUR)} netto pro Monat ({MONTHLY_GROSS_LABEL}&nbsp;€ brutto)
                    </li>
                    <li>Ein Abo umfasst bis zu {MAX_ENTITIES_PER_ACCOUNT} Firmen</li>
                  </>
                )}
                <li>{ALL_AREAS_LINE}</li>
              </ul>
              <p className={styles.fine}>
                Die Bestellung der Mandanten läuft über die{" "}
                <Link href="/">öffentliche Seite</Link>. Diese Partnerschaft hat
                keinen Bestellweg.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section} id="ablauf">
          <div className={`shell ${styles.split}`}>
            <div>
              <h2>So läuft es ab</h2>
              <ol className={styles.steps} role="list">
                <li>Sie senden eine Partneranfrage. Es gibt hier keine Selbstbedienung.</li>
                <li>
                  Logo im PDF und die Übersicht der Mandanten, die zugestimmt haben,
                  richten wir danach auf Anfrage ein.
                </li>
                <li>
                  Mandanten bestellen selbst und zahlen den Listenpreis direkt an die{" "}
                  {LEGAL_OPERATOR.name}.
                </li>
                <li>Sie füllen die Dokumentation nicht für den Mandanten aus.</li>
              </ol>
              <p className={styles.fine}>{PARTNER_EFFORT_LINE}</p>
            </div>
            <div>
              <h2>Grenze</h2>
              <p className={styles.prose}>
                Keine Steuerberatung und keine Rechtsberatung. Keine Zusage, dass
                eine Dokumentation einer Prüfung standhält. Die Verantwortung für
                die Angaben bleibt beim Mandanten.
              </p>
              <p className={styles.prose}>
                <Link className={styles.inlineLink} href={PARTNER_DEMO_PATH}>
                  Fragenprozess ansehen
                </Link>
                . Die Demo speichert keine Eingaben.
              </p>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.alt}`} id="anfrage">
          <div className={`shell ${styles.split}`}>
            <div>
              <h2>Partneranfrage</h2>
              <p className={styles.prose}>
                Schreiben Sie uns, wenn die Kanzlei das Logo im PDF und die
                Übersicht eingewilligter Mandanten nutzen möchte. Die Anfrage ist
                unverbindlich. Eine Provision gibt es nicht.
              </p>
              <p className={styles.fine}>
                <a href={PARTNER_MAIL}>
                  {LEGAL_OPERATOR.email} mit dem Betreff „Partneranfrage Kanzlei“
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
            <h2>Partnerschaft auf Anfrage</h2>
            <p>
              {euro(KANZLEI_MONTHLY_EUR)} netto pro Monat für die Kanzlei · keine Provision ·
              Mandanten zahlen den Listenpreis direkt an die {LEGAL_OPERATOR.name}.
              Keine Steuerberatung.
            </p>
            <div className={styles.ctas}>
              <a className={`btn ${styles.btnOnDark}`} href={PARTNER_MAIL}>
                Partneranfrage per E-Mail
              </a>
              <a className={`btn ${styles.btnSecOnDark}`} href="#anfrage">
                Formular
              </a>
              <a className={styles.textLink} href={PARTNER_MUSTER_PDF_PATH}>
                Muster-PDF
              </a>
            </div>
          </div>
        </section>
      </main>
      <div className="sticky-cta">
        <a className="btn" href="#anfrage">
          Partneranfrage
        </a>
      </div>
      <SiteFooter />
    </div>
  );
}
