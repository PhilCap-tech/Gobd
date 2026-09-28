import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { PARTNER_DEMO_PATH } from "@/lib/partner-muster";
import { DemoWalkthrough } from "./demo-walkthrough";

const PAGE_TITLE =
  "Fragenprozess testen (Demo, Beispieldaten) | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Die produktiven Intake-Fragen mit Beispieldaten einer anonymisierten GmbH. Nichts wird gespeichert. Keine Steuerberatung.";

export const metadata: Metadata = {
  metadataBase: new URL(LEGAL_OPERATOR.siteUrl),
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: true },
  alternates: { canonical: PARTNER_DEMO_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PARTNER_DEMO_PATH,
    locale: "de_DE",
    type: "website",
  },
};

export default function PartnerDemoPage() {
  return (
    <>
      <SiteHeader backHref="/steuerberater" backLabel="Für Steuerberater" />
      <main className="wrap partner-copy">
        <p className="kicker">Muster · Demo · anonymisiert</p>
        <DemoWalkthrough />
        <p className="hint back-links">
          <Link href="/steuerberater">Zur Partnerseite</Link>
          {" · "}
          <Link href="/steuerberater/muster">Muster-PDF</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
