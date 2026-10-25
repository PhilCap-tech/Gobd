import type { Metadata } from "next";
import Link from "next/link";
import { CrumbJsonLd } from "@/components/json-ld";
import { VorlagenShell } from "@/components/vorlagen-shell";
import { MAGNET_OVERVIEW_INTRO, MAGNET_OVERVIEW_TITLE } from "@/lib/vorlagen/copy";
import { MAGNET_PATHS, MAGNET_TITLES } from "@/lib/vorlagen/ids";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: MAGNET_OVERVIEW_TITLE,
  description:
    "Checkliste zur Kassen-Nachschau, Gliederungsvorlage und Kostenrechner zur Verfahrensdokumentation. Keine Steuerberatung.",
  alternates: { canonical: canonicalUrl("/vorlagen") },
};

export default function VorlagenPage() {
  return (
    <VorlagenShell backHref="/" backLabel="← Zur Startseite">
      <CrumbJsonLd items={[{ name: "Startseite", path: "/" }, { name: MAGNET_OVERVIEW_TITLE, path: "/vorlagen" }]} />
      <p className="kicker">Arbeitshilfen · Stand Oktober 2026</p>
      <h1>{MAGNET_OVERVIEW_TITLE}</h1>
      <p className="prose">{MAGNET_OVERVIEW_INTRO}</p>
      <div className="vorlagen-cols">
        <article className="card">
          <h2>{MAGNET_TITLES.kostenrechner}</h2>
          <p>Den Rechner können Sie direkt nutzen. Das Ergebnis-PDF gibt es nach Bestätigung Ihrer E-Mail-Adresse.</p>
          <p className="actions">
            <Link className="btn" href={MAGNET_PATHS.kostenrechner}>Kostenrechner öffnen</Link>
          </p>
        </article>
        <article className="card">
          <h2>{MAGNET_TITLES["checkliste-kassen-nachschau"]}</h2>
          <p>Eine Checkliste für Betriebe mit elektronischer Kasse oder offener Ladenkasse.</p>
          <p className="actions">
            <Link className="btn" href={MAGNET_PATHS["checkliste-kassen-nachschau"]}>Checkliste anfordern</Link>
          </p>
        </article>
        <article className="card">
          <h2>{MAGNET_TITLES["gliederung-verfahrensdoku"]}</h2>
          <p>Eine Struktur mit Leitfragen – zum Selbstausfüllen.</p>
          <p className="actions">
            <Link className="btn" href={MAGNET_PATHS["gliederung-verfahrensdoku"]}>Gliederung anfordern</Link>
          </p>
        </article>
      </div>
    </VorlagenShell>
  );
}
