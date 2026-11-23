import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CheckoutForm } from "@/app/checkout/checkout-form";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { entityChoices } from "@/lib/entities";
import { isStripeConfigured, isStripeTestMode } from "@/lib/env";
import {
  FRAGEBOGEN_DEFAULT_ENTITY,
  FRAGEBOGEN_PATH,
  PAKET_H1,
  PAKET_INTRO,
  fragebogenEntitiesForQuery,
  fragebogenHref,
} from "@/lib/fragebogen";
import { emailDraftEntityId } from "@/lib/intake-draft-shared";
import { planPackageTextsV3 } from "@/lib/plan-copy";
import { intakeLoginFirstEnabled, memberPreselected } from "@/lib/pricing-model";
import { firstQueryValue } from "@/lib/query";
import { listEntitiesByEmail } from "@/lib/store";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { creditHintVisible } from "@/lib/schnellversion-credit";
import { anrechnungBis, listSvPurchases } from "@/lib/schnellversion-record";
import { formatSvDate } from "@/lib/schnellversion-copy";

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
  const keyEntity = emailDraftEntityId(draftKey);
  // Der Schlüssel entscheidet. `default` bleibt ungebunden und wird nicht
  // durch die erste Firma ersetzt. Eine fremde Id fällt sicher zurück.
  const pick = fragebogenEntitiesForQuery(
    entities,
    keyEntity === "" ? FRAGEBOGEN_DEFAULT_ENTITY : keyEntity || requested,
  );
  const bound = pick.entities[0];
  const checkoutCompany = bound?.name ?? "";
  const backHref = keyEntity === "" ? fragebogenHref(FRAGEBOGEN_DEFAULT_ENTITY) : fragebogenHref(pick.initialEntityId);
  const credit = checkoutCompany && schnellversionOffered()
    ? (await listSvPurchases(email)).find((row) => creditHintVisible(row, checkoutCompany, new Date()))
    : undefined;
  return (
    <>
      <SiteHeader backHref={backHref} backLabel="← Zurück zum Fragebogen" />
      <main className="wrap page">
        <h1>{PAKET_H1}</h1>
        <p className="lead">{PAKET_INTRO}</p>
        {credit ? (
          <p className="hint">
            Anrechnung der 49 € für {credit.company} bis zum {formatSvDate(anrechnungBis(credit.purchasedAt))}. Die
            Anrechnung gilt einmal für dieselbe Firma.
          </p>
        ) : null}
        <CheckoutForm
          key={email}
          stripeReady={isStripeConfigured()}
          stripeTestMode={isStripeTestMode()}
          entities={entityChoices(pick.entities)}
          initialEntityId={pick.initialEntityId}
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
