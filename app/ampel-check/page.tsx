import { AMPEL_CTA } from "@/lib/ampel-questions";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CrumbJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AMPEL_H1, AMPEL_INTRO } from "@/lib/ampel-questions";
import { canonicalUrl } from "@/lib/seo";
import { AmpelCheck } from "./ampel-check";

export const metadata: Metadata = {
  title: { absolute: AMPEL_H1 },
  description: AMPEL_INTRO,
  alternates: { canonical: canonicalUrl("/ampel-check") },
};

export default function AmpelCheckPage() {
  return (
    <>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "GoBD-Ampel", path: "/ampel-check" },
        ]}
      />
      <SiteHeader backHref="/" backLabel="← Zur Startseite" />
      <main className="wrap page">
        <Suspense fallback={<p className="hint">Die Ampel wird geladen.</p>}>
          <AmpelCheck ctaPrice={AMPEL_CTA.price} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
