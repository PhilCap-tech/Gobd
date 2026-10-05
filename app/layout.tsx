import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsentBanner } from "@/components/consent-banner";
import { MarketingPixel } from "@/components/marketing-pixel";
import { SITE_ORIGIN } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default:
      "GoBD-Verfahrensdokumentation online erstellen | GoBD Verfahrensdoku",
    template: "%s | GoBD Verfahrensdoku",
  },
  description:
    "GoBD-Verfahrensdokumentation online erstellen: strukturierte digitale Dokumentation für KMU & Handwerk — PDF plus offene Punkte. Kein Steuerberatungsersatz.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body>
        {children}
        <ConsentBanner />
        <Suspense fallback={null}>
          <MarketingPixel />
        </Suspense>
      </body>
    </html>
  );
}
