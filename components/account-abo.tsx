import Link from "next/link";
import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";
import { accountBillingPath } from "@/lib/stripe";

export const ACCOUNT_PAID_CTA_LABEL = `Jetzt Verfahrensdokumentation erstellen — ${SETUP_EUR} € + ${MONTHLY_EUR} €/Mo`;

export function AccountPaidActions() {
  return (
    <div className="actions" style={{ marginTop: 12 }}>
      <Link className="btn" href="/checkout">
        {ACCOUNT_PAID_CTA_LABEL}
      </Link>
      <Link className="btn ghost" href="/readiness">
        Readiness nochmal ansehen
      </Link>
    </div>
  );
}

export function AccountUpgradeCard({
  compact = false,
  headingId = "upgrade-heading",
}: {
  compact?: boolean;
  headingId?: string;
}) {
  return (
    <section
      className="card"
      style={{ marginBottom: 16 }}
      aria-labelledby={headingId}
    >
      <h2 id={headingId}>
        {compact
          ? "Volle Verfahrensdokumentation"
          : "Dein Readiness-Ergebnis ist da — die volle Verfahrensdokumentation fehlt noch"}
      </h2>
      {compact ? (
        <p className="prose">
          Der Leitfaden bleibt die kostenlose Arbeitshilfe. Die bezahlte Version
          ist der geführte Entwurf nach Checkout.
        </p>
      ) : (
        <>
          <p className="prose">
            Der Leitfaden zeigt Lücken. Die bezahlte Version liefert geführtes
            PDF plus Offene-Punkte-Liste und Login zum Nachpflegen ({SETUP_EUR}{" "}
            € Setup + {MONTHLY_EUR} €/Mo).
          </p>
          <div className="price-grid" style={{ marginTop: 16 }}>
            <div>
              <h3>Readiness (gratis)</h3>
              <ul className="prose-list">
                <li>PDF-Arbeitshilfe zu den GoBD-Grundlagen</li>
                <li>Lücken und nächste Schritte sichtbar machen</li>
              </ul>
            </div>
            <div>
              <h3>Volle Verfahrensdokumentation</h3>
              <ul className="prose-list">
                <li>Geführtes PDF plus Offene-Punkte-Liste</li>
                <li>Login zum Nachpflegen nach Checkout und Intake</li>
              </ul>
            </div>
          </div>
        </>
      )}
      <AccountPaidActions />
      <p className="trust-line">
        14 Tage Geld-zurück · Keine Steuerberatung · Entwurf für deinen
        Steuerberater
      </p>
    </section>
  );
}

export function AccountAboCard({ stripeBound }: { stripeBound: boolean }) {
  if (!stripeBound) {
    return <AccountUpgradeCard />;
  }

  return (
    <section className="card" style={{ marginBottom: 16 }} aria-labelledby="abo-heading">
      <h2 id="abo-heading">Abo</h2>
      <p className="prose">
        Ein Abo gilt für bis zu {MAX_ENTITIES_PER_ACCOUNT} Firmen. Status,
        Rechnungen und Zahlungsmittel findest du unter Abo verwalten.
      </p>
      <div className="actions" style={{ marginTop: 12 }}>
        <Link className="btn ghost" href={accountBillingPath()}>
          Abo verwalten
        </Link>
      </div>
    </section>
  );
}
