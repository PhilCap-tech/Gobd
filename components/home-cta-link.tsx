"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createHomeCtaGesture, releaseHomeView, sendHomeCta, sendHomeView } from "@/lib/home-cta-beacon";
import type { HomeCtaId } from "@/lib/home-cta-event";

/**
 * Homepage control that is not a campaign link. The beacon does not
 * change the href and does not wait before navigation.
 */
export function HomeCtaLink({
  href,
  className,
  cta,
  children,
}: {
  href: string;
  className?: string;
  cta: HomeCtaId;
  children: ReactNode;
}) {
  const [gesture] = useState(() => createHomeCtaGesture());

  function emit(): void {
    sendHomeCta(cta);
  }

  function onMouseDown(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button === 0) gesture.pointerDown(emit);
  }

  function onClick() {
    gesture.click(emit);
  }

  return (
    <Link className={className} href={href} onClick={onClick} onMouseDown={onMouseDown}>
      {children}
    </Link>
  );
}

/** One homepage view per entry. Nothing is written to storage. */
export function HomeViewBeacon() {
  useEffect(() => {
    sendHomeView();
    return releaseHomeView;
  }, []);
  return null;
}
