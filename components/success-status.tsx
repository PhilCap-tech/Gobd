"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEGAL_OPERATOR } from "@/lib/legal";

const POLL_MS = 2000;
const MAX_WAIT_MS = 30_000;
const STORAGE_PREFIX = "gobd-success-pending:";

export const SUCCESS_SESSION_INVALID_HEADING =
  "Diese Bestell-Sitzung ist ungültig oder abgelaufen";

export const SUCCESS_SESSION_INVALID_LEAD =
  "Wenn die Zahlung bereits erfolgt ist, schreiben Sie bitte an";

export function successSessionInvalidSentence(
  email: string = LEGAL_OPERATOR.email,
): string {
  return `${SUCCESS_SESSION_INVALID_LEAD} ${email}.`;
}

export function SuccessSessionInvalid() {
  const email = LEGAL_OPERATOR.email;
  return (
    <div className="card" role="alert">
      <h1>{SUCCESS_SESSION_INVALID_HEADING}</h1>
      <p className="prose">
        {SUCCESS_SESSION_INVALID_LEAD} <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </div>
  );
}

export function SuccessNotFound() {
  return (
    <div className="card">
      <h1>Dokument nicht gefunden</h1>
      <p className="prose">
        Der Entwurf ist nicht verfügbar. Wenn Sie gerade bezahlt haben, öffnen
        Sie den Link aus der E-Mail oder melden Sie sich an.
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
            window.location.replace(href);
          }, POLL_MS)
        : undefined;

    return () => {
      window.clearTimeout(giveUp);
      if (reload) window.clearTimeout(reload);
    };
  }, [href, sessionId]);

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
