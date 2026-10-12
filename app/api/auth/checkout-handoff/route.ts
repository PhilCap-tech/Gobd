import { NextResponse } from "next/server";
import { clearSessionCookie, loginPath, sessionEmailFromRequest } from "@/lib/auth";
import {
  checkoutHandoffPlan,
  ownerEmailAfterVerifiedCheckout,
} from "@/lib/checkout-session";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { checkoutSessionGrant } from "@/lib/checkout-session-grant";
import { deliverLoginLink, type LoginMailStatus } from "@/lib/login-mail";
import { findLatestDocumentByStripeSessionId } from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";

export const runtime = "nodejs";

export type CheckoutHandoffDeps = {
  resolveOwner: (sessionId: string) => Promise<string | null>;
  deliver: (email: string, next: string) => Promise<LoginMailStatus>;
};

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
  const current = sessionEmailFromRequest(request);
  if (!sessionId || !current) {
    return NextResponse.redirect(new URL("/account", request.url), 303);
  }

  const owner = await deps.resolveOwner(sessionId);
  if (checkoutHandoffPlan({ currentEmail: current, ownerEmail: owner }) !== "send" || !owner) {
    return NextResponse.redirect(new URL("/account", request.url), 303);
  }

  const nextPath = `/intake?session_id=${encodeURIComponent(sessionId)}`;
  const status = await deps.deliver(owner, nextPath);
  if (status === "failed") {
    const back = new URL("/intake", request.url);
    back.searchParams.set("session_id", sessionId);
    back.searchParams.set("handoff", "failed");
    return NextResponse.redirect(back, 303);
  }

  const response = NextResponse.redirect(new URL(loginPath(nextPath), request.url), 303);
  clearSessionCookie(response);
  return response;
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

export function POST(request: Request) {
  return completeCheckoutHandoff(request, {
    resolveOwner: resolveHandoffOwner,
    deliver: deliverLoginLink,
  });
}
