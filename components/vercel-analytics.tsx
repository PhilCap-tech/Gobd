"use client";

import { Analytics } from "@vercel/analytics/react";
import { usePathname } from "next/navigation";
import { sanitizeAnalyticsEvent } from "@/lib/analytics-url";

/** Cookieless page views. Route changes follow the pathname, without a search-param bailout. */
export function VercelAnalytics() {
  const pathname = usePathname() || "/";
  return <Analytics beforeSend={sanitizeAnalyticsEvent} path={pathname} route={pathname} />;
}
