import Link from "next/link";
import { formatSvDate } from "@/lib/schnellversion-copy";
import { creditHintVisible } from "@/lib/schnellversion-credit";
import { anrechnungBis, downloadStillOpen, type SvPurchase } from "@/lib/schnellversion-record";

export function SchnellversionKonto({ rows }: { rows: SvPurchase[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="card" style={{ margin: "16px 0" }}>
      <h2>Standardfassung</h2>
      {rows.map((row) => {
        const open = downloadStillOpen(row, new Date());
        const until = formatSvDate(anrechnungBis(row.purchasedAt));
        return (
          <div key={row.id} style={{ marginTop: 12 }}>
            <p>
              <strong>{row.company}</strong>
            </p>
            {open ? (
              <>
                <p>Ihre Standardfassung steht zum Download bereit.</p>
                <p>
                  <a className="btn" href={`/api/schnellversion/konto/download?id=${encodeURIComponent(row.id)}`}>
                    PDF herunterladen
                  </a>
                </p>
                <p className="hint">Download 30 Tage im Konto. Bitte speichern Sie das PDF selbst.</p>
                {creditHintVisible(row, row.company, new Date()) ? (
                  <p className="hint">
                    Bis zum {until} rechnen wir die 49 € an.{" "}
                    <Link href="/checkout">Fragebogen fortsetzen</Link>
                  </p>
                ) : (
                  <p className="hint">
                    <Link href="/checkout">Fragebogen fortsetzen</Link>
                  </p>
                )}
              </>
            ) : (
              <>
                <p>Der Download ist gesperrt. Die Anrechnung der 49 € ist beendet.</p>
                <p>
                  <Link href="/checkout">Zur Verfahrensdokumentation</Link>
                </p>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
