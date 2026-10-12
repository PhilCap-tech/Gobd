import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountAboCard } from "@/components/account-abo";
import { AccountCompanyCard } from "@/components/account-company-card";
import { AccountResourcesCard } from "@/components/account-free";
import { AccountProfileForm } from "@/components/account-profile-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { prepareAccountCheckout } from "@/lib/account-checkout-prefill";
import { accountCompanyCards } from "@/lib/account-hub";
import { FIRMA_ADD_LABEL } from "@/lib/account-labels";
import { getSessionEmail } from "@/lib/auth";
import { firmaEditPath } from "@/lib/documents";
import {
  entityCapReached,
  MAX_ENTITIES_PER_ACCOUNT,
} from "@/lib/entities";
import {
  listOpenDraftsForEmail,
  openDraftContinuePath,
  openDraftLabel,
} from "@/lib/open-drafts";
import { firstQueryValue } from "@/lib/query";
import { findLatestStripeCustomerIdByEmail } from "@/lib/store";
import { portalStatusCopy, portalStatusFromQuery } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meine Firmen",
  robots: { index: false, follow: false },
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string | string[] }>;
}) {
  const email = await getSessionEmail();
  if (!email) {
    redirect("/login");
  }

  const params = await searchParams;
  const portalStatus = portalStatusFromQuery(firstQueryValue(params.portal));
  const portalCopy = portalStatus ? portalStatusCopy(portalStatus) : null;

  const { entities, documents: docs, profile } = await prepareAccountCheckout(email);
  const hub = accountCompanyCards(entities, docs, await listOpenDraftsForEmail(email));
  const groups = hub.groups;
  const openDrafts = hub.openDrafts;
  const customerId = await findLatestStripeCustomerIdByEmail(email);
  const stripeBound =
    Boolean(customerId) ||
    docs.some((row) => row.stripeCustomerId || row.stripeSessionId);
  const atCap = entityCapReached(entities.length);

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap account-wrap page">
        <p className="kicker">Konto</p>
        <h1>Meine Firmen</h1>
        <p className="lead">
          {profile?.name ? (
            <>
              {profile.name}
              <br />
              <span className="doc-meta">{email}</span>
            </>
          ) : (
            email
          )}
        </p>

        {portalCopy && (
          <p
            className={portalCopy.tone === "ok" ? "banner ok" : "banner warn"}
            role="status"
          >
            {portalCopy.text}
          </p>
        )}

        {openDrafts.length > 0 && (
          <section className="card" id="offene-entwuerfe" aria-labelledby="offene-entwuerfe-heading">
            <h2 id="offene-entwuerfe-heading">Offener Entwurf</h2>
            <p className="prose">
              Ihre Angaben sind gespeichert. Sie können den Entwurf weiter ausfüllen.
            </p>
            {openDrafts.map((draft) => (
              <div className="actions" key={draft.draftKey} style={{ marginTop: 12 }}>
                <span className="doc-meta">{openDraftLabel(draft)}</span>
                <Link className="btn" href={openDraftContinuePath(draft)}>
                  Weiter ausfüllen
                </Link>
              </div>
            ))}
          </section>
        )}

        <div className="account-companies" id="firmen">
          {entities.length === 0 && docs.length === 0 ? (
            <div className="card">
              <p className="prose">
                Zu dieser E-Mail liegt noch keine Firma vor.
              </p>
              <div className="actions entity-actions">
                <Link
                  className={stripeBound ? "btn" : "btn ghost"}
                  href="/account/firma/neu"
                >
                  Firma anlegen
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="entity-list">
                {groups.map((group) => (
                  <AccountCompanyCard
                    key={group.entity?.entityId ?? "unbound"}
                    group={group}
                    email={email}
                    empty={group.families.length === 0 && group.continueDrafts.length === 0}
                  />
                ))}
              </div>
              <div className="entity-toolbar">
                {atCap ? (
                  <p className="hint">
                    Sie haben das Maximum von {MAX_ENTITIES_PER_ACCOUNT} Firmen
                    erreicht.
                  </p>
                ) : (
                  <Link className="btn ghost" href="/account/firma/neu">
                    {entities.length === 0 ? "Firma anlegen" : FIRMA_ADD_LABEL}
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        <div className="account-tiles">
          <AccountAboCard stripeBound={stripeBound} />
          <AccountProfileForm
            email={email}
            initialName={profile?.name ?? ""}
            atCap={atCap}
            firmHref={entities[0] ? firmaEditPath(entities[0].entityId) : null}
          />
          <AccountResourcesCard subscribed={stripeBound} />
        </div>

        <p className="hint account-note">
          {stripeBound
            ? "Identität über die E-Mail aus dem Checkout."
            : "Identität über die E-Mail aus dem Intake."}{" "}
          Der Name im Profil ändert die Anmeldung nicht. Bis zu{" "}
          {MAX_ENTITIES_PER_ACCOUNT} Firmen pro Konto.
        </p>

        <form action="/api/auth/logout" method="post" className="account-logout">
          <button className="btn ghost" type="submit">
            Abmelden
          </button>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}
