import { NextResponse } from "next/server";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { getAppUrl, isStripeSecretConfigured } from "@/lib/env";
import { applyLifecycleEvent } from "@/lib/kuendigung-apply";
import {
  createCancellationPortalSession,
  loadCancellationPreview,
  periodEndIso,
  scheduleCancelAtPeriodEnd,
} from "@/lib/kuendigung-stripe";
import { resolveStripeCustomerForEmail } from "@/lib/store";
import { accountBillingPath } from "@/lib/stripe";
import { isTestEntity } from "@/lib/test-entities";
import { loadPlanAccess } from "@/lib/plan-access";
import { planLifecycleEnabled } from "@/lib/pricing-model";
import { logError } from "@/lib/log-error";

export const runtime = "nodejs";

function back(status: string): NextResponse {
  const response = NextResponse.redirect(
    `${getAppUrl()}/account/kuendigung?status=${encodeURIComponent(status)}`,
    303,
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: Request) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.redirect(`${getAppUrl()}${loginPath("/account/kuendigung")}`, 303);
  }
  const form = await request.formData().catch(() => null);
  if (form?.get("acknowledged") !== "yes") {
    return back("hinweis");
  }
  if (!isStripeSecretConfigured()) {
    return back("unverfuegbar");
  }
  const resolved = await resolveStripeCustomerForEmail(email);
  if (!resolved.customerId) {
    return back(resolved.lookupFailed ? "fehler" : "keins");
  }
  const preview = await loadCancellationPreview(resolved.customerId);
  if (preview.lookupFailed) return back("fehler");
  if (!preview.subscriptionId) return back("keins");
  // Preismodell v2: Der Jahresplan hat einen Kündigungsstichtag und eine eigene Route.
  // Ohne PLAN_LIFECYCLE_ENABLED (Default, CoS 27.10.) kündigt das Stripe-Portal;
  // kein Lifecycle-Eintrag für das Jahres-Abo (keine 30-Tage-Logik, keine Sperre).
  let annualPlan = false;
  try {
    const plan = await loadPlanAccess(email);
    if (plan && plan.row.memberSubscriptionId === preview.subscriptionId) {
      if (planLifecycleEnabled()) {
        return NextResponse.redirect(`${getAppUrl()}/account#frist`, 303);
      }
      annualPlan = true;
    }
  } catch {
    return back("fehler");
  }

  const wantsPortal = annualPlan || new URL(request.url).pathname.endsWith("/portal");
  if (wantsPortal) {
    try {
      const url = await createCancellationPortalSession({
        customerId: preview.customerId || resolved.customerId,
        subscriptionId: preview.subscriptionId,
        returnUrl: `${getAppUrl()}${accountBillingPath("returned")}`,
      });
      return NextResponse.redirect(url, 303);
    } catch (error) {
      logError("[kuendigung] Portal-Session fehlgeschlagen", error);
      return back("portal");
    }
  }

  try {
    const subscription = preview.alreadyScheduled
      ? null
      : await scheduleCancelAtPeriodEnd(preview.subscriptionId);
    const periodEnd = subscription ? periodEndIso(subscription) : preview.periodEnd;
    const at = new Date().toISOString();
    await applyLifecycleEvent(
      {
        id: `account-confirm-${preview.subscriptionId}-${periodEnd}`,
        type: "subscription_updated",
        at,
        email,
        customerId: preview.customerId || resolved.customerId,
        subscriptionId: preview.subscriptionId,
        periodEnd,
        status: subscription?.status || preview.status || "active",
        cancelAtPeriodEnd: true,
        cancellationReason: "cancellation_requested",
      },
      {
        suppressCustomerMail:
          isTestEntity(subscription?.metadata?.entity_id) || isTestEntity(preview.entityId),
      },
    );
  } catch (error) {
    logError("[kuendigung] Kündigung fehlgeschlagen", error);
    return back("fehler");
  }
  return back("vorgemerkt");
}
