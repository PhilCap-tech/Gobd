/**
 * Schnellversion 49 €. Ohne gesetzte Variable bleibt die Seite wie bisher.
 * Nur `1` oder `true` schaltet ein. Die Price-ID kommt ausschließlich aus
 * STRIPE_PRICE_SCHNELL_49. Fehlt sie oder sieht sie nicht wie eine Stripe-Price-ID
 * aus, bleibt der Kauf geschlossen.
 */

type FlagEnv = Record<string, string | undefined>;

export function schnellversion49Enabled(env: FlagEnv = process.env): boolean {
  const raw = (env.SCHNELLVERSION_49_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true";
}

/** Leerer String, wenn die Price-ID fehlt oder nicht wie `price_…` aussieht. */
export function schnellversionPriceId(env: FlagEnv = process.env): string {
  const raw = (env.STRIPE_PRICE_SCHNELL_49 ?? "").trim();
  return /^price_[A-Za-z0-9_]+$/.test(raw) ? raw : "";
}

/** Vercel und jeder Produktionslauf ignorieren den Stub, auch wenn die Variable gesetzt ist. */
export function schnellversionStubBlocked(env: FlagEnv = process.env): boolean {
  if ((env.VERCEL ?? "").trim()) return true;
  return (env.NODE_ENV ?? "").trim() === "production";
}

export function schnellversionStripeStub(env: FlagEnv = process.env): boolean {
  if (schnellversionStubBlocked(env)) return false;
  const raw = (env.SCHNELLVERSION_49_STRIPE_STUB ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "paid" || raw === "unpaid";
}

/** Flag allein reicht nicht: im bisherigen Preismodell bleiben die Routen zu. */
export function schnellversionOffered(env: FlagEnv = process.env): boolean {
  if (!schnellversion49Enabled(env)) return false;
  const model = (env.PRICING_MODEL ?? "").trim().toLowerCase();
  return model === "v2" || model === "v3";
}

/**
 * `refuse`: kein Checkout (Flag aus, Price-ID fehlt, oder Live-Key).
 * `stub`: lokale Danke-Seite, kein Stripe-Aufruf.
 * `test`: nur ein `sk_test_`-Key darf später eine Session anlegen.
 */
export type SchnellversionCheckoutPlan = "refuse" | "stub" | "test";

export function schnellversionCheckoutPlan(env: FlagEnv = process.env): SchnellversionCheckoutPlan {
  if (!schnellversion49Enabled(env) || !schnellversionPriceId(env)) return "refuse";
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  if (secret.startsWith("sk_live_")) return "refuse";
  if (schnellversionStubBlocked(env)) {
    return secret.startsWith("sk_test_") ? "test" : "refuse";
  }
  if (schnellversionStripeStub(env) || !secret) return "stub";
  if (secret.startsWith("sk_test_")) return "test";
  return "refuse";
}
