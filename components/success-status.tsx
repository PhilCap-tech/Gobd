"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_MS = 2000;
const MAX_WAIT_MS = 30_000;
const STORAGE_PREFIX = "gobd-success-pending:";

export function SuccessNotFound() {
  return (
    <div className="card">
      <h1>Dokument nicht gefunden</h1>
      <p className="prose">
        Der Entwurf ist nicht verfügbar. Wenn du gerade bezahlt hast, öffne den
        Link aus der E-Mail oder melde dich an.
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn" href="/login">
          Anmelden
        </Link>
        <Link className="btn ghost" href="/checkout">
          Dokumentation starten
        </Link>
      </div>
    </div>
  );
}

export function SuccessPending({
  href,
  sessionId,
}: {
  href: string;
  sessionId: string;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const key = `${STORAGE_PREFIX}${sessionId}`;
    const startedAt = Number(sessionStorage.getItem(key)) || Date.now();
    sessionStorage.setItem(key, String(startedAt));
    const remaining = MAX_WAIT_MS - (Date.now() - startedAt);

    if (remaining <= 0) {
      sessionStorage.removeItem(key);
      const stop = window.setTimeout(() => setTimedOut(true), 0);
      return () => window.clearTimeout(stop);
    }

    const giveUp = window.setTimeout(() => {
      sessionStorage.removeItem(key);
      setTimedOut(true);
    }, remaining);
    const reload =
      remaining > POLL_MS
        ? window.setTimeout(() => {
            window.location.reload();
          }, POLL_MS)
        : undefined;

    return () => {
      window.clearTimeout(giveUp);
      if (reload) window.clearTimeout(reload);
    };
  }, [sessionId]);

  if (timedOut) {
    return <SuccessNotFound />;
  }

  return (
    <div className="card" role="status" aria-live="polite">
      <h1>Dokument wird bereitgestellt…</h1>
      <p className="prose">
        Der Entwurf wird gerade gespeichert. Diese Seite aktualisiert sich
        automatisch.
      </p>
      <p className="hint">Bitte einen Moment warten — meist ist es gleich soweit.</p>
      <div className="actions" style={{ marginTop: 16 }}>
        <a className="btn" href={href}>
          Erneut prüfen
        </a>
      </div>
    </div>
  );
}
