import type Stripe from "stripe";
import { EXTRA_FIRM_NOTE } from "@/lib/account-labels";
import { isStoredPaidEntitlementStatus } from "@/lib/checkout-session";
import { newDocumentPath } from "@/lib/documents";
import type { PlanRow } from "@/lib/plan";
import { loadPlanAccess } from "@/lib/plan-access";
import { firmDecision, type PlanFirmRow } from "@/lib/plan-firms";
import { listPlanFirmsByEmailStrict } from "@/lib/plan-firm-store";
import { extraFirmsEnabled } from "@/lib/pricing-model";
import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
import { findLatestPaidCheckoutByEmail, resolveStripeCustomerForEmail } from "@/lib/store";
import {
  billingSubscriptionStatusFrom,
  listCustomerSubscriptionStatuses,
} from "@/lib/stripe";
import { emailsEqual } from "@/lib/types";

/**
 * One subscription covers firms 1–5 of the account (creation order).
 * Firm 6 and later stay on the existing checkout.
 *
 * Active, for this rule, is the status the billing hub already computes
 * (`billingSubscriptionStatusFrom` → `"active"`). That is Stripe `active`
 * or `trialing`, and only when none of the customer's subscriptions is
 * `past_due` or `unpaid`.
 *
 * `past_due` does not cover further firms. The latest invoice failed, and
 * the billing hub already calls that Zahlungsrückstand rather than Aktiv.
 * `unpaid` is the ended past_due state and is inactive as well. `canceled`,
 * `incomplete`, `incomplete_expired`, and `paused` collapse to `"none"`.
 * A subscription that is still `active` with cancel_at_period_end stays
 * covered until Stripe reports it as canceled.
 *
 * A Checkout Session id is never proof. `cs_test_` alone is not a stored
 * paid entitlement and is not a subscription status. Coverage needs a
 * stored paid row for this mailbox (paid / intake_submitted, not a stub)
 * and a subscription list that the helper classifies as active. If that
 * list cannot be read, access stays closed.
 */
export { EXTRA_FIRM_NOTE };

export type IncludedFirmCoverage = {
  /** Stored paid / intake row for this mailbox. A session id is not this. */
  hasStoredPaidEntitlement: boolean;
  /** Stripe subscription statuses. Ignored when `lookupFailed` is set. */
  subscriptionStatuses: readonly string[];
  /** Stripe could not be asked, or the paid row has no customer id. Fail closed. */
  lookupFailed: boolean;
  stripeCustomerId: string;
  /** Preismodell v2: Mitglied oder Frist läuft (Konto-Ebene). */
  planOpen?: boolean;
  /**
   * Preismodell v2 (R1 neu): Konto und Firmen. Wenn gesetzt, entscheidet
   * der Firmen-Platz statt der Position 1–5; kein Limit von 5 Firmen.
   */
  planFirms?: { account: PlanRow; firms: PlanFirmRow[] };
};

/** `add_firm`: v2, kein Platz frei — weitere Firma im Konto buchen. */
export type FirmStart = "intake" | "checkout" | "denied" | "add_firm";

export function emptyIncludedFirmCoverage(): IncludedFirmCoverage {
  return {
    hasStoredPaidEntitlement: false,
    subscriptionStatuses: [],
    lookupFailed: false,
    stripeCustomerId: "",
  };
}

/**
 * True only for a stored paid row. The session id is not read: `cs_test_`
 * without this status is not an entitlement, and the id is not sufficient
 * even when the status is present — the subscription must still be active.
 */
export function storedPaidEntitlementRow(
  row: { status?: string | null } | null | undefined,
): boolean {
  if (!row) return false;
  return isStoredPaidEntitlementStatus(row.status);
}

export function includedFirmsOpen(coverage: IncludedFirmCoverage): boolean {
  if (coverage.planOpen === true) return true;
  if (!coverage.hasStoredPaidEntitlement || coverage.lookupFailed) return false;
  const status = billingSubscriptionStatusFrom(
    coverage.subscriptionStatuses.map((item) => ({
      status: item as Stripe.Subscription.Status,
    })),
  );
  return status === "active";
}

/**
 * 1-based place in the owner's firm list. The caller passes that list in
 * account order (`listEntitiesByEmail`: oldest `createdAt`, then name).
 * 0 means the firm is not in the list.
 */
export function firmPosition(
  entities: readonly { entityId: string }[],
  entityId: string,
): number {
  const id = entityId.trim();
  if (!id) return 0;
  const index = entities.findIndex((row) => row.entityId === id);
  return index < 0 ? 0 : index + 1;
}

/**
 * Where „Neues Dokument“ and `/checkout?entity_id=` go.
 * A mailbox that does not own the firm is denied. Ownership is the same
 * email match the checkout and intake gates already use (#136 / #143).
 */
export function firmStartDecision(input: {
  sessionEmail: string;
  entityOwnerEmail: string;
  entityId: string;
  firmPosition: number;
  coverage: IncludedFirmCoverage;
}): FirmStart {
  const entityId = input.entityId.trim();
  if (!entityId || input.firmPosition < 1) return "denied";
  if (!emailsEqual(input.sessionEmail, input.entityOwnerEmail)) return "denied";
  const plan = input.coverage.planFirms;
  if (plan && plan.firms.length > 0) {
    const decision = firmDecision({ account: plan.account, firms: plan.firms, entityId, newVersion: false });
    if (decision.allowed) return "intake";
    return decision.reason === "needs_purchase" || decision.reason === "needs_member_slot" ? "add_firm" : "denied";
  }
  if (!includedFirmsOpen(input.coverage)) return "checkout";
  if (input.firmPosition <= MAX_ENTITIES_PER_ACCOUNT) return "intake";
  return "checkout";
}

/** Questionnaire for a firm the active subscription already covers. No session id. */
export function coveredIntakePath(entityId: string): string {
  const params = new URLSearchParams({ modus: "gesamt" });
  const id = entityId.trim();
  if (id) params.set("entity_id", id);
  return `/intake?${params.toString()}`;
}

/** Intake for a covered firm, otherwise the existing per-firm checkout. Denied is empty. */
export function firmDocumentHref(decision: FirmStart, entityId: string): string {
  if (decision === "intake") return coveredIntakePath(entityId);
  if (decision === "checkout") return newDocumentPath(entityId);
  if (decision === "add_firm") return "/account#firmen";
  return "";
}

export async function loadIncludedFirmCoverage(email: string): Promise<IncludedFirmCoverage> {
  const normalized = email.trim();
  if (!normalized) return emptyIncludedFirmCoverage();
  try {
    const plan = await loadPlanAccess(normalized);
    if (plan) {
      const open = plan.access.state === "member" || plan.access.state === "window";
      const firms = extraFirmsEnabled() ? await listPlanFirmsByEmailStrict(plan.row.email) : [];
      return {
        hasStoredPaidEntitlement: true,
        subscriptionStatuses: [],
        lookupFailed: false,
        stripeCustomerId: plan.row.stripeCustomerId,
        planOpen: open,
        ...(extraFirmsEnabled() ? { planFirms: { account: plan.row, firms } } : {}),
      };
    }
    const paid = await findLatestPaidCheckoutByEmail(normalized);
    if (!storedPaidEntitlementRow(paid)) return emptyIncludedFirmCoverage();
    // Verified id only: a stale or other-mode `cus_` from the Sheet is skipped
    // instead of being sent to subscriptions.list.
    const customerId =
      (await resolveStripeCustomerForEmail(normalized)).customerId ?? "";
    if (!customerId) {
      return {
        hasStoredPaidEntitlement: true,
        subscriptionStatuses: [],
        lookupFailed: true,
        stripeCustomerId: "",
      };
    }
    const listed = await listCustomerSubscriptionStatuses(customerId);
    if (!listed.ok) {
      return {
        hasStoredPaidEntitlement: true,
        subscriptionStatuses: [],
        lookupFailed: true,
        stripeCustomerId: customerId,
      };
    }
    return {
      hasStoredPaidEntitlement: true,
      subscriptionStatuses: listed.statuses,
      lookupFailed: false,
      stripeCustomerId: customerId,
    };
  } catch (error) {
    console.error(
      "[coverage] Abo für weitere Firmen nicht geprüft",
      error instanceof Error ? error.name : "error",
    );
    return {
      hasStoredPaidEntitlement: false,
      subscriptionStatuses: [],
      lookupFailed: true,
      stripeCustomerId: "",
    };
  }
}
