import type { Metadata } from "next";
import { Suspense } from "react";
import { CrumbJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { KASSEN_CHECK_PATH, KASSEN_H1, KASSEN_INTRO } from "@/lib/kassen-check-questions";
import { canonicalUrl } from "@/lib/seo";
import { KassenCheck } from "./kassen-check";

export const metadata: Metadata = {
  title: "Kassen- und TSE-Meldecheck",
  description: KASSEN_INTRO,
  robots: { index: false, follow: true },
  alternates: { canonical: canonicalUrl(KASSEN_CHECK_PATH) },
};

export default function KassenCheckPage() {
  return (
    <>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "Kassen- und TSE-Meldecheck", path: KASSEN_CHECK_PATH },
        ]}
      />
      <SiteHeader backHref="/" backLabel="← Zur Startseite" />
      <main className="wrap page">
        <Suspense fallback={<p className="hint">Der Check wird geladen.</p>}>
          <KassenCheck />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
