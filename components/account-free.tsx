import Link from "next/link";

const RESOURCE_LINKS = [
  { href: "/resources/10-offene-punkte", label: "10 offene Punkte" },
  {
    href: "/resources/inhalt-verfahrensdokumentation",
    label: "Inhalt einer Verfahrensdokumentation",
  },
  { href: "/blog", label: "Berichte / Bibliothek" },
  { href: "/faq", label: "FAQ" },
] as const;

function ResourceLinks() {
  return (
    <ul className="free-list">
      {RESOURCE_LINKS.map((item) => (
        <li key={item.href}>
          <Link href={item.href}>{item.label}</Link>
        </li>
      ))}
    </ul>
  );
}

export function AccountFreeCard() {
  return (
    <section className="card account-panel" aria-labelledby="free-heading">
      <h2 id="free-heading">Kostenlos nutzen</h2>
      <p className="prose">
        Check, Arbeitshilfen und Berichte bleiben ohne Kauf erreichbar.
      </p>
      <div className="actions">
        <Link className="btn" href="/readiness">
          Test kostenlos machen
        </Link>
      </div>
      <p className="hint">Readiness-Test erneut durchführen.</p>
      <ResourceLinks />
    </section>
  );
}

/** Shown instead of „Kostenlos nutzen“ when the account has a subscription. */
export function AccountHelpCard() {
  return (
    <section className="card account-panel" aria-labelledby="help-heading">
      <h2 id="help-heading">Hilfe & Wissen</h2>
      <p className="prose">
        Arbeitshilfen, Berichte und Antworten zu Ihrer Verfahrensdokumentation.
      </p>
      <ResourceLinks />
    </section>
  );
}

export function AccountResourcesCard({ subscribed }: { subscribed: boolean }) {
  return subscribed ? <AccountHelpCard /> : <AccountFreeCard />;
}
