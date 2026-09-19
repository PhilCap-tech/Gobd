export function AccountAboCard({
  canOpenPortal,
  stripeReady,
}: {
  canOpenPortal: boolean;
  stripeReady: boolean;
}) {
  const hint = canOpenPortal
    ? "Abo, Zahlungsmittel und Rechnungen verwaltest du im Stripe Customer Portal."
    : stripeReady
      ? "Kein Stripe-Kunde zu dieser E-Mail. Nach einem Checkout mit Stripe speichern Webhook und Intake die Customer-ID — dann kannst du das Abo hier verwalten."
      : "Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt). Abo-Verwaltung ist im Demo-Pfad nicht verfügbar.";

  return (
    <section className="card" style={{ marginBottom: 16 }} aria-labelledby="abo-heading">
      <h2 id="abo-heading">Abo</h2>
      <p className="prose">{hint}</p>
      <div className="actions" style={{ marginTop: 12 }}>
        {canOpenPortal ? (
          <form action="/api/stripe/portal" method="post">
            <button className="btn ghost" type="submit">
              Abo verwalten
            </button>
          </form>
        ) : (
          <button className="btn ghost" type="button" disabled title={hint}>
            Abo verwalten
          </button>
        )}
      </div>
    </section>
  );
}
