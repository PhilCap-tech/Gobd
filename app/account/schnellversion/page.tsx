import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SchnellversionKonto } from "@/components/schnellversion-konto";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import { schnellversion49Enabled } from "@/lib/schnellversion-flag";
import { listSvPurchases } from "@/lib/schnellversion-record";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Standardfassung",
  robots: { index: false, follow: false },
};

export default async function SchnellversionKontoPage() {
  if (!schnellversion49Enabled()) redirect("/account");
  const email = await getSessionEmail();
  if (!email) redirect("/login");
  const rows = await listSvPurchases(email);
  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap account-wrap page">
        <p className="kicker">Konto</p>
        <h1>Standardfassung</h1>
        {rows.length === 0 ? (
          <p>Für dieses Konto liegt keine Standardfassung vor.</p>
        ) : (
          <SchnellversionKonto rows={rows} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
