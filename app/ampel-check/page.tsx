import { AMPEL_CTA } from "@/lib/ampel-questions";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CrumbJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AMPEL_INTRO, AMPEL_TITLE } from "@/lib/ampel-questions";
import { canonicalUrl } from "@/lib/seo";
import { ampelV2OverrideAllowed, isAmpelNoEmailEnabled } from "@/lib/ampel-v2-flag";
import { AMPEL_V2_COPY } from "@/lib/ampel-v2-copy";
import { AmpelCheck } from "./ampel-check";
import { AmpelCheckV2 } from "./ampel-check-v2";

type AmpelSearch = Record<string, string | string[] | undefined>;

const metadataV1: Metadata = {
  title: { absolute: AMPEL_TITLE },
  description: AMPEL_INTRO,
  alternates: { canonical: canonicalUrl("/ampel-check") },
};

/** Title/meta „ohne E-Mail“ switch only together with the flag. Flag off: metadataV1 unchanged. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<AmpelSearch> }): Promise<Metadata> {
  const query = ampelV2OverrideAllowed() ? await searchParams : undefined;
  if (!isAmpelNoEmailEnabled(query)) return metadataV1;
  return {
    ...metadataV1,
    title: { absolute: AMPEL_V2_COPY.title },
    description: AMPEL_V2_COPY.description,
  };
}

/**
 * Flag "Ampel ohne E-Mail": env AMPEL_NO_EMAIL_ENABLED (default OFF).
 * Outside production `?ampel_v2=1` turns it on for the request. In production the
 * search params are not even read, so the page keeps its static render.
 */
export default async function AmpelCheckPage({ searchParams }: { searchParams: Promise<AmpelSearch> }) {
  const query = ampelV2OverrideAllowed() ? await searchParams : undefined;
  const noEmail = isAmpelNoEmailEnabled(query);
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
          {noEmail ? <AmpelCheckV2 ctaPrice={AMPEL_CTA.price} /> : <AmpelCheck ctaPrice={AMPEL_CTA.price} />}
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
