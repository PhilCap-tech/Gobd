"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
import { PROFILE_NAME_MAX } from "@/lib/profile";

type AccountProfileFormProps = {
  email: string;
  initialName: string;
  atCap: boolean;
  firmHref: string | null;
};

export function AccountProfileForm({
  email,
  initialName,
  atCap,
  firmHref,
}: AccountProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok || !data.ok) {
        setError(data.error || "Name konnte nicht gespeichert werden.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card account-panel" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Profil</h2>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            maxLength={PROFILE_NAME_MAX}
            autoComplete="name"
            placeholder="Vor- und Nachname"
          />
        </div>
        <div className="field">
          <label htmlFor="profile-email">E-Mail</label>
          <input
            id="profile-email"
            name="email"
            type="email"
            value={email}
            readOnly
            autoComplete="email"
          />
          <p className="hint">Die Anmeldung bleibt an diese Adresse gebunden.</p>
        </div>
        {error && <p className="error">{error}</p>}
        {saved && (
          <p className="banner ok" role="status">
            Name gespeichert.
          </p>
        )}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Bitte warten…" : "Name speichern"}
        </button>
      </form>

      <h3 className="account-subhead">Firma</h3>
      <p className="prose">
        Stammdaten legst du unabhängig vom Abo an.
      </p>
      <div className="actions">
        {!atCap && (
          <Link className="btn ghost" href="/account/firma/neu">
            Firma anlegen
          </Link>
        )}
        {firmHref && (
          <Link className="btn ghost" href={firmHref}>
            Stammdaten bearbeiten
          </Link>
        )}
      </div>
      {atCap && (
        <p className="hint">
          Du hast das Maximum von {MAX_ENTITIES_PER_ACCOUNT} Firmen erreicht.
        </p>
      )}
    </section>
  );
}
