import Link from "next/link";
import { CookieSettingsButton } from "@/components/consent-banner";
import { listBranchenFooterLinks } from "@/lib/branchen";
import { LEGAL_LINKS, LEGAL_OPERATOR } from "@/lib/legal";
import { DISCLAIMER_ONCE } from "@/lib/offer-copy";
import { faqAvailable } from "@/lib/faq-entries";

/**
 * Footer Variante B (Prototyper 31.10., Freigabe Philip): oben Hinweis + Kontakt | FAQ/Blog/Ampel,
 * darunter einklappbare Branchen-Zeile (natives <details>, Links im Server-HTML), unten Rechtliches.
 */
export function SiteFooter() {
  const seiten = listBranchenFooterLinks();
  const faq = faqAvailable();
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-top">
          <div className="footer-main">
            <p className="footer-disclaimer">{DISCLAIMER_ONCE}</p>
            GoBD Verfahrensdoku ·{" "}
            {faq ? <Link href="/faq">kein Steuerberatungsersatz</Link> : "kein Steuerberatungsersatz"}
            <br />
            Kontakt:{" "}
            <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
          </div>
          <nav className="footer-links footer-links-top" aria-label="Weitere Seiten">
            {faq ? <Link href="/faq">FAQ</Link> : null}
            <Link href="/blog">Blog</Link>
            <Link href="/ampel-check">GoBD-Ampel</Link>
          </nav>
        </div>
        <details className="footer-branchen">
          <summary>
            <span className="footer-col-title">Verfahrensdokumentation nach Branche ({seiten.length})</span>
            <span className="footer-chev" aria-hidden="true">▾</span>
          </summary>
          <ul>
            {seiten.map((seite) => (
              <li key={seite.slug}>
                <Link href={seite.href}>{seite.label}</Link>
              </li>
            ))}
          </ul>
        </details>
        <nav className="footer-links footer-legal" aria-label="Rechtliches">
          {LEGAL_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <CookieSettingsButton />
          <a href={`mailto:${LEGAL_OPERATOR.email}`}>Kontakt</a>
        </nav>
      </div>
    </footer>
  );
}
