import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MusterUpsell } from "@/components/muster-upsell";
import { planDelivery } from "@/lib/delivery";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  evaluateOpenPoints,
  OPEN_POINT_EMPTY_LABELS,
  openPointChapterLabel,
  openPointDueLabel,
} from "@/lib/open-points";
import {
  PARTNER_DEMO_PATH,
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_PATH,
  PARTNER_MUSTER_PDF_PATH,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";

const PAGE_TITLE =
  "Muster: Verfahrensdokumentation Beispiel GmbH (fiktiv) | GoBD Verfahrensdoku";
const PAGE_DESCRIPTION =
  "Fiktive GmbH, DATEV, E-Mail und PDF. Gliederung am detaillierten Muster. Präsens nur für bestätigte Angaben. Keine Freigabe durch die Geschäftsführung. Keine Steuerberatung.";

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
  ["Unternehmen", `${PARTNER_MUSTER_IDENTITY.company} (fiktiv)`],
  ["Branche", PARTNER_MUSTER_ANSWERS.branchen.join(", ")],
  ["Rechtsform", PARTNER_MUSTER_ANSWERS.rechtsform],
  ["Mitarbeitende", PARTNER_MUSTER_ANSWERS.mitarbeitende],
  ["Geschäftsführung", PARTNER_MUSTER_ANSWERS.gf],
  ["Buchhaltung", PARTNER_MUSTER_ANSWERS.buchhaltung],
  ["Steuerberatung", PARTNER_MUSTER_ANSWERS.steuerberater],
  ["FiBu", PARTNER_MUSTER_ANSWERS.fibu.join(", ")],
  ["Eingangsbelege", PARTNER_MUSTER_ANSWERS.eingangsbelege.join(", ")],
  ["Ausgangsrechnungen", PARTNER_MUSTER_ANSWERS.ausgangsrechnungen.join(", ")],
  ["Archiv", PARTNER_MUSTER_ANSWERS.archiv],
  ["Hosting", PARTNER_MUSTER_ANSWERS.hosting],
  ["Backup", PARTNER_MUSTER_ANSWERS.backup.join(", ")],
  ["Zugriff", PARTNER_MUSTER_ANSWERS.zugriff],
  ["Weitere Systeme", PARTNER_MUSTER_ANSWERS.weitereSysteme],
  ["IT", "nicht angegeben — offener Punkt"],
  ["Gültig ab", PARTNER_MUSTER_VERSION_META.validFrom || "von der Geschäftsführung festzulegen"],
  ["Änderung im PDF", PARTNER_MUSTER_VERSION_META.changeSummary],
];

export default function PartnerMusterPage() {
  return (
    <>
      <SiteHeader backHref="/steuerberater" backLabel="Für Steuerberater" />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Muster · Beispiel · fiktiv</p>
          <h1>Musterergebnis: Beispiel GmbH</h1>
          <p className="lead">
            Kein Mandant, keine echten Personen. Dieselbe Gliederung wie das
            detaillierte Beispiel, erzeugt aus festen Beispieldaten. Präsens
            nur für bestätigte Angaben. Die Erzeugung ist keine Freigabe durch
            die Geschäftsführung.
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
            Im Katalog dieses Beispiels sind bestätigt: DATEV, Hosting, Eingang
            per E-Mail/PDF, der Zugriffstext und die Sicherungsart. Namen,
            Archivordnung, Kanzlei-Umfang, Kontrollen und die betriebliche
            Bestätigung bleiben offen. Kein Papierweg. Die Erzeugung ist keine
            Freigabe durch die Geschäftsführung.
          </p>
        </section>

        <section className="block" id="daten">
          <h2>Beispieldaten</h2>
          <p className="hint">
            Die Liste ist der Beispielbestand. Im PDF wird daraus nur Präsens,
            wenn die Katalogfrage bestätigt ist.
          </p>
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
            Präsens im PDF nur für die festgelegten Angaben. Alles andere ist
            Hinweis oder offener Punkt. Ein Papierabschnitt entsteht nur, wenn
            ein Papier- oder Scanweg genannt ist. In diesem Muster entfällt er.
          </p>
        </section>

        <section className="block" id="offene-punkte">
          <h2>Offene Punkte aus dem Regelsatz</h2>
          <p className="prose">
            Leer gilt, was der Regelsatz als leer wertet
            {OPEN_POINT_EMPTY_LABELS.length
              ? `: ${OPEN_POINT_EMPTY_LABELS.join(", ")}.`
              : "."}{" "}
            Die Backup-Option „Unklar“ steht nicht in dieser Liste. Zusätzlich
            bleiben Schritte offen, die der Fragebogen nicht abfragt
            (Sichtungsturnus, Rücksicherung, Kontrollroutine,
            Berechtigungsliste). Ein Kanzleiname mit unbestätigtem
            Leistungsumfang wird nicht als Verbuchung beschrieben. Ein
            konkreter Hinweis: ist ersetzendes Scannen genannt, ohne dass ein
            Papierweg bestätigt ist, erscheint das als offener Punkt. Das ist
            keine automatische Freigabe und kein allgemeiner
            Widerspruchs-Check.
          </p>
          <div className="legal legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Priorität</th>
                  <th scope="col">Offener Punkt</th>
                  <th scope="col">Kapitel</th>
                  <th scope="col">Zieltermin</th>
                </tr>
              </thead>
              <tbody>
                {openPoints.map((item) => (
                  <tr key={item.id}>
                    <td>{item.priority}</td>
                    <td>{item.text}</td>
                    <td>{openPointChapterLabel(item.chapter)}</td>
                    <td>{item.dueDate ?? openPointDueLabel()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Dieselbe Tabelle steht im PDF. Priorität ist hoch, mittel oder
            niedrig. Ein Zieltermin wird nicht erfunden und steht auf „nicht
            festgelegt“.
          </p>
        </section>

        <section className="block" id="fassung">
          <h2>Was im Produkt anders ist</h2>
          <p className="prose">
            Im Produkt kann der Mandant die Angaben erneut ausfüllen oder den
            Kapiteltext bearbeiten. Speichern erzeugt eine neue Fassung mit
            Gültig-ab, Kurz-Changelog und „Geändert durch“. Bisherige PDFs
            bleiben downloadbar. Eine eigene Bestätigungsstufe gibt es nicht.
            Diese Musterseite ist ein Beispiel und speichert keine Eingaben.
          </p>
          <p className="hint back-links">
            <Link href="/steuerberater">Zur Partnerseite</Link>
            {" · "}
            <Link href={PARTNER_DEMO_PATH}>Fragenprozess testen</Link>
          </p>
          <MusterUpsell />
          <p className="disclaimer">
            Muster der IKAT GmbH, gobd-doku-erstellen.de. Keine Steuer-, Rechts-
            oder Prüfungsberatung. Keine Zusicherung von GoBD-Konformität. Die
            Beispiel GmbH ist erfunden. Die Erzeugung ist keine Freigabe durch
            die Geschäftsführung.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
