"use client";

import { useState } from "react";

export function KuendigungActions({
  hasExport,
  canConfirm,
  portalFallback,
}: {
  hasExport: boolean;
  canConfirm: boolean;
  portalFallback: boolean;
}) {
  const [zipStarted, setZipStarted] = useState(false);
  const portalReady = !hasExport || zipStarted;

  return (
    <>
      <section className="card" aria-labelledby="download-heading">
        <h2 id="download-heading">Dokumente herunterladen</h2>
        {hasExport ? (
          <p className="actions">
            <a
              className="btn"
              href="/api/account/export"
              onClick={() => setZipStarted(true)}
            >
              ZIP aller PDF-Versionen herunterladen
            </a>
          </p>
        ) : (
          <p className="prose">Es liegen noch keine PDF-Versionen vor.</p>
        )}
        <p className="hint">
          Der Download bleibt auf dieser Seite. Die Kündigung hängt nicht am Download.
        </p>
      </section>

      {canConfirm ? (
        <section className="card" aria-labelledby="portal-heading">
          <h2 id="portal-heading">Weiter zum Stripe-Portal</h2>
          <form method="post" action="/api/account/kuendigung/portal">
            <label className="check">
              <input type="checkbox" name="acknowledged" value="yes" required />
              <span>Ich habe die Folgen der Kündigung gelesen.</span>
            </label>
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn" type="submit" disabled={!portalReady}>
                Weiter zur Kündigung im Stripe-Portal
              </button>
            </div>
          </form>
          {hasExport && !portalReady ? (
            <form method="post" action="/api/account/kuendigung/portal" style={{ marginTop: 16 }}>
              <label className="check">
                <input type="checkbox" name="acknowledged" value="yes" required />
                <span>
                  Ich habe die Folgen gelesen und möchte auch ohne ZIP zum Portal.
                </span>
              </label>
              <div className="actions" style={{ marginTop: 12 }}>
                <button className="btn ghost" type="submit">
                  Trotzdem zum Stripe-Portal
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {portalFallback ? (
        <section className="card" aria-labelledby="fallback-heading">
          <h2 id="fallback-heading">Kündigung ohne Portal</h2>
          <p className="prose">
            Das Stripe-Portal konnte nicht geöffnet werden. Sie können die Kündigung
            hier zum Ende des bezahlten Zeitraums bestätigen.
          </p>
          <form method="post" action="/api/account/kuendigung">
            <label className="check">
              <input type="checkbox" name="acknowledged" value="yes" required />
              <span>Ich habe die Folgen der Kündigung zur Kenntnis genommen.</span>
            </label>
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn" type="submit">
                Kündigung zum Periodenende bestätigen
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
