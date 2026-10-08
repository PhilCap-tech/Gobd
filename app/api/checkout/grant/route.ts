import { NextResponse } from "next/server";
import { applyCheckoutGrantCookie } from "@/lib/auth";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { resolveCheckoutSession } from "@/lib/stripe";

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

/**
 * Rückkehr aus Stripe: `session_id` serverseitig prüfen und einen
 * kurzlebigen Nachweis nur für diese Checkout-Session setzen.
 * Das Login-Cookie wird hier nicht gesetzt.
 */
export async function GET(request: Request) {
  const source = new URL(request.url);
  const sessionId = source.searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }

  const resolved = await resolveCheckoutSession(sessionId);
  if ("error" in resolved || (resolved.stub && !devCheckoutStubAllowed())) {
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }

  let email = resolved.email.trim();
  if (resolved.stub) {
    email = source.searchParams.get("email")?.trim() || email;
  }

  const response = NextResponse.redirect(intakeReturn(request, source, "set"));
  if (email && resolved.stripeSessionId) {
    applyCheckoutGrantCookie(response, {
      sessionId: resolved.stripeSessionId,
      email,
    });
  }
  return response;
}
