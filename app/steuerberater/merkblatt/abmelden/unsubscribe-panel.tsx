"use client";

import { useEffect, useState } from "react";
import { KANZLEI_UNSUBSCRIBE_DONE, KANZLEI_UNSUBSCRIBE_INVALID } from "@/lib/kanzlei-copy";

export function KanzleiUnsubscribePanel({ token }: { token: string }) {
  const [state, setState] = useState<"pending" | "ok" | "invalid">("pending");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/kanzlei-merkblatt/abmelden", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await response.json().catch(() => null)) as { ok?: boolean } | null;
        if (cancelled) return;
        setState(response.ok && data?.ok ? "ok" : "invalid");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "pending") return <p>Die Abmeldung wird gespeichert.</p>;
  if (state === "invalid") return <p role="alert">{KANZLEI_UNSUBSCRIBE_INVALID}</p>;
  return <p>{KANZLEI_UNSUBSCRIBE_DONE}</p>;
}
