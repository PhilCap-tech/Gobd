import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { ConsentBanner } from "@/components/consent-banner";
import { JsonLd } from "@/components/json-ld";
import { MarketingPixel } from "@/components/marketing-pixel";
import { VercelAnalytics } from "@/components/vercel-analytics";
import { organizationJsonLd } from "@/lib/jsonld";
import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  ROOT_OPEN_GRAPH,
  ROOT_TWITTER,
  SITE_NAME,
  SITE_ORIGIN,
} from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: HOME_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: HOME_DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: ROOT_OPEN_GRAPH,
  twitter: ROOT_TWITTER,
  verification: {
    google: "UdJko_oNkF_ToTGinfT7UJRB64VflyCe1elXacBI5NA",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={inter.variable}>
      <body>
        <JsonLd data={organizationJsonLd()} />
        {children}
        <VercelAnalytics />
        <ConsentBanner />
        <Suspense fallback={null}>
          <MarketingPixel />
        </Suspense>
      </body>
    </html>
  );
}
