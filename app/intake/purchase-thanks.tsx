import { PurchaseConversion } from "@/components/purchase-conversion";

/**
 * Short confirmation after a paid checkout, before the questionnaire.
 * The Kauf conversion is mounted once, and only for a real cs_ session.
 */
export function PurchaseThanks({
  continueHref,
  sessionId,
}: {
  continueHref: string;
  sessionId: string;
}) {
  return (
    <div className="card">
      <PurchaseConversion sessionId={sessionId} />
      <h1>Vielen Dank für Ihren Kauf</h1>
      <p className="prose">
        Sie können jetzt den Fragebogen für Ihre Verfahrensdokumentation starten.
      </p>
      <div className="actions" style={{ marginTop: 16 }}>
        <a className="btn" href={continueHref}>
          Fragebogen starten
        </a>
      </div>
    </div>
  );
}
