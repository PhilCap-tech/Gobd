import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import { entityById, entityChoices } from "@/lib/entities";
import { isStripeConfigured, isStripeTestMode } from "@/lib/env";
import { firstQueryValue } from "@/lib/query";
import { getOwnedEntity, listEntitiesByEmail } from "@/lib/store";
import { ALL_AREAS_LINE, INTAKE_EFFORT_LINE, PRICE_MICRO } from "@/lib/offer-copy";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dokumentation starten",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity_id?: string | string[];
    utm_campaign?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const requestedEntityId = firstQueryValue(params.entity_id) ?? "";
  const partner = firstQueryValue(params.utm_campaign) === "steuerberater";
  const email = await getSessionEmail();
  const entities = email ? await listEntitiesByEmail(email) : [];
  const owned = email
    ? requestedEntityId
      ? await getOwnedEntity(requestedEntityId, email)
      : entityById(entities, requestedEntityId)
    : null;
  const initialEntityId =
    owned?.entityId ||
    (entities.length === 1 ? entities[0]?.entityId ?? "" : "") ||
    requestedEntityId;

  return (
    <>
      <SiteHeader
        backHref={partner ? "/steuerberater" : "/"}
        backLabel={
          partner ? "← Zurück für Steuerberater" : "← Zurück zur Landing"
        }
      />
      <main className="wrap page">
        <h1>{partner ? "Partner-Pilot starten" : "Dokumentation starten"}</h1>
        <p className="lead">
          {partner ? (
            <>
              Listenpreis: {SETUP_EUR}&nbsp;€ Setup plus {MONTHLY_EUR}&nbsp;€/Monat.
              Den Aktionscode lösen Sie im Checkout ein. Danach der Fragenkatalog.
            </>
          ) : (
            <>
              {PRICE_MICRO}. {ALL_AREAS_LINE}
            </>
          )}
        </p>
        <p className="prose">{INTAKE_EFFORT_LINE}</p>
        <CheckoutForm
          stripeReady={isStripeConfigured()}
          stripeTestMode={isStripeTestMode()}
          entities={entityChoices(entities)}
          initialEntityId={initialEntityId}
          initialCompany={owned?.name ?? ""}
          initialEmail={email ?? ""}
          audience={partner ? "steuerberater" : "kunde"}
        />
      </main>
      <SiteFooter />
    </>
  );
}
