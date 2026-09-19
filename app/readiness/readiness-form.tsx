"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  READINESS_BELEGWEGE,
  READINESS_BRANCHEN,
  type ReadinessBrancheId,
} from "@/lib/readiness-options";

const RECHTSFORMEN = [
  "Einzelunternehmen",
  "GbR",
  "UG",
  "GmbH",
  "AG",
  "Sonstiges",
];

const MITARBEITENDE = [
  "1 (nur ich)",
  "2–5",
  "6–10",
  "11–20",
  "über 20",
];

type FormState = {
  branche: ReadinessBrancheId | "";
  brancheFreitext: string;
  rechtsform: string;
  mitarbeitende: string;
  belegweg: string;
  software: string;
  verantwortliche: string;
  name: string;
  email: string;
  company: string;
};

const INITIAL: FormState = {
  branche: "",
  brancheFreitext: "",
  rechtsform: "",
  mitarbeitende: "",
  belegweg: "",
  software: "",
  verantwortliche: "",
  name: "",
  email: "",
  company: "",
};

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="chips">
      {options.map((option) => {
        const on = value === option;
        return (
          <button
            key={option}
            type="button"
            className={on ? "chip on" : "chip"}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function ReadinessForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function patch(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function validate(current: number): boolean {
    setError("");
    if (current === 0) {
      if (!form.branche) {
        setError("Bitte eine Branche wählen.");
        return false;
      }
      if (!form.rechtsform || !form.mitarbeitende) {
        setError("Rechtsform und Größe wählen.");
        return false;
      }
    }
    if (current === 1 && !form.belegweg) {
      setError("Bitte den Belegweg wählen.");
      return false;
    }
    if (current === 2) {
      if (!form.name.trim() || !form.email.trim()) {
        setError("Name und E-Mail sind erforderlich.");
        return false;
      }
    }
    return true;
  }

  async function submit() {
    if (!validate(2)) return;
    setPending(true);
    try {
      const response = await fetch("/api/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          branche: form.branche,
          brancheFreitext: form.brancheFreitext.trim(),
          rechtsform: form.rechtsform,
          mitarbeitende: form.mitarbeitende,
          belegweg: form.belegweg,
          software: form.software.trim(),
          verantwortliche: form.verantwortliche.trim(),
        }),
      });
      let data: { error?: string; successUrl?: string } = {};
      try {
        const text = await response.text();
        if (text.trim()) data = JSON.parse(text) as typeof data;
      } catch {
        data = {};
      }
      if (!response.ok || !data.successUrl) {
        setError(data.error || "Speichern fehlgeschlagen.");
        return;
      }
      router.push(data.successUrl);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="progress" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <i
            key={index}
            className={index < step ? "done" : index === step ? "on" : ""}
          />
        ))}
      </div>

      {step === 0 && (
        <section>
          <p className="step-label">Schritt 1 von 3 · ca. 1 Minute</p>
          <h2>Branche und Größe</h2>
          <div className="card">
            <div className="field">
              <label>Branche / Industrie</label>
              <Chips
                options={READINESS_BRANCHEN.map((item) => item.label)}
                value={
                  READINESS_BRANCHEN.find((item) => item.id === form.branche)
                    ?.label ?? ""
                }
                onChange={(label) => {
                  const match = READINESS_BRANCHEN.find((item) => item.label === label);
                  patch({ branche: match?.id ?? "" });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="branche-freitext">Branche genauer (optional)</label>
              <input
                id="branche-freitext"
                name="brancheFreitext"
                placeholder="z. B. SHK, Online-Handel, Physio …"
                value={form.brancheFreitext}
                onChange={(e) => patch({ brancheFreitext: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="rechtsform">Rechtsform</label>
              <select
                id="rechtsform"
                value={form.rechtsform}
                onChange={(e) => patch({ rechtsform: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                {RECHTSFORMEN.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mitarbeitende">Größe (Mitarbeitende, ca.)</label>
              <select
                id="mitarbeitende"
                value={form.mitarbeitende}
                onChange={(e) => patch({ mitarbeitende: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                {MITARBEITENDE.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <p className="step-label">Schritt 2 von 3 · optional Software</p>
          <h2>Belege und Systeme</h2>
          <div className="card">
            <div className="field">
              <label>Belegweg</label>
              <Chips
                options={[...READINESS_BELEGWEGE]}
                value={form.belegweg}
                onChange={(belegweg) => patch({ belegweg })}
              />
            </div>
            <div className="field">
              <label htmlFor="software">Software (optional)</label>
              <input
                id="software"
                name="software"
                placeholder="z. B. DATEV, sevdesk, lexoffice, Handwerkersoftware …"
                value={form.software}
                onChange={(e) => patch({ software: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="verantwortliche">Verantwortliche (optional)</label>
              <input
                id="verantwortliche"
                name="verantwortliche"
                placeholder="z. B. Inhaberin, Büro, Steuerberater"
                value={form.verantwortliche}
                onChange={(e) => patch({ verantwortliche: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <p className="step-label">Schritt 3 von 3 · schaltet den Download frei</p>
          <h2>Kontakt</h2>
          <div className="card">
            <div className="field">
              <label htmlFor="readiness-name">Name</label>
              <input
                id="readiness-name"
                name="name"
                autoComplete="name"
                placeholder="Max Mustermann"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="readiness-email">E-Mail</label>
              <input
                id="readiness-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="du@firma.de"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="readiness-company">Firma (optional)</label>
              <input
                id="readiness-company"
                name="company"
                autoComplete="organization"
                placeholder="Muster GmbH"
                value={form.company}
                onChange={(e) => patch({ company: e.target.value })}
              />
            </div>
            <p className="disclaimer" role="note">
              Kein Steuerberatungsersatz. Das PDF ist eine branchenbezogene
              Arbeitshilfe — keine fertige Verfahrensdokumentation und keine
              Zusicherung von GoBD-Konformität.
            </p>
          </div>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions" style={{ marginTop: 18 }}>
        {step > 0 && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setError("");
              setStep((s) => Math.max(0, s - 1));
            }}
          >
            Zurück
          </button>
        )}
        {step < 2 && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!validate(step)) return;
              setStep((s) => s + 1);
            }}
          >
            Weiter
          </button>
        )}
        {step === 2 && (
          <button type="button" className="btn" onClick={submit} disabled={pending}>
            {pending ? "PDF wird erstellt…" : "PDF kostenlos erhalten"}
          </button>
        )}
      </div>
    </>
  );
}
