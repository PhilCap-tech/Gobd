import type { Metadata } from "next";
import { Suspense } from "react";
import { CrumbJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AMPEL_H1, AMPEL_INTRO } from "@/lib/ampel-questions";
import { kanzleiFlowSlug } from "@/lib/kanzlei-toolbox";
import { lookupPublicKanzlei } from "@/lib/kanzlei-toolbox-store";
import { canonicalUrl } from "@/lib/seo";
import { AmpelCheck, type AmpelKanzleiHint } from "./ampel-check";

export const metadata: Metadata = {
  title: { absolute: AMPEL_H1 },
  description: AMPEL_INTRO,
  alternates: { canonical: canonicalUrl("/ampel-check") },
};

type PageProps = {
  searchParams: Promise<{ kanzlei?: string | string[] }>;
};

export default async function AmpelCheckPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.kanzlei) ? params.kanzlei[0] : params.kanzlei;
  let hint: AmpelKanzleiHint | null = null;
  try {
    const record = await lookupPublicKanzlei(kanzleiFlowSlug(raw ?? ""));
    if (record) {
      hint = { name: record.displayName, slug: record.slug, kanzleiId: record.kanzleiId };
    }
  } catch {
    hint = null;
  }
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
          <AmpelCheck hint={hint} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
