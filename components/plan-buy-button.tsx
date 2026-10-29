"use client";

import { useState } from "react";

/** Änderung (49 €) oder Mitgliedschaft nachträglich: nur aus dem Konto. */
export function PlanBuyButton({
  kind,
  label,
  note,
}: {
  kind: "change" | "member" | "addon" | "reactivate";
  label: string;
  note: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error || "Checkout fehlgeschlagen.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="field">
      <button className="btn" type="button" onClick={onClick} disabled={pending}>
        {pending ? "Bitte warten…" : label}
      </button>
      <p className="hint">{note}</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
