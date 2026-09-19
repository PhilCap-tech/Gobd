import Link from "next/link";

type SiteHeaderProps = {
  ctaHref?: string;
  ctaLabel?: string;
  backHref?: string;
  backLabel?: string;
};

export function SiteHeader({
  ctaHref = "/checkout",
  ctaLabel = "Dokumentation starten",
  backHref,
  backLabel,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link className="logo" href="/">
        GoBD <em>Verfahrensdoku</em>
      </Link>
      <nav className="nav">
        {backHref ? (
          <Link href={backHref}>{backLabel || "Zurück"}</Link>
        ) : (
          <>
            <a className="hide-sm" href="#problem">
              Problem
            </a>
            <a className="hide-sm" href="#outcome">
              Ergebnis
            </a>
            <a className="hide-sm" href="#preis">
              Preis
            </a>
            <Link className="btn" href={ctaHref}>
              {ctaLabel}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
