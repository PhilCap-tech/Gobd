import Link from "next/link";
import {
  documentDownloadPath,
  documentEditPath,
  formatDocumentTime,
  intakeEditPath,
  parseDocumentVersion,
} from "@/lib/documents";
import type { SheetRow } from "@/lib/types";

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
            Meine Dokumente
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
}: {
  versions: SheetRow[];
  sessionId?: string;
}) {
  return (
    <section className="version-history" aria-labelledby="versionshistorie">
      <h3 className="version-heading" id="versionshistorie">
        Versionshistorie
      </h3>
      {versions.length <= 1 && (
        <p className="version-hint">
          Nach dem Überarbeiten erscheint hier Version 2.
        </p>
      )}
      {versions.length > 0 && (
        <ul className="version-list">
          {versions.map((row) => (
            <li key={row.documentId}>
              <span>
                Version {parseDocumentVersion(row)} ·{" "}
                {formatDocumentTime(row.timestamp)}
              </span>
              <a href={documentDownloadPath(row, sessionId)}>Download</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
