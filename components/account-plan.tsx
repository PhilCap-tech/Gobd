import { PlanBuyButton } from "@/components/plan-buy-button";
import type { AccountPlanView } from "@/lib/plan-view";
import { PLAN_CHANGE_PRICE_LINE, PLAN_MEMBER_PRICE_LINE } from "@/lib/plan-copy";

const PURCHASE_NOTICES: Record<string, string> = {
  aenderung: "Danke. Die Änderung wird verbucht; das kann einen Moment dauern.",
  mitglied: "Danke. Ihre Mitgliedschaft wird verbucht; das kann einen Moment dauern.",
  gekuendigt: "Ihre Kündigung ist vorgemerkt. Das Enddatum sehen Sie unten.",
  "kuendigung-hinweis": "Bitte bestätigen Sie die Kündigung mit dem Häkchen.",
  "kuendigung-fehler": "Die Kündigung konnte gerade nicht gespeichert werden. Bitte versuchen Sie es später erneut.",
  "kuendigung-unverfuegbar": "Die Kündigung ist hier gerade nicht verfügbar. Sie können auch schriftlich kündigen.",
  "kuendigung-keins": "Für dieses Konto gibt es keine aktive Mitgliedschaft.",
  widerrufen: "Ihre Kündigung ist zurückgenommen. Die Mitgliedschaft läuft weiter.",
  "widerruf-fehler": "Die Rücknahme konnte gerade nicht gespeichert werden. Bitte versuchen Sie es später erneut.",
  "widerruf-unverfuegbar": "Die Rücknahme ist hier gerade nicht verfügbar. Bitte schreiben Sie uns.",
  "widerruf-zu-spaet": "Die Mitgliedschaft ist bereits beendet; eine Rücknahme ist nicht mehr möglich.",
};

/** Konto-Karte Preismodell v2. Nur sichtbar, wenn ein Plan existiert. */
export function AccountPlanCard({ view, purchase }: { view: AccountPlanView; purchase?: string }) {
  return (
    <section className="card" aria-labelledby="plan-heading" id="frist">
      <h2 id="plan-heading">{view.title}</h2>
      {purchase && PURCHASE_NOTICES[purchase] ? (
        <p className="banner">{PURCHASE_NOTICES[purchase]}</p>
      ) : null}
      {view.lines.map((line) => (
        <p key={line} className="prose">
          {line}
        </p>
      ))}
      {view.refundLine ? <p className="hint">{view.refundLine}</p> : null}
      {view.canBuyChange ? (
        <PlanBuyButton kind="change" label="Änderung beauftragen" note={PLAN_CHANGE_PRICE_LINE} />
      ) : null}
      {view.canBecomeMember ? (
        <PlanBuyButton kind="member" label="Mitglied werden" note={PLAN_MEMBER_PRICE_LINE} />
      ) : null}
      {view.canCancel ? (
        <form method="post" action="/api/account/jahresplan/kuendigung">
          <p className="hint">{view.cancelPreview}</p>
          <label className="check">
            <input type="checkbox" name="acknowledged" value="yes" required />
            <span>Ich möchte die Jahresmitgliedschaft kündigen.</span>
          </label>
          <button className="btn secondary" type="submit">
            Mitgliedschaft kündigen
          </button>
        </form>
      ) : null}
      {view.canWithdrawCancel ? (
        <form method="post" action="/api/account/jahresplan/kuendigung">
          <input type="hidden" name="action" value="widerruf" />
          <button className="btn secondary" type="submit">
            Kündigung zurücknehmen
          </button>
        </form>
      ) : null}
    </section>
  );
}
