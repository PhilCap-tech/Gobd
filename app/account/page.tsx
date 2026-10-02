import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountAboCard, AccountUpgradeCard } from "@/components/account-abo";
import { AccountFreeCard } from "@/components/account-free";
import { AccountProfileForm } from "@/components/account-profile-form";
import {
  DocumentRevisionActions,
  VersionHistory,
} from "@/components/document-revision";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  customerChangedBy,
  customerChangeSummary,
  customerHubTitle,
} from "@/lib/account-display";
import { getSessionEmail } from "@/lib/auth";
import {
  firmaEditPath,
  groupFamiliesByEntity,
  newDocumentPath,
} from "@/lib/documents";
import {
  entityCapReached,
  formatEntityAddress,
  MAX_ENTITIES_PER_ACCOUNT,
} from "@/lib/entities";
import { firstQueryValue } from "@/lib/query";
import {
  ensureAccountEntities,
  findLatestStripeCustomerIdByEmail,
  getAccountProfile,
} from "@/lib/store";
import { portalStatusCopy, portalStatusFromQuery } from "@/lib/stripe";
import {
  currentVersionBadge,
  formatValidityRange,
  selectCurrentVersion,
  versionLabelFromRow,
} from "@/lib/versioning";

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

  const [{ entities, documents: docs }, profile] = await Promise.all([
    ensureAccountEntities(email),
    getAccountProfile(email),
  ]);
  const groups = groupFamiliesByEntity(entities, docs);
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

        <div className="account-split">
          <AccountAboCard stripeBound={stripeBound} />
          <div className="account-side">
            <AccountFreeCard />
            <AccountProfileForm
              email={email}
              initialName={profile?.name ?? ""}
              atCap={atCap}
              firmHref={
                entities[0] ? firmaEditPath(entities[0].entityId) : null
              }
            />
          </div>
        </div>

        {entities.length === 0 && docs.length === 0 ? (
          <div className="card" id="firmen">
            <p className="prose">
              Zu dieser E-Mail liegt noch keine Firma vor.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
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
            <div className="entity-toolbar" id="firmen">
              {atCap ? (
                <p className="hint" style={{ margin: 0 }}>
                  Du hast das Maximum von {MAX_ENTITIES_PER_ACCOUNT} Firmen
                  erreicht.
                </p>
              ) : (
                <Link className="btn ghost" href="/account/firma/neu">
                  Firma anlegen
                </Link>
              )}
            </div>

            <div className="entity-list">
              {groups.map((group) => {
                const entity = group.entity;
                const title = entity
                  ? customerHubTitle(entity.name, "Firma")
                  : "Ohne Firma";
                const address = entity ? formatEntityAddress(entity) : "";
                return (
                  <article
                    className="card entity-card"
                    key={entity?.entityId ?? "unbound"}
                  >
                    <h2>{title}</h2>
                    {address ? (
                      <p className="doc-meta">{address}</p>
                    ) : entity ? (
                      <p className="doc-meta">Keine Adresse hinterlegt.</p>
                    ) : (
                      <p className="doc-meta">
                        Dokumente ohne Firmenzuordnung — bis zur Zuordnung
                        ungebunden.
                      </p>
                    )}

                    {entity && (
                      <div className="actions" style={{ marginTop: 12 }}>
                        <Link
                          className="btn ghost"
                          href={firmaEditPath(entity.entityId)}
                        >
                          Stammdaten bearbeiten
                        </Link>
                        <Link
                          className="btn"
                          href={newDocumentPath(entity.entityId)}
                        >
                          Neues Dokument
                        </Link>
                      </div>
                    )}

                    {group.families.length === 0 ? (
                      <div className="entity-docs">
                        <p className="prose">
                          Für diese Firma liegt noch kein Entwurf vor.
                        </p>
                      </div>
                    ) : (
                      <div className="entity-docs">
                        {group.families.map((family) => {
                          const pick = selectCurrentVersion(family.versions);
                          const current = pick?.row ?? family.latest;
                          const summary = customerChangeSummary(
                            current.changeSummary,
                          );
                          const who = customerChangedBy(current.changedBy);
                          return (
                            <section
                              className="entity-doc"
                              key={family.familyId}
                            >
                              <h3>
                                {customerHubTitle(
                                  family.latest.company ||
                                    "Verfahrensdokumentation",
                                  "Verfahrensdokumentation",
                                )}
                              </h3>
                              <p className="doc-meta">
                                {currentVersionBadge(Boolean(pick?.fallback))}
                                : Version {versionLabelFromRow(current)} · Gültig{" "}
                                {formatValidityRange(current, family.versions)} ·{" "}
                                {summary} · {who}
                              </p>
                              <DocumentRevisionActions row={family.latest} />
                              <VersionHistory
                                headingId={`versionshistorie-${family.familyId}`}
                                versions={family.versions}
                              />
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {!stripeBound && (
              <AccountUpgradeCard
                compact
                headingId="upgrade-heading-docs"
              />
            )}
          </>
        )}

        <p className="hint" style={{ marginTop: 20 }}>
          {stripeBound
            ? "Identität über die E-Mail aus dem Checkout."
            : "Identität über die E-Mail aus dem Intake."}{" "}
          Der Name im Profil ändert die Anmeldung nicht. Bis zu{" "}
          {MAX_ENTITIES_PER_ACCOUNT} Firmen pro Konto.
        </p>

        <form action="/api/auth/logout" method="post" style={{ marginTop: 16 }}>
          <button className="btn ghost" type="submit">
            Abmelden
          </button>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}
