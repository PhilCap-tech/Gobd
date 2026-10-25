"use client";

import { useEffect, useState } from "react";
import {
  MAGNET_CONFIRM_BODY,
  MAGNET_CONFIRM_PENDING,
  MAGNET_CONFIRM_TITLE,
  MAGNET_DOWNLOAD_LABEL,
  MAGNET_LINK_EXPIRED,
  MAGNET_LINK_INVALID,
  MAGNET_RENEW_BUTTON,
} from "@/lib/vorlagen/copy";
import { isMagnetId } from "@/lib/vorlagen/ids";
import { magnetBeaconNumber, sendMagnetStep } from "@/lib/vorlagen/step-beacon";
import { trackMagnetConfirmed } from "@/lib/tracking";

type State =
  | { kind: "pending" }
  | { kind: "ok"; downloadToken: string }
  | { kind: "expired"; magnet?: string }
  | { kind: "invalid" };

export function MagnetConfirmPanel({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "pending" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/magnet/bestaetigen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          reason?: string;
          downloadToken?: string;
          magnet?: string;
        } | null;
        if (cancelled) return;
        const magnet = data?.magnet && isMagnetId(data.magnet) ? data.magnet : null;
        if (data?.ok && data.downloadToken) {
          if (magnet) sendMagnetStep({ event: "magnet_doi_confirmed", n: magnetBeaconNumber(magnet), status: "ok" });
          trackMagnetConfirmed();
          setState({ kind: "ok", downloadToken: data.downloadToken });
          return;
        }
        if (data?.reason === "expired") {
          if (magnet) sendMagnetStep({ event: "magnet_doi_confirmed", n: magnetBeaconNumber(magnet), status: "expired" });
          setState({ kind: "expired", magnet: magnet ?? undefined });
          return;
        }
        setState({ kind: "invalid" });
      } catch {
        if (!cancelled) setState({ kind: "invalid" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "pending") return <p>{MAGNET_CONFIRM_PENDING}</p>;
  if (state.kind === "expired") {
    return (
      <p className="card" role="alert">
        {MAGNET_LINK_EXPIRED}{" "}
        <a className="btn" href={`/vorlagen/erneut?token=${encodeURIComponent(token)}`}>{MAGNET_RENEW_BUTTON}</a>
      </p>
    );
  }
  if (state.kind === "invalid") return <p className="card" role="alert">{MAGNET_LINK_INVALID}</p>;
  return (
    <>
      <h1>{MAGNET_CONFIRM_TITLE}</h1>
      <p>{MAGNET_CONFIRM_BODY}</p>
      <p className="actions">
        <a className="btn" href={`/api/magnet/datei?token=${encodeURIComponent(state.downloadToken)}`}>
          {MAGNET_DOWNLOAD_LABEL}
        </a>
      </p>
    </>
  );
}
