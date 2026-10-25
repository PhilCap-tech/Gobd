"use client";

import { useEffect, useState } from "react";
import {
  MAGNET_CONFIRM_PENDING,
  MAGNET_LINK_INVALID,
  MAGNET_MARKETING_CONFIRM_BODY,
  MAGNET_MARKETING_CONFIRM_TITLE,
  MAGNET_MARKETING_WITHDRAWN,
} from "@/lib/vorlagen/copy";

export function MagnetMarketingPanel({ token }: { token: string }) {
  const [state, setState] = useState<"pending" | "ok" | "withdrawn" | "invalid">("pending");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/magnet/werbung/bestaetigen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await response.json().catch(() => null)) as { ok?: boolean; withdrawn?: boolean } | null;
        if (cancelled) return;
        if (!response.ok || !data?.ok) setState("invalid");
        else if (data.withdrawn) setState("withdrawn");
        else setState("ok");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "pending") return <p>{MAGNET_CONFIRM_PENDING}</p>;
  if (state === "withdrawn") return <p>{MAGNET_MARKETING_WITHDRAWN}</p>;
  if (state === "invalid") return <p className="card" role="alert">{MAGNET_LINK_INVALID}</p>;
  return (
    <>
      <h1>{MAGNET_MARKETING_CONFIRM_TITLE}</h1>
      <p>{MAGNET_MARKETING_CONFIRM_BODY}</p>
    </>
  );
}
