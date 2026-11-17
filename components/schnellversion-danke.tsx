"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import home from "@/app/home.module.css";
import styles from "@/components/schnellversion-ui.module.css";
import {
  postSvEvent,
  readSvAnswersSnapshot,
  readSvBoughtSnapshot,
  subscribeSvStorage,
} from "@/components/schnellversion-browser";
import { vorlageForBranche, vorlageLabel } from "@/lib/schnellversion-answers";
import {
  SV_DANKE_MICRO,
  SV_DANKE_TITEL,
  SV_DOWNLOAD_DAYS,
  addSvDays,
  formatSvDate,
  svCoverBox,
  svDankeText,
  svHeaderLine,
} from "@/lib/schnellversion-copy";

export function SchnellversionDanke() {
  const answers = useSyncExternalStore(subscribeSvStorage, readSvAnswersSnapshot, () => null);
  const bought = useSyncExternalStore(subscribeSvStorage, readSvBoughtSnapshot, () => "");
  const [downloadNote, setDownloadNote] = useState("");

  useEffect(() => {
    if (bought && sessionStorage.getItem("sv49_counted") !== "1") {
      sessionStorage.setItem("sv49_counted", "1");
      void postSvEvent({ name: "sv_purchase", arm: "test", value: 49 });
    }
    void postSvEvent({ name: "sv_upgrade_view", arm: "test" });
  }, [bought]);

  async function download() {
    if (!answers || !bought) return;
    setDownloadNote("");
    const response = await fetch("/api/schnellversion/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...answers, gekauftAm: bought }),
    });
    if (!response.ok) {
      setDownloadNote("Der PDF-Download ist 30 Tage ab Kauf abrufbar.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "standardfassung.pdf";
    link.click();
    URL.revokeObjectURL(url);
    void postSvEvent({ name: "sv_pdf_download", arm: "test" });
  }

  const bis = bought ? formatSvDate(addSvDays(new Date(bought), SV_DOWNLOAD_DAYS)) : "";
  const vorlage = answers ? vorlageLabel(vorlageForBranche(answers.branche)) : "";
  const cover = vorlage ? svCoverBox(vorlage).replace(/\*\*/g, "") : "";

  return (
    <div className={`shell ${styles.lay}`}>
      <section>
        <h1>{SV_DANKE_TITEL}</h1>
        <p>{bis ? svDankeText(bis) : null}</p>
        <div className={styles.ctas}>
          <button className="btn" type="button" onClick={() => void download()} disabled={!answers}>
            PDF herunterladen
          </button>
          <Link className={`btn ${home.btnSec}`} href="/checkout">
            Fragebogen fortsetzen
          </Link>
        </div>
        {downloadNote ? <p className={styles.err}>{downloadNote}</p> : null}
        <p className={styles.micro}>{SV_DANKE_MICRO}</p>
        <section className={styles.card}>
          <h2>Upgrade mit Anrechnung</h2>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Upgrade auf</th>
                <th>Preis regulär</th>
                <th>Aufpreis nach Anrechnung</th>
                <th>brutto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Upgrade auf">Einmalig</td>
                <td data-label="Preis regulär">99 €</td>
                <td data-label="Aufpreis nach Anrechnung">50 €</td>
                <td data-label="brutto">59,50 €</td>
              </tr>
              <tr>
                <td data-label="Upgrade auf">Dauerhaft</td>
                <td data-label="Preis regulär">99 € + 49 €/Jahr</td>
                <td data-label="Aufpreis nach Anrechnung">50 € + 49 €/Jahr (erstes Jahr 99 €)</td>
                <td data-label="brutto">59,50 € + 58,31 €/Jahr</td>
              </tr>
            </tbody>
          </table>
          <p className={styles.micro}>Preise netto zzgl. 19 % USt, nur für Unternehmen. Keine Steuer- oder Rechtsberatung.</p>
        </section>
      </section>
      <aside>
        <p className={styles.micro}>Vorschau: Seite 1 (Deckblatt)</p>
        <div className={styles.pdf}>
          <p className={styles.micro}>{answers && bought ? svHeaderLine(answers.firma, formatSvDate(new Date(bought))) : ""}</p>
          <h2>Verfahrensdokumentation</h2>
          <p>
            <strong>{answers?.firma}</strong>
          </p>
          <p className={styles.micro}>Branchenvorlage „{vorlage}“</p>
          <div className={styles.kasten}>
            <b>Standardfassung, bitte prüfen</b>
            <span>{cover.replace("Standardfassung, bitte prüfen", "").trim()}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
