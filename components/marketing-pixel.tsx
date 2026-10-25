"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { installSensitiveQueryStrip, stripSensitiveQueryFromAddressBar } from "@/lib/tag-page-url";
import { isTokenLandingPath } from "@/lib/token-pages";
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
 * Token landings never load a tag. `token` and `t` leave the address bar first.
 */
export function MarketingPixel() {
  const pathname = usePathname() || "";

  useEffect(() => {
    removeLegacyFirstTouchUtm();
    installSensitiveQueryStrip();
    stripSensitiveQueryFromAddressBar();
    if (pathname.startsWith("/auth/invite") || isTokenLandingPath(pathname)) return;

    function sync() {
      trackRoute(pathname);
    }

    sync();
    return subscribeConsent(sync);
  }, [pathname]);

  return null;
}
