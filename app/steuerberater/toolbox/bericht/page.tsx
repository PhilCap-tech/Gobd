import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { KanzleiReportClient } from "./report-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kanzlei-Bericht",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function KanzleiReportPage() {
  return (
    <>
      <SiteHeader backHref="/steuerberater#toolbox" backLabel="← Zur Kanzlei-Seite" />
      <main className="wrap page">
        <h1>Bericht mit Zahlen</h1>
        <KanzleiReportClient />
      </main>
      <SiteFooter />
    </>
  );
}
