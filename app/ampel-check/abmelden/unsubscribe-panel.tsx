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
      const response = await fetch("/api/ampel/abmelden", {
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
        Sie erhalten keine weiteren Informationen per E-Mail. Eine bereits angefragte Ergebnis-PDF bleibt davon unberührt.
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
        Hier melden Sie sich von weiteren E-Mails zu GoBD-Themen und Angeboten ab. Das angeforderte Ergebnis bleibt davon unberührt.
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
