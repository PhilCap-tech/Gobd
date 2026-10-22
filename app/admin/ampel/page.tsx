import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { isAmpelAdminEmail } from "@/lib/ampel-admin";
import { ampelStatsError } from "@/lib/ampel-admin-http";
import {
  AMPEL_STEP_RESULT_STATUSES,
  ampelStepDeviceLabel,
  ampelStepFilterVariant,
  buildAmpelStepReport,
  formatAmpelStepDay,
  formatAmpelStepDrop,
  type AmpelStepReport,
} from "@/lib/ampel-step-event";
import { readAmpelStepRows } from "@/lib/ampel-step-store";
import { HOME_CTA_LABELS, buildHomeCtaReport, type HomeCtaReport } from "@/lib/home-cta-event";
import { readHomeCtaRows } from "@/lib/home-cta-store";
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

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function StepsTable({ report }: { report: AmpelStepReport }) {
  const days = [...report.days, report.total];
  return (
    <>
      <div className="ampel-admin-table-wrap">
        <table className="ampel-admin-table">
          <caption>Tageswerte</caption>
          <thead>
            <tr>
              <th>Tag</th>
              <th>Gerät</th>
              <th>Pageview</th>
              <th>E-Mail</th>
              <th>Absenden gültig</th>
              <th>Absenden ungültig</th>
              {AMPEL_STEP_RESULT_STATUSES.map((status) => (
                <th key={status}>Ergebnis {status === "timeout" ? "Timeout" : status}</th>
              ))}
              <th>Hinweis angenommen</th>
              <th>Hinweis abgelehnt</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) =>
              day.devices.map((device) => (
                <tr key={`${day.date}:${device.device}`}>
                  <td>{device.device === "gesamt" ? formatAmpelStepDay(day.date) : ""}</td>
                  <td>{ampelStepDeviceLabel(device.device)}</td>
                  <td>{device.pageview}</td>
                  <td>{device.emailView}</td>
                  <td>{device.submitValid}</td>
                  <td>{device.submitInvalid}</td>
                  {AMPEL_STEP_RESULT_STATUSES.map((status) => (
                    <td key={status}>{device.results[status]}</td>
                  ))}
                  <td>{device.consentAccept}</td>
                  <td>{device.consentReject}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <div className="ampel-admin-table-wrap">
        <table className="ampel-admin-table">
          <caption>Abbruch je Frage gegenüber der vorherigen Anzeige</caption>
          <thead>
            <tr>
              <th>Tag</th>
              <th>Frage</th>
              <th>Angezeigt</th>
              <th>Angezeigt Mobil</th>
              <th>Angezeigt Desktop</th>
              <th>Beantwortet</th>
              <th>Beantwortet Mobil</th>
              <th>Beantwortet Desktop</th>
              <th>Abbruch</th>
              <th>Abbruch Mobil</th>
              <th>Abbruch Desktop</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) =>
              day.questions.map((question) => (
                <tr key={`${day.date}:${question.n}`}>
                  <td>{question.n === 1 ? formatAmpelStepDay(day.date) : ""}</td>
                  <td>{question.n}</td>
                  <td>{question.viewed}</td>
                  <td>{question.viewedMobile}</td>
                  <td>{question.viewedDesktop}</td>
                  <td>{question.answered}</td>
                  <td>{question.answeredMobile}</td>
                  <td>{question.answeredDesktop}</td>
                  <td>{formatAmpelStepDrop(question.dropPct)}</td>
                  <td>{formatAmpelStepDrop(question.dropPctMobile)}</td>
                  <td>{formatAmpelStepDrop(question.dropPctDesktop)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StepsSection({
  report,
  configured,
  failed,
  testsOn,
}: {
  report: AmpelStepReport | null;
  configured: boolean;
  failed: boolean;
  testsOn: boolean;
}) {
  return (
    <section className="ampel-steps">
      <h2>Schritte (letzte 14 Tage)</h2>
      {failed ? (
        <p className="error">Die Schritte konnten nicht geladen werden. Bitte laden Sie die Seite später erneut.</p>
      ) : !configured ? (
        <p>Die Schrittstatistik ist in dieser Umgebung nicht eingerichtet.</p>
      ) : report ? (
        <>
          <p>
            Sie sehen die Schritte der letzten 14 Tage nach dem Kalendertag in Europe/Berlin. Pageview ist die Anzeige
            von Frage 1. Die letzte Zeile ist die Summe. Mobil und Desktop sind getrennt ausgewiesen.
          </p>
          <form className="ampel-step-filter" method="get">
            {testsOn ? <input type="hidden" name="tests" value="1" /> : null}
            <label htmlFor="ampel-step-variant">Variante</label>
            <select id="ampel-step-variant" name="v" defaultValue={report.variant}>
              <option value="">Alle</option>
              {report.variants.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button className="btn ghost" type="submit">
              Anzeigen
            </button>
          </form>
          {report.hasRows ? null : <p>In den letzten 14 Tagen ist noch kein Schritt gespeichert.</p>}
          <StepsTable report={report} />
        </>
      ) : null}
    </section>
  );
}

function HomeCtaTable({ report }: { report: HomeCtaReport }) {
  const days = [...report.days, report.total];
  return (
    <div className="ampel-admin-table-wrap">
      <table className="ampel-admin-table">
        <caption>Tag, CTA und Gerät</caption>
        <thead>
          <tr>
            <th>Tag</th>
            <th>CTA</th>
            <th>Mobil</th>
            <th>Desktop</th>
            <th>Gesamt</th>
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
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function HomeCtaSection({
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
            Sie sehen die Klicks der letzten 14 Tage nach dem Kalendertag in Europe/Berlin. Der Seitenaufruf zählt
            jedes Laden der Startseite. Mobil und Desktop sind getrennt ausgewiesen. Die letzte Zeile ist die Summe.
          </p>
          {report.hasRows ? null : <p>In den letzten 14 Tagen ist noch kein Eintrag gespeichert.</p>}
          <HomeCtaTable report={report} />
        </>
      ) : null}
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
          {report.includeTests ? "Test- und interne Adressen ausblenden" : "Test- und interne Adressen einblenden"}
        </a>
      </p>
      <p>
        {report.includeTests
          ? "Test- und interne Adressen sind in der Liste markiert."
          : "Test- und interne Adressen sind in der Liste ausgeblendet. Die Zähler oben bleiben vollständig."}
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
                  <td>{entry.note}</td>
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
  searchParams: Promise<{ tests?: string | string[]; v?: string | string[] }>;
}) {
  const email = await getSessionEmail();
  if (!isAmpelAdminEmail(email)) notFound();

  const params = await searchParams;
  const tests = firstParam(params.tests);
  const variant = ampelStepFilterVariant(firstParam(params.v));
  let report: AmpelStatsReport | null = null;
  let failure = "";
  try {
    const rows = await listAmpelLeads();
    report = buildAmpelStats(rows, { includeTests: tests === "1" });
  } catch (error) {
    failure = ampelStatsError(error).message;
  }

  let steps: AmpelStepReport | null = null;
  let stepsConfigured = false;
  let stepsFailed = false;
  try {
    const loaded = await readAmpelStepRows();
    stepsConfigured = loaded.configured;
    if (loaded.configured) {
      steps = buildAmpelStepReport(loaded.rows, { now: new Date(), variant });
    }
  } catch {
    stepsFailed = true;
  }

  let homeCta: HomeCtaReport | null = null;
  let homeCtaConfigured = false;
  let homeCtaFailed = false;
  try {
    const loaded = await readHomeCtaRows();
    homeCtaConfigured = loaded.configured;
    if (loaded.configured) {
      homeCta = buildHomeCtaReport(loaded.rows, { now: new Date() });
    }
  } catch {
    homeCtaFailed = true;
  }

  return (
    <main className="wrap page ampel-admin">
      <h1>Ampel-Check Auswertung</h1>
      <p className="lead">
        Hier sehen Sie die gespeicherten Ampel-Checks. Heute und die letzten 7 Tage gelten nach dem Kalendertag in Europe/Berlin.
      </p>
      {failure ? <p className="error">{failure}</p> : report ? <Report report={report} /> : null}
      <StepsSection report={steps} configured={stepsConfigured} failed={stepsFailed} testsOn={tests === "1"} />
      <HomeCtaSection report={homeCta} configured={homeCtaConfigured} failed={homeCtaFailed} />
    </main>
  );
}
