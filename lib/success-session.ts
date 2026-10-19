import type { CheckoutResolveError } from "@/lib/stripe";
import type { CheckoutIdentity } from "@/lib/types";

/**
 * Query flag for a reload that already classified this Checkout Session.
 * The pending poll follows it so a paid session is not retrieved again.
 */
export const SUCCESS_CHECKOUT_CHECKED_PARAM = "geprueft" as const;

/** Matches the success-page pending window. A second probe inside it is not another Stripe call. */
export const SUCCESS_CHECKOUT_PROBE_TTL_MS = 30_000;

export type SuccessCheckoutResult =
  | CheckoutIdentity
  | { error: CheckoutResolveError };

export type SuccessPageBody =
  | "sheets"
  | "invalid"
  | "pending"
  | "not_found"
  | "denied"
  | "ready";

const probes = new Map<string, { at: number; value: SuccessCheckoutResult }>();

export function clearSuccessCheckoutProbes(): void {
  probes.clear();
}

/**
 * Stripe could not attach this request to a paid Checkout Session.
 * `lookup_failed` stays out: a transient outage is not an invalid session.
 * Resource-missing ("not found") arrives as `invalid`.
 */
export function isUnresolvableCheckoutSession(
  checkout: SuccessCheckoutResult | null,
): boolean {
  if (!checkout || !("error" in checkout)) return false;
  return (
    checkout.error === "missing" ||
    checkout.error === "invalid" ||
    checkout.error === "not_paid"
  );
}

/**
 * Stripe retrieve for /success. A stored document keeps today's single
 * purchase lookup and does not come through here. `alreadyChecked` is the
 * poll after that one retrieve.
 */
export function shouldProbeSuccessCheckout(input: {
  sheetsDown: boolean;
  hasRow: boolean;
  sessionId: string;
  alreadyChecked: boolean;
}): boolean {
  return (
    !input.sheetsDown &&
    !input.hasRow &&
    Boolean(input.sessionId) &&
    !input.alreadyChecked
  );
}

export async function probeSuccessCheckout(
  sessionId: string,
  resolve: (sessionId: string) => Promise<SuccessCheckoutResult>,
  now = Date.now(),
): Promise<SuccessCheckoutResult> {
  const key = sessionId.trim();
  const hit = probes.get(key);
  if (hit && now - hit.at < SUCCESS_CHECKOUT_PROBE_TTL_MS) return hit.value;
  const value = await resolve(key);
  probes.set(key, { at: now, value });
  if (probes.size > 100) {
    for (const [id, entry] of probes) {
      if (now - entry.at >= SUCCESS_CHECKOUT_PROBE_TTL_MS) probes.delete(id);
    }
  }
  return value;
}

export function successPageBody(input: {
  sheetsDown: boolean;
  hasRow: boolean;
  allowed: boolean;
  sessionId: string;
  sessionInvalid: boolean;
}): SuccessPageBody {
  if (input.sheetsDown) return "sheets";
  if (!input.hasRow) {
    if (input.sessionId && input.sessionInvalid) return "invalid";
    if (input.sessionId) return "pending";
    return "not_found";
  }
  if (!input.allowed) return "denied";
  return "ready";
}

export function successPendingHref(input: {
  sessionId: string;
  documentId?: string;
  checked: boolean;
}): string {
  const params = new URLSearchParams();
  if (input.sessionId) params.set("session_id", input.sessionId);
  if (input.documentId) params.set("document_id", input.documentId);
  if (input.checked) params.set(SUCCESS_CHECKOUT_CHECKED_PARAM, "1");
  const query = params.toString();
  return query ? `/success?${query}` : "/success";
}
