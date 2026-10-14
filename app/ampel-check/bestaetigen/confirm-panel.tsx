"use client";

import { useState } from "react";
import Link from "next/link";
import { AmpelCta, AmpelDisclaimer, AmpelResult } from "@/components/ampel-result";
import type { AmpelAnswerMap } from "@/lib/ampel-score";
import { trackLeadSubmit } from "@/lib/tracking";

export function AmpelConfirmPanel({
  token,
  answers,
}: {
  token: string;
  answers: AmpelAnswerMap;
}) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (pending || done) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/ampel/bestaetigen", {
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
        setError(data.error || "Die Bestätigung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
        return;
      }
      trackLeadSubmit();
      setDone(true);
    } catch {
      setError("Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <AmpelResult answers={answers} />
      {done ? (
        <p className="card" role="status">
          Ihre E-Mail-Adresse ist bestätigt. Das Ergebnis ist unterwegs.
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
          <p>
            Der Link allein speichert noch nichts. Bitte bestätigen Sie hier, damit wir das Ergebnis senden.
          </p>
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
      <AmpelCta />
      <p className="hint">
        <Link href="/ampel-check">Zurück zur Ampel</Link>
      </p>
      <AmpelDisclaimer />
    </>
  );
}
