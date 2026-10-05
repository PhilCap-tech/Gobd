import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BEREICHE } from "@/lib/bereiche";
import { musterPath } from "@/lib/bereich-muster";
import {
  gesamtMusterFragebogenPath,
  gesamtMusterPath,
  gesamtMusterPdfPath,
  MUSTER_VORLAGEN,
  getGesamtMuster,
  redirectForBereichMuster,
} from "@/lib/module-muster";
import { ALL_AREAS_DETAIL, ALL_AREAS_LINE } from "@/lib/offer-copy";
import { canonicalUrl } from "@/lib/seo";
import { MUSTER_INDEX_PATH } from "@/lib/bereich-muster";

const PAGE_TITLE = "Muster: Gesamtdokument und Module (fiktiv) | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Muster-Gesamtdokumente für Dienstleister, Handel, E-Commerce, Gastronomie und Handwerk/Bau sowie Fragebögen je Modul. Fiktive Beispiele, keine Steuerberatung. 24 Module, alle inklusive.";

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
      <SiteHeader backHref="/#bereiche" backLabel="Module" />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Muster · fiktiv</p>
          <h1>Muster-Gesamtdokumente und Module</h1>
          <p className="lead">
            Fünf vollständige Muster nach Branchenvorlage sowie die bisherigen
            Bereichs-Muster (leiten auf das passende Gesamtmuster weiter).
          </p>
          <p className="price-frame">
            <strong>{ALL_AREAS_LINE}</strong> {ALL_AREAS_DETAIL}
          </p>
        </section>

        <section className="block" id="gesamt">
          <h2>Gesamtdokumente nach Vorlage</h2>
          <ul className="bereich-grid muster-grid">
            {MUSTER_VORLAGEN.map((vorlage) => {
              const muster = getGesamtMuster(vorlage)!;
              return (
                <li key={vorlage}>
                  <strong>
                    <Link href={gesamtMusterPath(vorlage)}>{muster.label}</Link>
                  </strong>
                  <span>{muster.steckbrief}</span>
                  <span className="muster-links">
                    <Link href={gesamtMusterPath(vorlage)}>Übersicht</Link>
                    {" · "}
                    <a href={gesamtMusterPdfPath(vorlage)}>Muster-PDF</a>
                    {" · "}
                    <a href={gesamtMusterFragebogenPath(vorlage)}>Fragebogen</a>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="block" id="legacy">
          <h2>Bisherige Bereichs-Muster (Weiterleitung)</h2>
          <ul className="bereich-grid muster-grid">
            {BEREICHE.map((bereich) => (
              <li key={bereich.id}>
                <strong>
                  <Link href={musterPath(bereich.id)}>{bereich.label}</Link>
                </strong>
                <span>
                  Leitet weiter nach {redirectForBereichMuster(bereich.id)}
                </span>
              </li>
            ))}
          </ul>
          <p className="disclaimer">
            Muster der IKAT GmbH, gobd-doku-erstellen.de. Alle Unternehmen mit
            dem Zusatz „fiktiv“ sind erfunden. Keine Steuer-, Rechts- oder
            Prüfungsberatung.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
