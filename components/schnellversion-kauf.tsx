"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "@/components/schnellversion-ui.module.css";
import {
  postSvEvent,
  readSvAnswersSnapshot,
  saveSvBought,
  subscribeSvStorage,
} from "@/components/schnellversion-browser";
import {
  brancheLabel,
  softwareLabel,
  vorlageForBranche,
  vorlageLabel,
} from "@/lib/schnellversion-answers";
import {
  SV_KAUF_BEWUSST,
  SV_KAUF_BUTTON,
  SV_KAUF_PFLICHT,
  SV_KAUF_PREIS,
  SV_KAUF_UNTERNEHMER,
  SV_KAUF_WECHSEL,
  SV_WECHSEL_LINK,
} from "@/lib/schnellversion-copy";

export function SchnellversionKauf() {
  const answers = useSyncExternalStore(subscribeSvStorage, readSvAnswersSnapshot, () => null);
  const [unternehmer, setUnternehmer] = useState(false);
  const [bewusst, setBewusst] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void postSvEvent({ name: "sv_checkout_view", arm: "test" });
  }, []);

  async function buy() {
    if (!unternehmer || !bewusst) {
      setError("Bitte bestätigen Sie beide Hinweise.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/schnellversion/checkout", { method: "POST" });
      const payload = (await response.json()) as { ready?: boolean; url?: string };
      if (!payload.ready || !payload.url) {
        setPending(false);
        return;
      }
      saveSvBought(new Date().toISOString());
      const vorlage = answers ? vorlageForBranche(answers.branche) : "";
      void postSvEvent({
        name: "sv_checkout_start",
        arm: "test",
        ...(vorlage ? { branche_vorlage: vorlage } : {}),
      });
      window.location.assign(payload.url);
    } catch {
      setPending(false);
    }
  }

  if (!answers) {
    return (
      <div className={`shell ${styles.wrap}`}>
        <h1>Ihre Standardfassung als PDF</h1>
        <p>
          Bitte beantworten Sie zuerst die 6 Fragen.{" "}
          <Link href="/schnellversion">Zu den Fragen</Link>
        </p>
      </div>
    );
  }

  const vorlage = vorlageLabel(vorlageForBranche(answers.branche));
  const branche = brancheLabel(answers.branche);
  const rows: Array<[string, string, number]> = [
    ["Firma", `${answers.firma} · ${answers.rechtsform}`, 1],
    ["Branche/Vorlage", `${branche} → Vorlage ${vorlage}`, 2],
    ["Mitarbeitende", answers.mitarbeitende, 3],
    ["Buchhaltungsprogramm", softwareLabel(answers), 4],
    ["Kasse", answers.kasse, 5],
    ["Buchführung durch", answers.bucht, 6],
  ];

  return (
    <div className={`shell ${styles.wide}`}>
      <div className={styles.top}>
        <h1>Ihre Standardfassung als PDF – aus der Vorlage für {branche}</h1>
        <p className={styles.lead}>
          Erstellt aus Ihren 6 Angaben. Eine Ausgangsfassung, die Sie prüfen und an Ihren Betrieb anpassen.
        </p>
      </div>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Ihre Angaben</h2>
          <dl className={styles.angaben}>
            {rows.map(([label, value, step]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
                <dd>
                  <Link href={`/schnellversion?step=${step}&return=kauf`}>Ändern</Link>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className={styles.card}>
          <h2>Leistungsumfang</h2>
          <ul className={styles.list}>
            <li>Standard-PDF aus der Branchenvorlage {vorlage}, mit Ihren Firmendaten und Eckdaten vorbelegt</li>
            <li>Standardabläufe Ihrer Branche, Stellen zum Prüfen sind markiert</li>
            <li>
              Kapitel zur Kassenführung (nur bei Kasse) und zur Zusammenarbeit mit der Steuerkanzlei (nur wenn die Kanzlei bucht)
            </li>
            <li>Eine Seite mit allgemeinen Prüfhinweisen</li>
            <li>Download 30 Tage im Konto. Bitte speichern Sie das PDF selbst.</li>
          </ul>
          <p>
            <strong>Nicht enthalten:</strong> Ihre individuellen Abläufe, Liste offener Punkte aus Ihren Antworten, Dashboard, Änderungen nach dem Kauf, Versionen, Einladungen
          </p>
        </section>
      </div>
      <section>
        <table className={styles.tbl}>
          <thead>
            <tr>
              <th />
              <th className={styles.sv}>Schnellversion</th>
              <th>Verfahrensdokumentation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Preis</th>
              <td className={styles.sv} data-label="Schnellversion">49 € einmalig</td>
              <td data-label="Verfahrensdokumentation">99 € einmalig (Jahrespaket optional 49 €/Jahr)</td>
            </tr>
            <tr>
              <th>Grundlage</th>
              <td className={styles.sv} data-label="Schnellversion">Branchenvorlage + 6 Angaben</td>
              <td data-label="Verfahrensdokumentation">Ihre Antworten zu allen für Sie aktiven Modulen</td>
            </tr>
            <tr>
              <th>Ihre Abläufe</th>
              <td className={styles.sv} data-label="Schnellversion">Standardabläufe, von Ihnen zu prüfen</td>
              <td data-label="Verfahrensdokumentation">aus Ihren Angaben beschrieben</td>
            </tr>
            <tr>
              <th>Liste offener Punkte</th>
              <td className={styles.sv} data-label="Schnellversion">allgemeine Prüfhinweise</td>
              <td data-label="Verfahrensdokumentation">individuell aus Ihren Antworten</td>
            </tr>
            <tr>
              <th>Dashboard, Änderungen, PDF neu erstellen</th>
              <td className={styles.sv} data-label="Schnellversion">–</td>
              <td data-label="Verfahrensdokumentation">30 Tage (dauerhaft mit Jahrespaket)</td>
            </tr>
            <tr>
              <th>Versionen mit Datum</th>
              <td className={styles.sv} data-label="Schnellversion">–</td>
              <td data-label="Verfahrensdokumentation">mit Jahrespaket</td>
            </tr>
            <tr>
              <th>Später wechseln</th>
              <td className={styles.sv} data-label="Schnellversion">30 Tage lang mit Anrechnung der 49 €</td>
              <td data-label="Verfahrensdokumentation">–</td>
            </tr>
          </tbody>
        </table>
        <p>
          {SV_KAUF_WECHSEL}{" "}
          <Link
            href="/checkout"
            onClick={() => {
              void postSvEvent({ name: "sv_switch_to_fragebogen", arm: "test" });
              void postSvEvent({ name: "fragebogen_start", arm: "test" });
            }}
          >
            {SV_WECHSEL_LINK}
          </Link>
        </p>
      </section>
      <section className={styles.buy}>
        <button className="btn" type="button" onClick={() => void buy()} disabled={pending}>
          {SV_KAUF_BUTTON}
        </button>
        <p className={styles.micro}>{SV_KAUF_PREIS}</p>
        <div className={styles.checks}>
          <label>
            <input type="checkbox" checked={unternehmer} onChange={(event) => setUnternehmer(event.target.checked)} />
            <span>{SV_KAUF_UNTERNEHMER}</span>
          </label>
          <label>
            <input type="checkbox" checked={bewusst} onChange={(event) => setBewusst(event.target.checked)} />
            <span>{SV_KAUF_BEWUSST}</span>
          </label>
        </div>
        <p className={styles.err} role="alert">
          {error}
        </p>
        <p className={styles.micro}>{SV_KAUF_PFLICHT}</p>
        <p className={styles.micro}>
          <Link href="/agb">AGB</Link>
          {" · "}
          <Link href="/datenschutz">Datenschutz</Link>
        </p>
      </section>
    </div>
  );
}
