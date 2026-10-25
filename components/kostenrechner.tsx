"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CampaignLink } from "@/components/campaign-link";
import { VorlagenGate } from "@/components/vorlagen-gate";
import {
  CALC_ABSCHLUSS,
  CALC_ALWAYS_HINT,
  CALC_DISCLAIMER,
  CALC_GRENZ_HINT,
  CALC_INTRO_B,
  CALC_INTERPRETATION,
  CALC_KASSE_HINT,
  CALC_KLEIN_HINT,
  CALC_RESULT_TITLE,
  CALC_RZ155,
  CALC_STB_HINT,
  CALC_WAYS_NOTE,
  CALC_ZINS_HINT,
  DEFAULT_MONTHS,
  DEFAULT_STB_MAX,
  DEFAULT_STB_MIN,
  DEFAULT_YEARS,
  DEFAULT_ZINS_MONTHS,
  emptyCalc,
  viewCalc,
  type CalcSnapshot,
  type UstRate,
} from "@/lib/vorlagen/calc";
import { MAGNET_PDF_BUTTON } from "@/lib/vorlagen/copy";
import { MAGNET_PATHS } from "@/lib/vorlagen/ids";
import { sendMagnetCalcUsed, sendMagnetView } from "@/lib/vorlagen/step-beacon";

function amount(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function whole(raw: string): number | null {
  const value = amount(raw);
  if (value == null || !Number.isInteger(value)) return null;
  return value;
}

export function Kostenrechner() {
  const base = useId();
  const [stundenEigen, setStundenEigen] = useState("");
  const [satzEigen, setSatzEigen] = useState("");
  const [stundenStb, setStundenStb] = useState("");
  const [satzMin, setSatzMin] = useState(String(DEFAULT_STB_MIN));
  const [satzMax, setSatzMax] = useState(String(DEFAULT_STB_MAX));
  const [monate, setMonate] = useState(String(DEFAULT_MONTHS));
  const [hinzu, setHinzu] = useState("");
  const [ust, setUst] = useState<"" | "0.19" | "0.07" | "0">("");
  const [grenz, setGrenz] = useState("");
  const [jahre, setJahre] = useState(String(DEFAULT_YEARS));
  const [zins, setZins] = useState(String(DEFAULT_ZINS_MONTHS));
  const [kasse, setKasse] = useState(false);
  const [klein, setKlein] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    sendMagnetView("kostenrechner");
    sendMagnetCalcUsed("kostenrechner");
  }, []);

  const calc = useMemo<CalcSnapshot>(() => {
    const next = emptyCalc();
    next.stunden_eigen = amount(stundenEigen);
    next.stundensatz_eigen = amount(satzEigen);
    next.stunden_stb = amount(stundenStb);
    next.satz_stb_min = amount(satzMin);
    next.satz_stb_max = amount(satzMax);
    next.monate_tool = whole(monate);
    next.hinzuschaetzung_netto = amount(hinzu);
    next.ust_satz = ust === "" ? null : (Number(ust) as UstRate);
    next.grenzsteuersatz = amount(grenz);
    next.jahre = whole(jahre);
    next.zinsmonate = whole(zins);
    next.kasse = kasse;
    next.kleinunternehmer = klein;
    return next;
  }, [stundenEigen, satzEigen, stundenStb, satzMin, satzMax, monate, hinzu, ust, grenz, jahre, zins, kasse, klein]);

  const view = viewCalc(calc);
  const ratesOrdered =
    calc.satz_stb_min == null || calc.satz_stb_max == null || calc.satz_stb_min <= calc.satz_stb_max;

  return (
    <>
      <p className="vorlagen-callout">{CALC_DISCLAIMER}</p>
      <p className="vorlagen-quote">{CALC_RZ155}</p>

      <h2>Was kostet es, eine Verfahrensdokumentation zu erstellen?</h2>
      <div className="vorlagen-cols">
        <section className="card">
          <h3>Erstellung in Eigenleistung</h3>
          <div className="field">
            <label htmlFor={`${base}-eigen-h`}>Geschätzte eigene Stunden</label>
            <input id={`${base}-eigen-h`} inputMode="decimal" value={stundenEigen} onChange={(event) => setStundenEigen(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${base}-eigen-s`}>Wert einer eigenen Arbeitsstunde (€)</label>
            <input id={`${base}-eigen-s`} inputMode="decimal" value={satzEigen} onChange={(event) => setSatzEigen(event.target.value)} />
          </div>
          <p>{view.eigen}</p>
        </section>
        <section className="card">
          <h3>Erstellung mit Steuerberatung</h3>
          <div className="field">
            <label htmlFor={`${base}-stb-h`}>Geschätzte Stunden der Steuerberatung</label>
            <input id={`${base}-stb-h`} inputMode="decimal" value={stundenStb} onChange={(event) => setStundenStb(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${base}-stb-min`}>Zeitgebühr von (€ je Stunde, netto)</label>
            <input id={`${base}-stb-min`} inputMode="decimal" value={satzMin} onChange={(event) => setSatzMin(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${base}-stb-max`}>Zeitgebühr bis (€ je Stunde, netto)</label>
            <input id={`${base}-stb-max`} inputMode="decimal" value={satzMax} onChange={(event) => setSatzMax(event.target.value)} />
          </div>
          <p className="hint">{CALC_STB_HINT}</p>
          <p>{ratesOrdered ? view.stb : "Bitte geben Sie den unteren Satz nicht höher als den oberen an."}</p>
        </section>
        <section className="card">
          <h3>gobd-doku-erstellen.de</h3>
          <div className="field">
            <label htmlFor={`${base}-monate`}>Nutzungsdauer in Monaten</label>
            <input id={`${base}-monate`} inputMode="numeric" value={monate} onChange={(event) => setMonate(event.target.value)} />
          </div>
          <p>{view.tool}</p>
        </section>
      </div>
      <p>{CALC_WAYS_NOTE}</p>

      <h2>Was-wäre-wenn: mögliche steuerliche Folgen einer Schätzung</h2>
      <p>{CALC_INTRO_B}</p>
      <div className="card">
        <div className="field">
          <label htmlFor={`${base}-hinzu`}>Angenommener zusätzlicher Netto-Betrag je Jahr (€)</label>
          <input id={`${base}-hinzu`} inputMode="decimal" value={hinzu} onChange={(event) => setHinzu(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${base}-ust`}>Umsatzsteuersatz</label>
          <select id={`${base}-ust`} value={ust} onChange={(event) => setUst(event.target.value as typeof ust)}>
            <option value="">Bitte wählen</option>
            <option value="0.19">19 %</option>
            <option value="0.07">7 %</option>
            <option value="0">0 % (Kleinunternehmer)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${base}-grenz`}>Persönlicher Grenzsteuersatz Ertragsteuern (%)</label>
          <input id={`${base}-grenz`} inputMode="decimal" value={grenz} onChange={(event) => setGrenz(event.target.value)} />
          <p className="hint">{CALC_GRENZ_HINT}</p>
        </div>
        <div className="field">
          <label htmlFor={`${base}-jahre`}>Anzahl betroffener Jahre</label>
          <input id={`${base}-jahre`} inputMode="numeric" value={jahre} onChange={(event) => setJahre(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${base}-zins`}>Volle Monate Zinslauf</label>
          <input id={`${base}-zins`} inputMode="numeric" value={zins} onChange={(event) => setZins(event.target.value)} />
          <p className="hint">{CALC_ZINS_HINT}</p>
        </div>
      </div>

      <h2>{CALC_RESULT_TITLE}</h2>
      <div className="card" aria-live="polite">
        <p>{view.blockB}</p>
        {view.blockBDetail ? <p>{view.blockBDetail}</p> : null}
        {view.assumption ? <p>{view.assumption}</p> : null}
      </div>

      <div className="field">
        <label className="check" htmlFor={`${base}-kasse`}>
          <input id={`${base}-kasse`} type="checkbox" checked={kasse} onChange={(event) => setKasse(event.target.checked)} />
          <span>Ich verwende eine elektronische Kasse oder eine App-Kasse.</span>
        </label>
      </div>
      {kasse ? (
        <p className="card">
          {CALC_KASSE_HINT}{" "}
          <CampaignLink href={MAGNET_PATHS["checkliste-kassen-nachschau"]}>Kassen-Nachschau-Checkliste</CampaignLink>
        </p>
      ) : null}
      <div className="field">
        <label className="check" htmlFor={`${base}-klein`}>
          <input id={`${base}-klein`} type="checkbox" checked={klein} onChange={(event) => setKlein(event.target.checked)} />
          <span>Ich bin Kleinunternehmer/in und ermittle meinen Gewinn per Einnahmen-Überschussrechnung.</span>
        </label>
      </div>
      {klein ? <p className="card">{CALC_KLEIN_HINT}</p> : null}
      <p>{CALC_ALWAYS_HINT}</p>
      <p className="hint">{CALC_INTERPRETATION}</p>
      <p>{CALC_ABSCHLUSS}</p>
      <p className="actions">
        <CampaignLink className="btn" href="/ampel-check">Kostenlose GoBD-Ampel starten</CampaignLink>
        <CampaignLink className="btn ghost" href={MAGNET_PATHS["gliederung-verfahrensdoku"]}>Gliederungsvorlage ansehen</CampaignLink>
      </p>

      {pdfOpen ? (
        <VorlagenGate
          magnet="kostenrechner"
          intro="Das Ergebnis-PDF senden wir Ihnen, nachdem Sie Ihre E-Mail-Adresse bestätigt haben. Der Rechner oben bleibt ohne E-Mail nutzbar."
          buttonLabel="Ergebnis-PDF anfordern"
          calc={ratesOrdered ? calc : null}
        />
      ) : (
        <p className="actions">
          <button className="btn" type="button" onClick={() => setPdfOpen(true)} disabled={!ratesOrdered}>
            {MAGNET_PDF_BUTTON}
          </button>
        </p>
      )}
    </>
  );
}
