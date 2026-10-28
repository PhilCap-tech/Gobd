"use client";

import { useState } from "react";

export function UnsubscribePanel({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(token ? "" : "Dieser Abmeldelink ist ungültig.");

  async function withdraw() {
    if (pending || done || !token) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/angebote/abmelden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = (await response.json()) as typeof data;
      } catch {
        data = {};
      }
      if (!response.ok || !data.ok) {
        setError(data.error || "Die Abmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
        return;
      }
      setDone(true);
    } catch {
      setError("Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="card" role="status">
        Sie erhalten von uns keine Angebote mehr per E-Mail. Ihr Konto und Ihre PDFs bleiben davon unberührt.
      </p>
    );
  }

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        void withdraw();
      }}
    >
      <p>
        Hier widersprechen Sie der Verwendung Ihrer E-Mail-Adresse für Angebote. Hinweise zu Ihrem Vertrag erhalten Sie weiterhin.
      </p>
      {error ? (
        <p className="hint" role="alert">
          {error}
        </p>
      ) : null}
      <p className="actions">
        <button className="btn" type="submit" disabled={pending || !token}>
          {pending ? "Wird abgemeldet …" : "Abmelden"}
        </button>
      </p>
    </form>
  );
}
