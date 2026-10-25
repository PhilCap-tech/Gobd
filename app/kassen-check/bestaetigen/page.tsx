import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { verifyAmpelDoiToken } from "@/lib/ampel";
import { KASSEN_CHECK_PATH } from "@/lib/kassen-check-questions";
import { firstQueryValue } from "@/lib/query";
import { KassenConfirmPanel } from "./confirm-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-Mail bestätigen",
  robots: { index: false, follow: true },
};

export default async function KassenConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstQueryValue(params.token) ?? "";
  const payload = await verifyAmpelDoiToken(token);
  const valid = payload?.check === "kassen-check";

  return (
    <>
      <SiteHeader backHref={KASSEN_CHECK_PATH} backLabel="← Zum Kassen-Check" />
      <main className="wrap page">
        <h1>E-Mail-Adresse bestätigen</h1>
        {valid ? (
          <KassenConfirmPanel token={token} />
        ) : (
          <p className="card" role="alert">
            Dieser Bestätigungslink ist ungültig oder abgelaufen. Fordern Sie das Ergebnis auf der Check-Seite erneut an.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
