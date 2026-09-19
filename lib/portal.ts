import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { getAppUrl, isStripeSecretConfigured } from "@/lib/env";
import { findLatestStripeCustomerIdByEmail } from "@/lib/store";
import {
  createBillingPortalSession,
  type PortalStatus,
} from "@/lib/stripe";

export function accountPortalPath(status?: PortalStatus): string {
  return status ? `/account?portal=${encodeURIComponent(status)}` : "/account";
}

function resolveLocation(location: string): string {
  if (/^https?:\/\//i.test(location)) return location;
  return `${getAppUrl()}${location}`;
}

/**
 * Human/tester shortcut for `/portal` and `/billing`.
 * Opens Stripe Customer Portal when session + customer id exist;
 * otherwise lands on `/account` with a status query (Abo block always visible).
 */
export async function resolvePortalRedirect(
  loginNext: string = "/portal",
): Promise<{ location: string }> {
  const email = await getSessionEmail();
  if (!email) {
    return { location: loginPath(loginNext) };
  }
  if (!isStripeSecretConfigured()) {
    return { location: accountPortalPath("unavailable") };
  }
  const customerId = await findLatestStripeCustomerIdByEmail(email);
  if (!customerId) {
    return { location: accountPortalPath("missing") };
  }

  try {
    const { url } = await createBillingPortalSession(customerId);
    return { location: url };
  } catch (error) {
    console.error("[portal] Billing-Portal-Session fehlgeschlagen", error);
    return { location: accountPortalPath("error") };
  }
}

export async function redirectToStripePortalOrAccount(
  loginNext: string = "/portal",
): Promise<void> {
  const { location } = await resolvePortalRedirect(loginNext);
  redirect(location);
}

export async function portalRedirectResponse(
  _request: Request,
  loginNext: string = "/portal",
): Promise<NextResponse> {
  const { location } = await resolvePortalRedirect(loginNext);
  const response = NextResponse.redirect(resolveLocation(location), 303);
  response.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );
  return response;
}
