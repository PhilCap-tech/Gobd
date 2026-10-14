import type { Metadata } from "next";
import { CrumbJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AMPEL_ABBREVIATIONS, AMPEL_QUELLEN_PATH, AMPEL_SOURCE_ROWS } from "@/lib/ampel-questions";
import { canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Quellen & Methodik",
  description:
    "Quellen und Abkürzungen der Betriebsprüfungs-Ampel. Orientierung, keine Steuerberatung.",
  alternates: { canonical: canonicalUrl(AMPEL_QUELLEN_PATH) },
};

export default function AmpelQuellenPage() {
  return (
    <>
      <CrumbJsonLd
        items={[
          { name: "Startseite", path: "/" },
          { name: "Betriebsprüfungs-Ampel", path: "/ampel-check" },
          { name: "Quellen & Methodik", path: AMPEL_QUELLEN_PATH },
        ]}
      />
      <SiteHeader backHref="/ampel-check" backLabel="← Zur Ampel" />
      <main className="wrap page legal">
        <h1>Quellen & Methodik</h1>
        <p className="prose">{AMPEL_ABBREVIATIONS}</p>
        <div className="legal-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Quelle</th>
                <th scope="col">Inhalt</th>
                <th scope="col">Stand</th>
              </tr>
            </thead>
            <tbody>
              {AMPEL_SOURCE_ROWS.map((row) => (
                <tr key={row.source}>
                  <td>{row.source}</td>
                  <td>{row.content}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
