import Link from "next/link";
import {
  customerChangedBy,
  customerChangeSummary,
} from "@/lib/account-display";
import {
  documentDownloadPath,
  documentEditPath,
  intakeEditPath,
} from "@/lib/documents";
import type { SheetRow } from "@/lib/types";
import {
  CURRENT_VERSION_RULE,
  berlinTodayIso,
  currentVersionBadge,
  formatValidityRange,
  selectCurrentVersion,
  versionLabelFromRow,
  versionNumber,
} from "@/lib/versioning";

export function DocumentRevisionActions({
  row,
  sessionId,
  showDownload = true,
  showAccountLink = false,
  downloadLabel = "PDF herunterladen",
}: {
  row: Pick<SheetRow, "documentId" | "stripeSessionId">;
  sessionId?: string;
  showDownload?: boolean;
  showAccountLink?: boolean;
  downloadLabel?: string;
}) {
  const editHref = intakeEditPath(row, sessionId);
  const documentHref = documentEditPath(row);

  return (
    <>
      <div className="actions" style={{ marginTop: 12 }}>
        {showDownload && (
          <a className="btn" href={documentDownloadPath(row, sessionId)}>
            {downloadLabel}
          </a>
        )}
        <Link className="btn" href={editHref}>
          Angaben überarbeiten
        </Link>
        <Link className="btn ghost" href={documentHref}>
          Dokument bearbeiten
        </Link>
        <Link className="btn ghost" href={editHref}>
          Neue PDF-Version erzeugen
        </Link>
        {showAccountLink && (
          <Link className="btn ghost" href="/account">
            Zum Konto
          </Link>
        )}
      </div>
      <p className="hint revision-hint">
        „Angaben überarbeiten“ ändert die Intake-Antworten. „Dokument
        bearbeiten“ ändert den Kapiteltext des Entwurfs. Beides erzeugt die
        nächste PDF-Version — bisherige Downloads bleiben.
      </p>
    </>
  );
}

export function VersionHistory({
  versions,
  sessionId,
  headingId = "versionshistorie",
}: {
  versions: SheetRow[];
  sessionId?: string;
  headingId?: string;
}) {
  const current = selectCurrentVersion(versions, berlinTodayIso());
  const ordered = [...versions].sort((a, b) => {
    const diff = versionNumber(b) - versionNumber(a);
    if (diff !== 0) return diff;
    return b.timestamp.localeCompare(a.timestamp);
  });

  return (
    <section className="version-history" aria-labelledby={headingId}>
      <h3 className="version-heading" id={headingId}>
        Versionshistorie
      </h3>
      <p className="version-hint">{CURRENT_VERSION_RULE}</p>
      {versions.length <= 1 && (
        <p className="version-hint">
          Nach dem Überarbeiten erscheint hier Version 2.0.
        </p>
      )}
      {versions.length > 0 && (
        <ul className="version-list">
          {ordered.map((row) => {
            const isCurrent = current?.row.documentId === row.documentId;
            const summary = customerChangeSummary(row.changeSummary);
            const who = customerChangedBy(row.changedBy);
            return (
              <li key={row.documentId}>
                <div className="version-copy">
                  <span className="version-line">
                    Version {versionLabelFromRow(row)}
                    {isCurrent && (
                      <span className="version-badge">
                        {currentVersionBadge(current.fallback)}
                      </span>
                    )}
                  </span>
                  <span className="version-detail">
                    Gültig {formatValidityRange(row, versions)} · {summary} ·{" "}
                    {who}
                  </span>
                </div>
                <a href={documentDownloadPath(row, sessionId)}>Download</a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
