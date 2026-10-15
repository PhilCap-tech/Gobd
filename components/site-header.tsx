import Link from "next/link";
import { Logo } from "@/components/logo";
import { BRANCHEN_LINKS } from "@/lib/branchen-links";

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
  /** Branch pages in the header. Used on the homepage navigation. */
  branchenNav?: boolean;
};

export function SiteHeader({
  ctaHref = "/checkout",
  ctaLabel = "Dokumentation erstellen",
  ctaNote,
  backHref,
  backLabel,
  links = DEFAULT_LINKS,
  branchenNav = false,
}: SiteHeaderProps) {
  return (
    <>
      <header className="site-header">
        <div className="shell header-bar">
          <Link className="logo" href="/">
            <Logo />
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
        </div>
        {branchenNav ? (
          <nav className="header-branchen shell" aria-label="Branchenseiten">
            {BRANCHEN_LINKS.map((item) => (
              <Link key={item.slug} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      {ctaNote ? <p className="header-price shell">{ctaNote}</p> : null}
    </>
  );
}
