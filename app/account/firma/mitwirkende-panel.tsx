"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type MitwirkendeListItem = {
  membershipId: string;
  memberEmail: string;
  status: "pending" | "active";
  moduleIds: string[];
};

export type ModuleChoice = {
  id: string;
  nr: number;
  titel: string;
};

function moduleSummary(ids: string[]): string {
  if (ids.length === 0) return "Alle aktiven Module";
  const numbers = ids
    .map((id) => Number.parseInt(id.slice(1), 10))
    .filter((nr) => Number.isFinite(nr))
    .sort((a, b) => a - b);
  return numbers.length > 0 ? `Module ${numbers.join(", ")}` : "Ausgewählte Module";
}

export function MitwirkendePanel({
  entityId,
  firmName,
  members,
  modules,
  unavailable,
}: {
  entityId: string;
  firmName: string;
  members: MitwirkendeListItem[];
  modules: ModuleChoice[];
  unavailable: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<"all" | "some">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  const active = members.filter((item) => item.status === "active");
  const invited = members.filter((item) => item.status === "pending");

  async function send(memberEmail: string, moduleIds: string[]) {
    setError("");
    setNotice("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, memberEmail, moduleIds }),
      });
      const data = (await response.json()) as { error?: string; ok?: boolean; throttled?: boolean };
      if (!response.ok || !data.ok) {
        setError(data.error?.trim() || "Die Einladung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
        return;
      }
      setNotice(
        data.throttled
          ? "Die Einladung ist bereits unterwegs. Bitte warten Sie einen Moment, bevor Sie erneut senden."
          : "Die Einladung ist unterwegs. Der Link ist 20 Minuten gültig.",
      );
      setEmail("");
      router.refresh();
    } catch {
      setError("Die Verbindung ist abgebrochen. Bitte versuchen Sie es erneut.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (scope === "some" && selected.length === 0) {
      setError("Bitte wählen Sie mindestens ein Modul oder alle aktiven Module.");
      return;
    }
    void send(email, scope === "all" ? [] : selected);
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <section className="card" style={{ marginTop: 24 }} aria-labelledby="mitwirkende-heading">
      <h2 id="mitwirkende-heading">Mitwirkende</h2>
      <p>
        Personen, die Module ausfüllen. Höchstens fünf aktive Personen je Firma. Abo,
        Rechnungen und die PDF-Fassung bleiben bei Ihnen.
      </p>
      <p className="hint">Firma: {firmName}</p>
      {unavailable ? (
        <p className="error">
          Die Liste konnte gerade nicht geladen werden. Bitte laden Sie die Seite neu.
        </p>
      ) : null}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="mitwirkende-email">E-Mail</label>
          <input
            id="mitwirkende-email"
            name="email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <fieldset className="field">
          <legend>Module</legend>
          <label>
            <input
              type="radio"
              name="modul-umfang"
              checked={scope === "all"}
              onChange={() => setScope("all")}
            />{" "}
            Alle aktiven Module
          </label>
          <label style={{ display: "block", marginTop: 8 }}>
            <input
              type="radio"
              name="modul-umfang"
              checked={scope === "some"}
              onChange={() => setScope("some")}
            />{" "}
            Nur diese
          </label>
          {scope === "some" ? (
            <div style={{ maxHeight: 240, overflow: "auto", marginTop: 8 }}>
              {modules.map((modul) => (
                <label key={modul.id} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(modul.id)}
                    onChange={() => toggle(modul.id)}
                  />{" "}
                  {modul.nr} {modul.titel}
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="hint">{notice}</p> : null}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Bitte warten…" : "Einladung senden"}
        </button>
      </form>

      <h3 style={{ marginTop: 28 }}>Aktiv</h3>
      {active.length === 0 ? (
        <p className="hint">Noch keine aktive Person.</p>
      ) : (
        <ul>
          {active.map((item) => (
            <li key={item.membershipId}>
              {item.memberEmail} · {moduleSummary(item.moduleIds)}
            </li>
          ))}
        </ul>
      )}

      <h3>Eingeladen, Link 20 Minuten gültig</h3>
      {invited.length === 0 ? (
        <p className="hint">Keine offene Einladung.</p>
      ) : (
        <ul>
          {invited.map((item) => (
            <li key={item.membershipId}>
              {item.memberEmail} · {moduleSummary(item.moduleIds)}{" "}
              <button
                className="btn ghost"
                type="button"
                disabled={pending}
                onClick={() => void send(item.memberEmail, item.moduleIds)}
              >
                Erneut senden
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
