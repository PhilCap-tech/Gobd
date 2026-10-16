import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  loginPath,
  presentedSessionEmail,
  sessionEmailFromRequest,
} from "@/lib/auth";
import { revokeSessionsForEmail } from "@/lib/session-revocation";
import { ensureBuyerFirmForCheckout } from "@/lib/checkout-firm";
import { ownerEmailAfterVerifiedCheckout } from "@/lib/checkout-session";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { checkoutSessionGrant } from "@/lib/checkout-session-grant";
import { deliverLoginLink, type LoginMailStatus } from "@/lib/login-mail";
import { findLatestDocumentByStripeSessionId } from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";
import { isTestEntity } from "@/lib/test-entities";
import { emailsEqual } from "@/lib/types";

export const runtime = "nodejs";

export type CheckoutHandoffDeps = {
  resolveOwner: (sessionId: string) => Promise<string | null>;
  deliver: (email: string, next: string) => Promise<LoginMailStatus>;
  /**
   * Firm id to keep on the magic-link next. Empty omits entity_id.
   * Only an id owned by the buyer may be returned.
   */
  buyerEntityId?: (input: {
    email: string;
    sessionId: string;
    requestedEntityId: string;
  }) => Promise<string>;
};

function intakeNextPath(sessionId: string, entityId: string): string {
  const params = new URLSearchParams();
  params.set("session_id", sessionId);
  if (/^[A-Za-z0-9_-]+$/.test(entityId) && entityId.length <= 200) {
    params.set("entity_id", entityId);
  }
  return `/intake?${params.toString()}`;
}

/**
 * Abmelden und den Anmeldelink an die Kauf-Adresse schicken.
 * Die Adresse kommt nur aus der geprüften Checkout-Session, nie aus dem Formular.
 */
export async function completeCheckoutHandoff(
  request: Request,
  deps: CheckoutHandoffDeps,
): Promise<NextResponse> {
  const form = await request.formData();
  const sessionId = String(form.get("session_id") ?? "").trim();
  const requestedEntityId = String(form.get("entity_id") ?? "").trim();
  const presented = presentedSessionEmail(request);
  const current = await sessionEmailFromRequest(request);

  const loggedOut = async (path: string) => {
    if (presented) {
      try {
        await revokeSessionsForEmail(presented);
      } catch (error) {
        console.error(
          "[auth] Abmelden nicht gespeichert",
          error instanceof Error ? error.name : "error",
        );
        return NextResponse.json(
          { error: "Die Abmeldung ist fehlgeschlagen. Bitte versuchen Sie es noch einmal." },
          { status: 500, headers: { "Cache-Control": "private, no-store" } },
        );
      }
    }
    const response = NextResponse.redirect(new URL(path, request.url), 303);
    clearSessionCookie(response, request.url);
    return response;
  };

  if (!sessionId) {
    return await loggedOut("/login");
  }

  let owner: string | null = null;
  try {
    owner = await deps.resolveOwner(sessionId);
  } catch (error) {
    console.error(
      "[auth] Checkout-Inhaber nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
  }

  const ownerEmail = owner?.trim().toLowerCase() ?? "";
  const currentEmail = current?.trim().toLowerCase() ?? "";
  if (ownerEmail && currentEmail && ownerEmail === currentEmail) {
    return NextResponse.redirect(new URL("/account", request.url), 303);
  }
  if (!ownerEmail) {
    return await loggedOut("/login");
  }

  let buyerEntityId = "";
  if (deps.buyerEntityId) {
    try {
      buyerEntityId = await deps.buyerEntityId({
        email: ownerEmail,
        sessionId,
        requestedEntityId,
      });
    } catch (error) {
      console.error(
        "[auth] Firma des Käufers nicht lesbar",
        error instanceof Error ? error.name : "error",
      );
    }
  }
  const nextPath = intakeNextPath(sessionId, buyerEntityId);
  if (isTestEntity(buyerEntityId) || isTestEntity(requestedEntityId)) {
    return await loggedOut(loginPath(nextPath));
  }
  const status = await deps.deliver(ownerEmail, nextPath);
  if (status === "failed") {
    const back = new URL("/intake", request.url);
    back.searchParams.set("session_id", sessionId);
    back.searchParams.set("handoff", "failed");
    return NextResponse.redirect(back, 303);
  }

  return await loggedOut(loginPath(nextPath));
}

async function resolveHandoffOwner(sessionId: string): Promise<string | null> {
  const resolved = await resolveCheckoutSession(sessionId);
  if (!("error" in resolved) && !(resolved.stub && !devCheckoutStubAllowed())) {
    const owner = await ownerEmailAfterVerifiedCheckout(
      {
        stub: resolved.stub,
        customerEmail: resolved.email,
        stripeSessionId: resolved.stripeSessionId || sessionId,
      },
      async (id) => {
        const existing = await findLatestDocumentByStripeSessionId(id);
        return existing ? existing.email : null;
      },
    );
    if (owner) return owner;
  }
  const recorded = await checkoutSessionGrant(sessionId);
  return recorded?.email ?? null;
}

async function resolveBuyerEntityId(input: {
  email: string;
  sessionId: string;
  requestedEntityId: string;
}): Promise<string> {
  let company = "";
  let entityId = input.requestedEntityId.trim();
  let street = "";
  let zip = "";
  let city = "";
  let ustId = "";
  try {
    const resolved = await resolveCheckoutSession(input.sessionId);
    if (!("error" in resolved) && !(resolved.stub && !devCheckoutStubAllowed())) {
      if (!resolved.email.trim() || emailsEqual(resolved.email, input.email)) {
        company = resolved.company;
        if (!entityId) entityId = resolved.entityId?.trim() ?? "";
        street = resolved.billingAddress?.line1?.trim() ?? "";
        zip = resolved.billingAddress?.postalCode?.trim() ?? "";
        city = resolved.billingAddress?.city?.trim() ?? "";
        ustId = resolved.ustId?.trim() ?? "";
      }
    }
  } catch (error) {
    console.error(
      "[auth] Checkout-Firma nicht aus der Session gelesen",
      error instanceof Error ? error.name : "error",
    );
  }
  return ensureBuyerFirmForCheckout({
    email: input.email,
    company,
    entityId,
    sessionId: input.sessionId,
    street,
    zip,
    city,
    ustId,
  });
}

export function POST(request: Request) {
  return completeCheckoutHandoff(request, {
    resolveOwner: resolveHandoffOwner,
    deliver: deliverLoginLink,
    buyerEntityId: resolveBuyerEntityId,
  });
}
