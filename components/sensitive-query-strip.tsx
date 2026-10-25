"use client";

import { useEffect } from "react";
import { installSensitiveQueryStrip, stripSensitiveQueryFromAddressBar } from "@/lib/tag-page-url";

/**
 * Runs before sibling effects, including analytics and the marketing tag.
 * The address bar loses `token` and `t` before those read `location`.
 */
export function SensitiveQueryStrip() {
  useEffect(() => {
    installSensitiveQueryStrip();
    stripSensitiveQueryFromAddressBar();
  }, []);

  return null;
}
