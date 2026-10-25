import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ampelStepDate } from "@/lib/ampel-step-event";
import { verifyKanzleiReportToken } from "@/lib/kanzlei-toolbox-token";
import { findKanzleiById, kanzleiMonthReport, readKanzleiToolbox } from "@/lib/kanzlei-toolbox-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kanzlei-Bericht",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function monthOf(date: Date): string {
  return ampelStepDate(date).slice(0, 7);
}

export default async function KanzleiReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = first((await searchParams).token);
  const kanzleiId = token ? verifyKanzleiReportToken(token) : null;
  const file = kanzleiId ? await readKanzleiToolbox() : null;
  const record = file && kanzleiId ? findKanzleiById(file, kanzleiId) : null;
  const now = new Date();
  const previous = new Date(now);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const current = file && record ? kanzleiMonthReport(file, record.kanzleiId, monthOf(now)) : null;
  const last = file && record ? kanzleiMonthReport(file, record.kanzleiId, monthOf(previous)) : null;
  return (
    <>
      <SiteHeader backHref="/steuerberater#toolbox" backLabel="← Zur Kanzlei-Seite" />
      <main className="wrap page">
        <h1>Bericht mit Zahlen</h1>
        {!record || record.status === "removed" || record.status === "blocked" ? (
          <p>Dieser Bericht ist nicht verfügbar.</p>
        ) : !record.reportOptIn ? (
          <p>Sie haben den monatlichen Bericht nicht angefordert. Käufe und Ergebnisse sind darin nicht enthalten.</p>
        ) : (
          <>
            <p>
              Zusammengefasste Zahlen zu Ihrem Link: Aufrufe, gestartete Checks und abgeschlossene Checks. Werte unter 5
              stehen hier als „unter 5“. Käufe, Ampelfarben und Angaben zu einzelnen Personen sind nicht enthalten.
            </p>
            {[current, last].map((report) =>
              report ? (
                <section key={report.month}>
                  <h2>{report.month}</h2>
                  <ul>
                    <li>Aufrufe: {report.calls}</li>
                    <li>Gestartet: {report.starts}</li>
                    <li>Abgeschlossen: {report.completes}</li>
                  </ul>
                </section>
              ) : null,
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
