/**
 * Partner-Pilot allowlist for customer Payment-Failed / Dunning mail.
 *
 * Addresses here must never receive „Zahlung fehlgeschlagen“.
 * Onboarding and other customer mail stay normal. Ops/admin failed-job
 * alerts are unchanged.
 *
 * To exempt another address later, add it to PILOT_PAYMENT_FAILED_EXEMPT_EMAILS.
 * Match is the full address, case-insensitive; surrounding whitespace is ignored.
 */

export const PILOT_PAYMENT_FAILED_EXEMPT_EMAILS = [
  "winkler@winkler-segtrop.de",
] as const;

const exemptEmails = new Set(
  PILOT_PAYMENT_FAILED_EXEMPT_EMAILS.map((email) => email.toLowerCase()),
);

export function isPilotPaymentFailedExempt(
  email: string | null | undefined,
): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  return exemptEmails.has(normalized);
}
