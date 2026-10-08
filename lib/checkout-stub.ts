/**
 * Checkout-IDs aus dem lokalen Stub (`mock_<zeit>` in createCheckoutSession,
 * `mock_direct` auf der Intake-Seite ohne Stripe-Keys). Kein Zahlungsnachweis.
 */
export function isStubCheckoutSessionId(
  sessionId: string | null | undefined,
): boolean {
  const id = sessionId?.trim() ?? "";
  return id.startsWith("mock_");
}

/**
 * Stub-IDs dürfen nur auf dem lokalen Dev-/Test-Rechner eine Checkout-Session
 * ersetzen. Produktion ist `VERCEL_ENV==="production"` oder
 * `NODE_ENV==="production"`. Jede Vercel-Umgebung (`VERCEL==="1"`, auch
 * Preview) zählt nicht als lokal.
 */
export function devCheckoutStubAllowed(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL === "1") return false;
  return true;
}
