import type { Metadata } from "next";
import { CrumbJsonLd } from "@/components/json-ld";
import { VorlagenShell } from "@/components/vorlagen-shell";
import { MAGNET_PATHS, MAGNET_TITLES } from "@/lib/vorlagen/ids";
import { canonicalUrl } from "@/lib/seo";
import { GliederungGate } from "./gate";

const path = MAGNET_PATHS["gliederung-verfahrensdoku"];

export const metadata: Metadata = {
  title: "Gliederungsvorlage Verfahrensdokumentation",
  description:
    "Struktur mit Leitfragen zum Selbstausfüllen. Das PDF erhalten Sie nach Bestätigung Ihrer E-Mail-Adresse. Keine Steuerberatung.",
  alternates: { canonical: canonicalUrl(path) },
};

export default function GliederungPage() {
  return (
    <VorlagenShell>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "Vorlagen", path: "/vorlagen" },
          { name: MAGNET_TITLES["gliederung-verfahrensdoku"], path },
        ]}
      />
      <p className="kicker">Gliederungsvorlage · Stand Oktober 2026</p>
      <h1>{MAGNET_TITLES["gliederung-verfahrensdoku"]}</h1>
      <p className="prose">Eine Struktur mit Leitfragen – zum Selbstausfüllen.</p>
      <GliederungGate />
    </VorlagenShell>
  );
}
