import type { Metadata } from "next";
import { RefreshStoredView } from "@/components/refresh-stored-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import { entityChoices } from "@/lib/entities";
import { isStripeConfigured, isStripeTestMode } from "@/lib/env";
import { firstQueryValue } from "@/lib/query";
import { getOwnedEntity, listEntitiesByEmail } from "@/lib/store";
import { ALL_AREAS_LINE, INTAKE_EFFORT_LINE, PRICE_MICRO } from "@/lib/offer-copy";
import {
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  SETUP_GROSS_LABEL,
} from "@/lib/pricing";
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
  const owned =
    email && requestedEntityId ? await getOwnedEntity(requestedEntityId, email) : null;
  const sole = !requestedEntityId && entities.length === 1 ? entities[0] : undefined;
  const boundEntity = owned ?? sole ?? null;
  const initialEntityId = boundEntity?.entityId ?? "";

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
              Listenpreis: {SETUP_EUR}&nbsp;€ netto ({SETUP_GROSS_LABEL}&nbsp;€
              brutto) Einrichtung plus {MONTHLY_EUR}&nbsp;€ netto (
              {MONTHLY_GROSS_LABEL}&nbsp;€ brutto) pro Monat, inkl. 19 % USt.
              Den Aktionscode lösen Sie im Checkout ein. Danach der Fragenkatalog.
            </>
          ) : (
            <>
              {PRICE_MICRO}. {ALL_AREAS_LINE}
            </>
          )}
        </p>
        <p className="prose">{INTAKE_EFFORT_LINE}</p>
        <RefreshStoredView />
        <CheckoutForm
          key={email ?? "signed-out"}
          stripeReady={isStripeConfigured()}
          stripeTestMode={isStripeTestMode()}
          entities={entityChoices(entities)}
          initialEntityId={initialEntityId}
          initialCompany={boundEntity?.name ?? ""}
          initialEmail={email ?? ""}
          audience={partner ? "steuerberater" : "kunde"}
        />
      </main>
      <SiteFooter />
    </>
  );
}
