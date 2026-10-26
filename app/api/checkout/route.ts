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
import { addFirmOffer, boundFirm, firmDecision, type PlanFirmRow } from "@/lib/plan-firms";
import { listPlanFirmsByEmailStrict } from "@/lib/plan-firm-store";
import { memberFromPackage, planCheckoutKind, type PlanCheckoutKind } from "@/lib/plan-checkout";
import {
  extraFirmsEnabled,
  isPricingV2,
  memberPreselected,
} from "@/lib/pricing-model";

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
    console.error("[checkout] bekannter Kunde nicht geladen", error);
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
  if (v2 && kind !== "entry") {
    return accountPlanCheckout(kind, sessionEmail, requestedEntityId);
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

  try {
    const session = await createCheckoutSession({
      email,
      company,
      entityId: entityId || undefined,
      audience: body.audience === "steuerberater" ? "steuerberater" : "kunde",
      customerId: await reusableCustomerId(email),
      route: CHECKOUT_SESSION_ROUTE,
      ...(v2
        ? { plan: { kind: "entry" as const, member: memberFromPackage(body.paket, memberPreselected()) } }
        : {}),
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error("[checkout]", error);
    return NextResponse.json(
      { error: "Checkout konnte nicht gestartet werden." },
      { status: 500 },
    );
  }
}

/**
 * Preismodell v2, nur angemeldet aus dem Konto: Änderung (49 €) oder
 * Mitgliedschaft nachträglich. Beides nur innerhalb der Frist (R7).
 */
async function accountPlanCheckout(
  kind: Exclude<PlanCheckoutKind, "entry">,
  sessionEmail: string | null,
  entityId?: string,
): Promise<NextResponse> {
  if (!sessionEmail) {
    return NextResponse.json({ error: "Bitte melden Sie sich an." }, { status: 401 });
  }
  let loaded;
  try {
    loaded = await loadPlanAccess(sessionEmail);
  } catch (error) {
    console.error("[checkout] Plan nicht lesbar", error instanceof Error ? error.name : "error");
    return NextResponse.json(
      { error: "Bitte versuchen Sie es in einem Moment erneut." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
  if (!loaded) {
    return NextResponse.json({ error: "Für dieses Konto gibt es keinen passenden Kauf." }, { status: 403 });
  }
  if (kind === "firm" && !extraFirmsEnabled()) {
    return NextResponse.json({ error: "Eine weitere Firma ist hier noch nicht buchbar." }, { status: 404 });
  }
  let firms: PlanFirmRow[] = [];
  try {
    firms = extraFirmsEnabled() ? await listPlanFirmsByEmailStrict(loaded.row.email) : [];
  } catch (error) {
    console.error("[checkout] Firmen nicht lesbar", error instanceof Error ? error.name : "error");
    return NextResponse.json(
      { error: "Bitte versuchen Sie es in einem Moment erneut." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
  const target = (entityId ?? "").trim();
  const targetFirm = target ? boundFirm(firms, target) : null;
  let allowed: boolean;
  if (kind === "firm") {
    // Ohne Mitgliedschaft 99 € einmalig; Mitglied über dem Kontingent volle 49 € (laufendes Jahr).
    const offer = addFirmOffer(loaded.row, firms).kind;
    allowed = offer === "single_purchase" || offer === "member_paid";
  } else if (kind === "change" && targetFirm) {
    const decision = firmDecision({ account: loaded.row, firms, entityId: target, newVersion: true });
    allowed = !decision.allowed && decision.reason === "needs_change";
  } else {
    allowed = kind === "change" ? loaded.access.canBuyChange : loaded.access.canBecomeMember;
  }
  if (!allowed) {
    const messages: Record<typeof kind, string> = {
      change: "Eine Änderung ist für dieses Konto gerade nicht buchbar.",
      member: "Die Mitgliedschaft ist für dieses Konto gerade nicht buchbar.",
      firm: "Eine weitere Firma ist für dieses Konto hier nicht buchbar.",
    };
    return NextResponse.json({ error: messages[kind] }, { status: 409 });
  }
  const memberFirm = kind === "firm" && loaded.access.state === "member";
  try {
    const session = await createCheckoutSession({
      email: sessionEmail,
      company: "",
      customerId: await reusableCustomerId(sessionEmail),
      route: CHECKOUT_SESSION_ROUTE,
      entityId: targetFirm ? target : undefined,
      plan: { kind, member: kind === "member", memberFirm },
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error("[checkout] v2-Konto-Kauf", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Checkout konnte nicht gestartet werden." }, { status: 500 });
  }
}
