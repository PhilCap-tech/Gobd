import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { isStripeSecretConfigured } from "@/lib/env";
import { absoluteAccountPortalUrl } from "@/lib/portal";
import { findLatestStripeCustomerIdByEmail } from "@/lib/store";
import { createBillingPortalSession, type PortalStatus } from "@/lib/stripe";

export const runtime = "nodejs";

function accountRedirect(portal: PortalStatus) {
  return NextResponse.redirect(absoluteAccountPortalUrl(portal), 303);
}

export async function POST(request: Request) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  if (!isStripeSecretConfigured()) {
    return accountRedirect("unavailable");
  }

  const customerId = await findLatestStripeCustomerIdByEmail(email);
  if (!customerId) {
    return accountRedirect("missing");
  }

  try {
    const session = await createBillingPortalSession(customerId);
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("[portal] Billing-Portal-Session fehlgeschlagen", error);
    return accountRedirect("error");
  }
}
