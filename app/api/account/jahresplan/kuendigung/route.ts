import { NextResponse } from "next/server";
import { getSessionEmail, loginPath } from "@/lib/auth";
import { getAppUrl, isStripeSecretConfigured } from "@/lib/env";
import { applyMemberCancelRecord, memberCancelPlan } from "@/lib/plan";
import { loadPlanAccess } from "@/lib/plan-access";
import { savePlanRow } from "@/lib/plan-store";
import { planLifecycleEnabled } from "@/lib/pricing-model";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function back(status: string): NextResponse {
  const response = NextResponse.redirect(
    `${getAppUrl()}/account?kauf=${encodeURIComponent(status)}#frist`,
    303,
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * Kündigung der Jahresmitgliedschaft per Klick (Preismodell v2).
 * Bis zum Stichtag (3 Monate vor Ablauf) zum laufenden Ende, danach (R4)
 * zum Ende der folgenden Laufzeit. Eigene Route statt Portal-Flow, weil das
 * Stripe-Portal ohne Stichtag kündigen würde.
 */
export async function POST(request: Request) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.redirect(`${getAppUrl()}${loginPath("/account")}`, 303);
  }
  // T8 zurückgestellt (CoS 27.10.): ohne PLAN_LIFECYCLE_ENABLED kein eigener
  // Stichtag; gekündigt wird über das Stripe-Kundenportal.
  if (!planLifecycleEnabled()) return back("kuendigung-unverfuegbar");
  const form = await request.formData().catch(() => null);
  if (form?.get("action") === "widerruf") return withdraw(email);
  if (form?.get("acknowledged") !== "yes") return back("kuendigung-hinweis");
  if (!isStripeSecretConfigured()) return back("kuendigung-unverfuegbar");
  let loaded;
  try {
    loaded = await loadPlanAccess(email);
  } catch {
    return back("kuendigung-fehler");
  }
  if (!loaded || loaded.access.state !== "member" || !loaded.row.memberSubscriptionId) {
    return back("kuendigung-keins");
  }
  if (loaded.row.memberCancelAt) return back("gekuendigt");
  const plan = memberCancelPlan(loaded.row.memberPeriodEnd);
  if (!plan) return back("kuendigung-fehler");
  try {
    await getStripe().subscriptions.update(
      loaded.row.memberSubscriptionId,
      plan.atCurrentPeriodEnd
        ? { cancel_at_period_end: true }
        : { cancel_at: Math.floor(Date.parse(plan.effectiveAt) / 1000) },
    );
  } catch (error) {
    console.error("[jahresplan] Kündigung fehlgeschlagen", error instanceof Error ? error.name : "error");
    return back("kuendigung-fehler");
  }
  const at = new Date().toISOString();
  await savePlanRow(
    applyMemberCancelRecord(loaded.row, { effectiveAt: plan.effectiveAt, channel: "konto", receivedAt: at, at }),
  ).catch(
    (error: unknown) => {
      // Der Webhook customer.subscription.updated trägt das Datum ebenfalls nach.
      console.error("[jahresplan] Kündigung nicht im Plan vermerkt", error instanceof Error ? error.name : "error");
    },
  );
  return back("gekuendigt");
}

/**
 * Kündigung zurücknehmen, bis zum Ablauf möglich (approvals 14:15, Punkt 3).
 * Stripe ist maßgeblich: geplantes Ende am Abo wird entfernt.
 */
async function withdraw(email: string): Promise<NextResponse> {
  if (!isStripeSecretConfigured()) return back("widerruf-unverfuegbar");
  let loaded;
  try {
    loaded = await loadPlanAccess(email);
  } catch {
    return back("widerruf-fehler");
  }
  if (!loaded || loaded.access.state !== "member" || !loaded.row.memberSubscriptionId) {
    return back("kuendigung-keins");
  }
  if (!loaded.row.memberCancelAt) return back("widerrufen");
  if (Date.parse(loaded.row.memberCancelAt) <= Date.now()) return back("widerruf-zu-spaet");
  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(loaded.row.memberSubscriptionId);
    await stripe.subscriptions.update(
      loaded.row.memberSubscriptionId,
      subscription.cancel_at_period_end ? { cancel_at_period_end: false } : { cancel_at: "" },
    );
  } catch (error) {
    console.error("[jahresplan] Widerruf fehlgeschlagen", error instanceof Error ? error.name : "error");
    return back("widerruf-fehler");
  }
  const at = new Date().toISOString();
  await savePlanRow(
    applyMemberCancelRecord(loaded.row, { effectiveAt: "", channel: "konto", receivedAt: at, at }),
  ).catch((error: unknown) => {
    console.error("[jahresplan] Widerruf nicht im Plan vermerkt", error instanceof Error ? error.name : "error");
  });
  return back("widerrufen");
}
