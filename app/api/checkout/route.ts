import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { compCheckoutRedirect, isCompAccessEmail } from "@/lib/comp-access";
import { ds24CheckoutRedirect } from "@/lib/digistore24-access";
import { boundCheckoutEntityId } from "@/lib/checkout-entity";
import { isStripeSecretConfigured } from "@/lib/env";
import { listLifecycleByEmail } from "@/lib/kuendigung-store";
import { findLatestStripeCustomerIdByEmail, getEntity, listEntitiesByEmail } from "@/lib/store";
import {
  coveredIntakePath,
  firmPosition,
  firmStartDecision,
  loadIncludedFirmCoverage,
} from "@/lib/subscription-coverage";
import {
  CHECKOUT_SESSION_ROUTE,
  createCheckoutSession,
  verifyStripeCustomerId,
} from "@/lib/stripe";
import { emailsEqual } from "@/lib/types";
import { loadPlanAccess } from "@/lib/plan-access";
import { memberFromPackage, planCheckoutKind, type PlanCheckoutKind } from "@/lib/plan-checkout";
import {
  isPricingV2,
  memberPreselected,
} from "@/lib/pricing-model";
import { logError } from "@/lib/log-error";

async function reusableCustomerId(email: string): Promise<string | undefined> {
  if (!isStripeSecretConfigured()) return undefined;
  try {
    const rows = await listLifecycleByEmail(email);
    const fromLife =
      [...rows].reverse().find((row) => row.stripeCustomerId)?.stripeCustomerId ?? "";
    const id = fromLife || (await findLatestStripeCustomerIdByEmail(email)) || "";
    if (!id) return undefined;
    return (await verifyStripeCustomerId(id)) === "valid" ? id : undefined;
  } catch (error) {
    logError("[checkout] bekannter Kunde nicht geladen", error);
    return undefined;
  }
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    email?: string;
    company?: string;
    acceptedDisclaimer?: boolean;
    entrepreneur?: boolean;
    entityId?: string;
    audience?: "kunde" | "steuerberater";
    /** Preismodell v2: `mitglied` | `einstieg`. */
    paket?: string;
    /** Preismodell v2: `entry` (Default) | `change` | `member` | `firm`. Die letzten drei nur im Konto. */
    kind?: string;
    /** Preismodell v2: AGB bestätigt. */
    acceptedTerms?: boolean;
    /** Neues Modell: Widerspruch gegen Angebots-Mails. */
    offerOptOut?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const company = body.company?.trim() ?? "";
  const requestedEntityId = body.entityId?.trim() ?? "";
  const sessionEmail = await sessionEmailFromRequest(request);
  const v2 = isPricingV2();
  const kind: PlanCheckoutKind = v2 ? planCheckoutKind(body.kind) : "entry";
  if (v2 && (kind === "addon" || kind === "reactivate")) {
    return accountV3Checkout(kind, sessionEmail);
  }
  if (v2 && kind !== "entry") {
    // Neues Modell (28.10.): 49-€-Änderung, 99,90-€-Mitgliedschaft und weitere Firmen sind abgeschaltet.
    return NextResponse.json({ error: "Das ist im Konto gerade nicht buchbar." }, { status: 404 });
  }
  const compTarget =
    compCheckoutRedirect(sessionEmail, requestedEntityId) ||
    compCheckoutRedirect(email, requestedEntityId) ||
    (await ds24CheckoutRedirect(sessionEmail, requestedEntityId));
  if (compTarget) {
    return NextResponse.json({ url: compTarget });
  }
  let entityOwnerEmail = "";
  if (requestedEntityId) {
    try {
      const entity = await getEntity(requestedEntityId);
      entityOwnerEmail = entity?.userEmail ?? "";
    } catch (error) {
      console.error(
        "[checkout] Firma nicht lesbar",
        error instanceof Error ? error.name : "error",
      );
    }
  }
  const entityId = boundCheckoutEntityId({
    checkoutEmail: email,
    entityId: requestedEntityId,
    entityOwnerEmail,
    sessionEmail,
    dropWhenSessionDiffers: true,
  });

  if (
    sessionEmail &&
    entityId &&
    emailsEqual(sessionEmail, email) &&
    !isCompAccessEmail(sessionEmail) &&
    !isCompAccessEmail(email)
  ) {
    try {
      const entities = await listEntitiesByEmail(sessionEmail);
      const coverage = await loadIncludedFirmCoverage(sessionEmail);
      const decision = firmStartDecision({
        sessionEmail,
        entityOwnerEmail,
        entityId,
        firmPosition: firmPosition(entities, entityId),
        coverage,
      });
      if (decision === "intake") {
        return NextResponse.json({ url: coveredIntakePath(entityId) });
      }
    } catch (error) {
      console.error(
        "[checkout] weitere Firma nicht geprüft",
        error instanceof Error ? error.name : "error",
      );
    }
  }

  if (!company || !email) {
    return NextResponse.json(
      { error: "Bitte Firma und E-Mail angeben." },
      { status: 400 },
    );
  }

  if (body.entrepreneur !== true) {
    return NextResponse.json(
      { error: "Bitte bestätigen Sie, dass Sie als Unternehmer bestellen." },
      { status: 400 },
    );
  }

  if (!body.acceptedDisclaimer) {
    return NextResponse.json(
      {
        error:
          "Bitte bestätigen: keine Steuerberatung und keine Rechtsberatung.",
      },
      { status: 400 },
    );
  }

  if (v2 && body.acceptedTerms !== true) {
    return NextResponse.json(
      { error: "Bitte bestätigen Sie die AGB." },
      { status: 400 },
    );
  }
  // Nachweis der AGB-Bestätigung (Legal 15:20): Zeitpunkt in den Stripe-Metadaten.
  const agbAcceptedAt = v2 ? new Date().toISOString() : undefined;

  try {
    const session = await createCheckoutSession({
      email,
      company,
      entityId: entityId || undefined,
      audience: body.audience === "steuerberater" ? "steuerberater" : "kunde",
      customerId: await reusableCustomerId(email),
      route: CHECKOUT_SESSION_ROUTE,
      ...(v2
        ? {
            plan: {
              kind: "entry" as const,
              member: memberFromPackage(body.paket, memberPreselected()),
              agbAcceptedAt,
              offerOptOut: body.offerOptOut === true,
            },
          }
        : {}),
    });
    return NextResponse.json(session);
  } catch (error) {
    logError("[checkout]", error);
    return NextResponse.json(
      { error: "Checkout konnte nicht gestartet werden." },
      { status: 500 },
    );
  }
}

/**
 * Neues Modell (28.10.), nur angemeldet: Jahrespaket nachbuchen (innerhalb
 * der 30 Tage, Jahr ab Erstkauf) oder Konto reaktivieren (nach Ablauf,
 * 99 € + 49 €/Jahr).
 */
async function accountV3Checkout(
  kind: "addon" | "reactivate",
  sessionEmail: string | null,
): Promise<NextResponse> {
  if (!sessionEmail) {
    return NextResponse.json({ error: "Bitte melden Sie sich an." }, { status: 401 });
  }
  let loaded;
  try {
    loaded = await loadPlanAccess(sessionEmail);
  } catch (error) {
    logError("[checkout] Plan nicht lesbar", error);
    return NextResponse.json(
      { error: "Bitte versuchen Sie es in einem Moment erneut." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
  if (!loaded) {
    return NextResponse.json({ error: "Für dieses Konto gibt es keinen passenden Kauf." }, { status: 403 });
  }
  const allowed = kind === "addon" ? loaded.access.canBecomeMember : loaded.access.canReactivate;
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          kind === "addon"
            ? "Das Jahrespaket ist für dieses Konto gerade nicht buchbar."
            : "Eine Reaktivierung ist für dieses Konto gerade nicht nötig.",
      },
      { status: 409 },
    );
  }
  try {
    const session = await createCheckoutSession({
      email: sessionEmail,
      company: "",
      customerId: loaded.row.stripeCustomerId || (await reusableCustomerId(sessionEmail)),
      route: CHECKOUT_SESSION_ROUTE,
      plan: { kind, member: true, firstPurchasedAt: loaded.row.purchasedAt },
    });
    return NextResponse.json(session);
  } catch (error) {
    logError("[checkout] Konto-Kauf neues Modell", error);
    return NextResponse.json({ error: "Checkout konnte nicht gestartet werden." }, { status: 500 });
  }
}
