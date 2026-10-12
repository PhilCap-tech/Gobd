import { NextResponse } from "next/server";
import { loginPath, sessionEmailFromRequest } from "@/lib/auth";
import { notifyBuyerOfCheckout } from "@/lib/buyer-onboarding";
import { ensureBuyerFirmForCheckout, type BuyerFirmRequest } from "@/lib/checkout-firm";
import { finishCheckoutReturn } from "@/lib/checkout-session";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { findLatestDocumentByStripeSessionId } from "@/lib/store";
import { resolveCheckoutSession, type CheckoutResolveError } from "@/lib/stripe";
import type { CheckoutIdentity } from "@/lib/types";

export const runtime = "nodejs";

const PASSTHROUGH = [
  "session_id",
  "email",
  "company",
  "document_id",
  "entity_id",
  "bereich",
  "basis",
  "modus",
  "schritt",
  "modul",
] as const;

function intakeReturn(request: Request, source: URL, grant: "set" | "skip"): URL {
  const target = new URL("/intake", request.url);
  for (const key of PASSTHROUGH) {
    const value = source.searchParams.get(key)?.trim();
    if (value) target.searchParams.set(key, value);
  }
  target.searchParams.set("grant", grant);
  return target;
}

function intakePath(source: URL): string {
  const target = new URL("/intake", "http://safe.invalid");
  for (const key of PASSTHROUGH) {
    const value = source.searchParams.get(key)?.trim();
    if (value) target.searchParams.set(key, value);
  }
  const query = target.searchParams.toString();
  return query ? `/intake?${query}` : "/intake";
}

export type CheckoutGrantIo = {
  resolveCheckout: (
    sessionId: string,
  ) => Promise<CheckoutIdentity | { error: CheckoutResolveError }>;
  lookupDocumentOwner: (sessionId: string) => Promise<string | null>;
  /** Order mail to the checkout email. Defaults ignore the browser session. */
  notifyBuyer?: (input: {
    email: string;
    company?: string;
    sessionId: string;
  }) => Promise<void>;
  /** Firm owned by the checkout email. A foreign entity id is not returned. */
  bindBuyerFirm?: (input: BuyerFirmRequest) => Promise<string>;
};

const defaultGrantIo: CheckoutGrantIo = {
  resolveCheckout: resolveCheckoutSession,
  lookupDocumentOwner: async (id) => {
    const existing = await findLatestDocumentByStripeSessionId(id);
    return existing ? existing.email : null;
  },
};

/**
 * Rückkehr aus Stripe: `session_id` serverseitig prüfen.
 * Ein bestehendes Login wird nie ersetzt. Nach dem ersten Login,
 * nach einer gespeicherten Fassung und nach jedem abgesendeten Intake
 * führt dieselbe ID zur Anmeldung statt zu einem neuen Cookie.
 */
export async function completeCheckoutGrant(
  request: Request,
  io: CheckoutGrantIo = defaultGrantIo,
): Promise<NextResponse> {
  const source = new URL(request.url);
  const sessionId = source.searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }

  const resolved = await io.resolveCheckout(sessionId);
  if ("error" in resolved || (resolved.stub && !devCheckoutStubAllowed())) {
    source.searchParams.delete("entity_id");
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }

  let email = typeof resolved.email === "string" ? resolved.email.trim() : "";
  if (resolved.stub) {
    email = source.searchParams.get("email")?.trim() || email;
  }

  if (!email || !resolved.stripeSessionId) {
    source.searchParams.delete("entity_id");
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }

  let buyerEntityId = "";
  try {
    const bind = io.bindBuyerFirm ?? ensureBuyerFirmForCheckout;
    buyerEntityId = await bind({
      email,
      company: resolved.company,
      entityId: resolved.entityId || source.searchParams.get("entity_id") || "",
      sessionId: resolved.stripeSessionId,
      street: resolved.billingAddress?.line1,
      zip: resolved.billingAddress?.postalCode,
      city: resolved.billingAddress?.city,
      ustId: resolved.ustId,
    });
  } catch (error) {
    console.error(
      "[checkout] Firma für den Käufer nicht angelegt",
      error instanceof Error ? error.name : "error",
    );
  }
  if (buyerEntityId && /^[A-Za-z0-9_-]+$/.test(buyerEntityId) && buyerEntityId.length <= 200) {
    source.searchParams.set("entity_id", buyerEntityId);
  } else {
    source.searchParams.delete("entity_id");
  }

  if (!resolved.stub) {
    try {
      const notify = io.notifyBuyer ?? notifyBuyerOfCheckout;
      await notify({
        email,
        company: resolved.company,
        sessionId: resolved.stripeSessionId,
      });
    } catch (error) {
      console.error(
        "[checkout] Bestellmail nicht ausgelöst",
        error instanceof Error ? error.name : "error",
      );
    }
  }

  const response = NextResponse.redirect(intakeReturn(request, source, "set"));
  const decision = await finishCheckoutReturn(
    response,
    {
      stub: resolved.stub,
      customerEmail: email,
      stripeSessionId: resolved.stripeSessionId,
      existingSessionEmail: await sessionEmailFromRequest(request),
    },
    io.lookupDocumentOwner,
  );

  if (decision === "mismatch") {
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }
  if (decision === "login") {
    return NextResponse.redirect(new URL(loginPath(intakePath(source)), request.url));
  }
  return response;
}

export async function GET(request: Request) {
  return completeCheckoutGrant(request);
}
