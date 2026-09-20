"use client";

import { useState } from "react";
import { FirmaSelect } from "@/components/firma-select";
import type { EntityChoice } from "@/lib/entities";
import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "@/lib/pricing";

type CheckoutFormProps = {
  stripeReady: boolean;
  entities?: EntityChoice[];
  initialEntityId?: string;
  initialCompany?: string;
  initialEmail?: string;
};

export function CheckoutForm({
  stripeReady,
  entities = [],
  initialEntityId = "",
  initialCompany = "",
  initialEmail = "",
}: CheckoutFormProps) {
  const [entityId, setEntityId] = useState(initialEntityId);
  const [company, setCompany] = useState(initialCompany);
  const [email, setEmail] = useState(initialEmail);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requireFirm = entities.length > 1;

  function onEntityChange(nextId: string) {
    setEntityId(nextId);
    const selected = entities.find((entity) => entity.entityId === nextId);
    if (selected) {
      setCompany(selected.name);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (requireFirm && !entityId.trim()) {
      setError("Bitte eine Firma wählen.");
      return;
    }
    if (!accepted) {
      setError(
        "Bitte bestätigen: keine Steuerberatung und keine Rechtsberatung.",
      );
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          email: email.trim(),
          acceptedDisclaimer: accepted,
          entityId: entityId.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !data.url) {
        setError(data.error || "Checkout fehlgeschlagen.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid-2">
      <form className="card" onSubmit={onSubmit}>
        <h2>Rechnungsdaten</h2>
        {!stripeReady && (
          <p className="banner">
            Stripe-Keys fehlen. Lokal geht’s ohne Zahlung weiter zum Intake
            (Stub). Für den Testmodus: STRIPE_SECRET_KEY und Price-IDs in
            .env.local.
          </p>
        )}
        {entities.length > 1 && (
          <FirmaSelect
            entities={entities}
            value={entityId}
            onChange={onEntityChange}
            required={requireFirm}
          />
        )}
        <div className="field">
          <label htmlFor="company">Firma / Name</label>
          <input
            id="company"
            name="company"
            autoComplete="organization"
            placeholder="Muster GmbH"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="du@firma.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            name="acceptedDisclaimer"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            required
          />
          <span>
            Ich bestätige: keine Steuerberatung und keine Rechtsberatung. Die
            Dokumentation ist ein Entwurf zur Abstimmung mit meinem
            Steuerberater.
          </span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={pending}>
          {pending
            ? "Bitte warten…"
            : stripeReady
              ? "Dokumentation starten"
              : "Weiter zum Intake (Stub)"}
        </button>
        <p className="hint">
          {stripeReady
            ? "Weiter zu Stripe Checkout (Testmodus, wenn Test-Keys gesetzt sind)."
            : "Kein Stripe — nach dem Absenden direkt zum Intake."}
        </p>
      </form>

      <aside className="card">
        <h2>Bestellübersicht</h2>
        <div className="line">
          <span>Setup GoBD Verfahrensdoku</span>
          <strong>{SETUP_EUR}&nbsp;€</strong>
        </div>
        <div className="line">
          <span>Monatliche Betreuung</span>
          <strong>{MONTHLY_EUR}&nbsp;€ / Mo</strong>
        </div>
        <div className="total">
          <span>Heute fällig</span>
          <span>{TODAY_EUR}&nbsp;€</span>
        </div>
        <p className="hint">Danach {MONTHLY_EUR}&nbsp;€/Monat.</p>
        <p className="disclaimer" role="note">
          Kein Steuerberatungsersatz. Die erzeugte Dokumentation ist ein Entwurf
          zur Abstimmung mit deinem Steuerberater — keine individuelle Steuer-
          oder Rechtsberatung.
        </p>
      </aside>
    </div>
  );
}
