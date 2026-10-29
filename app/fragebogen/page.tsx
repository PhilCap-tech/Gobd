import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { IntakeForm } from "@/app/intake/intake-form";
import { LoginForm } from "@/app/login/login-form";
import { getSessionEmail } from "@/lib/auth";
import { FRAGEBOGEN_PAKET_PATH, FRAGEBOGEN_PATH } from "@/lib/fragebogen";
import { entityChoices } from "@/lib/entities";
import { isStripeTestMode } from "@/lib/env";
import { PLAN_OFFER_OBJECTION_NOTICE } from "@/lib/plan-copy";
import { intakeLoginFirstEnabled } from "@/lib/pricing-model";
import { listEntitiesByEmail } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fragebogen starten",
  robots: { index: false, follow: false },
};

/**
 * Neues Preismodell, Login zuerst (INTAKE_LOGIN_FIRST_ENABLED, im neuen
 * Modell Default an): E-Mail + Anmeldelink vor dem Fragebogen, der Entwurf
 * gehört zum Login (email:-Schlüssel), nach der letzten Frage Paketwahl und
 * Zahlung. Erstellt wird erst nach bestätigter Zahlung (bezahlter Weg /intake).
 */
export default async function FragebogenPage() {
  if (!intakeLoginFirstEnabled()) redirect("/checkout");
  const email = await getSessionEmail();
  if (!email) {
    return (
      <>
        <SiteHeader backHref="/" backLabel="← Zur Landing" />
        <main className="wrap page">
          <h1>Fragebogen kostenlos starten</h1>
          <p className="lead">
            Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Anmeldelink; damit speichern wir Ihre Angaben
            in Ihrem Konto. Bezahlt wird erst, wenn Sie die Dokumentation erstellen lassen.
          </p>
          <LoginForm next={FRAGEBOGEN_PATH} />
          <p className="hint">{PLAN_OFFER_OBJECTION_NOTICE}</p>
        </main>
        <SiteFooter />
      </>
    );
  }
  const entities = await listEntitiesByEmail(email);
  const first = entities[0];
  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <IntakeForm
          session={{ email, company: first?.name ?? "", stripeSessionId: "", stripeCustomerId: "", stub: false }}
          firm={first ? { name: first.name, street: first.street, zip: first.zip, city: first.city, stnr: first.stnr, ustId: first.ustId } : { name: "" }}
          entities={entityChoices(entities.slice(0, 1))}
          initialEntityId={first?.entityId ?? ""}
          gesamtMode
          stripeTestMode={isStripeTestMode()}
          prepayHref={FRAGEBOGEN_PAKET_PATH}
        />
      </main>
      <SiteFooter />
    </>
  );
}
