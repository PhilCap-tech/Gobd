"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  applyStoredAffiliateToBuyLinks,
  syncDigistorePromocode,
} from "@/lib/digistore-promocode";
import { subscribeConsent } from "@/lib/tracking";

/**
 * Sales page only. Digistore24 asks for the promocode on the sales page.
 * The thank-you page is required only for the separate email-hash opt-in
 * flow, which this offer does not use.
 * After consent, the stored aff is written onto the buy links on each visit,
 * including reload and back navigation. The script itself runs once.
 */
export function DigistorePromocode() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    function sync() {
      syncDigistorePromocode();
      applyStoredAffiliateToBuyLinks();
    }
    sync();
    window.addEventListener("popstate", sync);
    const unsubscribe = subscribeConsent(sync);
    return () => {
      window.removeEventListener("popstate", sync);
      unsubscribe();
    };
  }, [pathname, search]);

  return null;
}
