import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  INHALT_GLIEDERUNG_CTA_AFTER,
  INHALT_GLIEDERUNG_CTA_BEFORE,
  INHALT_GLIEDERUNG_CTA_LINK_LABEL,
  INHALT_GLIEDERUNG_CTA_TITLE,
  INHALT_GLIEDERUNG_DISCLAIMER,
  INHALT_GLIEDERUNG_DOWNLOAD_PATH,
  INHALT_GLIEDERUNG_FILENAME,
  INHALT_GLIEDERUNG_HEADLINE,
  INHALT_GLIEDERUNG_INTRO,
  INHALT_GLIEDERUNG_SUBHEAD,
  inhaltGliederungReadinessHref,
} from "@/lib/lead-magnet-inhalt";

export const metadata: Metadata = {
  title: "Inhalt einer Verfahrensdokumentation — Mini-Gliederung für KMU",
  description:
    "Mini-Gliederung für KMU: sieben Bausteine, die typischerweise in eine Verfahrensdokumentation gehören. Keine Steuerberatung.",
};

export default function InhaltGliederungPage() {
  return (
    <>
      <SiteHeader
        backHref="/blog/gobd-verfahrensdokumentation-erstellen"
        backLabel="← Zum Artikel"
      />
      <main className="wrap page">
        <p className="kicker">Arbeitshilfe · 1 Seite · PDF</p>
        <h1>{INHALT_GLIEDERUNG_HEADLINE}</h1>
        <p className="lead-magnet-sub">{INHALT_GLIEDERUNG_SUBHEAD}</p>
        <p className="prose">{INHALT_GLIEDERUNG_INTRO}</p>
        <p className="actions">
          <a className="btn" href={INHALT_GLIEDERUNG_DOWNLOAD_PATH}>
            PDF herunterladen
          </a>
        </p>
        <p className="hint">Datei: {INHALT_GLIEDERUNG_FILENAME}</p>
        <aside className="card lead-magnet-cta">
          <h2>{INHALT_GLIEDERUNG_CTA_TITLE}</h2>
          <p>
            {INHALT_GLIEDERUNG_CTA_BEFORE}
            <Link href={inhaltGliederungReadinessHref()}>
              {INHALT_GLIEDERUNG_CTA_LINK_LABEL}
            </Link>
            {INHALT_GLIEDERUNG_CTA_AFTER}
          </p>
        </aside>
        <p className="hint lead-magnet-disclaimer">{INHALT_GLIEDERUNG_DISCLAIMER}</p>
      </main>
      <SiteFooter />
    </>
  );
}
