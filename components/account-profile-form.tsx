"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXTRA_FIRM_NOTE, FIRMA_ADD_LABEL, FIRMA_EDIT_LABEL } from "@/lib/account-labels";
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
  // Null until the field is edited, so a name that arrives with a later
  // server render fills the empty first paint.
  const [editedName, setEditedName] = useState<string | null>(null);
  const name = editedName ?? initialName;
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
              setEditedName(event.target.value);
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
        Stammdaten legen Sie unabhängig vom Abo an.
      </p>
      <div className="actions">
        <Link className="btn ghost" href="/account/firma/neu">
          {firmHref ? FIRMA_ADD_LABEL : "Firma anlegen"}
        </Link>
        {firmHref && (
          <Link className="btn ghost" href={firmHref}>
            {FIRMA_EDIT_LABEL}
          </Link>
        )}
      </div>
      {atCap && <p className="hint">{EXTRA_FIRM_NOTE}</p>}
    </section>
  );
}
