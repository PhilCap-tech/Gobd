import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { getAppUrl, isStripeSecretConfigured } from "@/lib/env";
import { findLatestStripeCustomerIdByEmail } from "@/lib/store";
import { createBillingPortalSession } from "@/lib/stripe";

export const runtime = "nodejs";

function documentsRedirect(portal: string) {
  return NextResponse.redirect(
    `${getAppUrl()}/meine-dokumente?portal=${encodeURIComponent(portal)}`,
    303,
  );
}

export async function POST(request: Request) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  if (!isStripeSecretConfigured()) {
    return documentsRedirect("unavailable");
  }

  const customerId = await findLatestStripeCustomerIdByEmail(email);
  if (!customerId) {
    return documentsRedirect("missing");
  }

  try {
    const session = await createBillingPortalSession(customerId);
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("[portal] Billing-Portal-Session fehlgeschlagen", error);
    return documentsRedirect("error");
  }
}
