import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { getAppUrl, isStripeSecretConfigured } from "@/lib/env";
import { findLatestStripeCustomerIdByEmail } from "@/lib/store";
import {
  createBillingPortalSession,
  type PortalStatus,
} from "@/lib/stripe";

export function accountPortalPath(status?: PortalStatus): string {
  return status ? `/account?portal=${encodeURIComponent(status)}` : "/account";
}

export function absoluteAccountPortalUrl(status: PortalStatus): string {
  return `${getAppUrl()}${accountPortalPath(status)}`;
}

/**
 * Human/tester shortcut for `/portal` and `/billing`.
 * Opens Stripe Customer Portal when session + customer id exist;
 * otherwise lands on `/account` with a status query (Abo block always visible).
 */
export async function redirectToStripePortalOrAccount(): Promise<never> {
  const email = await getSessionEmail();
  if (!email) {
    redirect("/login");
  }
  if (!isStripeSecretConfigured()) {
    redirect(accountPortalPath("unavailable"));
  }
  const customerId = await findLatestStripeCustomerIdByEmail(email);
  if (!customerId) {
    redirect(accountPortalPath("missing"));
  }

  let url: string;
  try {
    ({ url } = await createBillingPortalSession(customerId));
  } catch (error) {
    console.error("[portal] Billing-Portal-Session fehlgeschlagen", error);
    redirect(accountPortalPath("error"));
  }
  redirect(url);
}
