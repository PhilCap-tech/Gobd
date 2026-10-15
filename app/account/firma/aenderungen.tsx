"use client";

import { useState } from "react";
import {
  AUDIT_EMPTY,
  AUDIT_HEADING,
  AUDIT_LOAD_MORE,
  AUDIT_UNAVAILABLE,
} from "@/lib/membership-copy";
import type { AuditListItem } from "@/lib/audit-log";

export function Aenderungen({
  entityId,
  firmName,
  entries,
  nextOffset,
  unavailable,
}: {
  entityId: string;
  firmName: string;
  entries: AuditListItem[];
  nextOffset: number | null;
  unavailable: boolean;
}) {
  const [rows, setRows] = useState(entries);
  const [more, setMore] = useState(nextOffset);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function loadOlder() {
    if (more == null || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/account/audit?entityId=${encodeURIComponent(entityId)}&offset=${more}`,
      );
      const data = (await response.json()) as {
        entries?: AuditListItem[];
        nextOffset?: number | null;
        error?: string;
      };
      const loaded = data.entries;
      if (!response.ok || !loaded) {
        setError(data.error?.trim() || AUDIT_UNAVAILABLE);
        return;
      }
      setRows((current) => [...current, ...loaded]);
      setMore(data.nextOffset ?? null);
    } catch {
      setError(AUDIT_UNAVAILABLE);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: 24 }} aria-labelledby="aenderungen-heading">
      <h2 id="aenderungen-heading">{AUDIT_HEADING}</h2>
      <p className="hint">Firma: {firmName}</p>
      {unavailable ? <p className="error">{AUDIT_UNAVAILABLE}</p> : null}
      {!unavailable && rows.length === 0 ? <p className="hint">{AUDIT_EMPTY}</p> : null}
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => (
            <li key={row.eventId}>
              <div>
                {row.when} · {row.actorEmail}
              </div>
              <div>{row.line}</div>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {more != null ? (
        <button className="btn ghost" type="button" disabled={pending} onClick={() => void loadOlder()}>
          {pending ? "Bitte warten…" : AUDIT_LOAD_MORE}
        </button>
      ) : null}
    </section>
  );
}
