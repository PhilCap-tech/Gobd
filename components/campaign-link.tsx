"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { campaignTargetHref } from "@/lib/campaign-params";
import { buyHrefWithStoredAffiliate } from "@/lib/digistore-promocode";
import { createHomeCtaGesture, sendHomeCta } from "@/lib/home-cta-beacon";
import type { HomeCtaId } from "@/lib/home-cta-event";
import { hasMarketingConsent, subscribeConsent } from "@/lib/tracking";

/**
 * Server render keeps `href`. After hydration, and again on click, utm_* and
 * click ids from the current page are appended only when marketing consent
 * is granted. Digistore24 hosts never receive those parameters. A later
 * consent change updates the href. Nothing is written to storage.
 * An optional homepage CTA id is sent once per click and does not wait.
 */
export function CampaignLink({
  href,
  className,
  cta,
  children,
}: {
  href: string;
  className?: string;
  cta?: HomeCtaId;
  children: ReactNode;
}) {
  const [liveHref, setLiveHref] = useState(href);
  const [gesture] = useState(() => createHomeCtaGesture());

  const pageHref = useCallback(() => {
    const target = campaignTargetHref(href, window.location.search, hasMarketingConsent());
    return buyHrefWithStoredAffiliate(target);
  }, [href]);

  useEffect(() => {
    function sync() {
      setLiveHref(pageHref());
    }
    sync();
    return subscribeConsent(sync);
  }, [pageHref]);

  function emit(): void {
    if (cta) sendHomeCta(cta);
  }

  function onMouseDown(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button === 0) gesture.pointerDown(emit);
    const next = pageHref();
    if (event.currentTarget.getAttribute("href") !== next) {
      event.currentTarget.setAttribute("href", next);
    }
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    gesture.click(emit);
    const next = pageHref();
    if (next === liveHref) return;
    event.preventDefault();
    window.location.assign(next);
  }

  return (
    <Link className={className} href={liveHref} onClick={onClick} onMouseDown={onMouseDown}>
      {children}
    </Link>
  );
}
