/**
 * Anrechnung der 49 € auf die Vollversion.
 * Kein Stripe-Aufruf. Die Coupon-ID kommt nur aus der Umgebung.
 * Serverseitig: gleiche Firma, 30 Tage, einmal.
 */

import { creditStillOpen, type SvPurchase } from "@/lib/schnellversion-record";

type FlagEnv = Record<string, string | undefined>;

/** Leerer String, wenn die Coupon-ID fehlt oder nicht wie eine Stripe-ID aussieht. */
export function schnellversionCouponId(env: FlagEnv = process.env): string {
  const raw = (env.STRIPE_COUPON_SCHNELL_49_ANRECHNUNG ?? "").trim();
  return /^[A-Za-z0-9_]+$/.test(raw) ? raw : "";
}

export function openCredit(rows: SvPurchase[], company: string, now: Date): SvPurchase | null {
  return rows.find((row) => creditStillOpen(row, company, now)) ?? null;
}
