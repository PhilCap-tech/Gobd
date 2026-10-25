"use client";

import { useEffect, useState } from "react";

type Month = {
  month: string;
  calls: string;
  starts: string;
  completes: string;
};

type View =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "opted-out" }
  | { kind: "ready"; months: Month[] };

function tokenFromFragment(): string {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return "";
  return new URLSearchParams(hash).get("t") ?? "";
}

function isMonth(value: unknown): value is Month {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Month>;
  return (
    typeof row.month === "string" &&
    typeof row.calls === "string" &&
    typeof row.starts === "string" &&
    typeof row.completes === "string"
  );
}

export function KanzleiReportClient() {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    const token = tokenFromFragment();
    if (!token) {
      setView({ kind: "unavailable" });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/steuerberater/toolbox/bericht", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
          cache: "no-store",
        });
        const data = (await response.json()) as { ok?: boolean; optedOut?: boolean; months?: unknown };
        if (cancelled) return;
        if (!response.ok || data.ok !== true) {
          setView({ kind: "unavailable" });
          return;
        }
        if (data.optedOut === true) {
          setView({ kind: "opted-out" });
          return;
        }
        const months = Array.isArray(data.months) ? data.months.filter(isMonth) : [];
        setView({ kind: "ready", months });
      } catch {
        if (!cancelled) setView({ kind: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.kind === "loading") return <p>Der Bericht wird geladen.</p>;
  if (view.kind === "unavailable") return <p>Dieser Bericht ist nicht verfügbar.</p>;
  if (view.kind === "opted-out") {
    return <p>Sie haben den monatlichen Bericht nicht angefordert. Käufe und Ergebnisse sind darin nicht enthalten.</p>;
  }
  return (
    <>
      <p>
        Zusammengefasste Zahlen zu Ihrem Link: Aufrufe, gestartete Checks und abgeschlossene Checks. Werte unter 5 stehen
        hier als „unter 5“. Käufe, Ampelfarben und Angaben zu einzelnen Personen sind nicht enthalten.
      </p>
      {view.months.map((report) => (
        <section key={report.month}>
          <h2>{report.month}</h2>
          <ul>
            <li>Aufrufe: {report.calls}</li>
            <li>Gestartet: {report.starts}</li>
            <li>Abgeschlossen: {report.completes}</li>
          </ul>
        </section>
      ))}
    </>
  );
}
