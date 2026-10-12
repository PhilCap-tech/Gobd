import { emailsEqual } from "@/lib/types";

/**
 * Entity id that may be stored on a Checkout Session.
 * A firm is attached only when its owner is the checkout email.
 * At checkout creation, a browser session for someone else contributes nothing.
 */
export function boundCheckoutEntityId(input: {
  checkoutEmail: string;
  entityId?: string | null;
  entityOwnerEmail?: string | null;
  sessionEmail?: string | null;
  /** True on POST /api/checkout. Webhook and grant only compare the owner. */
  dropWhenSessionDiffers?: boolean;
}): string {
  const id = (input.entityId ?? "").trim();
  if (!id) return "";
  const checkout = (input.checkoutEmail ?? "").trim();
  if (!checkout.includes("@")) return "";
  if (input.dropWhenSessionDiffers) {
    const session = (input.sessionEmail ?? "").trim();
    if (session && !emailsEqual(session, checkout)) return "";
  }
  const owner = (input.entityOwnerEmail ?? "").trim();
  if (!owner || !emailsEqual(owner, checkout)) return "";
  return id;
}

/**
 * Entity id the checkout form may submit.
 * Changing the email away from the session drops the prefilled firm.
 */
export function checkoutEntityIdForEmail(input: {
  typedEmail: string;
  sessionEmail: string;
  entityId: string;
}): string {
  const id = input.entityId.trim();
  const session = input.sessionEmail.trim();
  if (!id || !session) return "";
  if (!emailsEqual(input.typedEmail, session)) return "";
  return id;
}
