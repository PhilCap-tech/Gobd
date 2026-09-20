import { MAX_ENTITIES_PER_ACCOUNT } from "@/lib/entities";
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
}: {
  status: BillingSubscriptionStatus;
  stripeReady: boolean;
  hasCustomer: boolean;
  lookupFailed: boolean;
}) {
  const copy = subscriptionStatusCopy(status);
  const emptyHint = !stripeReady
    ? "Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt). Abo-Status und Rechnungen sind im Demo-Pfad nicht verfügbar."
    : !hasCustomer
      ? "Kein Stripe-Kunde zu dieser E-Mail. Nach einem Checkout mit Stripe speichern Webhook und Intake die Customer-ID — dann siehst du Status und Rechnungen hier."
      : "";

  return (
    <section className="card" aria-labelledby="billing-status-heading">
      <h2 id="billing-status-heading">Abo-Status</h2>
      {lookupFailed ? (
        <p className="banner warn" role="status">
          Rechnungen und Abo-Status konnten gerade nicht geladen werden. Bitte
          später erneut versuchen.
        </p>
      ) : emptyHint ? (
        <p className="banner warn" role="status">
          {emptyHint}
        </p>
      ) : (
        <>
          <p className={`billing-status ${copy.tone}`}>
            <span className="billing-status-label">{copy.label}</span>
            <span>{copy.text}</span>
          </p>
        </>
      )}
      <p className="prose">
        Ein Abo gilt für bis zu {MAX_ENTITIES_PER_ACCOUNT} Firmen — nicht pro
        Firma.
      </p>
      <div className="actions" style={{ marginTop: 12 }}>
        {stripeReady && hasCustomer ? (
          <form action="/api/stripe/portal" method="post">
            <button className="btn" type="submit">
              Zahlungsmethode / Abo im Stripe-Portal öffnen
            </button>
          </form>
        ) : (
          <button
            className="btn"
            type="button"
            disabled
            title={emptyHint || copy.text}
          >
            Zahlungsmethode / Abo im Stripe-Portal öffnen
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
}: {
  invoices: BillingInvoice[];
  stripeReady?: boolean;
  hasCustomer?: boolean;
  lookupFailed?: boolean;
}) {
  const emptyCopy = !stripeReady
    ? "Stripe ist nicht konfiguriert. Rechnungen sind im Demo-Pfad nicht verfügbar."
    : lookupFailed
      ? "Rechnungen konnten gerade nicht geladen werden. Bitte später erneut versuchen."
      : !hasCustomer
        ? "Kein Stripe-Kunde zu dieser E-Mail. Rechnungen erscheinen nach einem Checkout."
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
