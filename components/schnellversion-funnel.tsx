"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import home from "@/app/home.module.css";
import styles from "@/components/schnellversion-ui.module.css";
import { postSvEvent, readSvAnswersSnapshot, saveSvAnswers, subscribeSvStorage } from "@/components/schnellversion-browser";
import {
  SV_BRANCHEN,
  SV_BUCHT,
  SV_KASSE,
  SV_MITARBEITENDE,
  SV_RECHTSFORMEN,
  SV_SOFTWARE,
  vorlageForBranche,
  type SchnellversionAnswers,
} from "@/lib/schnellversion-answers";
import {
  SV_FUNNEL_FOOT,
  SV_FUNNEL_HEAD,
  SV_KASSE_HILFE,
  SV_KASSE_UNSICHER_HILFE,
} from "@/lib/schnellversion-copy";

const EMPTY: SchnellversionAnswers = {
  firma: "",
  rechtsform: "" as SchnellversionAnswers["rechtsform"],
  branche: "" as SchnellversionAnswers["branche"],
  mitarbeitende: "" as SchnellversionAnswers["mitarbeitende"],
  software: "" as SchnellversionAnswers["software"],
  kasse: "" as SchnellversionAnswers["kasse"],
  bucht: "" as SchnellversionAnswers["bucht"],
  softwareFrei: "",
};

export function SchnellversionFunnel({
  initialStep = 1,
  returnToKauf = false,
}: {
  initialStep?: number;
  returnToKauf?: boolean;
}) {
  const router = useRouter();
  const stored = useSyncExternalStore(subscribeSvStorage, readSvAnswersSnapshot, () => null);
  const [edited, setEdited] = useState<SchnellversionAnswers | null>(null);
  const draft = edited ?? stored ?? EMPTY;
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState("");

  useEffect(() => {
    void postSvEvent({ name: "sv_question_step", arm: "test", step: initialStep });
  }, [initialStep]);

  function set<K extends keyof SchnellversionAnswers>(key: K, value: SchnellversionAnswers[K]) {
    setEdited({ ...draft, [key]: value });
  }

  function check(): string {
    if (step === 1) {
      if (!draft.firma.trim()) return "Bitte geben Sie den Namen Ihres Unternehmens an.";
      if (!draft.rechtsform) return "Bitte wählen Sie die Rechtsform.";
    }
    if (step === 2 && !draft.branche) return "Bitte wählen Sie eine Antwort.";
    if (step === 3 && !draft.mitarbeitende) return "Bitte wählen Sie eine Antwort.";
    if (step === 4 && !draft.software) return "Bitte wählen Sie eine Antwort.";
    if (step === 4 && draft.software === "Sonstiges" && !draft.softwareFrei.trim()) {
      return "Bitte geben Sie den Namen des Programms an.";
    }
    if (step === 5 && !draft.kasse) return "Bitte wählen Sie eine Antwort.";
    if (step === 6 && !draft.bucht) return "Bitte wählen Sie eine Antwort.";
    return "";
  }

  function persist(nextStep: number) {
    const saved = {
      ...draft,
      firma: draft.firma.trim(),
      softwareFrei: draft.softwareFrei.trim(),
    };
    saveSvAnswers(saved as SchnellversionAnswers);
    const vorlage = draft.branche ? vorlageForBranche(draft.branche) : "";
    void postSvEvent({
      name: "sv_question_step",
      arm: "test",
      step: nextStep,
      ...(vorlage ? { branche_vorlage: vorlage } : {}),
    });
  }

  function next() {
    const message = check();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    if (returnToKauf || step === 6) {
      const saved = {
        ...draft,
        firma: draft.firma.trim(),
        softwareFrei: draft.softwareFrei.trim(),
      };
      saveSvAnswers(saved as SchnellversionAnswers);
      if (step === 6) {
        const vorlage = vorlageForBranche(draft.branche);
        void postSvEvent({ name: "sv_questions_complete", arm: "test", branche_vorlage: vorlage });
      }
      router.push("/schnellversion/kauf");
      return;
    }
    const following = step + 1;
    persist(following);
    setStep(following);
  }

  return (
    <div className={`shell ${styles.wrap}`}>
      <p className={styles.kopf}>{SV_FUNNEL_HEAD}</p>
      <div className={styles.prog}>
        <span>Frage {step} von 6</span>
        <div className={styles.bar} aria-hidden="true">
          <i style={{ width: `${(step / 6) * 100}%` }} />
        </div>
      </div>
      <form
        className={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        {step === 1 ? (
          <fieldset>
            <legend className={styles.frage}>Wie lautet der Name Ihres Unternehmens?</legend>
            <p className={styles.hilfe}>
              Der Name erscheint auf dem Deckblatt und in jedem Kapitel. Bitte schreiben Sie ihn so, wie er auf Ihren Rechnungen steht. Eine Schnellversion gilt für eine Firma.
            </p>
            <label className={styles.fld}>
              Firmenname
              <input
                name="firma"
                autoComplete="organization"
                maxLength={120}
                value={draft.firma}
                onChange={(event) => set("firma", event.target.value)}
              />
            </label>
            <label className={styles.fld}>
              Rechtsform
              <select
                name="rechtsform"
                value={draft.rechtsform}
                onChange={(event) => set("rechtsform", event.target.value as SchnellversionAnswers["rechtsform"])}
              >
                <option value="">Bitte wählen</option>
                {SV_RECHTSFORMEN.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </fieldset>
        ) : null}
        {step === 2 ? (
          <fieldset>
            <legend className={styles.frage}>In welcher Branche ist Ihr Unternehmen tätig?</legend>
            <p className={styles.hilfe}>
              Wir wählen danach die passende Branchenvorlage aus. Wenn mehrere Bereiche zutreffen, wählen Sie den mit dem größten Umsatz. Ein Betrieb mit mehreren Bereichen ist mit dem vollständigen Fragebogen besser beschrieben.
            </p>
            {SV_BRANCHEN.map((item) => (
              <label className={styles.opt} key={item.id}>
                <input
                  type="radio"
                  name="branche"
                  value={item.id}
                  checked={draft.branche === item.id}
                  onChange={() => set("branche", item.id)}
                />
                <span>{item.label}</span>
              </label>
            ))}
            {draft.branche === "sonstiges" ? (
              <p className={styles.note}>
                Für Ihre Branche gibt es keine eigene Vorlage. Wir verwenden die allgemeine Dienstleistungsvorlage. Der vollständige Fragebogen beschreibt Ihre Abläufe individuell.
              </p>
            ) : null}
          </fieldset>
        ) : null}
        {step === 3 ? (
          <fieldset>
            <legend className={styles.frage}>Wie viele Personen arbeiten in Ihrem Unternehmen, Sie eingeschlossen?</legend>
            <p className={styles.hilfe}>
              Danach richtet sich, wie die Vorlage Zuständigkeiten und Vertretungen beschreibt. Bei einer Person entfallen die Abschnitte zu Vertretungen.
            </p>
            {SV_MITARBEITENDE.map((item) => (
              <label className={styles.opt} key={item}>
                <input
                  type="radio"
                  name="mitarbeitende"
                  value={item}
                  checked={draft.mitarbeitende === item}
                  onChange={() => set("mitarbeitende", item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {step === 4 ? (
          <fieldset>
            <legend className={styles.frage}>Mit welchem Programm wird Ihre Buchhaltung geführt?</legend>
            <p className={styles.hilfe}>
              Wir tragen das Programm in die Systemübersicht ein. Weitere Systeme wie Warenwirtschaft, Shop oder Lohn erfasst nur der vollständige Fragebogen.
            </p>
            {SV_SOFTWARE.map((item) => (
              <label className={styles.opt} key={item}>
                <input
                  type="radio"
                  name="software"
                  value={item}
                  checked={draft.software === item}
                  onChange={() => set("software", item)}
                />
                <span>{item}</span>
              </label>
            ))}
            {draft.software === "Sonstiges" ? (
              <label className={styles.fld}>
                Name des Programms
                <input
                  name="softwareFrei"
                  maxLength={80}
                  value={draft.softwareFrei}
                  onChange={(event) => set("softwareFrei", event.target.value)}
                />
              </label>
            ) : null}
          </fieldset>
        ) : null}
        {step === 5 ? (
          <fieldset>
            <legend className={styles.frage}>Nehmen Sie Bargeld ein oder nutzen Sie eine Kasse?</legend>
            <p className={styles.hilfe}>{SV_KASSE_HILFE}</p>
            {SV_KASSE.map((item) => (
              <label className={styles.opt} key={item}>
                <input
                  type="radio"
                  name="kasse"
                  value={item}
                  checked={draft.kasse === item}
                  onChange={() => set("kasse", item)}
                />
                <span>{item}</span>
              </label>
            ))}
            <p className={styles.note}>{SV_KASSE_UNSICHER_HILFE}</p>
          </fieldset>
        ) : null}
        {step === 6 ? (
          <fieldset>
            <legend className={styles.frage}>Wer erledigt die laufende Buchführung?</legend>
            <p className={styles.hilfe}>
              Wenn eine Kanzlei bucht, enthält die Standardfassung einen Abschnitt zur Übergabe der Belege und zur Abgrenzung der Zuständigkeiten. Abstimmen sollten Sie ihn mit Ihrer Kanzlei.
            </p>
            {SV_BUCHT.map((item) => (
              <label className={styles.opt} key={item}>
                <input
                  type="radio"
                  name="bucht"
                  value={item}
                  checked={draft.bucht === item}
                  onChange={() => set("bucht", item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <p className={styles.err} role="alert">
          {error}
        </p>
        <div className={styles.nav2}>
          {step === 1 && !returnToKauf ? (
            <Link className={`btn ${home.btnSec}`} href="/">
              Zur Startseite
            </Link>
          ) : (
            <button
              className={`btn ${home.btnSec}`}
              type="button"
              onClick={() => {
                if (returnToKauf) {
                  router.push("/schnellversion/kauf");
                  return;
                }
                setError("");
                setStep((current) => Math.max(1, current - 1));
              }}
            >
              Zurück
            </button>
          )}
          <button className="btn" type="submit">
            {returnToKauf ? "Übernehmen" : step === 6 ? "Weiter zur Übersicht" : "Weiter"}
          </button>
        </div>
      </form>
      <p className={`${styles.micro} ${styles.fuss}`}>{SV_FUNNEL_FOOT}</p>
    </div>
  );
}
