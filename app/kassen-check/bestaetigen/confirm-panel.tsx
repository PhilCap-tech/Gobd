"use client";

import { useState } from "react";
import Link from "next/link";
import { KASSEN_CHECK_PATH } from "@/lib/kassen-check-questions";

export function KassenConfirmPanel({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (pending || done) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/kassen-check/bestaetigen", {
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
        setError(data.error || "Die Bestätigung konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es später erneut.");
        return;
      }
      setDone(true);
    } catch {
      setError("Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {done ? (
        <p className="card" role="status">
          Ihre E-Mail-Adresse ist bestätigt.
        </p>
      ) : (
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <h2>E-Mail-Adresse bestätigen</h2>
          <p>Bitte bestätigen Sie, dass Sie Informationen zu GoBD-Themen und Angeboten erhalten möchten.</p>
          {error ? (
            <p className="hint" role="alert">
              {error}
            </p>
          ) : null}
          <p className="actions">
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Wird bestätigt …" : "E-Mail-Adresse bestätigen"}
            </button>
          </p>
        </form>
      )}
      <p className="hint">
        <Link href={KASSEN_CHECK_PATH}>Zurück zum Kassen- und TSE-Meldecheck</Link>
      </p>
    </>
  );
}
