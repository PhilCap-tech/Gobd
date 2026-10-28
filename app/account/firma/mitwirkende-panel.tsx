"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  REVOKE_ALREADY_MESSAGE,
  REVOKE_CONFIRM,
  REVOKE_DONE_MESSAGE,
  REVOKE_MAIL_NOTE,
} from "@/lib/membership-copy";

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
  inviteBlocked = null,
}: {
  entityId: string;
  firmName: string;
  members: MitwirkendeListItem[];
  modules: ModuleChoice[];
  unavailable: boolean;
  /** Neues Modell vor der Zahlung: Einladen gesperrt, Hinweistext. */
  inviteBlocked?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<"all" | "some">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [target, setTarget] = useState<MitwirkendeListItem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  function askRevoke(item: MitwirkendeListItem) {
    if (pending) return;
    flushSync(() => setTarget(item));
    dialogRef.current?.showModal();
  }

  async function confirmRevoke() {
    const item = target;
    dialogRef.current?.close();
    if (!item || pending) return;
    setError("");
    setNotice("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/invite/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, membershipId: item.membershipId }),
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
        mailed?: boolean;
        already?: boolean;
      };
      if (!response.ok || !data.ok) {
        setError(data.error?.trim() || "Der Zugriff konnte nicht entzogen werden. Bitte versuchen Sie es erneut.");
        return;
      }
      setNotice(data.already ? REVOKE_ALREADY_MESSAGE : data.mailed ? REVOKE_DONE_MESSAGE : REVOKE_MAIL_NOTE);
      router.refresh();
    } catch {
      setError("Die Verbindung ist abgebrochen. Bitte versuchen Sie es erneut.");
    } finally {
      setPending(false);
    }
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
        {inviteBlocked ? <p className="hint">{inviteBlocked}</p> : null}
        <button className="btn" type="submit" disabled={pending || Boolean(inviteBlocked)}>
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
              {item.memberEmail} · {moduleSummary(item.moduleIds)}{" "}
              <button className="btn ghost" type="button" disabled={pending} onClick={() => askRevoke(item)}>
                Zugriff entziehen
              </button>
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
              </button>{" "}
              <button className="btn ghost" type="button" disabled={pending} onClick={() => askRevoke(item)}>
                Zurücknehmen
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog
        ref={dialogRef}
        className="info-dialog"
        aria-labelledby="mitwirkende-revoke-title"
        onClose={() => setTarget(null)}
      >
        <h3 id="mitwirkende-revoke-title">
          {target?.status === "pending" ? "Einladung zurücknehmen" : "Zugriff entziehen"}
        </h3>
        <p>{REVOKE_CONFIRM}</p>
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn" type="button" disabled={pending} onClick={() => void confirmRevoke()}>
            {target?.status === "pending" ? "Zurücknehmen" : "Zugriff entziehen"}
          </button>
          <button className="btn ghost" type="button" onClick={() => dialogRef.current?.close()}>
            Abbrechen
          </button>
        </div>
      </dialog>
    </section>
  );
}
