"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_ENTITIES_PER_ACCOUNT, type EntityInput } from "@/lib/entities";

type FirmaFormProps = {
  mode?: "create" | "edit";
  entityId?: string;
  initial?: EntityInput;
};

export function FirmaForm({
  mode = "create",
  entityId,
  initial,
}: FirmaFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [name, setName] = useState(initial?.name ?? "");
  const [street, setStreet] = useState(initial?.street ?? "");
  const [zip, setZip] = useState(initial?.zip ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [stnr, setStnr] = useState(initial?.stnr ?? "");
  const [ustId, setUstId] = useState(initial?.ustId ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/entities", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          name: name.trim(),
          street: street.trim(),
          zip: zip.trim(),
          city: city.trim(),
          stnr: stnr.trim(),
          ustId: ustId.trim(),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        ok?: boolean;
      };
      if (!response.ok || !data.ok) {
        setError(
          data.error ||
            (isEdit
              ? "Firma konnte nicht gespeichert werden."
              : "Firma konnte nicht angelegt werden."),
        );
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="firma-name">Firmenname</label>
        <input
          id="firma-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoComplete="organization"
        />
      </div>
      <div className="field">
        <label htmlFor="firma-street">Straße und Hausnummer</label>
        <input
          id="firma-street"
          name="street"
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          autoComplete="street-address"
        />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="firma-zip">PLZ</label>
          <input
            id="firma-zip"
            name="zip"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            autoComplete="postal-code"
          />
        </div>
        <div className="field">
          <label htmlFor="firma-city">Ort</label>
          <input
            id="firma-city"
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            autoComplete="address-level2"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="firma-stnr">Steuernummer (optional)</label>
        <input
          id="firma-stnr"
          name="stnr"
          value={stnr}
          onChange={(event) => setStnr(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="firma-ust">USt-IdNr. (optional)</label>
        <input
          id="firma-ust"
          name="ustId"
          value={ustId}
          onChange={(event) => setUstId(event.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending
          ? "Bitte warten…"
          : isEdit
            ? "Stammdaten speichern"
            : "Firma anlegen"}
      </button>
      {!isEdit && (
        <p className="hint" style={{ marginTop: 12 }}>
          Du kannst bis zu {MAX_ENTITIES_PER_ACCOUNT} Firmen in einem Konto
          anlegen.
        </p>
      )}
    </form>
  );
}
