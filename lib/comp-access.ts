/**
 * Kostenfreier Vollzugang (Comp).
 * Freigegeben von Philip, 2026-10-13.
 *
 * These mailboxes may use intake, PDF and the account hub without a Stripe
 * payment. The entitlement is this list alone. It does not create a Checkout
 * Session, a payment, or a Sheet row. Match is the full address,
 * case-insensitive; surrounding whitespace is ignored.
 *
 * `extra` is an optional test address on the same comparison. Production
 * call sites omit it.
 */
export const COMP_ACCESS_EMAILS = [
  "winkler@winkler-segtrop.de",
  // Temporary Prod smoke test (CoS, 2026-10-13). Will be removed afterward.
  "gobd-test@mail.grokbot.com",
] as const;

const allowlist = new Set(
  COMP_ACCESS_EMAILS.map((email) => email.toLowerCase()),
);

function normalizeEmail(value: string | null | undefined): string {
  const email = (value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || /\s/.test(email)) return "";
  return email;
}

export function isCompAccessEmail(
  email: string | null | undefined,
  extra?: readonly (string | null | undefined)[],
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (allowlist.has(normalized)) return true;
  if (!extra || extra.length === 0) return false;
  return extra.some((item) => normalizeEmail(item) === normalized);
}

/** Logged-in accounts may create a company. A comp mailbox does not need Stripe. */
export function firmaAnlegenAllowed(
  sessionEmail: string | null | undefined,
): sessionEmail is string {
  return Boolean(normalizeEmail(sessionEmail));
}

/** Questionnaire for a comp mailbox. No Checkout Session id. */
export function compIntakePath(entityId?: string): string {
  const params = new URLSearchParams({ modus: "gesamt" });
  const id = entityId?.trim() ?? "";
  if (id) params.set("entity_id", id);
  return `/intake?${params.toString()}`;
}
