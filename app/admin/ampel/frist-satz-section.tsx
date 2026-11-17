"use client";

import { useActionState } from "react";
import { scanFristSatzAction } from "./frist-satz-action";
import { initialFristSatzView } from "@/lib/frist-satz-view";

/** Count on submit. The page render does not open drafts, rows, or PDFs. */
export function FristSatzSection() {
  const [state, action, pending] = useActionState(scanFristSatzAction, initialFristSatzView);
  const showContinue = state.ran && !state.done && Boolean(state.cursor);
  return (
    <section className="card ampel-admin-count" aria-labelledby="frist-satz-heading">
      <h2 id="frist-satz-heading">Aufbewahrungsfrist im Bestand</h2>
      <p>
        Hier sehen Sie zwei Zahlen: gespeicherte Kunden-Entwürfe und bereits erzeugte PDFs. Eine PDF ist
        eine Dokumentfassung. Gezählt werden Stellen mit der alten Formulierung, die für Buchungsbelege eine
        falsche Aufbewahrungsfrist nennt. Die Zählung startet erst mit dem Knopf. Es wird nur gelesen, nichts
        gespeichert, gelöscht oder verändert.
      </p>
      <p>
        Entwürfe sind die JSON-Dateien im privaten Speicher. Dokumentfassungen sind die Zeilen der Tabelle.
        Liegen zu einer Fassung Antworten oder Kapiteltext vor, wird dieser Text gelesen. Nur wenn beides
        fehlt, wird der Wortlaut aus der PDF gelesen. Testfirmen und Testadressen bleiben ausgenommen.
        Namen, Adressen und Kennungen werden nicht angezeigt.
      </p>
      <form action={action}>
        <input type="hidden" name="cursor" value={state.cursor} />
        <p className="actions">
          {showContinue ? (
            <button className="btn" type="submit" name="mode" value="continue" disabled={pending}>
              {pending ? "Zählt …" : "Fortsetzen"}
            </button>
          ) : (
            <button className="btn" type="submit" name="mode" value="start" disabled={pending}>
              {pending ? "Zählt …" : state.ran ? "Erneut zählen" : "Bestand zählen"}
            </button>
          )}
          {showContinue ? (
            <button className="btn ghost" type="submit" name="mode" value="start" disabled={pending}>
              Von vorn zählen
            </button>
          ) : null}
        </p>
      </form>
      {state.ran ? (
        <div aria-live="polite">
          <dl>
            <div>
              <dt>Entwürfe</dt>
              <dd>{state.drafts.toLocaleString("de-DE")}</dd>
            </div>
            <div>
              <dt>PDFs</dt>
              <dd>{state.pdfs.toLocaleString("de-DE")}</dd>
            </div>
            <div>
              <dt>Geprüfte Objekte</dt>
              <dd>{state.checked.toLocaleString("de-DE")}</dd>
            </div>
          </dl>
          {state.at ? <p>Stand: {state.at}</p> : null}
          {state.note ? <p>{state.note}</p> : null}
        </div>
      ) : (
        <p>Noch nicht gezählt.</p>
      )}
    </section>
  );
}
