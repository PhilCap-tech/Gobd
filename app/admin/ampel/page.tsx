import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { isAmpelAdminEmail } from "@/lib/ampel-admin";
import { ampelStatsError } from "@/lib/ampel-admin-http";
import { buildAmpelStats, type AmpelCount, type AmpelStatsReport } from "@/lib/ampel-stats";
import { listAmpelLeads } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ampel-Check Auswertung",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

function CountBlock({ title, count }: { title: string; count: AmpelCount }) {
  return (
    <section className="card ampel-admin-count">
      <h2>{title}</h2>
      <dl>
        <div>
          <dt>Gesamt</dt>
          <dd>{count.total}</dd>
        </div>
        <div>
          <dt>Heute</dt>
          <dd>{count.today}</dd>
        </div>
        <div>
          <dt>Letzte 7 Tage</dt>
          <dd>{count.last7Days}</dd>
        </div>
      </dl>
    </section>
  );
}

function Report({ report }: { report: AmpelStatsReport }) {
  const toggleHref = report.includeTests ? "/admin/ampel" : "/admin/ampel?tests=1";
  return (
    <>
      <div className="ampel-admin-counts">
        <CountBlock title="Mit Testadressen" count={report.counts.withTests} />
        <CountBlock title="Ohne Testadressen" count={report.counts.withoutTests} />
      </div>
      <p className="actions">
        <a className="btn ghost" href={toggleHref}>
          {report.includeTests ? "Testadressen ausblenden" : "Testadressen einblenden"}
        </a>
      </p>
      <p>
        {report.includeTests
          ? "Testadressen sind in der Liste markiert."
          : "Testadressen sind in der Liste ausgeblendet. Die Zähler oben bleiben vollständig."}
      </p>
      {report.entries.length === 0 ? (
        <p>Keine Einträge in dieser Ansicht.</p>
      ) : (
        <div className="ampel-admin-table-wrap">
          <table className="ampel-admin-table">
            <caption>Ampel-Checks</caption>
            <thead>
              <tr>
                <th>Zeit (Berlin)</th>
                <th>E-Mail-Adresse</th>
                <th>Ergebnis</th>
                <th>Opt-in</th>
                <th>E-Mail versendet</th>
                <th>UTM-Quelle</th>
                <th>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry, index) => (
                <tr key={`${index}:${entry.at}:${entry.email}`}>
                  <td>{entry.timeBerlin}</td>
                  <td>{entry.email || "—"}</td>
                  <td>{entry.result}</td>
                  <td>{entry.optIn}</td>
                  <td>{entry.mailed}</td>
                  <td>{entry.utmSource}</td>
                  <td>{entry.test ? "Test" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default async function AmpelAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tests?: string | string[] }>;
}) {
  const email = await getSessionEmail();
  if (!isAmpelAdminEmail(email)) notFound();

  const params = await searchParams;
  const tests = Array.isArray(params.tests) ? params.tests[0] : params.tests;
  let report: AmpelStatsReport | null = null;
  let failure = "";
  try {
    const rows = await listAmpelLeads();
    report = buildAmpelStats(rows, { includeTests: tests === "1" });
  } catch (error) {
    failure = ampelStatsError(error).message;
  }

  return (
    <main className="wrap page ampel-admin">
      <h1>Ampel-Check Auswertung</h1>
      <p className="lead">
        Hier sehen Sie die gespeicherten Ampel-Checks. Heute und die letzten 7 Tage gelten nach dem Kalendertag in Europe/Berlin.
      </p>
      {failure ? <p className="error">{failure}</p> : report ? <Report report={report} /> : null}
    </main>
  );
}
