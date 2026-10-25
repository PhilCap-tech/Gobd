import type { Metadata } from "next";
import { CrumbJsonLd } from "@/components/json-ld";
import { Kostenrechner } from "@/components/kostenrechner";
import { VorlagenShell } from "@/components/vorlagen-shell";
import { MAGNET_PATHS, MAGNET_TITLES } from "@/lib/vorlagen/ids";
import { canonicalUrl } from "@/lib/seo";

const path = MAGNET_PATHS.kostenrechner;

export const metadata: Metadata = {
  title: MAGNET_TITLES.kostenrechner,
  description:
    "Illustration zu Erstellungskosten und einem selbst gewählten Schätzszenario. Keine Prognose und keine Steuerberatung.",
  alternates: { canonical: canonicalUrl(path) },
};

export default function KostenrechnerPage() {
  return (
    <VorlagenShell>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "Vorlagen", path: "/vorlagen" },
          { name: MAGNET_TITLES.kostenrechner, path },
        ]}
      />
      <p className="kicker">Kostenrechner · Stand Oktober 2026</p>
      <h1>{MAGNET_TITLES.kostenrechner}</h1>
      <Kostenrechner />
    </VorlagenShell>
  );
}
