import type { Metadata } from "next";
import { CrumbJsonLd } from "@/components/json-ld";
import { VorlagenShell } from "@/components/vorlagen-shell";
import { MAGNET_PATHS, MAGNET_TITLES } from "@/lib/vorlagen/ids";
import { canonicalUrl } from "@/lib/seo";
import { ChecklisteGate } from "./gate";

const path = MAGNET_PATHS["checkliste-kassen-nachschau"];

export const metadata: Metadata = {
  title: MAGNET_TITLES["checkliste-kassen-nachschau"],
  description:
    "Checkliste für Betriebe mit elektronischer Kasse oder offener Ladenkasse. Das PDF erhalten Sie nach Bestätigung Ihrer E-Mail-Adresse.",
  alternates: { canonical: canonicalUrl(path) },
};

export default function ChecklistePage() {
  return (
    <VorlagenShell>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "Vorlagen", path: "/vorlagen" },
          { name: MAGNET_TITLES["checkliste-kassen-nachschau"], path },
        ]}
      />
      <p className="kicker">Checkliste · Stand Oktober 2026</p>
      <h1>{MAGNET_TITLES["checkliste-kassen-nachschau"]}</h1>
      <p className="prose">Eine Checkliste für Betriebe mit elektronischer Kasse oder offener Ladenkasse.</p>
      <ChecklisteGate />
    </VorlagenShell>
  );
}
