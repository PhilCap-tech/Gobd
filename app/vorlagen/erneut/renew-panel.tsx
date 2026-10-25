"use client";

import { useId, useState } from "react";
import {
  MAGNET_LATER,
  MAGNET_RENEW_BUTTON,
  MAGNET_RENEW_DONE,
  MAGNET_RENEW_PENDING,
} from "@/lib/vorlagen/copy";

export function MagnetRenewPanel({ token }: { token: string }) {
  const faxId = useId();
  const [fax, setFax] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/magnet/erneut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fax_number: fax }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error || MAGNET_LATER);
        return;
      }
      setDone(true);
    } catch {
      setError(MAGNET_LATER);
    } finally {
      setPending(false);
    }
  }

  if (done) return <p className="card" role="status">{MAGNET_RENEW_DONE}</p>;

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="ampel-honeypot" aria-hidden="true">
        <label htmlFor={faxId}>Fax</label>
        <input id={faxId} name="fax_number" tabIndex={-1} autoComplete="off" value={fax} onChange={(event) => setFax(event.target.value)} />
      </div>
      <p className="actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? MAGNET_RENEW_PENDING : MAGNET_RENEW_BUTTON}
        </button>
      </p>
      <p className="field-error" role="alert" aria-live="polite">{error}</p>
    </form>
  );
}
