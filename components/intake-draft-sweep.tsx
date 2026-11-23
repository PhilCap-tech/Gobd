"use client";

import { useEffect } from "react";
import { sweepIntakeDraftsOnView } from "@/lib/guest-start";

/** Entfernt abgelaufene Fragebogen-Einträge bei jedem Seitenaufruf. */
export function IntakeDraftSweep() {
  useEffect(() => {
    const storages = [];
    try {
      storages.push(window.localStorage);
    } catch {
      /* gesperrt */
    }
    try {
      storages.push(window.sessionStorage);
    } catch {
      /* gesperrt */
    }
    sweepIntakeDraftsOnView(storages, Date.now());
  }, []);
  return null;
}
