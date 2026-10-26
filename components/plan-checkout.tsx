"use client";

import {
  PLAN_CHANGE_PRICE_LINE,
  PLAN_ENTRY_POINTS,
  PLAN_ENTRY_PRICE_LINE,
  PLAN_ENTRY_WITH_MEMBER_TOTAL,
  PLAN_MEMBER_POINTS,
  PLAN_MEMBER_PRICE_LINE,
  PLAN_PACKAGE_ENTRY_TITLE,
  PLAN_PACKAGE_INTRO,
  PLAN_PACKAGE_MEMBER_TITLE,
  type PlanPackage,
} from "@/lib/plan-copy";

/** Zwei Pakete nebeneinander (Preismodell v2). Vorauswahl kommt vom Server. */
export function PlanPackageSelect({
  value,
  onChange,
}: {
  value: PlanPackage;
  onChange: (next: PlanPackage) => void;
}) {
  return (
    <fieldset className="field">
      <legend>Paket</legend>
      <p className="hint">{PLAN_PACKAGE_INTRO}</p>
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
            <strong>{PLAN_PACKAGE_ENTRY_TITLE}</strong>
            <br />
            {PLAN_ENTRY_PRICE_LINE}
            <ul>
              {PLAN_ENTRY_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
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
            <strong>{PLAN_PACKAGE_MEMBER_TITLE}</strong>
            <br />
            {PLAN_ENTRY_PRICE_LINE} + {PLAN_MEMBER_PRICE_LINE}
            <ul>
              {PLAN_MEMBER_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

export function PlanCheckoutSummary({ paket }: { paket: PlanPackage }) {
  const member = paket === "mitglied";
  return (
    <>
      <div className="line">
        <span>Verfahrensdokumentation (Einstieg)</span>
        <strong>{PLAN_ENTRY_PRICE_LINE}</strong>
      </div>
      {member ? (
        <div className="line">
          <span>Jahresmitgliedschaft, 1. Jahr</span>
          <strong>{PLAN_MEMBER_PRICE_LINE}</strong>
        </div>
      ) : null}
      <div className="total">
        <span>Heute fällig</span>
        <span>{member ? PLAN_ENTRY_WITH_MEMBER_TOTAL : PLAN_ENTRY_PRICE_LINE}</span>
      </div>
      <p className="hint">
        {member
          ? "Die Mitgliedschaft verlängert sich jährlich. Kündigung bis 3 Monate vor Ablauf."
          : `Spätere Änderungen innerhalb der Frist: ${PLAN_CHANGE_PRICE_LINE}.`}
      </p>
    </>
  );
}
