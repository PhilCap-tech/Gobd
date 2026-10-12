"use client";

import { useEffect } from "react";
import { subscribeConsent, trackPurchaseConversion } from "@/lib/tracking";

/**
 * One Google Ads purchase conversion per paid Stripe checkout session.
 * Reloads are ignored via the session storage key. No send_to env, no consent,
 * or a session that is not paid: the tracker sends nothing.
 */
export function PurchaseConversion({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    trackPurchaseConversion(sessionId);
    return subscribeConsent(() => {
      trackPurchaseConversion(sessionId);
    });
  }, [sessionId]);

  return null;
}
