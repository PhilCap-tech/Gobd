import Link from "next/link";
import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";
import { accountBillingPath } from "@/lib/stripe";

export function AccountAboCard({ stripeBound }: { stripeBound: boolean }) {
  if (!stripeBound) {
    return (
      <section
        className="card"
        style={{ marginBottom: 16 }}
        aria-labelledby="upgrade-heading"
      >
        <h2 id="upgrade-heading">Volle Verfahrensdokumentation</h2>
        <p className="prose">
          Das Readiness-PDF ist eine kostenlose Arbeitshilfe zu den
          GoBD-Grundlagen. Die volle Verfahrensdokumentation ist der geführte
          Entwurf (PDF plus offene Punkte) nach Checkout und Intake. Keine
          Steuerberatung.
        </p>
        <div className="actions" style={{ marginTop: 12 }}>
          <Link className="btn" href="/checkout">
            {`Volle Verfahrensdokumentation erstellen — ${SETUP_EUR} € + ${MONTHLY_EUR} €/Mo`}
          </Link>
        </div>
      </section>
    );
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
