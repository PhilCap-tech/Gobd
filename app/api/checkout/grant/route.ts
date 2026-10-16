import { NextResponse } from "next/server";
import { loginPath, sessionEmailFromRequest } from "@/lib/auth";
import { notifyBuyerOfCheckout } from "@/lib/buyer-onboarding";
import { scheduleCheckoutAfterResponse } from "@/lib/checkout-after";
import { ensureBuyerFirmForCheckout, type BuyerFirmRequest } from "@/lib/checkout-firm";
import { finishCheckoutReturn } from "@/lib/checkout-session";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { findLatestDocumentByStripeSessionId } from "@/lib/store";
import { resolveCheckoutSession, type CheckoutResolveError } from "@/lib/stripe";
import { matchingTestEntityId } from "@/lib/test-entities";
import type { CheckoutIdentity } from "@/lib/types";

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

function intakePath(source: URL): string {
  const target = new URL("/intake", "http://safe.invalid");
  for (const key of PASSTHROUGH) {
    const value = source.searchParams.get(key)?.trim();
    if (value) target.searchParams.set(key, value);
  }
  const query = target.searchParams.toString();
  return query ? `/intake?${query}` : "/intake";
}

export type CheckoutGrantIo = {
  resolveCheckout: (
    sessionId: string,
  ) => Promise<CheckoutIdentity | { error: CheckoutResolveError }>;
  lookupDocumentOwner: (sessionId: string) => Promise<string | null>;
  /** Order mail to the checkout email. Defaults ignore the browser session. */
  notifyBuyer?: (input: {
    email: string;
    company?: string;
    sessionId: string;
    entityId?: string;
  }) => Promise<void>;
  /** Firm owned by the checkout email. A foreign entity id is not returned. */
  bindBuyerFirm?: (input: BuyerFirmRequest) => Promise<string>;
  /**
   * Runs firm creation and the welcome mail after the redirect.
   * Tests pass a recorder and do not wait. Production uses `after` and `waitUntil`.
   */
  schedule?: (work: () => Promise<void>) => void;
};

const defaultGrantIo: CheckoutGrantIo = {
  resolveCheckout: resolveCheckoutSession,
  lookupDocumentOwner: async (id) => {
    const existing = await findLatestDocumentByStripeSessionId(id);
    return existing ? existing.email : null;
  },
};

/** Test-firm id wins, so a listed firm is skipped. Otherwise the firm we just bound. */
function welcomeEntityId(
  createdEntityId: string,
  resolvedEntityId: string | undefined,
  queryEntityId: string,
): string {
  return (
    matchingTestEntityId(createdEntityId, resolvedEntityId, queryEntityId) ||
    createdEntityId ||
    resolvedEntityId ||
    queryEntityId ||
    ""
  );
}

/**
 * Rückkehr aus Stripe: `session_id` serverseitig prüfen.
 * Ein bestehendes Login wird nie ersetzt. Nach dem ersten Login,
 * nach einer gespeicherten Fassung und nach jedem abgesendeten Intake
 * führt dieselbe ID zur Anmeldung statt zu einem neuen Cookie.
 */
export async function completeCheckoutGrant(
  request: Request,
  io: CheckoutGrantIo = defaultGrantIo,
): Promise<NextResponse> {
  const source = new URL(request.url);
  const sessionId = source.searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }

  const resolved = await io.resolveCheckout(sessionId);
  if ("error" in resolved || (resolved.stub && !devCheckoutStubAllowed())) {
    source.searchParams.delete("entity_id");
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }

  let email = typeof resolved.email === "string" ? resolved.email.trim() : "";
  if (resolved.stub) {
    email = source.searchParams.get("email")?.trim() || email;
  }

  if (!email || !resolved.stripeSessionId) {
    source.searchParams.delete("entity_id");
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }

  const queryEntityId = source.searchParams.get("entity_id")?.trim() ?? "";
  const firmRequest: BuyerFirmRequest = {
    email,
    company: resolved.company,
    entityId: resolved.entityId || queryEntityId,
    sessionId: resolved.stripeSessionId,
    street: resolved.billingAddress?.line1,
    zip: resolved.billingAddress?.postalCode,
    city: resolved.billingAddress?.city,
    ustId: resolved.ustId,
  };
  let buyerEntityId = "";
  // Injected doubles stay on this request so checks can see them. The live
  // path creates the firm and sends the mail after the redirect: both are
  // idempotent and safe if the webhook is doing the same work.
  if (!io.bindBuyerFirm || (!resolved.stub && !io.notifyBuyer)) {
    const schedule = io.schedule ?? scheduleCheckoutAfterResponse;
    schedule(async () => {
      let createdEntityId = "";
      if (!io.bindBuyerFirm) {
        try {
          createdEntityId = await ensureBuyerFirmForCheckout(firmRequest);
        } catch (error) {
          console.error(
            "[checkout] Firma für den Käufer nicht angelegt",
            error instanceof Error ? error.name : "error",
          );
        }
      }
      if (!resolved.stub && !io.notifyBuyer) {
        try {
          const mailed = await notifyBuyerOfCheckout({
            email,
            company: resolved.company,
            sessionId: resolved.stripeSessionId,
            entityId: welcomeEntityId(createdEntityId, resolved.entityId, queryEntityId),
          });
          // A fresh claim belongs to the other caller (usually the webhook).
          // Leaving it alone lets that caller finish; Stripe retries a 500.
          if (mailed === "inflight") {
            console.info("[checkout] Bestellmail noch nicht abgeschlossen");
          } else if (mailed === "failed") {
            console.error("[checkout] Bestellmail nicht gesendet");
          }
        } catch (error) {
          console.error(
            "[checkout] Bestellmail nicht ausgelöst",
            error instanceof Error ? error.name : "error",
          );
        }
      }
    });
  }
  if (io.bindBuyerFirm) {
    try {
      buyerEntityId = await io.bindBuyerFirm(firmRequest);
    } catch (error) {
      console.error(
        "[checkout] Firma für den Käufer nicht angelegt",
        error instanceof Error ? error.name : "error",
      );
    }
  }
  if (buyerEntityId && /^[A-Za-z0-9_-]+$/.test(buyerEntityId) && buyerEntityId.length <= 200) {
    source.searchParams.set("entity_id", buyerEntityId);
  } else {
    source.searchParams.delete("entity_id");
  }

  if (!resolved.stub && io.notifyBuyer) {
    try {
      await io.notifyBuyer({
        email,
        company: resolved.company,
        sessionId: resolved.stripeSessionId,
        entityId: welcomeEntityId(buyerEntityId, resolved.entityId, queryEntityId),
      });
    } catch (error) {
      console.error(
        "[checkout] Bestellmail nicht ausgelöst",
        error instanceof Error ? error.name : "error",
      );
    }
  }

  const response = NextResponse.redirect(intakeReturn(request, source, "set"));
  const decision = await finishCheckoutReturn(
    response,
    {
      stub: resolved.stub,
      customerEmail: email,
      stripeSessionId: resolved.stripeSessionId,
      existingSessionEmail: await sessionEmailFromRequest(request),
    },
    io.lookupDocumentOwner,
  );

  if (decision === "mismatch") {
    return NextResponse.redirect(intakeReturn(request, source, "skip"));
  }
  if (decision === "login") {
    return NextResponse.redirect(new URL(loginPath(intakePath(source)), request.url));
  }
  return response;
}

export async function GET(request: Request) {
  return completeCheckoutGrant(request);
}
