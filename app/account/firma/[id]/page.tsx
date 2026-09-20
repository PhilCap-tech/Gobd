import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { getOwnedEntity } from "@/lib/store";
import { FirmaForm } from "../firma-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Firma bearbeiten",
  robots: { index: false, follow: false },
};

function EditGate() {
  return (
    <div className="card">
      <h1>Firma nicht verfügbar</h1>
      <p className="prose">Diese Firma gehört nicht zu deinem Konto.</p>
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

  const entity = await getOwnedEntity(id, email);

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap page">
        <p className="kicker">Konto</p>
        {!entity ? (
          <EditGate />
        ) : (
          <>
            <h1>Firma bearbeiten</h1>
            <p className="lead">{entity.name}</p>
            <FirmaForm
              mode="edit"
              entityId={entity.entityId}
              initial={{
                name: entity.name,
                street: entity.street,
                zip: entity.zip,
                city: entity.city,
                stnr: entity.stnr,
                ustId: entity.ustId,
              }}
            />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
