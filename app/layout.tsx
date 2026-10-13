import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { ConsentBanner } from "@/components/consent-banner";
import { JsonLd } from "@/components/json-ld";
import { MarketingPixel } from "@/components/marketing-pixel";
import { organizationJsonLd } from "@/lib/jsonld";
import { SITE_ORIGIN } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="de" className={inter.variable}>
      <body>
        <JsonLd data={organizationJsonLd()} />
        {children}
        <ConsentBanner />
        <Suspense fallback={null}>
          <MarketingPixel />
        </Suspense>
      </body>
    </html>
  );
}
