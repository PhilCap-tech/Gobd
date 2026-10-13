import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { isCompAccessEmail } from "@/lib/comp-access";
import { getAppUrl, isStripeSecretConfigured } from "@/lib/env";
import { resolveStripeCustomerForEmail } from "@/lib/store";
import { loadCancellationPreview } from "@/lib/kuendigung-stripe";
import {
  accountBillingPath,
  classifyBillingPortalError,
  createBillingPortalSession,
  type PortalStatus,
} from "@/lib/stripe";

export function accountPortalPath(status?: PortalStatus): string {
  return accountBillingPath(status);
}

function resolveLocation(location: string): string {
  if (/^https?:\/\//i.test(location)) return location;
  return `${getAppUrl()}${location}`;
}

/**
 * Human/tester shortcut for `/portal` and `/billing`.
 * Opens Stripe Customer Portal when session + customer id exist;
 * otherwise lands on `/account/billing` with a status query.
 */
export async function resolvePortalRedirect(
  loginNext: string = "/portal",
): Promise<{ location: string }> {
  const email = await getSessionEmail();
  if (!email) {
    return { location: loginPath(loginNext) };
  }
  if (isCompAccessEmail(email)) {
    return { location: "/account" };
  }
  if (!isStripeSecretConfigured()) {
    return { location: accountPortalPath("unavailable") };
  }
  const resolved = await resolveStripeCustomerForEmail(email);
  if (!resolved.customerId) {
    if (resolved.lookupFailed) {
      console.error("[portal] Customer-Lookup fehlgeschlagen");
      return { location: accountPortalPath("error") };
    }
    return { location: accountPortalPath("missing") };
  }

  try {
    const { url } = await createBillingPortalSession(resolved.customerId);
    return { location: url };
  } catch (error) {
    const kind = classifyBillingPortalError(error);
    if (kind === "missing_customer") {
      console.error(
        "[portal] Billing-Portal: Customer fehlt oder andere Stripe-Mode",
        error,
      );
      return { location: accountPortalPath("missing") };
    }
    if (kind === "portal_config") {
      console.error(
        "[portal] Billing-Portal: Konfiguration fehlt (Dashboard)",
        error,
      );
      return { location: accountPortalPath("config") };
    }
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

/**
 * Kurzwege `/portal` und `/billing` führen auf die Kündigungsseite,
 * sobald ein kündbares Abo existiert. Zahlungsmittel bleiben über
 * `/account/billing` erreichbar.
 */
export async function redirectToKuendigungOrPortal(
  loginNext: string = "/portal",
): Promise<void> {
  const email = await getSessionEmail();
  if (!email) {
    redirect(loginPath(loginNext));
  }
  if (isCompAccessEmail(email)) {
    redirect("/account");
  }
  if (!isStripeSecretConfigured()) {
    redirect(accountPortalPath("unavailable"));
  }
  let toCancellation = false;
  try {
    const resolved = await resolveStripeCustomerForEmail(email);
    if (resolved.customerId && !resolved.lookupFailed) {
      const preview = await loadCancellationPreview(resolved.customerId);
      toCancellation = Boolean(preview.subscriptionId);
    }
  } catch (error) {
    console.error("[portal] Kündigungsziel nicht geprüft", error);
  }
  if (toCancellation) {
    redirect("/account/kuendigung");
  }
  await redirectToStripePortalOrAccount(loginNext);
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
