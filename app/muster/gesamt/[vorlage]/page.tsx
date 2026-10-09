import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MODULE, TEIL_TITEL } from "@/lib/module/katalog";
import { STATUS_LABEL, effectiveModulStatus, vollstaendigkeitsZeilen } from "@/lib/module/status";
import {
  gesamtMusterFragebogenPath,
  gesamtMusterPdfPath,
  getGesamtMuster,
  isMusterVorlage,
  MUSTER_VORLAGEN,
  modulMusterFragebogenPath,
} from "@/lib/module-muster";
import { ALL_AREAS_LINE, INTAKE_EFFORT_LINE } from "@/lib/offer-copy";
import { canonicalUrl } from "@/lib/seo";

type Params = { params: Promise<{ vorlage: string }> };

export function generateStaticParams() {
  return MUSTER_VORLAGEN.map((vorlage) => ({ vorlage }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { vorlage } = await params;
  const muster = getGesamtMuster(vorlage);
  if (!muster) return { title: "Muster" };
  const title = `Muster-Gesamtdokument: ${muster.label} (fiktiv) | GoBD Verfahrensdoku`;
  const description = `Fiktives Gesamtdokument mit 24 Modulen für die Vorlage ${muster.label}. PDF und Fragebogen, keine Steuerberatung.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalUrl(`/muster/gesamt/${vorlage}`) },
  };
}

export default async function GesamtMusterPage({ params }: Params) {
  const { vorlage } = await params;
  if (!isMusterVorlage(vorlage)) notFound();
  const muster = getGesamtMuster(vorlage)!;
  const rows = vollstaendigkeitsZeilen(muster.answers);

  return (
    <>
      <SiteHeader backHref="/muster" backLabel="← Alle Muster" />
      <main className="wrap partner-copy">
        <section className="hero">
          <p className="kicker">Muster-Gesamtdokument · fiktiv</p>
          <h1>{muster.label}</h1>
          <p className="lead">{muster.steckbrief}</p>
          <p className="prose">{INTAKE_EFFORT_LINE}</p>
          <p className="price-frame">
            <strong>{ALL_AREAS_LINE}</strong>
          </p>
          <div className="actions" style={{ marginTop: 16 }}>
            <a className="btn" href={gesamtMusterPdfPath(vorlage)}>
              Muster-PDF
            </a>
            <a className="btn ghost" href={gesamtMusterFragebogenPath(vorlage)}>
              Muster-Fragebogen
            </a>
          </div>
        </section>

        <section className="block">
          <h2>Vollständigkeitsübersicht (Muster)</h2>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Modul</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.modul} id={row.modul}>
                  <td>{row.nr}</td>
                  <td>
                    {row.titel}
                    {" · "}
                    <Link href={modulMusterFragebogenPath(row.modul)}>Fragebogen</Link>
                  </td>
                  <td>{row.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="block">
          <h2>Teile nach GoBD Rz. 153</h2>
          {([1, 2, 3, 4] as const).map((teil) => (
            <div key={teil}>
              <h3>{TEIL_TITEL[teil]}</h3>
              <ul>
                {MODULE.filter((modul) => modul.teil === teil).map((modul) => (
                  <li key={modul.id}>
                    {modul.nr}. {modul.titel} — {STATUS_LABEL[effectiveModulStatus(muster.answers, modul.id).status]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <p className="disclaimer">
          Muster der IKAT GmbH. Alle Angaben sind fiktiv. Keine Steuer-, Rechts-
          oder Prüfungsberatung. Keine Zusicherung von GoBD-Konformität.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
