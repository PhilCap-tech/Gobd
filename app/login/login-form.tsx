"use client";

import { useState } from "react";

export function LoginForm({
  next,
  maskedEmail = "",
  resolveOwner = false,
}: {
  next?: string | null;
  maskedEmail?: string;
  /** Send to the checkout owner resolved from next. The address is not in the browser. */
  resolveOwner?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const buttonLabel =
    resolveOwner && maskedEmail ? `Link an ${maskedEmail} senden` : "Anmeldelink senden";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    setSent(false);
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          resolveOwner
            ? { next: next || undefined }
            : { email: email.trim(), next: next || undefined },
        ),
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
        message?: string;
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
      {resolveOwner ? null : (
        <div className="field">
          <label htmlFor="login-email">E-Mail</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@firma.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {sent && (
        <p className="banner">
          Wenn ein Konto existiert, ist ein Link unterwegs. Er ist 20 Minuten gültig.
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Bitte warten…" : buttonLabel}
      </button>
      {maskedEmail ? (
        <p className="hint">Wir senden den Anmeldelink an {maskedEmail}.</p>
      ) : (
        <p className="hint">Kein Passwort. Nur ein Link per E-Mail.</p>
      )}
    </form>
  );
}
