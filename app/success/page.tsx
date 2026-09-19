import type { Metadata } from "next";
import {
  DocumentRevisionActions,
  VersionHistory,
} from "@/components/document-revision";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  SuccessNotFound,
  SuccessPending,
} from "@/components/success-status";
import { getSessionEmail } from "@/lib/auth";
import { DELIVERY_DISCLAIMER } from "@/lib/delivery";
import {
  canAccessDocument,
  groupDocumentFamilies,
  parseDocumentVersion,
} from "@/lib/documents";
import { isMailConfigured } from "@/lib/env";
import { firstQueryValue } from "@/lib/query";
import { findSuccessDocument, listDocumentFamily } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dokument bereit",
  robots: { index: false, follow: false },
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string | string[];
    document_id?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const sessionId = firstQueryValue(params.session_id);
  const documentId = firstQueryValue(params.document_id);
  const sessionEmail = await getSessionEmail();
  const row = await findSuccessDocument({ documentId, sessionId });
  const allowed = Boolean(
    row && canAccessDocument(row, { sessionEmail, sessionId }),
  );
  const family = allowed && row
    ? groupDocumentFamilies(await listDocumentFamily(row.documentId))[0]
    : undefined;
  const mailReady = isMailConfigured();
  const version = row ? parseDocumentVersion(row) : 1;

  const pendingQuery = new URLSearchParams();
  if (sessionId) pendingQuery.set("session_id", sessionId);
  if (documentId) pendingQuery.set("document_id", documentId);
  const pendingHref = pendingQuery.toString()
    ? `/success?${pendingQuery.toString()}`
    : "/success";

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        {!row ? (
          sessionId ? (
            <SuccessPending href={pendingHref} sessionId={sessionId} />
          ) : (
            <SuccessNotFound />
          )
        ) : !allowed ? (
          <SuccessNotFound />
        ) : (
          <section>
            <p className="kicker">Version {version}</p>
            <h1>Dein Entwurf ist fertig</h1>
            <p className="lead">
              {row.company || "Dein Unternehmen"} — Verfahrensdokumentation als
              PDF plus offene Punkte. Zur Abstimmung mit deinem Steuerberater.
            </p>
            <div className="card">
              <p className="prose">
                Kapitelgerüst aus deinen Intake-Angaben. Keine erfundenen
                GoBD-Rechtstexte — Platzhalter kennzeichnen, was mit dem
                Steuerberater zu füllen ist.
              </p>
              {mailReady ? (
                <p className="hint">
                  Wir haben den Download-Link{row.email ? ` an ${row.email}` : ""}{" "}
                  geschickt. Später geht’s über Magic Link ins Konto.
                </p>
              ) : (
                <p className="banner">
                  E-Mail-Versand ist nicht konfiguriert (Demo). Der Download
                  bleibt hier auf der Seite. Magic-Link-Mail folgt, sobald{" "}
                  <code>RESEND_API_KEY</code> und <code>EMAIL_FROM</code> gesetzt
                  sind.
                </p>
              )}
              <DocumentRevisionActions
                row={row}
                sessionId={sessionId}
                showAccountLink
              />
              <VersionHistory
                versions={family?.versions ?? [row]}
                sessionId={sessionId}
              />
              <p className="disclaimer" role="note">
                {DELIVERY_DISCLAIMER}
              </p>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
