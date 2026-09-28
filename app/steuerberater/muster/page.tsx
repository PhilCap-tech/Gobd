import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { planDelivery } from "@/lib/delivery";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { evaluateOpenPoints, OPEN_POINT_EMPTY_LABELS } from "@/lib/open-points";
import {
  PARTNER_DEMO_PATH,
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_PATH,
  PARTNER_MUSTER_PDF_PATH,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";

const PAGE_TITLE =
  "Muster: Verfahrensdokumentation Beispiel GmbH (anonymisiert) | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Anonymisierte Beispiel-GmbH: DATEV, Eingang per E-Mail/PDF, Ausgang aus der Buchhaltungssoftware. PDF und Offene Punkte aus dem Lieferpfad. Keine Steuerberatung.";

export const metadata: Metadata = {
  metadataBase: new URL(LEGAL_OPERATOR.siteUrl),
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: true },
  alternates: { canonical: PARTNER_MUSTER_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PARTNER_MUSTER_PATH,
    locale: "de_DE",
    type: "website",
  },
};

const plan = planDelivery(
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_IDENTITY,
  1,
);
const openPoints = evaluateOpenPoints({
  answers: PARTNER_MUSTER_ANSWERS,
  identity: PARTNER_MUSTER_IDENTITY,
});

const facts: Array<[string, string]> = [
  ["Unternehmen", `${PARTNER_MUSTER_IDENTITY.company} (anonymisiert)`],
  ["Branche", PARTNER_MUSTER_ANSWERS.branchen.join(", ")],
  ["Rechtsform", PARTNER_MUSTER_ANSWERS.rechtsform],
  ["Mitarbeitende", PARTNER_MUSTER_ANSWERS.mitarbeitende],
  ["FiBu", PARTNER_MUSTER_ANSWERS.fibu.join(", ")],
  ["Eingangsbelege", PARTNER_MUSTER_ANSWERS.eingangsbelege.join(", ")],
  ["Ausgangsrechnungen", PARTNER_MUSTER_ANSWERS.ausgangsrechnungen.join(", ")],
  ["Archiv", PARTNER_MUSTER_ANSWERS.archiv],
  ["Hosting", PARTNER_MUSTER_ANSWERS.hosting],
  ["Backup", PARTNER_MUSTER_ANSWERS.backup.join(", ")],
  ["Weitere Systeme", "leer — wird offener Punkt"],
  ["IT", "leer — wird offener Punkt"],
  ["Änderung im PDF", PARTNER_MUSTER_VERSION_META.changeSummary],
];

export default function PartnerMusterPage() {
  return (
    <>
      <SiteHeader backHref="/steuerberater" backLabel="Für Steuerberater" />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Muster · Beispiel · anonymisiert</p>
          <h1>Musterergebnis: Beispiel GmbH</h1>
          <p className="lead">
            Kein Mandant, keine echten Personen. Das PDF und die Liste entstehen
            aus festen Beispieldaten über denselben Generator wie eine Lieferung
            nach den Angaben.
          </p>
          <div className="actions">
            <a className="btn" href={PARTNER_MUSTER_PDF_PATH}>
              Muster-PDF herunterladen
            </a>
            <Link className="btn ghost" href={PARTNER_DEMO_PATH}>
              Fragenprozess testen
            </Link>
          </div>
          <p className="hint">
            Beispieldaten, die der Fragebogen abbilden kann: kleine GmbH,
            Dienstleistung, DATEV, digitaler Belegeingang über die Option
            „E-Mail / PDF“, Ausgangsrechnungen über „aus Buchhaltungssoftware“,
            Archiv als Freitext „DATEV Unternehmen online“.
          </p>
        </section>

        <section className="block" id="daten">
          <h2>Was in diesem Muster steht</h2>
          <div className="card">
            <dl className="summary">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="block" id="kapitel">
          <h2>Kapitel im PDF</h2>
          <ol className="prose-list">
            {plan.chapters.map((chapter) => (
              <li key={chapter.id}>
                <strong>{chapter.title}</strong>
              </li>
            ))}
          </ol>
          <p className="hint">
            Die Kapiteltexte sind die feste Vorlage. Eingesetzt werden die
            Beispieldaten. Beide Verfahrenskapitel (Papier und Digital) werden
            erzeugt, auch wenn der Eingang nur „E-Mail / PDF“ ist.
          </p>
        </section>

        <section className="block" id="offene-punkte">
          <h2>Offene Punkte aus dem Regelsatz</h2>
          <p className="prose">
            Leer gilt, was der Regelsatz als leer wertet
            {OPEN_POINT_EMPTY_LABELS.length
              ? `: ${OPEN_POINT_EMPTY_LABELS.join(", ")}.`
              : "."}{" "}
            Die Backup-Option „Unklar“ steht nicht in dieser Liste. Widersprüche
            zwischen ausgefüllten Angaben prüft der Regelsatz nicht.
          </p>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Schwere</th>
                  <th scope="col">Offener Punkt</th>
                  <th scope="col">Kapitel</th>
                </tr>
              </thead>
              <tbody>
                {openPoints.map((item) => (
                  <tr key={item.id}>
                    <td>{item.severity}</td>
                    <td>{item.title}</td>
                    <td>{item.chapter || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Dieselbe Tabelle steht im PDF (Kapitel Offene Punkte). Schweregrade
            bleiben high, medium, low — so schreibt sie der Generator.
          </p>
        </section>

        <section className="block" id="fassung">
          <h2>Was nach einem echten Kauf anders ist</h2>
          <p className="prose">
            Nach dem Kauf kann der Mandant die Angaben erneut ausfüllen oder den
            Kapiteltext bearbeiten. Speichern erzeugt eine neue Fassung mit
            Gültig-ab, Kurz-Changelog und „Geändert durch“. Bisherige PDFs
            bleiben downloadbar. Eine eigene Bestätigungsstufe gibt es nicht.
            Diese Musterseite speichert nichts.
          </p>
          <p className="hint back-links">
            <Link href="/steuerberater">Zur Partnerseite</Link>
            {" · "}
            <Link href={PARTNER_DEMO_PATH}>Fragenprozess testen</Link>
          </p>
          <p className="disclaimer">
            Muster der IKAT GmbH, gobd-doku-erstellen.de. Keine Steuer-, Rechts-
            oder Prüfungsberatung. Keine Zusicherung von GoBD-Konformität. Die
            Beispiel GmbH ist erfunden.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
