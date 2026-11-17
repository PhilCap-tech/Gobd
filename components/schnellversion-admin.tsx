import { evaluateSvEvents, SV_CONV99_ABORT_SHARE, SV_MIN_PURCHASES, SV_MIN_VISITORS_PER_ARM, SV_RPV_ABORT_SHARE } from "@/lib/schnellversion-events";
import { readSvEvents } from "@/lib/schnellversion-store";

function euro(value: number | null): string {
  if (value === null) return "–";
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number | null): string {
  if (value === null) return "–";
  return `${(value * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

/** Auswertung der Schwellen. Schaltet das Angebot nicht ab. */
export function SchnellversionAdminSection() {
  const report = evaluateSvEvents(readSvEvents());
  return (
    <section className="card ampel-admin-count">
      <h2>Schnellversion 49 €</h2>
      <p>
        Aufrufe der Startseite je Arm, nachdem eine Einwilligung für die Auswertung vorliegt. Umsatz ist die Summe der
        gemeldeten Nettowerte (49 €, 99 €, Upgrade). Die Schwellen werden nur angezeigt. Es wird nichts abgeschaltet.
      </p>
      <p>
        Mindestmenge: je Arm {SV_MIN_VISITORS_PER_ARM.toLocaleString("de-DE")} Aufrufe und insgesamt {SV_MIN_PURCHASES}{" "}
        Käufe (49 € und 99 €). Ab dann: Umsatz je Aufruf im Test mehr als {Math.round(SV_RPV_ABORT_SHARE * 100)} % unter
        der Kontrolle, oder 99-€-Käufe je Aufruf mehr als {Math.round(SV_CONV99_ABORT_SHARE * 100)} % unter der Kontrolle,
        ohne dass der Umsatz je Aufruf steigt.
      </p>
      <p>{report.minReached ? "Die Mindestmenge liegt vor." : "Die Mindestmenge liegt noch nicht vor."}</p>
      <div className="ampel-admin-table-wrap">
        <table className="ampel-admin-table">
          <thead>
            <tr>
              <th>Arm</th>
              <th>Aufrufe</th>
              <th>Umsatz netto</th>
              <th>Umsatz je Aufruf</th>
              <th>Käufe 49 €</th>
              <th>Käufe 99 €</th>
              <th>99 € je Aufruf</th>
            </tr>
          </thead>
          <tbody>
            {(["control", "test"] as const).map((arm) => {
              const stat = report[arm];
              return (
                <tr key={arm}>
                  <td>{arm === "control" ? "Kontrolle" : "Test"}</td>
                  <td>{stat.visitors}</td>
                  <td>{euro(stat.revenueNet)} €</td>
                  <td>{euro(stat.rpv)} €</td>
                  <td>{stat.purchases49}</td>
                  <td>{stat.purchases99}</td>
                  <td>{percent(stat.conv99)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Schwelle Umsatz je Aufruf: {report.rpvAbort ? "unterschritten" : "nicht unterschritten"}. Schwelle 99-€-Käufe:{" "}
        {report.conv99Abort ? "unterschritten" : "nicht unterschritten"}.
      </p>
    </section>
  );
}
