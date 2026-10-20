"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { hrefWithCampaignParams } from "@/lib/campaign-params";

/**
 * Server render keeps `href`. After hydration, and again on click, the
 * current page's campaign query is appended. Nothing is written to storage.
 */
export function CampaignLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const [liveHref, setLiveHref] = useState(href);

  useEffect(() => {
    setLiveHref(hrefWithCampaignParams(href, window.location.search));
  }, [href]);

  function pageHref(): string {
    return hrefWithCampaignParams(href, window.location.search);
  }

  function onMouseDown(event: MouseEvent<HTMLAnchorElement>) {
    const next = pageHref();
    if (event.currentTarget.getAttribute("href") !== next) {
      event.currentTarget.setAttribute("href", next);
    }
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
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
