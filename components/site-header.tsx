import Image from "next/image";
import Link from "next/link";

type HeaderLink = {
  href: string;
  label: string;
};

const DEFAULT_LINKS: HeaderLink[] = [
  { href: "#muster", label: "Muster" },
  { href: "#ablauf", label: "Ablauf" },
  { href: "#preise", label: "Preise" },
  { href: "/readiness", label: "3-Minuten-Check" },
];

type SiteHeaderProps = {
  ctaHref?: string;
  ctaLabel?: string;
  /** Full price line for the header primary. Renders on its own row so it is not clipped. */
  ctaNote?: string;
  backHref?: string;
  backLabel?: string;
  links?: HeaderLink[];
};

export function SiteHeader({
  ctaHref = "/checkout",
  ctaLabel = "Dokumentation erstellen",
  ctaNote,
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
      {ctaNote ? <p className="header-price">{ctaNote}</p> : null}
    </header>
  );
}
