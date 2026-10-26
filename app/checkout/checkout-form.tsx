"use client";

import { useEffect, useRef, useState } from "react";
import { FirmaSelect } from "@/components/firma-select";
import { checkoutEntityIdForEmail } from "@/lib/checkout-entity";
import { PilotKlartextSentence } from "@/components/pilot-klartext";
import type { EntityChoice } from "@/lib/entities";
import { INCLUDED_FIRM_NOTE } from "@/lib/account-labels";
import { RESULT_PROMISE } from "@/lib/offer-copy";
import { PlanCheckoutSummary, PlanPackageSelect } from "@/components/plan-checkout";
import {
  PLAN_B2B_NOTICE,
  PLAN_TERMS_HREF,
  PLAN_TERMS_LABEL_AFTER,
  PLAN_TERMS_LABEL_BEFORE,
  PLAN_TERMS_LINK,
  type PlanPackage,
} from "@/lib/plan-copy";
import {
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  SETUP_GROSS_LABEL,
  TODAY_EUR,
  TODAY_GROSS_LABEL,
} from "@/lib/pricing";

type CheckoutAudience = "kunde" | "steuerberater";

type CheckoutFormProps = {
  stripeReady: boolean;
  stripeTestMode?: boolean;
  entities?: EntityChoice[];
  initialEntityId?: string;
  initialCompany?: string;
  initialEmail?: string;
  audience?: CheckoutAudience;
  /** False when the firm-6+ note already explains coverage. */
  showIncludedFirmNote?: boolean;
  /** Preismodell v2 (PRICING_MODEL=v2): Paketwahl und AGB-Bestätigung. */
  planOffer?: { initialPackage: PlanPackage };
};

export function CheckoutForm({
  stripeReady,
  stripeTestMode = false,
  entities = [],
  initialEntityId = "",
  initialCompany = "",
  initialEmail = "",
  audience = "kunde",
  showIncludedFirmNote = true,
  planOffer,
}: CheckoutFormProps) {
  const [paket, setPaket] = useState<PlanPackage>(planOffer?.initialPackage ?? "mitglied");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const partner = audience === "steuerberater";
  const includedFirmNote = showIncludedFirmNote ? (
    <p className="hint">{INCLUDED_FIRM_NOTE}</p>
  ) : null;
  const [entityId, setEntityId] = useState(initialEntityId);
  const [company, setCompany] = useState(initialCompany);
  const [email, setEmail] = useState(initialEmail);
  const sessionEntityRef = useRef(initialEntityId);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    sessionEntityRef.current = initialEntityId;
    setEntityId(initialEntityId);
    setCompany(initialCompany);
    setEmail(initialEmail);
  }, [initialEntityId, initialCompany, initialEmail]);
  const [entrepreneur, setEntrepreneur] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requireFirm = entities.length > 1;

  function onEntityChange(nextId: string) {
    setEntityId(nextId);
    sessionEntityRef.current = nextId;
    const selected = entities.find((entity) => entity.entityId === nextId);
    if (selected) {
      setCompany(selected.name);
    }
  }

  function onEmailChange(value: string) {
    const kept = checkoutEntityIdForEmail({
      typedEmail: value,
      sessionEmail: initialEmail,
      entityId: sessionEntityRef.current || initialEntityId,
    });
    setEmail(value);
    if (kept) {
      setEntityId(kept);
      return;
    }
    if (initialEmail.trim()) {
      setEntityId("");
      if (company.trim() === initialCompany.trim()) setCompany("");
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
      setError("Bitte bestätigen Sie, dass Sie als Unternehmer bestellen.");
      return;
    }
    if (!accepted) {
      setError(
        "Bitte bestätigen: keine Steuerberatung und keine Rechtsberatung.",
      );
      return;
    }
    if (planOffer && !acceptedTerms) {
      setError("Bitte bestätigen Sie die AGB.");
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
          entityId:
            checkoutEntityIdForEmail({
              typedEmail: email,
              sessionEmail: initialEmail,
              entityId,
            }) || undefined,
          audience,
          ...(planOffer ? { paket, acceptedTerms } : {}),
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
        {planOffer ? (
          <>
            <p className="hint">{PLAN_B2B_NOTICE}</p>
            <PlanPackageSelect value={paket} onChange={setPaket} />
          </>
        ) : null}
        <h2>Rechnungsdaten</h2>
        {stripeTestMode ? (
          !stripeReady ? (
            <p className="banner">
              Zahlung ist hier nicht angebunden. Es geht ohne Zahlung weiter zum
              Intake.
            </p>
          ) : null
        ) : null}
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
            placeholder={partner ? "name@kanzlei.de" : "name@firma.de"}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
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
        {planOffer ? (
          <label className="check">
            <input
              type="checkbox"
              name="acceptedTerms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              required
            />
            <span>
              {PLAN_TERMS_LABEL_BEFORE}
              <a href={PLAN_TERMS_HREF} target="_blank" rel="noopener">
                {PLAN_TERMS_LINK}
              </a>
              {PLAN_TERMS_LABEL_AFTER}
            </span>
          </label>
        ) : null}
        {partner && !planOffer && (
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
          {stripeTestMode ? (
            stripeReady
              ? "Weiter zu Stripe Checkout (Testmodus)."
              : "Keine Zahlung angebunden — nach dem Absenden direkt zum Intake."
          ) : (
            "Weiter zu Stripe Checkout."
          )}
        </p>
      </form>

      <aside className="card">
        <h2>Bestellübersicht</h2>
        {planOffer ? (
          <>
            <PlanCheckoutSummary paket={paket} />
            <p className="prose">{RESULT_PROMISE}</p>
          </>
        ) : null}
        {planOffer ? null : partner && (
          <p className="hint">
            Der Betrag „Zum Start“ ist der Listenpreis netto. Den Code lösen
            Sie erst im Stripe-Checkout ein. Ohne Code bleibt die Einrichtung{" "}
            {SETUP_EUR}&nbsp;€ netto ({SETUP_GROSS_LABEL}&nbsp;€ brutto)
            einmalig.
          </p>
        )}
        {planOffer ? null : partner ? (
          <>
            <div className="line">
              <span>Setup GoBD Verfahrensdoku</span>
              <strong>
                {SETUP_EUR}&nbsp;€ netto ({SETUP_GROSS_LABEL}&nbsp;€ brutto)
              </strong>
            </div>
            <div className="line">
              <span>Monatliche Betreuung</span>
              <strong>
                {MONTHLY_EUR}&nbsp;€ netto ({MONTHLY_GROSS_LABEL}&nbsp;€ brutto)
                / Monat
              </strong>
            </div>
            <div className="total">
              <span>Zum Start fällig (Einrichtung + 1. Monat)</span>
              <span>
                {TODAY_EUR}&nbsp;€ netto ({TODAY_GROSS_LABEL}&nbsp;€ brutto)
              </span>
            </div>
            {includedFirmNote}
            <p className="hint">
              Mit Code: Setup und die ersten zwei Monate 0&nbsp;€. Danach{" "}
              {MONTHLY_EUR}&nbsp;€ netto ({MONTHLY_GROSS_LABEL}&nbsp;€ brutto)
              pro Monat, wenn Sie nicht kündigen.
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
              <strong>
                {SETUP_EUR}&nbsp;€ netto ({SETUP_GROSS_LABEL}&nbsp;€ brutto)
              </strong>
            </div>
            <div className="line">
              <span>Erster Monat</span>
              <strong>
                {MONTHLY_EUR}&nbsp;€ netto ({MONTHLY_GROSS_LABEL}&nbsp;€ brutto)
              </strong>
            </div>
            <div className="total">
              <span>Zum Start fällig (Einrichtung + 1. Monat)</span>
              <span>
                {TODAY_EUR}&nbsp;€ netto ({TODAY_GROSS_LABEL}&nbsp;€ brutto)
              </span>
            </div>
            {includedFirmNote}
            <p className="hint">
              Danach {MONTHLY_EUR}&nbsp;€ netto ({MONTHLY_GROSS_LABEL}&nbsp;€
              brutto) pro Monat, jederzeit zum Monatsende kündbar.
            </p>
            <p className="prose">{RESULT_PROMISE}</p>
          </>
        )}
        <p className="hint">
          Inland (Deutschland): 19&nbsp;% Umsatzsteuer auf die Nettopreise. Eine
          Umkehr der Steuerschuldnerschaft (Reverse Charge) bieten wir derzeit
          nicht an.
        </p>
      </aside>
    </div>
  );
}
