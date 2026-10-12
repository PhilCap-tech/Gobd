import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { checkoutSessionForViewer } from "@/lib/checkout-session";
import { resolveCheckoutSession, type CheckoutResolveError } from "@/lib/stripe";
import type { CheckoutIdentity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  return readCheckoutSession(request, resolveCheckoutSession);
}

export async function readCheckoutSession(
  request: Request,
  resolve: (
    sessionId: string | undefined,
  ) => Promise<CheckoutIdentity | { error: CheckoutResolveError }> = resolveCheckoutSession,
) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? undefined;
  const viewer = await sessionEmailFromRequest(request);
  const result = await resolve(sessionId);

  if ("error" in result) {
    const status =
      result.error === "lookup_failed"
        ? 503
        : result.error === "not_paid"
          ? 403
          : 400;
    return NextResponse.json(result, { status, headers: NO_STORE });
  }

  return NextResponse.json(checkoutSessionForViewer(result, viewer), { headers: NO_STORE });
}
