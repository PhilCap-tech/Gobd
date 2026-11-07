import { MEASURE_CHANNELS } from "@/lib/measure-channel";
import {
  MEASURE_CHANNEL_BASIS_LABEL,
  MEASURE_CHANNEL_LABELS,
  MEASURE_LABELS,
  MEASURE_NOT_MEASURED_LABEL,
  channelTotal,
  formatMeasureDay,
  formatMeasureFrom,
  type MeasureChannelCounts,
  type MeasureMetric,
  type MeasureMetricReport,
  type MeasureReport,
} from "@/lib/measure-event";

function Cells({
  counts,
  test,
  measured,
}: {
  counts: MeasureChannelCounts;
  test: MeasureChannelCounts;
  measured: boolean;
}) {
  if (!measured) {
    return (
      <td colSpan={6}>{MEASURE_NOT_MEASURED_LABEL}</td>
    );
  }
  return (
    <>
      {MEASURE_CHANNELS.map((channel) => (
        <td key={channel}>{counts[channel]}</td>
      ))}
      <td>{channelTotal(counts)}</td>
      <td>{channelTotal(test)}</td>
    </>
  );
}

function DayTable({ metric }: { metric: MeasureMetricReport }) {
  const days = metric.days;
  return (
    <div className="ampel-admin-table-wrap">
      <table className="ampel-admin-table">
        <caption>
          {MEASURE_LABELS[metric.metric]}. {formatMeasureFrom(metric.from)}. {MEASURE_CHANNEL_BASIS_LABEL}. Standard ohne Tests.
        </caption>
        <thead>
          <tr>
            <th>Tag</th>
            {MEASURE_CHANNELS.map((channel) => (
              <th key={channel}>{MEASURE_CHANNEL_LABELS[channel]}</th>
            ))}
            <th>Summe</th>
            <th>Tests</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{formatMeasureDay(day.date)}</td>
              <Cells counts={day.standard} test={day.test} measured={day.measured} />
            </tr>
          ))}
          <tr>
            <td>Summe</td>
            {MEASURE_CHANNELS.map((channel) => (
              <td key={channel}>{metric.total.standard[channel]}</td>
            ))}
            <td>{channelTotal(metric.total.standard)}</td>
            <td>{channelTotal(metric.total.test)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AnswerTable({ metric }: { metric: MeasureMetricReport }) {
  return (
    <div className="ampel-admin-table-wrap">
      <table className="ampel-admin-table">
        <caption>
          Antworten je Frage. {formatMeasureFrom(metric.from)}. Die Summe oben zählt alle Fragen. Standard ohne Tests.
        </caption>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Frage</th>
            {MEASURE_CHANNELS.map((channel) => (
              <th key={channel}>{MEASURE_CHANNEL_LABELS[channel]}</th>
            ))}
            <th>Summe</th>
            <th>Tests</th>
          </tr>
        </thead>
        <tbody>
          {metric.days.map((day) =>
            day.measured
              ? day.answers.map((answer, index) => (
                  <tr key={`${day.date}:${answer.n}`}>
                    <td>{index === 0 ? formatMeasureDay(day.date) : ""}</td>
                    <td>{answer.n}</td>
                    {MEASURE_CHANNELS.map((channel) => (
                      <td key={channel}>{answer.standard[channel]}</td>
                    ))}
                    <td>{channelTotal(answer.standard)}</td>
                    <td>{channelTotal(answer.test)}</td>
                  </tr>
                ))
              : (
                  <tr key={day.date}>
                    <td>{formatMeasureDay(day.date)}</td>
                    <td colSpan={7}>{MEASURE_NOT_MEASURED_LABEL}</td>
                  </tr>
                ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function metricByName(report: MeasureReport, name: MeasureMetric): MeasureMetricReport | undefined {
  return report.metrics.find((item) => item.metric === name);
}

function RequestChannelNote({ metric }: { metric: MeasureMetric }) {
  if (metric === "intake_start" || metric === "magic_link_first_login") {
    return (
      <p>
        {MEASURE_CHANNEL_BASIS_LABEL}. Das ist nicht die Herkunft des ursprünglichen Besuchs. Fragebogen-Start und
        der Magic-Link-Login tragen die Landing-Parameter meist nicht mehr. Ohne Signal auf dieser Anfrage bleibt
        der Kanal unbekannt.
      </p>
    );
  }
  return null;
}

export function MesslueckenSection({
  report,
  configured,
  failed,
}: {
  report: MeasureReport | null;
  configured: boolean;
  failed: boolean;
}) {
  const intake = report ? metricByName(report, "intake_start") : undefined;
  const accounts = report ? metricByName(report, "magic_link_first_login") : undefined;
  const start = report ? metricByName(report, "ampel_start") : undefined;
  const answers = report ? metricByName(report, "ampel_answer") : undefined;
  const result = report ? metricByName(report, "ampel_result") : undefined;
  return (
    <section className="ampel-steps">
      <h2>Messlücken (letzte 14 Tage)</h2>
      {failed ? (
        <p className="error">
          Die Messlücken konnten nicht geladen werden. Bitte laden Sie die Seite später erneut.
        </p>
      ) : !configured ? (
        <p>Die Messlücken sind in dieser Umgebung nicht eingerichtet.</p>
      ) : report && intake && accounts && start && answers && result ? (
        <>
          <p>
            Sie sehen Zählungen ab dem Messbeginn je Kennzahl, nach dem Kalendertag in Europe/Berlin. Der
            Messbeginn ist der Tag des ersten Produktiv-Ereignisses dieser Kennzahl. Davor, und solange noch kein
            Produktiv-Ereignis vorliegt, steht {MEASURE_NOT_MEASURED_LABEL}. Es wird nichts nachgetragen. Suche,
            unklar, Bezahlt, Direkt und Unbekannt sind die Standardzählung. Testläufe stehen nur in der Spalte
            Tests.
          </p>
          <p>
            Ein Fragebogen-Start ist das erste erfolgreiche Anlegen eines Entwurfs je Entwurfsschlüssel. Weitere
            automatische Speicherungen desselben Entwurfs zählen nicht. „Erster erfolgreicher Magic-Link-Login
            (neues Konto)“ ist die erste erfolgreiche Anmeldung über den Anmeldelink, nicht eine gesonderte
            Registrierung. Ein Stripe-Kunde ohne diese Anmeldung zählt nicht. Der Ampel-Start ist die Anzeige von
            Frage 1. Antworten zählen je Frage. Das Ergebnis zählt, wenn es angezeigt wird oder der Versand mit ok
            oder pending_ok bestätigt wird. Ein Neuladen kann den Ampel-Start erneut zählen, weil dafür kein Cookie
            gesetzt wird.
          </p>
          <p>
            Jede Klasse ist der {MEASURE_CHANNEL_BASIS_LABEL}, nicht die Herkunft eines früheren Besuchs. Bezahlt
            gilt nur, wenn dieselbe Anfrage utm_medium cpc oder paid trägt oder eine Klickkennung (gclid, gbraid,
            wbraid) enthält. Der Wert der Klickkennung wird nicht gespeichert. Ein Suchmaschinen-Referrer ohne
            dieses Signal ist „Suche, unklar“: organisch oder bezahlt ist daran nicht unterscheidbar, auch nicht
            bei Google und auch nicht bei anderen Suchmaschinen. Eine sichere organische Klasse gibt es nicht.
            Direkt ist kein Referrer und kein utm-Parameter. Alles andere ist unbekannt. Die Klasse wird nicht im
            Browser gespeichert.
          </p>
          <p>
            Testläufe sind die Adressen gobd-test@mail.grokbot.com, gobd-test+…@mail.grokbot.com, Adressen
            @resend.dev und cappe@gmx.de, ein Referrer von grokbot.com und der Zusatz ?gobd_test=1 auf der Seite
            des Ereignisses. Der Zusatz kann einen Vorgang nur in die Testzählung schieben. Eine IP- oder
            Browser-Allowlist ist nicht hinterlegt. Ein allgemeiner Bot-Hinweis zählt nicht als Test. Außerhalb
            der Produktion wird nichts in die Produktiv-Tabelle geschrieben.
          </p>
          {report.hasRows ? null : <p>Im gemessenen Zeitraum ist noch kein Vorgang gespeichert.</p>}
          <RequestChannelNote metric="intake_start" />
          <DayTable metric={intake} />
          <RequestChannelNote metric="magic_link_first_login" />
          <DayTable metric={accounts} />
          <DayTable metric={start} />
          <DayTable metric={answers} />
          <AnswerTable metric={answers} />
          <DayTable metric={result} />
        </>
      ) : null}
    </section>
  );
}
