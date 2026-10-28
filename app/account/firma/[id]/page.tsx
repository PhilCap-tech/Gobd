import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { customerHubTitle } from "@/lib/account-display";
import { readAuditPage } from "@/lib/audit-store";
import type { AuditListItem } from "@/lib/audit-log";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { findActiveMembership } from "@/lib/membership-store";
import { getOwnedEntity } from "@/lib/store";
import { SHEETS_RETRY_MESSAGE } from "@/lib/sheets-unavailable";
import { MODULE } from "@/lib/module/katalog";
import { listMembershipsByEntity } from "@/lib/membership-store";
import { moduleIdList } from "@/lib/memberships";
import { Aenderungen } from "../aenderungen";
import { FirmaForm } from "../firma-form";
import { MitwirkendePanel, type MitwirkendeListItem } from "../mitwirkende-panel";
import { v3InvitePrepayDenial } from "@/lib/v3-firm-limit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Firma bearbeiten",
  robots: { index: false, follow: false },
};

function EditGate({ unavailable }: { unavailable: boolean }) {
  return (
    <div className="card">
      <h1>Firma nicht verfügbar</h1>
      <p className="prose">
        {unavailable ? SHEETS_RETRY_MESSAGE : "Diese Firma gehört nicht zu Ihrem Konto."}
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn" href="/account">
          Zum Konto
        </Link>
      </div>
    </div>
  );
}

export default async function EditFirmaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const email = await getSessionEmail();
  if (!email) {
    redirect(loginPath(`/account/firma/${id}`));
  }

  const inviteBlocked = await v3InvitePrepayDenial(email);
  let entity: Awaited<ReturnType<typeof getOwnedEntity>> = null;
  let entityUnavailable = false;
  try {
    entity = await getOwnedEntity(id, email);
  } catch (error) {
    entityUnavailable = true;
    console.error(
      "[account] Firma nicht geladen",
      error instanceof Error ? error.name : "error",
    );
  }
  let memberOfFirm = false;
  if (!entity && !entityUnavailable) {
    try {
      memberOfFirm = Boolean(await findActiveMembership(email, id));
    } catch (error) {
      entityUnavailable = true;
      console.error(
        "[account] Mitwirkung nicht geprüft",
        error instanceof Error ? error.name : "error",
      );
    }
  }
  if (memberOfFirm) redirect(`/account/mitwirkung/${id}`);

  let members: MitwirkendeListItem[] = [];
  let membersUnavailable = false;
  let auditEntries: AuditListItem[] = [];
  let auditNext: number | null = null;
  let auditUnavailable = false;
  if (entity) {
    try {
      const rows = await listMembershipsByEntity(entity.entityId);
      members = rows
        .filter((row) => row.status === "pending" || row.status === "active")
        .map((row) => ({
          membershipId: row.membershipId,
          memberEmail: row.memberEmail,
          status: row.status === "active" ? "active" : "pending",
          moduleIds: moduleIdList(row.moduleIds),
        }));
    } catch (error) {
      membersUnavailable = true;
      console.error(
        "[account] Mitwirkende nicht geladen",
        error instanceof Error ? error.name : "error",
      );
    }
    try {
      const page = await readAuditPage(entity.entityId, 0);
      auditEntries = page.entries;
      auditNext = page.nextOffset;
    } catch (error) {
      auditUnavailable = true;
      console.error(
        "[account] Änderungshistorie nicht geladen",
        error instanceof Error ? error.name : "error",
      );
    }
  }

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <p className="kicker">Konto</p>
        {entityUnavailable || !entity ? (
          <EditGate unavailable={entityUnavailable} />
        ) : (
          <>
            <h1>Firma bearbeiten</h1>
            <p className="lead">
              {customerHubTitle(entity.name, "Firma")}
            </p>
            <FirmaForm
              mode="edit"
              entityId={entity.entityId}
              showCheckoutNote={entity.checkoutPrefill === "review"}
              initial={{
                name: entity.name,
                street: entity.street,
                zip: entity.zip,
                city: entity.city,
                stnr: entity.stnr,
                ustId: entity.ustId,
              }}
            />
            <MitwirkendePanel
              entityId={entity.entityId}
              firmName={entity.name}
              members={members}
              unavailable={membersUnavailable}
              inviteBlocked={inviteBlocked}
              modules={MODULE.map((modul) => ({
                id: modul.id,
                nr: modul.nr,
                titel: modul.titel,
              }))}
            />
            <Aenderungen
              entityId={entity.entityId}
              firmName={entity.name}
              entries={auditEntries}
              nextOffset={auditNext}
              unavailable={auditUnavailable}
            />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
