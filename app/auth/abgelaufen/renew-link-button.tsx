"use client";

import { useState } from "react";
import { renewExpiredLinkLabel } from "@/lib/expired-onboarding-link";

export function RenewExpiredLinkButton({
  email,
  masked,
  next,
}: {
  email: string;
  masked: string;
  next?: string | null;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const label = renewExpiredLinkLabel(masked);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    button.disabled = true;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next ? { email, next } : { email }),
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
      };
      if (!response.ok || !data.ok) {
        setError(
          data.error ||
            "Der Anmeldelink konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.",
        );
        return;
      }
      setSent(true);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      {error && <p className="error">{error}</p>}
      {sent && (
        <p className="banner">
          Wenn ein Konto existiert, ist ein Link unterwegs. Er ist 20 Minuten gültig.
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Bitte warten…" : label}
      </button>
    </form>
  );
}
