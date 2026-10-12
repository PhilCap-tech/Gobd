import { blobPathFromLocator } from "@/lib/blob-ref";
import {
  devCheckoutStubAllowed,
  isStubCheckoutSessionId,
} from "@/lib/checkout-stub";
import type { Entity } from "@/lib/entities";
import { normalizeQueryId, queryIdsEqual } from "@/lib/query";
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

export type EntityDocumentGroup = {
  entity: Entity | null;
  families: DocumentFamily[];
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
  const sessionId = (access.sessionId ?? "").trim();
  if (!sessionId || !row.stripeSessionId) return false;
  // Stub-IDs (`mock_…`) sind in Produktion kein Besitznachweis, auch wenn sie
  // auf der Zeile stehen. Echte Checkout-Session-IDs bleiben ein Bearer.
  if (
    !devCheckoutStubAllowed() &&
    (isStubCheckoutSessionId(sessionId) ||
      isStubCheckoutSessionId(row.stripeSessionId))
  ) {
    return false;
  }
  return queryIdsEqual(sessionId, row.stripeSessionId);
}

function compactDocumentId(value: string): string {
  return normalizeQueryId(value).replace(/[\s\u200B-\u200D\uFEFF]+/g, "").toLowerCase();
}

function documentIdsEqual(a: string, b: string): boolean {
  const left = compactDocumentId(a);
  const right = compactDocumentId(b);
  return Boolean(left) && left === right;
}

/** Family id from `gobd/<id>/v1.pdf`. Uploads and other objects do not match. */
export function pdfFamilyId(pdfUrl: string): string {
  const path = blobPathFromLocator(pdfUrl);
  if (!path) return "";
  const match = /^gobd\/([^/]+)\/v\d+\.pdf$/i.exec(path);
  const id = match?.[1] ?? "";
  if (!id || id === "uploads" || id.includes("..")) return "";
  return id;
}

/**
 * Fill an empty document id from the PDF key the server wrote
 * (`gobd/<id>/vN.pdf`). A parent id is not copied: another row can name it.
 */
export function recoverStoredDocumentId(row: SheetRow): SheetRow {
  if (row.documentId.trim()) return row;
  const fromPdf = pdfFamilyId(row.pdfUrl);
  if (!fromPdf) return row;
  return {
    ...row,
    documentId: fromPdf,
    parentDocumentId: row.parentDocumentId.trim() || fromPdf,
  };
}

/** A submitted Verfahrensdokumentation, not a paid checkout row without a file. */
export function rowHasStoredDocument(
  row: Pick<SheetRow, "documentId" | "parentDocumentId" | "pdfUrl">,
): boolean {
  return Boolean(row.documentId.trim() || pdfFamilyId(row.pdfUrl));
}

/**
 * The row is this document. Exact document id wins over a shared parent.
 * A self-parent (document id equals parent id) is an exact match.
 */
export function pickStoredDocument(
  rows: readonly SheetRow[],
  documentId: string,
): SheetRow | null {
  const id = compactDocumentId(documentId);
  if (!id) return null;
  const prepared = rows.map(recoverStoredDocumentId);
  const exact = prepared.filter((row) => documentIdsEqual(row.documentId, id));
  if (exact.length > 0) return exact.at(-1) ?? null;
  const byPdf = prepared.filter((row) => documentIdsEqual(pdfFamilyId(row.pdfUrl), id));
  if (byPdf.length > 0) return byPdf.at(-1) ?? null;
  const byParent = prepared.filter((row) => documentIdsEqual(row.parentDocumentId, id));
  return byParent.at(-1) ?? null;
}

export function rowsInFamily(rows: SheetRow[], documentId: string): SheetRow[] {
  if (!compactDocumentId(documentId)) return [];
  const seed = rows.filter((row) => documentIdsEqual(row.documentId, documentId)).at(-1);
  if (!seed) return [];
  const id = documentFamilyId(seed);
  return rows.filter(
    (row) =>
      Boolean(row.documentId) &&
      (documentIdsEqual(row.documentId, id) || documentIdsEqual(documentFamilyId(row), id)),
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
    // Highest version number, then newest timestamp. This is the revision to
    // edit — not “Aktuell”. Validity (Gültig von–bis) is selectCurrentVersion
    // in lib/versioning.ts.
    const versions = [...members].sort((a, b) => {
      const versionDiff = parseDocumentVersion(b) - parseDocumentVersion(a);
      if (versionDiff !== 0) return versionDiff;
      const left = typeof b.timestamp === "string" ? b.timestamp : "";
      const right = typeof a.timestamp === "string" ? a.timestamp : "";
      return left.localeCompare(right);
    });
    const latest = versions[0];
    if (!latest) continue;
    families.push({ familyId, latest, versions });
  }

  families.sort((a, b) => {
    const left = typeof b.latest.timestamp === "string" ? b.latest.timestamp : "";
    const right = typeof a.latest.timestamp === "string" ? a.latest.timestamp : "";
    return left.localeCompare(right);
  });
  return families;
}

/**
 * Highest version, then newest timestamp, among rows whose email matches.
 * A row from another mailbox in the same parent group is not an edit target.
 */
export function latestOwnedInFamily(rows: SheetRow[], email: string): SheetRow | null {
  const owner = email.trim();
  if (!owner) return null;
  const owned = rows.filter((row) => row.documentId && emailsEqual(row.email, owner));
  if (owned.length === 0) return null;
  return groupDocumentFamilies(owned)[0]?.latest ?? null;
}

export function groupFamiliesByEntity(
  entities: Entity[],
  docs: SheetRow[],
): EntityDocumentGroup[] {
  const families = groupDocumentFamilies(docs);
  const knownIds = new Set(entities.map((entity) => entity.entityId));
  const byEntity = new Map<string, DocumentFamily[]>();
  const unbound: DocumentFamily[] = [];

  for (const family of families) {
    const entityId = family.latest.entityId.trim();
    if (!entityId || !knownIds.has(entityId)) {
      unbound.push(family);
      continue;
    }
    const list = byEntity.get(entityId) ?? [];
    list.push(family);
    byEntity.set(entityId, list);
  }

  const groups: EntityDocumentGroup[] = entities.map((entity) => ({
    entity,
    families: byEntity.get(entity.entityId) ?? [],
  }));

  if (unbound.length > 0) {
    groups.push({ entity: null, families: unbound });
  }

  return groups;
}

export function documentDownloadPath(
  row: Pick<SheetRow, "documentId">,
  sessionId?: string,
): string {
  const base = `/api/docs/${row.documentId}/download`;
  if (!sessionId) return base;
  return `${base}?session_id=${encodeURIComponent(sessionId)}`;
}

function pathText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function intakeEditPath(
  row: Pick<SheetRow, "documentId" | "stripeSessionId">,
  sessionId?: string,
): string {
  const params = new URLSearchParams();
  const documentId = pathText(row.documentId);
  if (documentId) params.set("document_id", documentId);
  const sid = pathText(sessionId || row.stripeSessionId);
  if (sid) params.set("session_id", sid);
  return `/intake?${params}`;
}

export function documentEditPath(
  row: Pick<SheetRow, "documentId">,
): string {
  return `/account/dokument/${encodeURIComponent(pathText(row.documentId))}`;
}

export function firmaEditPath(entityId: string): string {
  return `/account/firma/${encodeURIComponent(pathText(entityId))}`;
}

export function newDocumentPath(entityId?: string): string {
  const id = entityId?.trim() ?? "";
  if (!id) return "/checkout";
  return `/checkout?entity_id=${encodeURIComponent(id)}`;
}

export function formatDocumentTime(timestamp: string): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString("de-DE");
}
