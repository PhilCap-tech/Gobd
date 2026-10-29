import type { Metadata } from "next";
import { cache } from "react";
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
  SuccessSessionInvalid,
} from "@/components/success-status";
import { getSessionEmail, sessionIdForCheckoutProof } from "@/lib/auth";
import { isCompAccessEmail } from "@/lib/comp-access";
import { emailShownToViewer } from "@/lib/checkout-session";
import { LOGIN_LINK_FAILED_NOTICE, loginLinkSentNotice } from "@/lib/login-mail";
import { showsLoginLinkSent } from "@/lib/login-mail-shared";
import { DELIVERY_DISCLAIMER } from "@/lib/delivery";
import {
  canAccessDocument,
  groupDocumentFamilies,
  parseDocumentVersion,
} from "@/lib/documents";
import { isMailConfigured } from "@/lib/env";
import { firstQueryValue } from "@/lib/query";
import { isSheetsOutage, SHEETS_RETRY_MESSAGE } from "@/lib/sheets-unavailable";
import { findSuccessDocument, listDocumentFamily } from "@/lib/store";
import {
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  SETUP_GROSS_LABEL,
  V2_ENTRY_CENTS,
  V2_MEMBER_YEAR_CENTS,
  netWithGrossCents,
} from "@/lib/pricing";
import { isPricingV2 } from "@/lib/pricing-model";
import {
  isUnresolvableCheckoutSession,
  lookupSuccessPurchase,
  probeSuccessCheckout,
  shouldProbeSuccessCheckout,
  SUCCESS_CHECKOUT_CHECKED_PARAM,
  successPageBody,
  successPageTitle,
  successPendingHref,
} from "@/lib/success-session";
import { findPlanByEmail } from "@/lib/plan-store";
import { resolveCheckoutSession } from "@/lib/stripe";
import { countsInReporting } from "@/lib/test-entities";
import { purchaseSessionIdFromCheckout } from "@/lib/tracking";
import { versionLabelFromRow } from "@/lib/versioning";

export const dynamic = "force-dynamic";

/** Invoice line for a paid checkout. Comp accounts get no prices. */
export function SuccessAccessNote({
  compAccess,
  memberPlan = false,
}: {
  compAccess: boolean;
  /** v3: Jahrespaket gebucht (Option 2 oder Add-on). Sonst kein Jahrespaket-Satz. */
  memberPlan?: boolean;
}) {
  if (compAccess) {
    return (
      <p className="hint">
        Kostenfreier Zugang. Sie können den Entwurf ohne Zahlung herunterladen.
      </p>
    );
  }
  if (isPricingV2()) {
    return (
      <p className="hint">
        Die Rechnung weist die Nettopreise zuzüglich 19&nbsp;% Umsatzsteuer aus:
        Paket „Einmalig“ {netWithGrossCents(V2_ENTRY_CENTS)}
        {memberPlan ? (
          <>, mit Jahrespaket zusätzlich {netWithGrossCents(V2_MEMBER_YEAR_CENTS)} für das erste Jahr.</>
        ) : (
          "."
        )}
      </p>
    );
  }
  return (
    <p className="hint">
      Die Rechnung weist die Nettopreise zuzüglich 19&nbsp;% Umsatzsteuer
      aus: Einrichtung {SETUP_EUR}&nbsp;€ netto ({SETUP_GROSS_LABEL}
      &nbsp;€ brutto), danach {MONTHLY_EUR}&nbsp;€ netto (
      {MONTHLY_GROSS_LABEL}&nbsp;€ brutto) pro Monat.
    </p>
  );
}

type SuccessSearch = {
  session_id?: string | string[];
  document_id?: string | string[];
  anmeldung?: string | string[];
  geprueft?: string | string[];
};

function successLookupKey(params: SuccessSearch) {
  return [
    firstQueryValue(params.session_id) ?? "",
    firstQueryValue(params.document_id) ?? "",
    firstQueryValue(params[SUCCESS_CHECKOUT_CHECKED_PARAM]) ?? "",
    firstQueryValue(params.anmeldung) ?? "",
  ] as const;
}

const loadSuccessPage = cache(async function loadSuccessPage(
  sessionQuery: string,
  documentQuery: string,
  checkedQuery: string,
  anmeldung: string,
) {
  const sessionId = await sessionIdForCheckoutProof(sessionQuery);
  const alreadyChecked = checkedQuery === "1";
  const documentId = documentQuery || undefined;
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
  const compAccess = isCompAccessEmail(row?.email) || isCompAccessEmail(sessionEmail);
  const memberPlan =
    isPricingV2() && row && allowed
      ? (await findPlanByEmail(row.email).catch(() => null))?.plan === "member"
      : false;
  const showSuccess = Boolean(row && allowed);
  // Live Stripe lookup only once the success view is stable (not the pending reload).
  const purchaseLookup =
    showSuccess && sessionId.startsWith("cs_") && row && countsInReporting(row.entityId)
      ? await lookupSuccessPurchase(sessionId, resolveCheckoutSession)
      : null;
  const purchaseSessionId =
    purchaseLookup &&
    ("error" in purchaseLookup || countsInReporting(purchaseLookup.entityId))
      ? purchaseSessionIdFromCheckout(purchaseLookup)
      : "";

  const sessionInvalid = isUnresolvableCheckoutSession(
    shouldProbeSuccessCheckout({
      sheetsDown,
      hasRow: Boolean(row),
      sessionId,
      alreadyChecked,
    })
      ? await probeSuccessCheckout(sessionId, resolveCheckoutSession)
      : null,
  );
  const body = successPageBody({
    sheetsDown,
    hasRow: Boolean(row),
    allowed,
    sessionId,
    sessionInvalid,
  });
  const pendingHref = successPendingHref({
    sessionId,
    documentId,
    checked:
      alreadyChecked ||
      (Boolean(sessionId) && !sheetsDown && !row && !sessionInvalid),
  });

  return {
    anmeldung,
    body,
    compAccess,
    memberPlan,
    documentId,
    family,
    mailReady,
    ownerView,
    pendingHref,
    purchaseSessionId,
    row,
    sessionEmail,
    sessionId,
    version,
    visibleEmail,
  };
});

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SuccessSearch>;
}): Promise<Metadata> {
  const params = await searchParams;
  const [sessionQuery, documentQuery, checkedQuery, anmeldung] = successLookupKey(params);
  const model = await loadSuccessPage(sessionQuery, documentQuery, checkedQuery, anmeldung);
  return {
    title: successPageTitle(model.body),
    robots: { index: false, follow: false },
  };
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<SuccessSearch>;
}) {
  const params = await searchParams;
  const [sessionQuery, documentQuery, checkedQuery, anmeldung] = successLookupKey(params);
  const {
    body,
    compAccess,
    memberPlan,
    family,
    mailReady,
    ownerView,
    pendingHref,
    purchaseSessionId,
    row,
    sessionEmail,
    sessionId,
    version,
    visibleEmail,
  } = await loadSuccessPage(sessionQuery, documentQuery, checkedQuery, anmeldung);

  return (
    <>
      <SiteHeader backHref="/" backLabel="← Zur Landing" />
      <main className="wrap page">
        {body === "sheets" ? (
          <div className="card">
            <h1>Bitte einen Moment</h1>
            <p className="prose">{SHEETS_RETRY_MESSAGE}</p>
          </div>
        ) : body === "invalid" ? (
          <SuccessSessionInvalid />
        ) : body === "pending" ? (
          <SuccessPending href={pendingHref} sessionId={sessionId} />
        ) : body === "ready" && row ? (
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
            <SuccessAccessNote compAccess={compAccess} memberPlan={memberPlan} />
            <div className="card">
              <p className="prose">
                Kapitelgerüst aus Ihren Intake-Angaben. Keine erfundenen
                GoBD-Rechtstexte. Offene Punkte kennzeichnen, was noch zu
                bestätigen ist. Eine Abstimmung mit dem Steuerberater ist
                optional und nur im Rahmen eines gesonderten Auftrags.
              </p>
              {anmeldung === "keine" ? (
                <p className="hint">
                  Der Download bleibt in Ihrem Konto. Es geht keine weitere E-Mail hinaus.
                </p>
              ) : anmeldung === "fehler" ? (
                <p className="error">{LOGIN_LINK_FAILED_NOTICE}</p>
              ) : showsLoginLinkSent(anmeldung) ? (
                <p className="banner">{loginLinkSentNotice(visibleEmail)}</p>
              ) : null}
              {anmeldung === "keine" ? null : mailReady ? (
                <p className="hint">
                  Wir haben den Download-Link{visibleEmail ? ` an ${visibleEmail}` : ""}{" "}
                  geschickt. Später melden Sie sich über einen Magic Link in Ihrem Konto an.
                </p>
              ) : (
                <p className="banner">
                  Der E-Mail-Versand ist derzeit nicht eingerichtet. Der
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
        ) : (
          <SuccessNotFound />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
