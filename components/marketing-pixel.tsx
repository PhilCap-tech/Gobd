"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  captureFirstTouchUtms,
  subscribeConsent,
  trackRoute,
} from "@/lib/tracking";

/**
 * Loads fbq / gtag only after marketing consent. Missing IDs → no scripts, no errors.
 * PageView on every consented route; ReadinessStart on `/readiness` mount.
 */
export function MarketingPixel() {
  const pathname = usePathname() || "";

  useEffect(() => {
    captureFirstTouchUtms();

    function sync() {
      trackRoute(pathname);
    }

    sync();
    return subscribeConsent(sync);
  }, [pathname]);

  return null;
}
