"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  removeLegacyFirstTouchUtm,
  subscribeConsent,
  trackRoute,
} from "@/lib/tracking";

/**
 * Loads fbq / gtag only after marketing consent. Missing IDs (Meta, Ads, GA4) → skip that tag.
 * Consent Mode v2 stays denied until that consent. PageView on every consented route.
 * Google Ads `config` runs on every consented route so Ads sees the tag there.
 * A leftover first-touch UTM entry is removed on load, with or without consent.
 */
export function MarketingPixel() {
  const pathname = usePathname() || "";

  useEffect(() => {
    removeLegacyFirstTouchUtm();
    if (pathname.startsWith("/auth/invite")) return;

    function sync() {
      trackRoute(pathname);
    }

    sync();
    return subscribeConsent(sync);
  }, [pathname]);

  return null;
}
