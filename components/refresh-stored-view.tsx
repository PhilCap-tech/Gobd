"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * /account and /checkout must not keep the previous user after Abmelden.
 * A restored back-forward entry is reloaded; a client cache is refreshed.
 */
export function RefreshStoredView() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [router]);
  return null;
}
