"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";
import type { DeliveryPlan } from "@/lib/delivery";

const BRANCHEN = [
  "Handwerk",
  "Handel",
  "Dienstleistung",
  "Freiberufler",
  "Gastronomie",
  "Sonstiges",
];
const FIBU = ["DATEV", "sevdesk", "lexoffice", "Excel / manuell", "Sonstiges"];
const EINGANG = ["E-Mail / PDF", "Scan / App", "Papierordner", "Portal Lieferant"];
const AUSGANG = [
  "aus Buchhaltungssoftware",
  "Word / Excel",
  "Shop / Kassensystem",
  "gemischt",
];
const BACKUP = [
  "Automatisch (Anbieter)",
  "Manuell / unregelmäßig",
  "Kein bekanntes Backup",
  "Unklar",
];

type IntakeFormProps = {
  session: CheckoutIdentity;
};

function Chips({
  options,
  value,
  onChange,
  multi,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="chips">
      {options.map((option) => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={on ? "chip on" : "chip"}
            onClick={() => {
              if (multi) {
                onChange(
                  on ? value.filter((item) => item !== option) : [...value, option],
                );
              } else {
                onChange([option]);
              }
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function IntakeForm({ session }: IntakeFormProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(emptyAnswers);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{
    store: string;
    delivery: DeliveryPlan;
  } | null>(null);

  function patch(partial: Partial<IntakeAnswers>) {
    setAnswers((current) => ({ ...current, ...partial }));
  }

  function validate(current: number): boolean {
    setError("");
    if (current === 0 && (!answers.branchen.length || !answers.rechtsform || !answers.mitarbeitende)) {
      setError("Branche, Rechtsform und Mitarbeitende auswählen.");
      return false;
    }
    if (current === 1 && !answers.fibu.length) {
      setError("Mindestens eine FiBu-Option wählen.");
      return false;
    }
    if (current === 2 && (!answers.eingangsbelege.length || !answers.ausgangsrechnungen.length)) {
      setError("Eingangs- und Ausgangswege wählen.");
      return false;
    }
    if (current === 3 && !answers.hosting) {
      setError("Hosting-Angabe fehlt.");
      return false;
    }
    if (current === 4 && (!answers.gf || !answers.buchhaltung)) {
      setError("GF und Buchhaltungsverantwortung ausfüllen.");
      return false;
    }
    return true;
  }

  async function submit() {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.stripeSessionId,
          email: session.email,
          company: session.company,
          answers,
        }),
      });
      let data: {
        error?: string;
        store?: string;
        delivery?: DeliveryPlan;
      } = {};
      try {
        const text = await response.text();
        if (text.trim()) {
          data = JSON.parse(text) as typeof data;
        }
      } catch {
        data = {};
      }
      if (!response.ok) {
        setError(data.error || "Speichern fehlgeschlagen.");
        return;
      }
      if (!data.delivery || !data.store) {
        setError(data.error || "Speichern fehlgeschlagen.");
        return;
      }
      setDone({ store: data.store, delivery: data.delivery });
      setStep(6);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  const summary = useMemo(
    () => [
      ["Branche", answers.branchen.join(", ") || "—"],
      ["Rechtsform", answers.rechtsform || "—"],
      ["Mitarbeitende", answers.mitarbeitende || "—"],
      ["FiBu", answers.fibu.join(", ") || "—"],
      ["Weitere Systeme", answers.weitereSysteme || "—"],
      ["Eingangsbelege", answers.eingangsbelege.join(", ") || "—"],
      ["Ausgangsrechnungen", answers.ausgangsrechnungen.join(", ") || "—"],
      ["Archiv", answers.archiv || "—"],
      ["Hosting", answers.hosting || "—"],
      ["Backup", answers.backup.join(", ") || "—"],
      ["Zugriff", answers.zugriff || "—"],
      ["GF / Inhaber", answers.gf || "—"],
      ["Buchhaltung", answers.buchhaltung || "—"],
      ["IT", answers.it || "—"],
      ["Steuerberater", answers.steuerberater || "—"],
    ],
    [answers],
  );

  return (
    <>
      {step < 6 && (
        <div className="progress" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <i
              key={index}
              className={index < step ? "done" : index === step ? "on" : ""}
            />
          ))}
        </div>
      )}

      {session.stub && step < 6 && (
        <p className="banner">
          Stub-Session (kein Stripe). Angaben werden lokal oder in Sheets
          gespeichert, sobald du absendest.
        </p>
      )}

      {session.email && step === 0 && (
        <p className="hint">
          Session: {session.company || "—"} · {session.email}
        </p>
      )}

      {step === 0 && (
        <section>
          <p className="step-label">Schritt 1 von 5</p>
          <h1>Branche &amp; Unternehmensform</h1>
          <div className="card">
            <div className="field">
              <label>Branche (mehrere möglich)</label>
              <Chips
                options={BRANCHEN}
                value={answers.branchen}
                onChange={(branchen) => patch({ branchen })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="rechtsform">Rechtsform</label>
              <select
                id="rechtsform"
                value={answers.rechtsform}
                onChange={(e) => patch({ rechtsform: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                <option>Einzelunternehmen</option>
                <option>GbR</option>
                <option>UG</option>
                <option>GmbH</option>
                <option>AG</option>
                <option>Sonstiges</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ma">Mitarbeitende (ca.)</label>
              <select
                id="ma"
                value={answers.mitarbeitende}
                onChange={(e) => patch({ mitarbeitende: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                <option>1 (nur ich)</option>
                <option>2–5</option>
                <option>6–10</option>
                <option>11–20</option>
                <option>über 20</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <p className="step-label">Schritt 2 von 5</p>
          <h1>Buchhaltungs- &amp; Branchensoftware</h1>
          <div className="card">
            <div className="field">
              <label>Buchhaltung / FiBu</label>
              <Chips
                options={FIBU}
                value={answers.fibu}
                onChange={(fibu) => patch({ fibu })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="andere-sw">
                Weitere Systeme (ERP, Kassensystem, Zeiterfassung …)
              </label>
              <textarea
                id="andere-sw"
                placeholder="z. B. Shopify, Lightspeed, Clockodo …"
                value={answers.weitereSysteme}
                onChange={(e) => patch({ weitereSysteme: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <p className="step-label">Schritt 3 von 5</p>
          <h1>Belegwege</h1>
          <div className="card">
            <div className="field">
              <label>Wie kommen Eingangsbelege rein?</label>
              <Chips
                options={EINGANG}
                value={answers.eingangsbelege}
                onChange={(eingangsbelege) => patch({ eingangsbelege })}
                multi
              />
            </div>
            <div className="field">
              <label>Ausgangsrechnungen</label>
              <Chips
                options={AUSGANG}
                value={answers.ausgangsrechnungen}
                onChange={(ausgangsrechnungen) => patch({ ausgangsrechnungen })}
                multi
              />
            </div>
            <div className="field">
              <label htmlFor="archiv">Wo werden Belege archiviert?</label>
              <input
                id="archiv"
                placeholder="z. B. DATEV Unternehmen online, Drive, lokaler Server …"
                value={answers.archiv}
                onChange={(e) => patch({ archiv: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <p className="step-label">Schritt 4 von 5</p>
          <h1>IT &amp; Zugriff</h1>
          <div className="card">
            <div className="field">
              <label htmlFor="hosting">Wo liegen die Daten?</label>
              <select
                id="hosting"
                value={answers.hosting}
                onChange={(e) => patch({ hosting: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                <option>Cloud (Anbieter DE/EU)</option>
                <option>Cloud (Anbieter außerhalb EU)</option>
                <option>Eigener Server / NAS</option>
                <option>Nur lokal auf PCs</option>
                <option>Gemischt / unklar</option>
              </select>
            </div>
            <div className="field">
              <label>Backup</label>
              <Chips
                options={BACKUP}
                value={answers.backup}
                onChange={(backup) => patch({ backup })}
              />
            </div>
            <div className="field">
              <label htmlFor="zugriff">Wer hat Zugriff auf Buchhaltungsdaten?</label>
              <textarea
                id="zugriff"
                placeholder="z. B. Inhaber, Buchhaltung intern, Steuerberater, externe IT …"
                value={answers.zugriff}
                onChange={(e) => patch({ zugriff: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          <p className="step-label">Schritt 5 von 5</p>
          <h1>Verantwortliche</h1>
          <div className="card">
            <div className="field">
              <label htmlFor="gf">Geschäftsführung / Inhaber</label>
              <input
                id="gf"
                placeholder="Name"
                value={answers.gf}
                onChange={(e) => patch({ gf: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="buchhaltung">Buchhaltung / Belegverantwortung</label>
              <input
                id="buchhaltung"
                placeholder="Name oder „externer Steuerberater“"
                value={answers.buchhaltung}
                onChange={(e) => patch({ buchhaltung: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="it-person">IT / Systeme</label>
              <input
                id="it-person"
                placeholder="Name oder Dienstleister"
                value={answers.it}
                onChange={(e) => patch({ it: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="steuerberater">Steuerberater (Kanzlei)</label>
              <input
                id="steuerberater"
                placeholder="optional"
                value={answers.steuerberater}
                onChange={(e) => patch({ steuerberater: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {step === 5 && (
        <section>
          <p className="step-label">Prüfen &amp; absenden</p>
          <h1>Stimmt das so?</h1>
          <div className="card">
            <dl className="summary">
              {summary.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="disclaimer">
              Kein Steuerberatungsersatz. Die erzeugte Dokumentation ist ein
              Entwurf zur Abstimmung mit deinem Steuerberater — keine
              individuelle Steuer- oder Rechtsberatung.
            </p>
          </div>
        </section>
      )}

      {step === 6 && done && (
        <section>
          <div className="card center">
            <h1>Intake gespeichert</h1>
            <p className="prose">
              Ablage:{" "}
              {done.store === "sheets"
                ? "Google Sheets"
                : "Datei-Fallback (lokal .data, auf Vercel /tmp)"}.
              Delivery ist ein Stub — kein PDF, keine GoBD-Rechtstexte.
            </p>
            <p className="prose" style={{ textAlign: "left", marginTop: 16 }}>
              <strong>Kapitelgerüst</strong>
            </p>
            <ul className="prose-list" style={{ textAlign: "left", display: "inline-block" }}>
              {done.delivery.chapters.map((chapter) => (
                <li key={chapter.id}>
                  {chapter.title} ({chapter.source})
                </li>
              ))}
            </ul>
            {done.delivery.openItems.length > 0 && (
              <>
                <p className="prose" style={{ textAlign: "left", marginTop: 16 }}>
                  <strong>Offene Punkte</strong>
                </p>
                <ul className="prose-list" style={{ textAlign: "left", display: "inline-block" }}>
                  {done.delivery.openItems.map((item) => (
                    <li key={item.id}>{item.title}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="actions" style={{ justifyContent: "center", marginTop: 16 }}>
              <Link className="btn" href="/">
                Zurück zur Landing
              </Link>
            </div>
          </div>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {step < 6 && (
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
          {step < 5 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!validate(step)) return;
                setStep((s) => s + 1);
              }}
            >
              {step === 4 ? "Zur Übersicht" : "Weiter"}
            </button>
          )}
          {step === 5 && (
            <button type="button" className="btn" onClick={submit} disabled={pending}>
              {pending ? "Speichern…" : "Intake absenden"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
