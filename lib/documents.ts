import { queryIdsEqual } from "@/lib/query";
import { emailsEqual, type SheetRow } from "@/lib/types";

export type DocumentAccess = {
  sessionEmail?: string | null;
  sessionId?: string | null;
};

export type DocumentFamily = {
  familyId: string;
  latest: SheetRow;
  versions: SheetRow[];
};

/** Root id for a version family. Empty parent (Slice A+B rows) means the row is the root. */
export function documentFamilyId(
  row: Pick<SheetRow, "documentId" | "parentDocumentId">,
): string {
  return (row.parentDocumentId || row.documentId).trim();
}

export function parseDocumentVersion(row: Pick<SheetRow, "version">): number {
  const n = Number.parseInt(String(row.version || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function nextVersionNumber(rows: Pick<SheetRow, "version">[]): number {
  if (rows.length === 0) return 1;
  return Math.max(...rows.map(parseDocumentVersion)) + 1;
}

export function canAccessDocument(
  row: Pick<SheetRow, "email" | "stripeSessionId">,
  access: DocumentAccess,
): boolean {
  const email = access.sessionEmail?.trim() ?? "";
  if (email && emailsEqual(email, row.email)) {
    return true;
  }
  const sessionId = access.sessionId ?? "";
  if (sessionId && row.stripeSessionId && queryIdsEqual(sessionId, row.stripeSessionId)) {
    return true;
  }
  return false;
}

export function rowsInFamily(rows: SheetRow[], documentId: string): SheetRow[] {
  if (!documentId) return [];
  const seed = rows.filter((row) => row.documentId === documentId).at(-1);
  if (!seed) return [];
  const id = documentFamilyId(seed);
  return rows.filter(
    (row) =>
      Boolean(row.documentId) &&
      (row.documentId === id || documentFamilyId(row) === id),
  );
}

export function groupDocumentFamilies(rows: SheetRow[]): DocumentFamily[] {
  const map = new Map<string, SheetRow[]>();
  for (const row of rows) {
    if (!row.documentId) continue;
    const id = documentFamilyId(row);
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }

  const families: DocumentFamily[] = [];
  for (const [familyId, members] of map) {
    const versions = [...members].sort((a, b) => {
      const versionDiff = parseDocumentVersion(b) - parseDocumentVersion(a);
      if (versionDiff !== 0) return versionDiff;
      return b.timestamp.localeCompare(a.timestamp);
    });
    const latest = versions[0];
    if (!latest) continue;
    families.push({ familyId, latest, versions });
  }

  families.sort((a, b) => b.latest.timestamp.localeCompare(a.latest.timestamp));
  return families;
}

export function documentDownloadPath(
  row: Pick<SheetRow, "documentId">,
  sessionId?: string,
): string {
  const base = `/api/docs/${row.documentId}/download`;
  if (!sessionId) return base;
  return `${base}?session_id=${encodeURIComponent(sessionId)}`;
}

export function intakeEditPath(
  row: Pick<SheetRow, "documentId" | "stripeSessionId">,
  sessionId?: string,
): string {
  const params = new URLSearchParams({ document_id: row.documentId });
  const sid = (sessionId || row.stripeSessionId).trim();
  if (sid) params.set("session_id", sid);
  return `/intake?${params}`;
}

export function formatDocumentTime(timestamp: string): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString("de-DE");
}
