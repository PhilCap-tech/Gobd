import { EXTRA_FIRM_NOTE } from "@/lib/account-labels";
import type { LifecycleNotice } from "@/lib/kuendigung";
import {
  formatStripeDate,
  formatStripeMoney,
  invoiceStatusCopy,
  subscriptionStatusCopy,
  type BillingInvoice,
  type BillingSubscriptionStatus,
} from "@/lib/stripe";

export function AccountBillingStatus({
  status,
  stripeReady,
  hasCustomer,
  lookupFailed,
  notice = null,
  compAccess = false,
}: {
  status: BillingSubscriptionStatus;
  stripeReady: boolean;
  hasCustomer: boolean;
  lookupFailed: boolean;
  notice?: LifecycleNotice | null;
  compAccess?: boolean;
}) {
  if (compAccess && !hasCustomer) {
    return (
      <section className="card" aria-labelledby="billing-status-heading">
        <h2 id="billing-status-heading">Abo-Status</h2>
        <p className="prose">
          <strong>Kostenfreier Zugang.</strong> Sie können die Verfahrensdokumentation
          ausfüllen, als PDF erzeugen und herunterladen. Eine Zahlung ist dafür nicht
          erforderlich.
        </p>
      </section>
    );
  }

  const copy = subscriptionStatusCopy(status);
  const lookupHint =
    "Rechnungen und Abo-Status konnten gerade nicht geladen werden. Bitte später erneut versuchen.";
  const emptyHint = !stripeReady
    ? "Die Zahlung ist derzeit nicht angebunden. Abo-Status und Rechnungen sind hier nicht verfügbar."
    : lookupFailed
      ? lookupHint
      : !hasCustomer
        ? "Noch kein bezahltes Abo. Status und Rechnungen erscheinen hier, sobald ein Abo besteht."
        : "";

  return (
    <section className="card" aria-labelledby="billing-status-heading">
      <h2 id="billing-status-heading">Abo-Status</h2>
      {notice && notice.phase !== "none" && notice.phase !== "active" && (notice.label || notice.detail) ? (
        <p className="billing-status warn">
          {notice.label ? <span className="billing-status-label">{notice.label}</span> : null}
          {notice.detail ? <span>{notice.detail}</span> : null}
        </p>
      ) : null}
      {lookupFailed ? (
        <p className="banner warn" role="status">
          {lookupHint}
        </p>
      ) : emptyHint ? (
        <p className="banner warn" role="status">
          {emptyHint}
        </p>
      ) : notice && notice.phase !== "none" && notice.phase !== "active" && (notice.label || notice.detail) ? (
        status === "past_due" ? (
          <p className="banner warn" role="status">
            {copy.text}
          </p>
        ) : null
      ) : (
        <p className={`billing-status ${copy.tone}`}>
          <span className="billing-status-label">{copy.label}</span>
          <span>{copy.text}</span>
        </p>
      )}
      <p className="prose">{EXTRA_FIRM_NOTE}</p>
      <div className="actions" style={{ marginTop: 12 }}>
        {stripeReady && hasCustomer ? (
          <>
            <form action="/api/stripe/portal" method="post">
              <button className="btn" type="submit">
                Zahlungsmethode und Rechnungen im Stripe-Portal öffnen
              </button>
            </form>
            {notice?.phase !== "restore" && notice?.phase !== "purged" && (
              <a className="btn ghost" href="/account/kuendigung">
                Kündigen
              </a>
            )}
          </>
        ) : (
          <button
            className="btn"
            type="button"
            disabled
            title={emptyHint || copy.text}
          >
            Zahlungsmethode und Rechnungen im Stripe-Portal öffnen
          </button>
        )}
      </div>
    </section>
  );
}

export function AccountInvoiceList({
  invoices,
  stripeReady = true,
  hasCustomer = true,
  lookupFailed = false,
  compAccess = false,
}: {
  invoices: BillingInvoice[];
  stripeReady?: boolean;
  hasCustomer?: boolean;
  lookupFailed?: boolean;
  compAccess?: boolean;
}) {
  const emptyCopy = compAccess && !hasCustomer
    ? "Zu diesem Zugang liegen keine Rechnungen vor."
    : !stripeReady
    ? "Die Zahlung ist derzeit nicht angebunden. Rechnungen sind hier nicht verfügbar."
    : lookupFailed
      ? "Rechnungen konnten gerade nicht geladen werden. Bitte später erneut versuchen."
      : !hasCustomer
        ? "Noch kein bezahltes Abo. Rechnungen erscheinen hier nach der ersten Zahlung."
        : "Noch keine Rechnungen vorhanden.";

  return (
    <section className="card" aria-labelledby="billing-invoices-heading">
      <h2 id="billing-invoices-heading">Rechnungen</h2>
      {invoices.length === 0 ? (
        <p className="prose">{emptyCopy}</p>
      ) : (
        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th scope="col">Nummer</th>
                <th scope="col">Datum</th>
                <th scope="col">Betrag</th>
                <th scope="col">Status</th>
                <th scope="col">Download</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.number || "—"}</td>
                  <td>{formatStripeDate(invoice.created)}</td>
                  <td>{formatStripeMoney(invoice.total, invoice.currency)}</td>
                  <td>{invoiceStatusCopy(invoice.status)}</td>
                  <td>
                    <InvoiceDownloads invoice={invoice} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint" style={{ marginTop: 12 }}>
        Rechnungen kommen von Stripe. Es gibt kein eigenes Rechnungssystem.
      </p>
    </section>
  );
}

function InvoiceDownloads({ invoice }: { invoice: BillingInvoice }) {
  const links = [
    invoice.hostedInvoiceUrl
      ? { href: invoice.hostedInvoiceUrl, label: "Ansehen" }
      : null,
    invoice.invoicePdf ? { href: invoice.invoicePdf, label: "PDF" } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  if (links.length === 0) {
    return <span>—</span>;
  }

  return (
    <span className="invoice-downloads">
      {links.map((link, index) => (
        <span key={link.label}>
          {index > 0 ? " · " : null}
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        </span>
      ))}
    </span>
  );
}
