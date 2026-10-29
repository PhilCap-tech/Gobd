"use client";

import {
  PLAN_BESTSELLER_LABEL,
  PLAN_ENTRY_SELECTED_HINT,
  PLAN_PACKAGES_FOOTER,
  PLAN_ENTRY_PRICE_LINE,
  PLAN_ENTRY_WITH_MEMBER_TOTAL,
  PLAN_MEMBER_PRICE_LINE,
  PLAN_ENTRY_SUBTITLE,
  PLAN_MEMBER_SUBTITLE,
  PLAN_PACKAGE_ENTRY_TITLE,
  PLAN_PACKAGE_INTRO,
  PLAN_OPTION_1_SUMMARY_NOTE,
  PLAN_OPTION_2_SUMMARY_NOTE,
  PLAN_PACKAGE_MEMBER_TITLE,
  type PlanPackage,
  type PlanPackageTexts,
} from "@/lib/plan-copy";

/** Zwei Pakete nebeneinander (Preismodell v2). Vorauswahl kommt vom Server. */
export function PlanPackageSelect({
  value,
  onChange,
  texts,
}: {
  value: PlanPackage;
  onChange: (next: PlanPackage) => void;
  /** Wortlaut Legal je Paket, vom Server (Löschsatz hängt an RETENTION_DELETE_ENABLED). */
  texts: PlanPackageTexts;
}) {
  return (
    <fieldset className="field">
      <legend>Paket</legend>
      {PLAN_PACKAGE_INTRO ? <p className="hint">{PLAN_PACKAGE_INTRO}</p> : null}
      <div className="grid-2">
        <label className="card check">
          <input
            type="radio"
            name="paket"
            value="einstieg"
            checked={value === "einstieg"}
            onChange={() => onChange("einstieg")}
          />
          <span>
            <strong>{PLAN_PACKAGE_ENTRY_TITLE}</strong> <small>({PLAN_ENTRY_SUBTITLE})</small>
            <br />
            {PLAN_ENTRY_PRICE_LINE}
            <br />
            <small>Paket „{PLAN_PACKAGE_ENTRY_TITLE}“: {texts.entry}</small>
          </span>
        </label>
        <label className="card check">
          <input
            type="radio"
            name="paket"
            value="mitglied"
            checked={value === "mitglied"}
            onChange={() => onChange("mitglied")}
          />
          <span>
            <strong>{PLAN_PACKAGE_MEMBER_TITLE}</strong> <small>({PLAN_MEMBER_SUBTITLE})</small>{" "}
            <span className="badge">{PLAN_BESTSELLER_LABEL}</span>
            <br />
            {PLAN_ENTRY_PRICE_LINE} + {PLAN_MEMBER_PRICE_LINE}
            <br />
            <small>Paket „{PLAN_PACKAGE_MEMBER_TITLE}“: {texts.member}</small>
          </span>
        </label>
      </div>
      {value === "einstieg" ? <p className="hint">{PLAN_ENTRY_SELECTED_HINT}</p> : null}
      <p className="hint">{PLAN_PACKAGES_FOOTER}</p>
    </fieldset>
  );
}

export function PlanCheckoutSummary({ paket }: { paket: PlanPackage }) {
  const member = paket === "mitglied";
  return (
    <>
      <div className="line">
        <span>Verfahrensdokumentation (einmalig)</span>
        <strong>{PLAN_ENTRY_PRICE_LINE}</strong>
      </div>
      {member ? (
        <div className="line">
          <span>Jahrespaket, 1. Jahr</span>
          <strong>{PLAN_MEMBER_PRICE_LINE}</strong>
        </div>
      ) : null}
      <div className="total">
        <span>Heute fällig</span>
        <span>{member ? PLAN_ENTRY_WITH_MEMBER_TOTAL : PLAN_ENTRY_PRICE_LINE}</span>
      </div>
      <p className="hint">
        {member
          ? PLAN_OPTION_2_SUMMARY_NOTE
          : PLAN_OPTION_1_SUMMARY_NOTE}
      </p>
    </>
  );
}
