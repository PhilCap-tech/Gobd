"use client";

import { useEffect, useState } from "react";
import {
  KANZLEI_CONFIRM_BODY,
  KANZLEI_CONFIRM_INVALID,
  KANZLEI_CONFIRM_TITLE,
  KANZLEI_WITHDRAWN_NOTICE,
} from "@/lib/kanzlei-copy";

export function KanzleiConfirmPanel({ token }: { token: string }) {
  const [state, setState] = useState<"pending" | "ok" | "invalid" | "withdrawn">("pending");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/kanzlei-merkblatt/bestaetigen", {
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

  if (state === "pending") return <p>Die Anmeldung wird bestätigt.</p>;
  if (state === "withdrawn") return <p>{KANZLEI_WITHDRAWN_NOTICE}</p>;
  if (state === "invalid") return <p role="alert">{KANZLEI_CONFIRM_INVALID}</p>;
  return (
    <>
      <h1>{KANZLEI_CONFIRM_TITLE}</h1>
      <p>{KANZLEI_CONFIRM_BODY}</p>
    </>
  );
}
