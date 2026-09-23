import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  LEAD_MAGNET_CTA_AFTER,
  LEAD_MAGNET_CTA_BEFORE,
  LEAD_MAGNET_CTA_LINK_LABEL,
  LEAD_MAGNET_CTA_TITLE,
  LEAD_MAGNET_DISCLAIMER,
  LEAD_MAGNET_DOWNLOAD_PATH,
  LEAD_MAGNET_FILENAME,
  LEAD_MAGNET_HEADLINE,
  LEAD_MAGNET_INTRO,
  LEAD_MAGNET_SUBHEAD,
  leadMagnetReadinessHref,
} from "@/lib/lead-magnet";

export const metadata: Metadata = {
  title: "10 Offene Punkte vor der Prüfung",
  description:
    "Kurzer Abgleich für KMU und Handwerk: eine Seite mit zehn offenen Punkten zur Verfahrensdokumentation. Keine Steuerberatung.",
};

export default function LeadMagnetPage() {
  return (
    <>
      <SiteHeader
        backHref="/blog/gobd-verfahrensdokumentation-betriebspruefung"
        backLabel="← Zum Artikel"
      />
      <main className="wrap page">
        <p className="kicker">Arbeitshilfe · 1 Seite · PDF</p>
        <h1>{LEAD_MAGNET_HEADLINE}</h1>
        <p className="lead-magnet-sub">{LEAD_MAGNET_SUBHEAD}</p>
        <p className="prose">{LEAD_MAGNET_INTRO}</p>
        <p className="actions">
          <a className="btn" href={LEAD_MAGNET_DOWNLOAD_PATH}>
            PDF herunterladen
          </a>
        </p>
        <p className="hint">Datei: {LEAD_MAGNET_FILENAME}</p>
        <aside className="card lead-magnet-cta">
          <h2>{LEAD_MAGNET_CTA_TITLE}</h2>
          <p>
            {LEAD_MAGNET_CTA_BEFORE}
            <Link href={leadMagnetReadinessHref()}>{LEAD_MAGNET_CTA_LINK_LABEL}</Link>
            {LEAD_MAGNET_CTA_AFTER}
          </p>
        </aside>
        <p className="hint lead-magnet-disclaimer">{LEAD_MAGNET_DISCLAIMER}</p>
      </main>
      <SiteFooter />
    </>
  );
}
