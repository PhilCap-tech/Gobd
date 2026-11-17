/**
 * Anrechnung der 49 € auf die Vollversion.
 * Kein Stripe-Aufruf. Die Coupon-ID kommt nur aus der Umgebung.
 * Serverseitig: gleiche Firma, 30 Tage, einmal.
 */

import { creditStillOpen, type SvPurchase } from "@/lib/schnellversion-record";
import { svDownloadStillOpen } from "@/lib/schnellversion-copy";

export const CREDIT_RESERVE_MS = 30 * 60 * 1000;

type FlagEnv = Record<string, string | undefined>;

/** Leerer String, wenn die Coupon-ID fehlt oder nicht wie eine Stripe-ID aussieht. */
export function schnellversionCouponId(env: FlagEnv = process.env): string {
  const raw = (env.STRIPE_COUPON_SCHNELL_49_ANRECHNUNG ?? "").trim();
  return /^[A-Za-z0-9_]+$/.test(raw) ? raw : "";
}

export function openCredit(rows: SvPurchase[], company: string, now: Date): SvPurchase | null {
  return rows.find((row) => creditStillOpen(row, company, now)) ?? null;
}

/** Zweite Reservierung innerhalb von 30 Minuten schlägt fehl. Abgelaufene Reservierung wird frei. */
export function reserveDecision(row: SvPurchase, token: string, now: Date): SvPurchase | null {
  if (!token.trim() || row.creditUsedAt.trim()) return null;
  if (!svDownloadStillOpen(row.purchasedAt, now)) return null;
  const held = row.creditReservationId.trim();
  if (held && held !== token) {
    const at = Date.parse(row.creditReservedAt);
    if (Number.isFinite(at) && now.getTime() - at < CREDIT_RESERVE_MS) return null;
  }
  return {
    ...row,
    creditReservedAt: now.toISOString(),
    creditReservationId: token,
  };
}
