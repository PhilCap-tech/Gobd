import Link from "next/link";
import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
import type { LifecycleNotice } from "@/lib/kuendigung";
import {
  MONTHLY_EUR,
  MONTHLY_GROSS_LABEL,
  SETUP_EUR,
  SETUP_GROSS_LABEL,
} from "@/lib/pricing";
import { accountBillingPath } from "@/lib/stripe";

export const ACCOUNT_PAID_CTA_LABEL = `Jetzt Verfahrensdokumentation erstellen — ${SETUP_EUR} € netto (${SETUP_GROSS_LABEL} € brutto) + ${MONTHLY_EUR} €/Mo netto (${MONTHLY_GROSS_LABEL} € brutto)`;

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
    <section className="card account-panel" aria-labelledby={headingId}>
      <h2 id={headingId}>
        {compact
          ? "Volle Verfahrensdokumentation"
          : "Ihr Readiness-Ergebnis ist da — die volle Verfahrensdokumentation fehlt noch"}
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
            € netto / {SETUP_GROSS_LABEL} € brutto Einrichtung + {MONTHLY_EUR} €
            netto / {MONTHLY_GROSS_LABEL} € brutto pro Monat, inkl. 19 % USt).
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
      {compact ? (
        <p className="hint">
          <Link href="/checkout">Checkout öffnen</Link>
          {" · "}
          {SETUP_EUR} € netto ({SETUP_GROSS_LABEL} € brutto) Einrichtung +{" "}
          {MONTHLY_EUR} € netto ({MONTHLY_GROSS_LABEL} € brutto) pro Monat, inkl.
          19 % USt
        </p>
      ) : (
        <>
          <AccountPaidActions />
          <p className="trust-line">
            14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein
            PDF erzeugt wurde · Keine Steuerberatung · Entwurf für Ihren
            Steuerberater
          </p>
        </>
      )}
    </section>
  );
}

export function AccountAboCard({
  stripeBound,
  notice = null,
}: {
  stripeBound: boolean;
  notice?: LifecycleNotice | null;
}) {
  const ended = notice?.phase === "restore" || notice?.phase === "purged";
  if (!stripeBound && !ended) {
    return (
      <section className="card account-panel" aria-labelledby="abo-heading">
        <h2 id="abo-heading">Abo</h2>
        <p className="prose">
          Der Leitfaden bleibt die kostenlose Arbeitshilfe. Die bezahlte Version
          ist der geführte Entwurf nach Checkout ({SETUP_EUR} € netto /{" "}
          {SETUP_GROSS_LABEL} € brutto Einrichtung + {MONTHLY_EUR} € netto /{" "}
          {MONTHLY_GROSS_LABEL} € brutto pro Monat, inkl. 19 % USt).
        </p>
        <div className="actions">
          <Link className="btn" href="/checkout">
            {ACCOUNT_PAID_CTA_LABEL}
          </Link>
        </div>
        <p className="hint">
          14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein
          PDF erzeugt wurde · Keine Steuerberatung · Entwurf für Ihren
          Steuerberater
        </p>
      </section>
    );
  }

  const cancellable = stripeBound && !ended;

  return (
    <section className="card account-panel" aria-labelledby="abo-heading">
      <h2 id="abo-heading">Abo</h2>
      {notice?.label ? (
        <p className="billing-status warn">
          <span className="billing-status-label">{notice.label}</span>
          {notice.detail ? <span>{notice.detail}</span> : null}
        </p>
      ) : notice?.detail ? (
        <p className="prose">{notice.detail}</p>
      ) : (
        <p className="prose">
          Ein Abo gilt für bis zu {MAX_ENTITIES_PER_ACCOUNT} Firmen. Status,
          Rechnungen und Zahlungsmittel finden Sie unter Abo verwalten.
        </p>
      )}
      <div className="actions">
        {stripeBound && (
          <Link className="btn ghost" href={accountBillingPath()}>
            Abo verwalten
          </Link>
        )}
        {cancellable && (
          <Link className="btn" href="/account/kuendigung">
            Kündigen
          </Link>
        )}
        {notice?.downloadsOpen && stripeBound && (
          <a className="btn ghost" href="/api/account/export">
            Alle Dokumente als ZIP
          </a>
        )}
        {notice?.showRestoreCheckout && (
          <Link className="btn" href="/checkout">
            Abonnement wiederherstellen
          </Link>
        )}
      </div>
    </section>
  );
}
