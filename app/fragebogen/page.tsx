import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { IntakeForm } from "@/app/intake/intake-form";
import { LoginForm } from "@/app/login/login-form";
import { getSessionEmail } from "@/lib/auth";
import { FRAGEBOGEN_PAKET_PATH, FRAGEBOGEN_PATH, fragebogenEntitiesForQuery, fragebogenHref } from "@/lib/fragebogen";
import { entityChoices } from "@/lib/entities";
import { isStripeTestMode } from "@/lib/env";
import { PLAN_OFFER_OBJECTION_NOTICE } from "@/lib/plan-copy";
import { intakeLoginFirstEnabled } from "@/lib/pricing-model";
import { firstQueryValue } from "@/lib/query";
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
export default async function FragebogenPage({
  searchParams,
}: {
  searchParams: Promise<{ entity_id?: string | string[] }>;
}) {
  if (!intakeLoginFirstEnabled()) redirect("/checkout");
  const requestedEntityId = firstQueryValue((await searchParams).entity_id) ?? "";
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
          <LoginForm
            next={requestedEntityId ? fragebogenHref(requestedEntityId) : FRAGEBOGEN_PATH}
            emailHint="Wir benötigen Ihre E-Mail-Adresse, damit wir Ihren Fortschritt speichern können und keine Eingaben verloren gehen. Sie erhalten einen Anmeldelink, ein Passwort brauchen Sie nicht."
            emailNotice={PLAN_OFFER_OBJECTION_NOTICE}
          />
        </main>
        <SiteFooter />
      </>
    );
  }
  const entities = await listEntitiesByEmail(email);
  // entity_id nur aus diesem Konto. `default` lässt den ungebundenen Entwurf.
  // Eine fremde Id fällt auf die erste Firma zurück und wird nicht übernommen.
  const pick = fragebogenEntitiesForQuery(entities, requestedEntityId);
  const chosen = pick.entities[0];
  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <IntakeForm
          session={{ email, company: chosen?.name ?? "", stripeSessionId: "", stripeCustomerId: "", stub: false }}
          firm={chosen ? { name: chosen.name, street: chosen.street, zip: chosen.zip, city: chosen.city, stnr: chosen.stnr, ustId: chosen.ustId } : { name: "" }}
          entities={entityChoices(pick.entities)}
          initialEntityId={pick.initialEntityId}
          gesamtMode
          stripeTestMode={isStripeTestMode()}
          prepayHref={FRAGEBOGEN_PAKET_PATH}
        />
      </main>
      <SiteFooter />
    </>
  );
}
