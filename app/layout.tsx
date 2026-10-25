import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { ConsentBanner } from "@/components/consent-banner";
import { JsonLd } from "@/components/json-ld";
import { MarketingPixel } from "@/components/marketing-pixel";
import { SensitiveQueryStrip } from "@/components/sensitive-query-strip";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=null;try{raw=localStorage.getItem("gobd_consent")}catch(e){}if(!raw){var m=document.cookie.match(/(?:^|; )gobd_consent=([^;]*)/);raw=m?decodeURIComponent(m[1]):""}if(!raw)document.documentElement.classList.add("consent-pending")}catch(e){document.documentElement.classList.add("consent-pending")}})();`,
          }}
        />
        <SensitiveQueryStrip />
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
