import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BEREICHE, bereichById, bereichDocTitle, isBereichId } from "@/lib/bereiche";
import { musterFragebogenPath, musterPath, musterPdfPath, MUSTER_INDEX_PATH } from "@/lib/bereich-muster";
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { catalogFragebogen } from "@/lib/intake-catalog";
import { getMuster, MUSTER_BEREICH_IDS } from "@/lib/muster";
import { openPointChapterLabel, openPointDueLabel } from "@/lib/open-points";
import { ALL_AREAS_LINE } from "@/lib/offer-copy";
import { canonicalUrl } from "@/lib/seo";

type Params = { params: Promise<{ bereich: string }> };

export function generateStaticParams() {
  return MUSTER_BEREICH_IDS.map((bereich) => ({ bereich }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { bereich } = await params;
  if (!isBereichId(bereich)) return { title: "Muster" };
  const label = bereichById(bereich).label;
  const title = `Muster: ${bereichDocTitle(bereich)} (fiktiv) | GoBD Verfahrensdoku`;
  const description = `Muster-PDF und ausgefüllter Muster-Fragebogen für den Bereich ${label}: ${bereichById(bereich).kurz} Fiktives Beispielunternehmen, keine Steuerberatung.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalUrl(musterPath(bereich)) },
    openGraph: { title, description, url: canonicalUrl(musterPath(bereich)), locale: "de_DE", type: "website" },
  };
}

export default async function MusterBereichPage({ params }: Params) {
  const { bereich: id } = await params;
  const muster = isBereichId(id) ? getMuster(id) : undefined;
  if (!muster) notFound();
  const bereich = bereichById(id);
  const rendered = renderDeliveryDocument({
    identity: muster.identity,
    answers: muster.answers,
    documentId: muster.documentId,
    version: muster.version,
    versionMeta: muster.versionMeta,
    versionHistory: muster.versionHistory,
  });
  const steps = catalogFragebogen(muster.answers);
  const questionCount = steps.reduce((sum, step) => sum + step.questions.length, 0);
  const others = BEREICHE.filter((item) => item.id !== id);

  return (
    <>
      <SiteHeader backHref={MUSTER_INDEX_PATH} backLabel="Alle Muster" />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Muster · {bereich.label} · fiktiv</p>
          <h1>Muster: {bereichDocTitle(id)}</h1>
          <p className="lead">{muster.steckbrief}</p>
          <div className="actions">
            <a className="btn" href={musterPdfPath(id)}>
              Muster-PDF herunterladen
            </a>
            <a className="btn ghost" href={musterFragebogenPath(id)}>
              Muster-Fragebogen (PDF)
            </a>
          </div>
          <p className="hint">
            {questionCount} Fragen, {rendered.chapters.length} Kapitel,{" "}
            {rendered.openPoints.length} offene Punkte. {ALL_AREAS_LINE}
          </p>
        </section>

        <section className="block" id="daten">
          <h2>Beispielunternehmen</h2>
          <div className="card">
            <dl className="summary">
              {muster.facts.map(([label, value]) => (
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
            {rendered.chapters.map((chapter) => (
              <li key={chapter.id}>
                <strong>{chapter.title}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="block" id="fragebogen">
          <h2>Muster-Fragebogen</h2>
          <p className="hint">
            So sieht der ausgefüllte Fragebogen aus. „So läuft es heute“ wird
            im PDF zur Ist-Beschreibung; „Soll künftig so laufen“ und „Muss ich
            klären“ werden zu offenen Punkten.
          </p>
          {steps.map((step, stepIndex) => (
            <details key={step.title} className="card muster-step" open={stepIndex === 0}>
              <summary>
                Schritt {stepIndex + 1}: {step.title} ({step.questions.length})
              </summary>
              <ol className="prose-list">
                {step.questions.map((question) => (
                  <li key={question.id}>
                    <strong>{question.prompt}</strong>
                    <br />
                    <em>{question.status}</em>
                    {question.lines.length ? ` · ${question.lines.join(" · ")}` : ""}
                    {question.reason ? ` · Begründung: ${question.reason}` : ""}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </section>

        <section className="block" id="offene-punkte">
          <h2>Offene Punkte im Muster</h2>
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
                {rendered.openPoints.map((item) => (
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
        </section>

        <section className="block" id="fassung">
          <h2>Versionierung</h2>
          <p className="prose">
            Jede Verfahrensdokumentation eines Bereichs hat eigene Fassungen mit
            Gültig-ab, Kurz-Changelog und „Geändert durch“. Das PDF enthält die
            Änderungshistorie aller Fassungen; frühere PDFs bleiben im
            Kundenkonto downloadbar.{" "}
            {muster.versionHistory.length
              ? `Dieses Muster zeigt Fassung ${rendered.versionLabel} mit Vorversion ${muster.versionHistory.map((item) => item.version).join(", ")}.`
              : `Dieses Muster zeigt Fassung ${rendered.versionLabel}.`}
          </p>
          {id === "belegfluss" ? (
            <p className="hint">
              Ausführliche Erläuterung zum Belegfluss-Muster:{" "}
              <Link href="/steuerberater/muster">Muster für Steuerberater</Link>.
            </p>
          ) : null}
        </section>

        <section className="block" id="weitere">
          <h2>Weitere Muster</h2>
          <ul className="bereich-grid">
            {others.map((item) => (
              <li key={item.id}>
                <strong>
                  <Link href={musterPath(item.id)}>{item.label}</Link>
                </strong>
                <span>{item.kurz}</span>
              </li>
            ))}
          </ul>
          <p className="disclaimer">
            Muster der IKAT GmbH, gobd-doku-erstellen.de. Das Unternehmen, alle
            Personen und mit „fiktiv“ gekennzeichneten Systeme sind erfunden.
            Keine Steuer-, Rechts- oder Prüfungsberatung. Keine Zusicherung von
            GoBD-Konformität. Die Erzeugung ist keine Freigabe durch die
            Geschäftsführung.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
