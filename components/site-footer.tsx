import Link from "next/link";
import { CookieSettingsButton } from "@/components/consent-banner";
import { BRANCHEN_LINKS } from "@/lib/branchen-links";
import { LEGAL_LINKS, LEGAL_OPERATOR } from "@/lib/legal";
import { DISCLAIMER_ONCE } from "@/lib/offer-copy";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <p className="footer-disclaimer">{DISCLAIMER_ONCE}</p>
        GoBD Verfahrensdoku ·{" "}
        <Link href="/faq">kein Steuerberatungsersatz</Link>
        <br />
        Kontakt:{" "}
        <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
        <nav className="footer-links" aria-label="Weitere Seiten">
          <Link href="/faq">FAQ</Link>
          <Link href="/blog">Blog</Link>
          {BRANCHEN_LINKS.map((item) => (
            <Link key={item.slug} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/ampel-check">Betriebsprüfungs-Ampel</Link>
          {LEGAL_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <CookieSettingsButton />
        </nav>
      </div>
    </footer>
  );
}
