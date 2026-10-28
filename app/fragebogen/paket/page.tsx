import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CheckoutForm } from "@/app/checkout/checkout-form";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { entityChoices } from "@/lib/entities";
import { isStripeConfigured, isStripeTestMode } from "@/lib/env";
import { FRAGEBOGEN_PATH, PAKET_H1, PAKET_INTRO } from "@/lib/fragebogen";
import { planPackageTextsV3 } from "@/lib/plan-copy";
import { intakeLoginFirstEnabled, memberPreselected } from "@/lib/pricing-model";
import { firstQueryValue } from "@/lib/query";
import { listEntitiesByEmail } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Paket wählen",
  robots: { index: false, follow: false },
};

/** Paketwahl + Zahlung nach der letzten Frage (Login zuerst). */
export default async function PaketPage({
  searchParams,
}: {
  searchParams: Promise<{ draftKey?: string | string[]; entity_id?: string | string[] }>;
}) {
  if (!intakeLoginFirstEnabled()) redirect("/checkout");
  const email = await getSessionEmail();
  if (!email) redirect(loginPath(FRAGEBOGEN_PATH));
  const params = await searchParams;
  const draftKey = firstQueryValue(params.draftKey) ?? "";
  // Nur der eigene Login-Entwurf.
  if (!draftKey.startsWith(`email:${email.trim().toLowerCase()}:`)) redirect(FRAGEBOGEN_PATH);
  const entities = await listEntitiesByEmail(email);
  const requested = firstQueryValue(params.entity_id) ?? "";
  const bound = entities.find((e) => e.entityId === requested) ?? entities[0];
  return (
    <>
      <SiteHeader backHref={FRAGEBOGEN_PATH} backLabel="← Zurück zum Fragebogen" />
      <main className="wrap page">
        <h1>{PAKET_H1}</h1>
        <p className="lead">{PAKET_INTRO}</p>
        <CheckoutForm
          key={email}
          stripeReady={isStripeConfigured()}
          stripeTestMode={isStripeTestMode()}
          entities={entityChoices(bound ? [bound] : [])}
          initialEntityId={bound?.entityId ?? ""}
          initialCompany={bound?.name ?? ""}
          initialEmail={email}
          draftKey={draftKey}
          planOffer={{
            initialPackage: memberPreselected() ? "mitglied" : "einstieg",
            packageTexts: planPackageTextsV3(),
          }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
