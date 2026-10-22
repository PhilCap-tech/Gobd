import { formatAmpelStepDay } from "@/lib/ampel-step-event";
import {
  HOME_CTA_LABELS,
  formatHomeCtaClickRate,
  homeViewCountingLabel,
  type HomeCtaId,
  type HomeCtaReport,
} from "@/lib/home-cta-event";

export function HomeCtaTable({ report }: { report: HomeCtaReport }) {
  const days = [...report.days, report.total];
  const label = homeViewCountingLabel();
  const rateByCta = new Map<HomeCtaId, number | null>(report.clickRate.byCta.map((item) => [item.cta, item.rate]));
  return (
    <div className="ampel-admin-table-wrap">
      <table className="ampel-admin-table">
        <caption>Tag, CTA und Gerät. Seitenaufrufe und Klickrate {label}.</caption>
        <thead>
          <tr>
            <th>Tag</th>
            <th>CTA</th>
            <th>Mobil</th>
            <th>Desktop</th>
            <th>Gesamt</th>
            <th>Klickrate {label}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) =>
            day.counts.map((count, index) => (
              <tr key={`${day.date}:${count.cta}`}>
                <td>{index === 0 ? formatAmpelStepDay(day.date) : ""}</td>
                <td>{HOME_CTA_LABELS[count.cta]}</td>
                <td>{count.mobile}</td>
                <td>{count.desktop}</td>
                <td>{count.total}</td>
                <td>
                  {day.date === "Summe"
                    ? formatHomeCtaClickRate(count.cta === "home_view" ? report.clickRate.rate : (rateByCta.get(count.cta) ?? null))
                    : ""}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HomeCtaSection({
  report,
  configured,
  failed,
}: {
  report: HomeCtaReport | null;
  configured: boolean;
  failed: boolean;
}) {
  return (
    <section className="ampel-steps">
      <h2>Startseite CTA (letzte 14 Tage)</h2>
      {failed ? (
        <p className="error">
          Die Startseiten-Klicks konnten nicht geladen werden. Bitte laden Sie die Seite später erneut.
        </p>
      ) : !configured ? (
        <p>Die Startseiten-Statistik ist in dieser Umgebung nicht eingerichtet.</p>
      ) : report ? (
        <>
          <p>
            Sie sehen die Klicks der letzten 14 Tage nach dem Kalendertag in Europe/Berlin. Seitenaufrufe{" "}
            {homeViewCountingLabel()} zählen mit. Ältere Seitenaufrufe bleiben gespeichert und gehen nicht in diese
            Auswertung ein. Mobil und Desktop sind getrennt ausgewiesen. Die Klickrate ist die Summe der
            Schaltflächen-Klicks geteilt durch die Seitenaufrufe, ebenfalls {homeViewCountingLabel()}. Ohne
            Seitenaufruf steht dort –. Die letzte Zeile ist die Summe.
          </p>
          {report.hasRows ? null : <p>In den letzten 14 Tagen ist noch kein Eintrag gespeichert.</p>}
          <HomeCtaTable report={report} />
        </>
      ) : null}
    </section>
  );
}
