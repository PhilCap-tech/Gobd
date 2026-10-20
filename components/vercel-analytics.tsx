"use client";

import { Analytics, track } from "@vercel/analytics/react";
import { usePathname } from "next/navigation";
import { sanitizeAnalyticsEvent } from "@/lib/analytics-url";

const VARIANTS = new Set(["a", "b", "c"]);
const HERO_TARGETS = new Set(["ampel", "checkout", "muster"]);

/**
 * Cookieless custom events through the Analytics script already on the page.
 * Only variant and target are sent. Click ids are not accepted.
 */
export function trackCookielessEvent(
  name: "hero_cta_click" | "ampel_start",
  properties: { variant?: string; target?: string },
): void {
  const data: Record<string, string> = {};
  if (properties.variant && VARIANTS.has(properties.variant)) data.variant = properties.variant;
  if (name === "hero_cta_click") {
    if (!data.variant || !properties.target || !HERO_TARGETS.has(properties.target)) return;
    data.target = properties.target;
  }
  if (Object.keys(data).length === 0) track(name);
  else track(name, data);
}

/** Cookieless page views. Route changes follow the pathname, without a search-param bailout. */
export function VercelAnalytics() {
  const pathname = usePathname() || "/";
  return <Analytics beforeSend={sanitizeAnalyticsEvent} path={pathname} route={pathname} />;
}
