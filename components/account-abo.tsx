import Link from "next/link";
import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
import { accountBillingPath } from "@/lib/stripe";

export function AccountAboCard() {
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
