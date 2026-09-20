import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, loginPath } from "@/lib/auth";
import {
  entityCapReached,
  MAX_ENTITIES_PER_ACCOUNT,
} from "@/lib/entities";
import { listEntitiesByEmail } from "@/lib/store";
import { FirmaForm } from "./firma-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Firma anlegen",
  robots: { index: false, follow: false },
};

export default async function NewFirmaPage() {
  const email = await getSessionEmail();
  if (!email) {
    redirect(loginPath("/account/firma/neu"));
  }

  const entities = await listEntitiesByEmail(email);
  const atCap = entityCapReached(entities.length);

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <p className="kicker">Konto</p>
        <h1>Firma anlegen</h1>
        <p className="lead">{email}</p>
        {atCap ? (
          <div className="card">
            <p className="prose">
              Du hast das Maximum von {MAX_ENTITIES_PER_ACCOUNT} Firmen
              erreicht.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/account">
                Zum Konto
              </Link>
            </div>
          </div>
        ) : (
          <FirmaForm />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
