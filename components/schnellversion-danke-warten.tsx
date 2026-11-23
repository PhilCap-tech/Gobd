"use client";

import { useEffect } from "react";

/** Solange der Kauf noch geschrieben wird. Kein Zeitversprechen. */
export function SchnellversionDankeWarten({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    async function poll() {
      if (stopped) return;
      try {
        const params = new URLSearchParams({ session_id: sessionId });
        const response = await fetch(`/api/schnellversion/status?${params}`, { cache: "no-store" });
        const payload = (await response.json()) as { state?: string };
        if (stopped) return;
        if (payload.state && payload.state !== "confirming") {
          window.location.reload();
          return;
        }
      } catch {
        /* Die Seite bleibt stehen und fragt erneut. */
      }
      timer = window.setTimeout(() => void poll(), 2000);
    }
    timer = window.setTimeout(() => void poll(), 2000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <>
      <h1>Ihr Kauf wird bestätigt.</h1>
      <p>Bitte lassen Sie diese Seite geöffnet. Der Download erscheint hier, sobald die Zahlung gespeichert ist.</p>
    </>
  );
}
