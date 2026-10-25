"use client";

import { useState, type FormEvent } from "react";
import {
  KANZLEI_UNSUBSCRIBE_BUTTON,
  KANZLEI_UNSUBSCRIBE_DONE,
  KANZLEI_UNSUBSCRIBE_INTRO,
  KANZLEI_UNSUBSCRIBE_INVALID,
  KANZLEI_UNSUBSCRIBE_PENDING,
} from "@/lib/kanzlei-copy";

export function KanzleiUnsubscribePanel({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(token ? "" : KANZLEI_UNSUBSCRIBE_INVALID);

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || done || !token) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/kanzlei-merkblatt/abmelden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || KANZLEI_UNSUBSCRIBE_INVALID);
        return;
      }
      setDone(true);
    } catch {
      setError(KANZLEI_UNSUBSCRIBE_INVALID);
    } finally {
      setPending(false);
    }
  }

  if (done) return <p role="status">{KANZLEI_UNSUBSCRIBE_DONE}</p>;

  return (
    <form
      onSubmit={(event) => {
        void withdraw(event);
      }}
    >
      <p>{KANZLEI_UNSUBSCRIBE_INTRO}</p>
      {error ? (
        <p role="alert">{error}</p>
      ) : null}
      <div className="actions">
        <button className="btn" type="submit" disabled={pending || !token}>
          {pending ? KANZLEI_UNSUBSCRIBE_PENDING : KANZLEI_UNSUBSCRIBE_BUTTON}
        </button>
      </div>
    </form>
  );
}
