import Link from "next/link";

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
      <p className="hint">Readiness-Test nochmal.</p>
      <ul className="free-list">
        <li>
          <Link href="/resources/10-offene-punkte">10 offene Punkte</Link>
        </li>
        <li>
          <Link href="/resources/inhalt-verfahrensdokumentation">
            Inhalt einer Verfahrensdokumentation
          </Link>
        </li>
        <li>
          <Link href="/blog">Berichte / Bibliothek</Link>
        </li>
        <li>
          <Link href="/faq">FAQ</Link>
        </li>
      </ul>
    </section>
  );
}
