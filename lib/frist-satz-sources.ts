/**
 * Read-only sources for the outdated-sentence count.
 * Lists draft JSON and intake rows. Resolves answer or chapter JSON per
 * version. Opens a PDF only when that version has neither.
 * Does not write, delete, or generate a file.
 */
import { get, list } from "@vercel/blob";
import { chapterContentLocator } from "@/lib/document-content";
import { rowHasStoredDocument } from "@/lib/documents";
import { isBlobConfigured, isSheetsConfigured } from "@/lib/env";
import { readStoredPdfBytes, resolveChapterContent, resolveIntakePayload } from "@/lib/blob";
import { intakePayloadLocator } from "@/lib/intake-payload";
import { logError } from "@/lib/log-error";
import { orderedPageTexts, pageTexts } from "@/scripts/pdf-text";
import { runWithSheetsRoute } from "@/lib/sheets-outage";
import { readIntakeRowsSnapshot } from "@/lib/store";
import type { SheetRow } from "@/lib/types";
import type { DraftListResult, FristSatzIo, VersionListResult, VersionRef } from "@/lib/frist-satz";

const DRAFT_PREFIX = "gobd/drafts/";
const MAX_PDF_BYTES = 20_000_000;

type BlobList = (options: {
  prefix?: string;
  cursor?: string;
  limit?: number;
  token?: string;
}) => Promise<{
  blobs: Array<{ pathname?: string }>;
  hasMore?: boolean;
  cursor?: string;
}>;

type BlobGet = (
  pathname: string,
  options: { access: "private"; token?: string; useCache?: boolean },
) => Promise<{
  statusCode?: number;
  stream?: ReadableStream<Uint8Array> | null;
} | null>;

export type FristSatzSourceDeps = {
  blobConfigured?: () => boolean;
  sheetsConfigured?: () => boolean;
  token?: () => string;
  list?: BlobList;
  get?: BlobGet;
  readRows?: () => Promise<SheetRow[]>;
  readAnswers?: (raw: string) => Promise<string>;
  readChapters?: (raw: string) => Promise<string>;
  readPdf?: (pdfUrl: string) => Promise<Buffer | null>;
};

export function pdfKitPlainText(buffer: Buffer): string {
  const ordered = orderedPageTexts(buffer).filter((part) => part.trim());
  if (ordered.length > 0) return ordered.join("\n\n");
  return pageTexts(buffer)
    .filter((part) => part.trim())
    .join("\n\n");
}

function safeDraftPath(pathname: string): boolean {
  return pathname.startsWith(DRAFT_PREFIX) && pathname.endsWith(".json") && !pathname.includes("..");
}

export function createFristSatzIo(deps: FristSatzSourceDeps = {}): FristSatzIo {
  const blobConfigured = deps.blobConfigured ?? isBlobConfigured;
  const sheetsConfigured = deps.sheetsConfigured ?? isSheetsConfigured;
  const token = deps.token ?? (() => process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "");
  const listBlobs = deps.list ?? list;
  const getBlob = deps.get ?? ((pathname, options) => get(pathname, options));
  const readRows = deps.readRows ?? (() => runWithSheetsRoute("frist-satz", () => readIntakeRowsSnapshot()));
  const readAnswers = deps.readAnswers ?? ((raw) => resolveIntakePayload(raw));
  const readChapters = deps.readChapters ?? ((raw) => resolveChapterContent(raw));
  const readPdfBytes = deps.readPdf ?? ((pdfUrl) => readStoredPdfBytes(pdfUrl));

  let rowsPromise: Promise<SheetRow[]> | null = null;

  async function listDrafts(cursor: string | undefined, limit: number): Promise<DraftListResult> {
    if (!blobConfigured() || !token()) return { unavailable: true };
    try {
      const result = await listBlobs({
        prefix: DRAFT_PREFIX,
        cursor,
        limit,
        token: token(),
      });
      const pathnames: string[] = [];
      for (const blob of result.blobs) {
        const pathname = (blob.pathname ?? "").replace(/^\/+/, "");
        if (!safeDraftPath(pathname)) continue;
        pathnames.push(pathname);
      }
      const nextCursor = result.hasMore && result.cursor ? result.cursor : undefined;
      return nextCursor ? { pathnames, nextCursor } : { pathnames };
    } catch (error) {
      logError("[frist-satz] Entwürfe", error);
      return { paused: true };
    }
  }

  async function readDraft(pathname: string): Promise<unknown | null> {
    if (!safeDraftPath(pathname) || !token()) return null;
    try {
      const result = await getBlob(pathname, { access: "private", token: token(), useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      const text = await new Response(result.stream).text();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    } catch (error) {
      logError("[frist-satz] Entwurf", error);
      return null;
    }
  }

  async function readStructured(row: SheetRow): Promise<string[] | null> {
    try {
      const texts: string[] = [];
      const answers = row.fragen.trim();
      const chapters = row.chapterContent.trim();
      if (answers) {
        texts.push(intakePayloadLocator(answers) ? await readAnswers(answers) : answers);
      }
      if (chapters) {
        texts.push(chapterContentLocator(chapters) ? await readChapters(chapters) : chapters);
      }
      if (texts.length === 0 || texts.every((text) => !text.trim())) return null;
      return texts;
    } catch (error) {
      logError("[frist-satz] Text", error);
      return null;
    }
  }

  async function readPdf(row: SheetRow): Promise<string | null> {
    const pdfUrl = row.pdfUrl.trim();
    if (!pdfUrl) return "";
    try {
      const bytes = await readPdfBytes(pdfUrl);
      if (!bytes || bytes.length === 0 || bytes.length > MAX_PDF_BYTES) return null;
      const text = pdfKitPlainText(bytes);
      return text.trim() ? text : null;
    } catch (error) {
      logError("[frist-satz] PDF", error);
      return null;
    }
  }

  function versionRef(row: SheetRow): VersionRef {
    const hasStructured = Boolean(row.fragen.trim() || row.chapterContent.trim());
    return {
      email: row.email,
      entityId: row.entityId,
      hasStructured,
      readStructured: () => readStructured(row),
      readPdf: () => readPdf(row),
    };
  }

  async function loadVersions(offset: number, limit: number): Promise<VersionListResult> {
    if (!sheetsConfigured()) return { unavailable: true };
    let rows: SheetRow[];
    try {
      if (!rowsPromise) rowsPromise = readRows();
      rows = await rowsPromise;
    } catch (error) {
      rowsPromise = null;
      logError("[frist-satz] Zeilen", error);
      return { paused: true };
    }
    const docs = rows.filter((row) => rowHasStoredDocument(row));
    const start = offset > 0 ? offset : 0;
    const slice = docs.slice(start, start + limit);
    return {
      items: slice.map(versionRef),
      done: start + slice.length >= docs.length,
    };
  }

  return { listDrafts, readDraft, loadVersions };
}
