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

  try {
    const session = await createCheckoutSession({
      email,
      company,
      entityId: entityId || undefined,
      audience: body.audience === "steuerberater" ? "steuerberater" : "kunde",
      customerId: await reusableCustomerId(email),
      route: CHECKOUT_SESSION_ROUTE,
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
