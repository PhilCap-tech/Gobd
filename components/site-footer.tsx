import { LEGAL_LINKS, LEGAL_OPERATOR } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      GoBD Verfahrensdoku · kein Steuerberatungsersatz
      <br />
      Kontakt:{" "}
      <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
      <nav className="footer-links" aria-label="Rechtliches">
        {LEGAL_LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
