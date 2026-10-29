import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  firstCompanyFormDefaults,
  readCheckoutAccountFacts,
} from "@/lib/account-checkout-prefill";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { listEntitiesByEmail } from "@/lib/store";
import { FirmaForm } from "../firma-form";
import { logError } from "@/lib/log-error";
import { v3FirmDenial } from "@/lib/v3-firm-limit";

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
  let formDefaults: ReturnType<typeof firstCompanyFormDefaults> = { showNote: false };
  if (entities.length === 0) {
    try {
      formDefaults = firstCompanyFormDefaults(0, await readCheckoutAccountFacts(email));
    } catch (error) {
      logError("[account] Checkout-Daten für die erste Firma fehlen", error);
    }
  }

  const oneFirm = await v3FirmDenial(email, entities.length);
  if (oneFirm) {
    return (
      <>
        <SiteHeader backHref="/account" backLabel="← Zum Konto" />
        <main className="wrap page">
          <p className="kicker">Konto</p>
          <h1>Weitere Firma</h1>
          <p className="lead">{oneFirm}</p>
          <p>
            <a className="btn" href="/account">Zurück zum Konto</a>
          </p>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <p className="kicker">Konto</p>
        <h1>Firma anlegen</h1>
        <p className="lead">{email}</p>
        <FirmaForm initial={formDefaults.initial} showCheckoutNote={formDefaults.showNote} />
      </main>
      <SiteFooter />
    </>
  );
}
