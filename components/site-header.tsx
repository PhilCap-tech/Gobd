import Image from "next/image";
import Link from "next/link";

type HeaderLink = {
  href: string;
  label: string;
};

const DEFAULT_LINKS: HeaderLink[] = [
  { href: "#problem", label: "Problem" },
  { href: "#outcome", label: "Ergebnis" },
  { href: "#preise", label: "Preise" },
  { href: "/readiness", label: "Readiness" },
];

type SiteHeaderProps = {
  ctaHref?: string;
  ctaLabel?: string;
  backHref?: string;
  backLabel?: string;
  links?: HeaderLink[];
};

export function SiteHeader({
  ctaHref = "/checkout",
  ctaLabel = "Jetzt Verfahrensdokumentation erstellen — 149 € + 49 €/Mo",
  backHref,
  backLabel,
  links = DEFAULT_LINKS,
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
            {links.map((item) =>
              item.href.startsWith("/") ? (
                <Link key={item.href} className="hide-sm" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <a key={item.href} className="hide-sm" href={item.href}>
                  {item.label}
                </a>
              ),
            )}
            {ctaHref.startsWith("#") ? (
              <a className="btn hide-sm" href={ctaHref}>
                {ctaLabel}
              </a>
            ) : (
              <Link className="btn hide-sm" href={ctaHref}>
                {ctaLabel}
              </Link>
            )}
          </>
        )}
        <Link href="/account">Konto</Link>
      </nav>
    </header>
  );
}
