import Image from "next/image";
import Link from "next/link";

type SiteHeaderProps = {
  ctaHref?: string;
  ctaLabel?: string;
  backHref?: string;
  backLabel?: string;
};

export function SiteHeader({
  ctaHref = "/checkout",
  ctaLabel = "Jetzt Verfahrensdokumentation erstellen — 149 € + 49 €/Mo",
  backHref,
  backLabel,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link className="logo" href="/">
        <Image
          src="/brand/logo-lockup.png"
          alt="GoBD Verfahrensdoku"
          width={106}
          height={40}
          preload
        />
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
            <a className="hide-sm" href="#preise">
              Preise
            </a>
            <Link className="hide-sm" href="/readiness">
              Readiness
            </Link>
            <Link className="btn hide-sm" href={ctaHref}>
              {ctaLabel}
            </Link>
          </>
        )}
        <Link href="/account">Konto</Link>
      </nav>
    </header>
  );
}
