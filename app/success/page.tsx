import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionEmail } from "@/lib/auth";
import { DELIVERY_DISCLAIMER } from "@/lib/delivery";
import {
  canAccessDocument,
  documentDownloadPath,
  intakeEditPath,
  parseDocumentVersion,
} from "@/lib/documents";
import { isMailConfigured } from "@/lib/env";
import { findDocumentById } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dokument bereit",
  robots: { index: false, follow: false },
};

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => item && item.trim()) || undefined;
  }
  return value;
}

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
  const row = documentId ? await findDocumentById(documentId) : null;
  const allowed = Boolean(
    row && canAccessDocument(row, { sessionEmail, sessionId }),
  );
  const downloadHref =
    allowed && row ? documentDownloadPath(row, sessionId) : null;
  const editHref = allowed && row ? intakeEditPath(row, sessionId) : null;
  const mailReady = isMailConfigured();
  const version = row ? parseDocumentVersion(row) : 1;

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        {!allowed || !row ? (
          <div className="card">
            <h1>Dokument nicht gefunden</h1>
            <p className="prose">
              Der Entwurf ist nicht verfügbar. Wenn du gerade bezahlt hast,
              öffne den Link aus der E-Mail oder melde dich an.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" href="/login">
                Anmelden
              </Link>
              <Link className="btn ghost" href="/checkout">
                Dokumentation starten
              </Link>
            </div>
          </div>
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
              <div className="actions" style={{ marginTop: 16 }}>
                {downloadHref && (
                  <a className="btn" href={downloadHref}>
                    PDF herunterladen
                  </a>
                )}
                {editHref && (
                  <Link className="btn ghost" href={editHref}>
                    Angaben bearbeiten
                  </Link>
                )}
                <Link className="btn ghost" href="/account">
                  Meine Dokumente
                </Link>
              </div>
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
