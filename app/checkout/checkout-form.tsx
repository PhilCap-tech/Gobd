"use client";

import { useState } from "react";
import { FirmaSelect } from "@/components/firma-select";
import { PilotKlartextSentence } from "@/components/pilot-klartext";
import type { EntityChoice } from "@/lib/entities";
import { RESULT_PROMISE } from "@/lib/offer-copy";
import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "@/lib/pricing";

type CheckoutAudience = "kunde" | "steuerberater";

type CheckoutFormProps = {
  stripeReady: boolean;
  stripeTestMode?: boolean;
  entities?: EntityChoice[];
  initialEntityId?: string;
  initialCompany?: string;
  initialEmail?: string;
  audience?: CheckoutAudience;
};

export function CheckoutForm({
  stripeReady,
  stripeTestMode = false,
  entities = [],
  initialEntityId = "",
  initialCompany = "",
  initialEmail = "",
  audience = "kunde",
}: CheckoutFormProps) {
  const partner = audience === "steuerberater";
  const [entityId, setEntityId] = useState(initialEntityId);
  const [company, setCompany] = useState(initialCompany);
  const [email, setEmail] = useState(initialEmail);
  const [accepted, setAccepted] = useState(false);
  const [entrepreneur, setEntrepreneur] = useState(false);
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
    if (!entrepreneur) {
      setError(
        partner
          ? "Bitte bestätigen Sie, dass Sie als Unternehmer bestellen."
          : "Bitte bestätige, dass du als Unternehmer bestellst.",
      );
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
          entrepreneur,
          entityId: entityId.trim() || undefined,
          audience,
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
            Zahlung ist hier nicht angebunden. Es geht ohne Zahlung weiter zum
            Intake.
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
            placeholder={partner ? "name@kanzlei.de" : "du@firma.de"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            name="entrepreneur"
            checked={entrepreneur}
            onChange={(e) => setEntrepreneur(e.target.checked)}
            required
          />
          <span>
            Ich bestelle als Unternehmer (§ 14 BGB) für meine gewerbliche oder
            selbstständige berufliche Tätigkeit.
          </span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="acceptedDisclaimer"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            required
          />
          <span>
            {partner
              ? "Ich bestätige: keine Steuerberatung und keine Rechtsberatung. Die Dokumentation ist ein Entwurf aus den Angaben, keine Freigabe. Sie füllen sie nicht für einen Mandanten aus."
              : "Ich bestätige: keine Steuerberatung und keine Rechtsberatung. Die Dokumentation ist ein Entwurf aus meinen Angaben, keine Freigabe."}
          </span>
        </label>
        {partner && (
          <p className="prose">
            <PilotKlartextSentence />
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={pending}>
          {pending
            ? "Bitte warten…"
            : partner
              ? stripeReady
                ? "Partner-Pilot starten"
                : "Weiter zum Fragenkatalog"
              : stripeReady
                ? "Jetzt bestellen"
                : "Weiter zum Intake"}
        </button>
        <p className="hint">
          {stripeReady
            ? stripeTestMode
              ? "Weiter zu Stripe Checkout (Testmodus)."
              : "Weiter zu Stripe Checkout."
            : "Keine Zahlung angebunden — nach dem Absenden direkt zum Intake."}
        </p>
      </form>

      <aside className="card">
        <h2>Bestellübersicht</h2>
        {partner && (
          <p className="hint">
            Der Betrag „Heute fällig“ ist der Listenpreis. Den Code lösen Sie
            erst im Stripe-Checkout ein. Ohne Code bleibt das Setup {SETUP_EUR}
            &nbsp;€ einmalig.
          </p>
        )}
        {partner ? (
          <>
            <div className="line">
              <span>Setup GoBD Verfahrensdoku</span>
              <strong>{SETUP_EUR}&nbsp;€ zzgl. USt</strong>
            </div>
            <div className="line">
              <span>Monatliche Betreuung</span>
              <strong>{MONTHLY_EUR}&nbsp;€ zzgl. USt / Monat</strong>
            </div>
            <div className="total">
              <span>Heute fällig</span>
              <span>{TODAY_EUR}&nbsp;€ zzgl. USt</span>
            </div>
            <p className="hint">
              Mit Code: Setup und die ersten zwei Monate 0&nbsp;€. Danach{" "}
              {MONTHLY_EUR}&nbsp;€ zzgl. USt pro Monat, wenn Sie nicht kündigen.
            </p>
            <p className="disclaimer" role="note">
              Kein Steuerberatungsersatz. Die erzeugte Dokumentation ist ein
              Entwurf aus Ihren Angaben — keine Freigabe und keine individuelle
              Steuer- oder Rechtsberatung.
            </p>
          </>
        ) : (
          <>
            <div className="line">
              <span>Einrichtung</span>
              <strong>{SETUP_EUR}&nbsp;€ zzgl. USt</strong>
            </div>
            <div className="line">
              <span>Erster Monat</span>
              <strong>{MONTHLY_EUR}&nbsp;€ zzgl. USt</strong>
            </div>
            <div className="total">
              <span>Heute fällig</span>
              <span>{TODAY_EUR}&nbsp;€ zzgl. USt</span>
            </div>
            <p className="hint">
              Danach {MONTHLY_EUR}&nbsp;€ zzgl. USt pro Monat, jederzeit zum
              Monatsende kündbar.
            </p>
            <p className="prose">{RESULT_PROMISE}</p>
          </>
        )}
      </aside>
    </div>
  );
}
