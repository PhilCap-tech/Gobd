import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { firstQueryValue } from "@/lib/query";
import { UnsubscribePanel } from "./unsubscribe-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-Mail-Informationen abmelden",
  robots: { index: false, follow: false },
};

export default async function AmpelUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";

  return (
    <>
      <SiteHeader backHref="/ampel-check" backLabel="← Zur Ampel" />
      <main className="wrap page">
        <p className="kicker">GoBD-Ampel</p>
        <h1>E-Mail-Informationen abmelden</h1>
        <UnsubscribePanel token={token} />
      </main>
      <SiteFooter />
    </>
  );
}
