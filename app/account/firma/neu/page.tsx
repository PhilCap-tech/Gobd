import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  firstCompanyFormDefaults,
  readCheckoutAccountFacts,
} from "@/lib/account-checkout-prefill";
import { getSessionEmail, loginPath } from "@/lib/auth";
import {
  entityCapReached,
  MAX_ENTITIES_PER_ACCOUNT,
} from "@/lib/entities";
import { listEntitiesByEmail } from "@/lib/store";
import { FirmaForm } from "../firma-form";

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

  let entities: Awaited<ReturnType<typeof listEntitiesByEmail>> = [];
  try {
    entities = await listEntitiesByEmail(email);
  } catch (error) {
    console.error(
      "[account] Firmen nicht geladen",
      error instanceof Error ? error.name : "error",
    );
  }
  const atCap = entityCapReached(entities.length);
  let formDefaults: ReturnType<typeof firstCompanyFormDefaults> = { showNote: false };
  if (!atCap && entities.length === 0) {
    try {
      formDefaults = firstCompanyFormDefaults(0, await readCheckoutAccountFacts(email));
    } catch (error) {
      console.error("[account] Checkout-Daten für die erste Firma fehlen", error);
    }
  }

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
              Sie haben das Maximum von {MAX_ENTITIES_PER_ACCOUNT} Firmen
              erreicht.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/account">
                Zum Konto
              </Link>
            </div>
          </div>
        ) : (
          <FirmaForm initial={formDefaults.initial} showCheckoutNote={formDefaults.showNote} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
