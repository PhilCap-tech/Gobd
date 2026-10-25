"use client";

import { useEffect } from "react";
import { syncDigistorePromocode } from "@/lib/digistore-promocode";
import { subscribeConsent } from "@/lib/tracking";

/**
 * Sales page only. Digistore24 asks for the promocode on the sales page.
 * The thank-you page is required only for the separate email-hash opt-in
 * flow, which this offer does not use.
 */
export function DigistorePromocode() {
  useEffect(() => {
    syncDigistorePromocode();
    return subscribeConsent(syncDigistorePromocode);
  }, []);

  return null;
}
