"use client";

import { useState } from "react";
import { INVITE_LINK_INVALID } from "@/lib/membership-copy";

export function InviteAcceptForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error?.trim() || INVITE_LINK_INVALID);
        setPending(false);
        return;
      }
      window.location.assign("/auth/invite/angenommen");
    } catch {
      setError("Die Verbindung ist abgebrochen. Bitte versuchen Sie es erneut.");
      setPending(false);
    }
  }

  return (
    <form className="actions" onSubmit={onSubmit} style={{ marginTop: 16 }}>
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Bitte warten…" : "Einladung annehmen"}
      </button>
    </form>
  );
}
