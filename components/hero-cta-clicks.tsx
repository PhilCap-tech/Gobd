"use client";

import type { MouseEvent, ReactNode } from "react";
import { trackCookielessEvent } from "@/components/vercel-analytics";

const TARGETS = new Set(["ampel", "checkout", "muster"]);

/** Records hero button clicks. The anchors stay in the homepage markup. */
export function HeroCtaClicks({ children }: { children: ReactNode }) {
  function onClick(event: MouseEvent<HTMLDivElement>) {
    const node = event.target;
    if (!(node instanceof Element)) return;
    const link = node.closest("a[data-hero-target]");
    if (!link) return;
    const target = link.getAttribute("data-hero-target") ?? "";
    if (!TARGETS.has(target)) return;
    trackCookielessEvent("hero_cta_click", { variant: "a", target });
  }

  return <div onClick={onClick}>{children}</div>;
}
