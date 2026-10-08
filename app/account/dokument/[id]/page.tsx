import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { BlobStorageError, blobFailureClass, resolveChapterContent } from "@/lib/blob";
import {
  editableDocumentFromRow,
  type EditableDocument,
} from "@/lib/document-content";
import { VersionHistory } from "@/components/document-revision";
import {
  canAccessDocument,
  documentDownloadPath,
  latestOwnedInFamily,
  nextVersionNumber,
} from "@/lib/documents";
import { emailsEqual } from "@/lib/types";
import { ensureAccountEntities, findDocumentById, listDocumentFamily } from "@/lib/store";
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
          ? "Dieses Dokument gehört nicht zu Ihrem Konto."
          : "Bitte mit der Checkout-E-Mail anmelden."}
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn" href={loggedIn ? "/account" : "/login"}>
          {loggedIn ? "Zum Konto" : "Anmelden"}
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

  await ensureAccountEntities(sessionEmail);
  const sourceRow = await findDocumentById(id);
  if (!sourceRow) {
    return (
      <>
        <SiteHeader backHref="/account" backLabel="← Zum Konto" />
        <main className="wrap wide page">
          <EditGate loggedIn />
        </main>
        <SiteFooter />
      </>
    );
  }

  const family = await listDocumentFamily(sourceRow.documentId);
  const owned = emailsEqual(sourceRow.email, sessionEmail);
  const latest = owned ? latestOwnedInFamily(family, sessionEmail) ?? sourceRow : null;
  const versions =
    latest && owned
      ? family.filter((row) => emailsEqual(row.email, sessionEmail))
      : [];
  const allowed = latest ? canAccessDocument(latest, { sessionEmail }) : false;
  let chapterError = false;
  let draft: EditableDocument | null = null;
  if (allowed && latest) {
    try {
      draft = editableDocumentFromRow({
        ...latest,
        chapterContent: await resolveChapterContent(latest.chapterContent),
      });
    } catch (error) {
      if (!(error instanceof BlobStorageError)) throw error;
      console.error("[document] Kapiteltext nicht lesbar", blobFailureClass(error));
      chapterError = true;
    }
  }

  return (
    <>
      <SiteHeader backHref="/account" backLabel="← Zum Konto" />
      <main className="wrap wide page">
        {chapterError ? (
          <div className="card">
            <h1>Dokumenttext nicht geladen</h1>
            <p className="prose">
              Der gespeicherte Kapiteltext ist gerade nicht lesbar. Bitte später
              erneut öffnen. Nichts wurde überschrieben.
            </p>
          </div>
        ) : !allowed || !draft || !latest ? (
          <EditGate loggedIn />
        ) : (
          <>
            <p className="kicker">Konto</p>
            <h1>Dokument bearbeiten</h1>
            <p className="lead">
              Kapiteltext Ihres Entwurfs. Intake-Angaben bleiben unter
              „Angaben überarbeiten“.
            </p>
            <DocumentEditor
              key={latest.documentId}
              sourceDocumentId={latest.documentId}
              company={latest.company}
              nextVersion={nextVersionNumber(versions)}
              initialCover={draft.cover}
              initialChapters={draft.chapters}
              disclaimer={draft.disclaimer}
              currentDownloadPath={documentDownloadPath(latest)}
              defaultChangedBy={sessionEmail}
            />
            <VersionHistory
              headingId="versionshistorie-dokument"
              versions={versions}
            />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
