import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { verifyAmpelDoiToken } from "@/lib/ampel";
import { decodeAmpelAnswers } from "@/lib/ampel-score";
import { firstQueryValue } from "@/lib/query";
import { AmpelDisclaimer } from "@/components/ampel-result";
import { AmpelConfirmPanel } from "./confirm-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-Mail bestätigen",
  robots: { index: false, follow: false },
};

export default async function AmpelConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";
  const payload = await verifyAmpelDoiToken(token);
  const answers = payload ? decodeAmpelAnswers(payload.answers) : null;

  return (
    <>
      <SiteHeader backHref="/ampel-check" backLabel="← Zur Ampel" />
      <main className="wrap page">
        <p className="kicker">GoBD-Ampel</p>
        <h1>E-Mail-Adresse bestätigen</h1>
        {payload && answers ? (
          <AmpelConfirmPanel token={token} answers={answers} />
        ) : (
          <>
            <p className="card" role="alert">
              Dieser Bestätigungslink ist ungültig oder abgelaufen. Fordern Sie das Ergebnis auf der Ampel-Seite erneut an.
            </p>
            <p className="actions">
              <Link className="btn" href="/ampel-check">
                Zur Ampel
              </Link>
            </p>
            <AmpelDisclaimer />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
