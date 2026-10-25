import Link from "next/link";
import { CookieSettingsButton } from "@/components/consent-banner";
import { listBranchenFooterLinks } from "@/lib/branchen";
import { LEGAL_LINKS, LEGAL_OPERATOR } from "@/lib/legal";
import { DISCLAIMER_ONCE } from "@/lib/offer-copy";

export function SiteFooter() {
  const seiten = listBranchenFooterLinks();
  return (
    <footer className="site-footer">
      <div className="shell footer-layout">
        <div className="footer-main">
          <p className="footer-disclaimer">{DISCLAIMER_ONCE}</p>
          GoBD Verfahrensdoku ·{" "}
          <Link href="/faq">kein Steuerberatungsersatz</Link>
          <br />
          Kontakt:{" "}
          <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
          <nav className="footer-links" aria-label="Weitere Seiten">
            <Link href="/faq">FAQ</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/ampel-check">GoBD-Ampel</Link>
            <Link href="/vorlagen">Vorlagen</Link>
            {LEGAL_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            <CookieSettingsButton />
          </nav>
        </div>
        <nav className="footer-branchen" aria-labelledby="footer-branchen-title">
          <h2 id="footer-branchen-title" className="footer-col-title">Branchen</h2>
          <ul>
            {seiten.map((seite) => (
              <li key={seite.slug}>
                <Link href={seite.href}>{seite.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
