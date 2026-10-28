import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { firstQueryValue } from "@/lib/query";
import { UnsubscribePanel } from "./unsubscribe-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Angebote per E-Mail abbestellen",
  robots: { index: false, follow: false },
};

/** Bestätigungsseite der Ein-Klick-Abmeldung aus der 7-Tage-Mail. */
export default async function OfferUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";
  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Startseite" />
      <main className="wrap page">
        <p className="kicker">E-Mail</p>
        <h1>Angebote per E-Mail abbestellen</h1>
        <p className="lead">
          Bestätigen Sie bitte, dass Sie keine Angebote (z. B. das Jahrespaket) mehr per E-Mail erhalten möchten.
        </p>
        <UnsubscribePanel token={token} />
      </main>
      <SiteFooter />
    </>
  );
}
