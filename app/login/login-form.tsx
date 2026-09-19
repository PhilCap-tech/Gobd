"use client";

import { useState } from "react";

export function LoginForm({ next }: { next?: string | null }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [stubUrl, setStubUrl] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    setSent(false);
    setStubUrl("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          next: next || undefined,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
        stub?: boolean;
        verifyUrl?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.error || "Link konnte nicht gesendet werden.");
        return;
      }
      setSent(true);
      if (data.stub && data.verifyUrl) {
        setStubUrl(data.verifyUrl);
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="login-email">E-Mail</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="du@firma.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && <p className="error">{error}</p>}
      {sent && !stubUrl && (
        <p className="banner">
          Falls ein Konto zu dieser Adresse gehört, ist der Anmeldelink unterwegs.
          Er ist 20 Minuten gültig.
        </p>
      )}
      {stubUrl && (
        <p className="banner">
          E-Mail-Versand ist nicht konfiguriert (Demo).{" "}
          <a href={stubUrl}>Hier anmelden</a>
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Bitte warten…" : "Anmeldelink senden"}
      </button>
      <p className="hint">Kein Passwort. Nur ein Link per E-Mail.</p>
    </form>
  );
}
