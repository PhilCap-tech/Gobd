import type { Metadata } from "next";
import {
  DocumentRevisionActions,
  VersionHistory,
} from "@/components/document-revision";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PurchaseConversion } from "@/components/purchase-conversion";
import {
  SuccessNotFound,
  SuccessPending,
} from "@/components/success-status";
import { getSessionEmail, sessionIdForCheckoutProof } from "@/lib/auth";
import { emailShownToViewer } from "@/lib/checkout-session";
import { LOGIN_LINK_FAILED_NOTICE, loginLinkSentNotice } from "@/lib/login-mail";
import { DELIVERY_DISCLAIMER } from "@/lib/delivery";
import {
  canAccessDocument,
  groupDocumentFamilies,
  parseDocumentVersion,
} from "@/lib/documents";
import { isMailConfigured } from "@/lib/env";
import { firstQueryValue } from "@/lib/query";
import { isSheetsOutage, SHEETS_RETRY_MESSAGE } from "@/lib/sheets-outage";
import { findSuccessDocument, listDocumentFamily } from "@/lib/store";
import {
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  SETUP_GROSS_LABEL,
} from "@/lib/pricing";
import { resolveCheckoutSession } from "@/lib/stripe";
import { purchaseSessionIdFromCheckout } from "@/lib/tracking";
import { versionLabelFromRow } from "@/lib/versioning";

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
    anmeldung?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const sessionId = await sessionIdForCheckoutProof(firstQueryValue(params.session_id));
  const anmeldung = firstQueryValue(params.anmeldung) ?? "";
  const documentId = firstQueryValue(params.document_id);
  const sessionEmail = await getSessionEmail();
  let sheetsDown = false;
  let row: Awaited<ReturnType<typeof findSuccessDocument>> = null;
  try {
    row = await findSuccessDocument({ documentId, sessionId });
  } catch (error) {
    if (!isSheetsOutage(error)) throw error;
    sheetsDown = true;
  }
  const allowed = Boolean(
    row && canAccessDocument(row, { sessionEmail, sessionId }),
  );
  let family: ReturnType<typeof groupDocumentFamilies>[number] | undefined;
  try {
    family =
      allowed && row
        ? groupDocumentFamilies(await listDocumentFamily(row.documentId))[0]
        : undefined;
  } catch (error) {
    if (!isSheetsOutage(error)) throw error;
    sheetsDown = true;
  }
  const mailReady = isMailConfigured();
  const version = row ? parseDocumentVersion(row) : 1;
  const visibleEmail = row ? emailShownToViewer(row.email, sessionEmail) : "";
  const ownerView = Boolean(visibleEmail && sessionEmail && visibleEmail === row?.email.trim().toLowerCase());
  const showSuccess = Boolean(row && allowed);
  // Live Stripe lookup only once the success view is stable (not the pending reload).
  const purchaseSessionId =
    showSuccess && sessionId.startsWith("cs_")
      ? purchaseSessionIdFromCheckout(await resolveCheckoutSession(sessionId))
      : "";

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
        {sheetsDown ? (
          <div className="card">
            <h1>Bitte einen Moment</h1>
            <p className="prose">{SHEETS_RETRY_MESSAGE}</p>
          </div>
        ) : !row ? (
          sessionId ? (
            <SuccessPending href={pendingHref} sessionId={sessionId} />
          ) : (
            <SuccessNotFound />
          )
        ) : !allowed ? (
          <SuccessNotFound />
        ) : (
          <section>
            {purchaseSessionId ? (
              <PurchaseConversion sessionId={purchaseSessionId} />
            ) : null}
            <p className="kicker">
              Version {versionLabelFromRow({ version: String(version) })}
            </p>
            <h1>Ihr Entwurf ist fertig</h1>
            <p className="lead">
              {row.company || "Ihr Unternehmen"} — Verfahrensdokumentation als
              PDF plus offene Punkte. Entwurf aus Ihren Angaben — keine
              Freigabe.
            </p>
            <p className="hint">
              Die Rechnung weist die Nettopreise zuzüglich 19&nbsp;% Umsatzsteuer
              aus: Einrichtung {SETUP_EUR}&nbsp;€ netto ({SETUP_GROSS_LABEL}
              &nbsp;€ brutto), danach {MONTHLY_EUR}&nbsp;€ netto (
              {MONTHLY_GROSS_LABEL}&nbsp;€ brutto) pro Monat.
            </p>
            <div className="card">
              <p className="prose">
                Kapitelgerüst aus Ihren Intake-Angaben. Keine erfundenen
                GoBD-Rechtstexte. Offene Punkte kennzeichnen, was noch zu
                bestätigen ist. Eine Abstimmung mit dem Steuerberater ist
                optional und nur im Rahmen eines gesonderten Auftrags.
              </p>
              {anmeldung === "fehler" ? (
                <p className="error">{LOGIN_LINK_FAILED_NOTICE}</p>
              ) : anmeldung === "gesendet" || (mailReady && anmeldung !== "stub") ? (
                <p className="banner">{loginLinkSentNotice(visibleEmail)}</p>
              ) : null}
              {mailReady ? (
                <p className="hint">
                  Wir haben den Download-Link{visibleEmail ? ` an ${visibleEmail}` : ""}{" "}
                  geschickt. Später geht’s über Magic Link ins Konto.
                </p>
              ) : (
                <p className="banner">
                  E-Mail-Versand ist in diesem Testpfad nicht eingerichtet. Der
                  Download bleibt hier auf der Seite.
                </p>
              )}
              <DocumentRevisionActions
                row={row}
                sessionId={sessionId}
                showAccountLink
                loggedIn={Boolean(sessionEmail)}
              />
              <VersionHistory
                versions={family?.versions ?? [row]}
                sessionId={sessionId}
                maskActors={!ownerView}
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
