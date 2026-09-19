import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { editableDocumentFromRow } from "@/lib/document-content";
import {
  canAccessDocument,
  documentDownloadPath,
  groupDocumentFamilies,
  nextVersionNumber,
} from "@/lib/documents";
import { findDocumentById, listDocumentFamily } from "@/lib/store";
import { DocumentEditor } from "./document-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dokument bearbeiten",
  robots: { index: false, follow: false },
};

function EditGate({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="card">
      <h1>Dokument nicht verfügbar</h1>
      <p className="prose">
        {loggedIn
          ? "Dieses Dokument gehört nicht zu deinem Konto."
          : "Bitte mit der Checkout-E-Mail anmelden."}
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn" href={loggedIn ? "/account" : "/login"}>
          {loggedIn ? "Meine Dokumente" : "Anmelden"}
        </Link>
      </div>
    </div>
  );
}

export default async function DocumentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    redirect(loginPath(`/account/dokument/${id}`));
  }

  const sourceRow = await findDocumentById(id);
  if (!sourceRow) {
    return (
      <>
        <SiteHeader backHref="/account" backLabel="← Meine Dokumente" />
        <main className="wrap wide page">
          <EditGate loggedIn />
        </main>
        <SiteFooter />
      </>
    );
  }

  const family = await listDocumentFamily(sourceRow.documentId);
  const latest = groupDocumentFamilies(family)[0]?.latest ?? sourceRow;
  const allowed = canAccessDocument(latest, { sessionEmail });
  const draft = allowed ? editableDocumentFromRow(latest) : null;

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Meine Dokumente" />
      <main className="wrap wide page">
        {!allowed || !draft ? (
          <EditGate loggedIn />
        ) : (
          <>
            <p className="kicker">Konto</p>
            <h1>Dokument bearbeiten</h1>
            <p className="lead">
              Kapiteltext deines Entwurfs. Intake-Angaben bleiben unter
              „Angaben überarbeiten“.
            </p>
            <DocumentEditor
              key={latest.documentId}
              sourceDocumentId={latest.documentId}
              company={latest.company}
              nextVersion={nextVersionNumber(family)}
              initialCover={draft.cover}
              initialChapters={draft.chapters}
              disclaimer={draft.disclaimer}
              currentDownloadPath={documentDownloadPath(latest)}
            />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
