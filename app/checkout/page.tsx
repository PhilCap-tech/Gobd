import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import { entityById, entityChoices } from "@/lib/entities";
import { isStripeConfigured, isStripeTestMode } from "@/lib/env";
import { firstQueryValue } from "@/lib/query";
import { getOwnedEntity, listEntitiesByEmail } from "@/lib/store";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dokumentation starten",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ entity_id?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedEntityId = firstQueryValue(params.entity_id) ?? "";
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
      <SiteHeader backHref="/" backLabel="← Zurück zur Landing" />
      <main className="wrap page">
        <h1>Dokumentation starten</h1>
        <p className="lead">
          149&nbsp;€ Setup plus 49&nbsp;€/Monat. Danach kurzes Intake.
        </p>
        <CheckoutForm
          stripeReady={isStripeConfigured()}
          stripeTestMode={isStripeTestMode()}
          entities={entityChoices(entities)}
          initialEntityId={initialEntityId}
          initialCompany={owned?.name ?? ""}
          initialEmail={email ?? ""}
        />
      </main>
      <SiteFooter />
    </>
  );
}
