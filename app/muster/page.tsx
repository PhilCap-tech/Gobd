import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BEREICHE } from "@/lib/bereiche";
import { musterFragebogenPath, musterPath, musterPdfPath, MUSTER_INDEX_PATH } from "@/lib/bereich-muster";
import { ALL_AREAS_DETAIL, ALL_AREAS_LINE } from "@/lib/offer-copy";
import { canonicalUrl } from "@/lib/seo";

const PAGE_TITLE = "Muster: Verfahrensdokumentation je Bereich (fiktiv) | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Muster-PDF und ausgefüllter Muster-Fragebogen für jeden Bereich: Belegfluss, Kasse, Warenwirtschaft, Einkauf, Verkauf, Retouren, Zeiterfassung, Lohn, E-Commerce, Bank, Anlagen und Vorsysteme. Fiktive Beispielunternehmen, keine Steuerberatung.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: canonicalUrl(MUSTER_INDEX_PATH) },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: canonicalUrl(MUSTER_INDEX_PATH),
    locale: "de_DE",
    type: "website",
  },
};

export default function MusterIndexPage() {
  return (
    <>
      <SiteHeader backHref="/#bereiche" backLabel="Bereiche" />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Muster · fiktiv</p>
          <h1>Muster je Bereich: PDF und Fragebogen</h1>
          <p className="lead">
            Für jeden Bereich gibt es eine Muster-Verfahrensdokumentation als
            PDF und den dazugehörigen ausgefüllten Fragebogen. Die
            Beispielunternehmen sind frei erfunden. Präsens steht nur dort, wo
            eine Angabe als heutige Praxis bestätigt ist; einzelne Punkte
            bleiben absichtlich offen.
          </p>
          <p className="price-frame">
            <strong>{ALL_AREAS_LINE}</strong> {ALL_AREAS_DETAIL}
          </p>
        </section>

        <section className="block" id="bereiche">
          <h2>Bereich wählen</h2>
          <ul className="bereich-grid muster-grid">
            {BEREICHE.map((bereich) => (
              <li key={bereich.id}>
                <strong>
                  <Link href={musterPath(bereich.id)}>{bereich.label}</Link>
                </strong>
                <span>{bereich.kurz}</span>
                <span className="muster-links">
                  <Link href={musterPath(bereich.id)}>Übersicht</Link>
                  {" · "}
                  <a href={musterPdfPath(bereich.id)}>Muster-PDF</a>
                  {" · "}
                  <a href={musterFragebogenPath(bereich.id)}>Muster-Fragebogen</a>
                </span>
              </li>
            ))}
          </ul>
          <p className="disclaimer">
            Muster der IKAT GmbH, gobd-doku-erstellen.de. Alle Unternehmen,
            Personen und Systeme mit dem Zusatz „fiktiv“ sind erfunden. Keine
            Steuer-, Rechts- oder Prüfungsberatung. Keine Zusicherung von
            GoBD-Konformität.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
