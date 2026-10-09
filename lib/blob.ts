import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  del,
  get,
  put,
  type GetBlobResult,
  type GetCommandOptions,
  type PutCommandOptions,
} from "@vercel/blob";
import { generatePdf } from "@/lib/delivery";
import {
  blobPathFromLocator,
  customerUploadHref,
  customerUploadOwner,
  isCustomerUploadPath,
} from "@/lib/blob-ref";
import {
  chapterContentLocator,
  encodeChapterContentRef,
  parseDocumentContent,
  SHEETS_CELL_SAFE_CHARS,
} from "@/lib/document-content";
import { canAccessDocument } from "@/lib/documents";
import { applyEntityToIdentity } from "@/lib/entities";
import { isBlobConfigured, isSheetsConfigured } from "@/lib/env";
import {
  DurableStoreError,
  encodeIntakePayloadRef,
  intakeAnswersBlobPath,
  intakePayloadLocator,
} from "@/lib/intake-payload";
import { uploadOwnerSegment } from "@/lib/upload-path";
import { generateReadinessPdf, type ReadinessLead } from "@/lib/readiness";
import {
  findRowByStripeSessionId,
  getFileFallbackDir,
  getOwnedEntity,
  listDocumentsByEmail,
  listEntitiesByEmail,
} from "@/lib/store";
import {
  answersFromSheetRow,
  identityFromSheetRow,
  type SheetRow,
} from "@/lib/types";

export type StoredPdf = {
  backend: "blob" | "file";
  /** App path or empty. Never a Blob host URL. */
  url: string;
  pathname: string;
};

/**
 * `gobd-blob` ist privat. `access: "public"` lehnt der Store ab; ein stiller
 * Datei-Fallback hat PDFs dann nur auf dem flüchtigen Function-Dateisystem
 * gehalten. Lesen geht nur mit Token über `get`. Dieselben PDF- und
 * Kapitelpfade werden bei einem erneuten Schreiben überschrieben.
 * Uploads bekommen einen Zeitstempel und werden nicht überschrieben.
 */
const BLOB_ACCESS = "private" as const;

export type BlobIo = {
  put: (pathname: string, body: Buffer | string, options: PutCommandOptions) => Promise<{
    url: string;
    pathname: string;
    contentType?: string;
  }>;
  get: (pathname: string, options: GetCommandOptions) => Promise<GetBlobResult | null>;
  del: (pathname: string, options?: { token?: string }) => Promise<void>;
};

const defaultBlobIo: BlobIo = {
  put: (pathname, body, options) => put(pathname, body, options),
  get,
  del,
};

export class BlobStorageError extends Error {
  readonly backend = "blob" as const;
  readonly operation: "read" | "write" | "delete";
  readonly errorClass: string;

  constructor(operation: "read" | "write" | "delete", error: unknown) {
    super("blob storage failed");
    this.name = "BlobStorageError";
    this.operation = operation;
    this.errorClass = blobFailureClass(error);
  }
}

export function blobFailureClass(error: unknown): string {
  if (error instanceof BlobStorageError) return error.errorClass;
  if (typeof error === "object" && error !== null) {
    const ctor = (error as { constructor?: { name?: unknown } }).constructor?.name;
    if (typeof ctor === "string" && ctor && ctor !== "Object") return ctor;
  }
  return "Unknown";
}

function isMissingBlob(error: unknown): boolean {
  return blobFailureClass(error) === "BlobNotFoundError";
}

function logBlobFailure(operation: "Lesen" | "Schreiben" | "Löschen", error: unknown): void {
  console.error(`[blob] Blob-${operation} fehlgeschlagen`, blobFailureClass(error));
}

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token && token.trim() ? token : undefined;
}

function privateBlobToken(): string | null {
  if (!isBlobConfigured()) return null;
  return blobToken() ?? null;
}

export type UploadAccessInput = {
  sessionEmail?: string | null;
  sessionId?: string | null;
};

export type UploadAccessDeps = {
  documentsByEmail: (email: string) => Promise<SheetRow[]>;
  entitiesByEmail: (email: string) => Promise<Array<{ entityId: string }>>;
  rowBySession: (sessionId: string) => Promise<SheetRow | null>;
};

const defaultUploadDeps: UploadAccessDeps = {
  documentsByEmail: listDocumentsByEmail,
  entitiesByEmail: (email) => listEntitiesByEmail(email),
  rowBySession: findRowByStripeSessionId,
};

/** Same owner key the upload path has always used. Case is preserved. */
export function sanitizeUploadOwner(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 64);
}

function ownerMatches(pathOwner: string, candidate: string | null | undefined): boolean {
  const clean = sanitizeUploadOwner(candidate ?? "");
  return Boolean(pathOwner) && Boolean(clean) && clean.toLowerCase() === pathOwner.toLowerCase();
}

function recordReferences(record: unknown, pathname: string): boolean {
  try {
    return JSON.stringify(record).includes(pathname);
  } catch {
    return false;
  }
}

/**
 * Besitzer: Session-Mail, Checkout-Session (wie der Dokument-Download) oder
 * ein Dokument/eine Firma dieser Mail, das den Upload referenziert.
 */
export async function canAccessCustomerUpload(
  locator: string,
  access: UploadAccessInput,
  deps: UploadAccessDeps = defaultUploadDeps,
): Promise<"anonymous" | "forbidden" | "ok"> {
  const owner = customerUploadOwner(locator);
  const sessionEmail = access.sessionEmail?.trim() ?? "";
  const sessionId = access.sessionId?.trim() ?? "";
  if (!sessionEmail && !sessionId) return "anonymous";
  if (!owner) return "forbidden";
  if (ownerMatches(owner, sessionEmail) || ownerMatches(owner, sessionId)) return "ok";

  const blobPath = blobPathFromLocator(locator);
  if (sessionEmail) {
    const docs = await deps.documentsByEmail(sessionEmail);
    for (const doc of docs) {
      if (ownerMatches(owner, doc.entityId) || ownerMatches(owner, doc.documentId)) return "ok";
      if (blobPath && recordReferences(doc, blobPath)) return "ok";
    }
    const entities = await deps.entitiesByEmail(sessionEmail);
    if (entities.some((entity) => ownerMatches(owner, entity.entityId))) return "ok";
  }
  if (sessionId) {
    const row = await deps.rowBySession(sessionId);
    if (row && canAccessDocument(row, { sessionEmail, sessionId })) {
      if (
        ownerMatches(owner, row.email) ||
        ownerMatches(owner, row.entityId) ||
        ownerMatches(owner, row.documentId)
      ) {
        return "ok";
      }
      if (blobPath && recordReferences(row, blobPath)) return "ok";
    }
  }
  return "forbidden";
}

function isFsUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "EROFS" || code === "EACCES" || code === "EPERM";
}

async function writeLocalPdf(fileBase: string, buffer: Buffer): Promise<StoredPdf> {
  const tryWrite = async (dir: string): Promise<StoredPdf> => {
    const pdfDir = path.join(dir, "pdfs");
    await mkdir(pdfDir, { recursive: true });
    const pathname = path.join(pdfDir, `${fileBase}.pdf`);
    await writeFile(pathname, buffer);
    return { backend: "file", url: "", pathname };
  };

  try {
    return await tryWrite(getFileFallbackDir());
  } catch (error) {
    const tmpDir = path.join(tmpdir(), "gobd-data");
    if (isFsUnavailable(error) && getFileFallbackDir() !== tmpDir) {
      console.warn("[blob] lokales PDF nicht beschreibbar — weiche auf tmpdir aus");
      return tryWrite(tmpDir);
    }
    throw error;
  }
}

function privateWriteOptions(
  token: string,
  contentType: string,
  allowOverwrite: boolean,
): PutCommandOptions {
  return {
    access: BLOB_ACCESS,
    contentType,
    addRandomSuffix: false,
    allowOverwrite,
    token,
  };
}

function privateReadOptions(token: string): GetCommandOptions {
  return {
    access: BLOB_ACCESS,
    useCache: false,
    token,
  };
}

class UnexpectedBlobRead extends Error {
  constructor() {
    super("unexpected blob read");
    this.name = "UnexpectedBlobRead";
  }
}

async function readPrivateBlob(
  pathname: string,
  token: string,
  io: BlobIo,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  let result: GetBlobResult | null;
  try {
    result = await io.get(pathname, privateReadOptions(token));
  } catch (error) {
    if (isMissingBlob(error)) return null;
    logBlobFailure("Lesen", error);
    throw new BlobStorageError("read", error);
  }
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    const error = new UnexpectedBlobRead();
    logBlobFailure("Lesen", error);
    throw new BlobStorageError("read", error);
  }
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return { buffer, contentType: result.blob.contentType || "" };
}

export async function storePdf(
  input: {
    familyId: string;
    documentId: string;
    version: number;
    buffer: Buffer;
  },
  io: BlobIo = defaultBlobIo,
): Promise<StoredPdf> {
  const familyId = input.familyId || input.documentId;
  const version = input.version > 0 ? input.version : 1;
  const blobPath = `gobd/${familyId}/v${version}.pdf`;
  const fileBase = `${familyId}-v${version}`;
  const token = privateBlobToken();

  if (token) {
    try {
      const blob = await io.put(
        blobPath,
        input.buffer,
        privateWriteOptions(token, "application/pdf", true),
      );
      return {
        backend: "blob",
        url: "",
        pathname: blob.pathname || blobPath,
      };
    } catch (error) {
      if (error instanceof BlobStorageError) throw error;
      logBlobFailure("Schreiben", error);
      throw new BlobStorageError("write", error);
    }
  }

  console.warn(
    "[blob] BLOB_READ_WRITE_TOKEN fehlt — speichere PDF lokal (Demo, nicht persistent auf Vercel)",
  );
  return writeLocalPdf(fileBase, input.buffer);
}

async function loadPdfFromStoredUrl(
  pdfUrl: string,
  io: BlobIo,
): Promise<Buffer | null> {
  const token = privateBlobToken();
  const blobPath = blobPathFromLocator(pdfUrl);
  if (blobPath && token) {
    const read = await readPrivateBlob(blobPath, token, io);
    return read?.buffer ?? null;
  }

  if (pdfUrl && !pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://")) {
    try {
      return await readFile(pdfUrl);
    } catch {
      return null;
    }
  }

  return null;
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

async function writeLocalChapterJson(documentId: string, json: string): Promise<string> {
  const tryWrite = async (dir: string): Promise<string> => {
    const chapterDir = path.join(dir, "chapters");
    await mkdir(chapterDir, { recursive: true });
    const pathname = path.join(chapterDir, `${documentId}.json`);
    await writeFile(pathname, json, "utf8");
    return pathname;
  };

  try {
    return await tryWrite(getFileFallbackDir());
  } catch (error) {
    const tmpDir = path.join(tmpdir(), "gobd-data");
    if (isFsUnavailable(error) && getFileFallbackDir() !== tmpDir) {
      console.warn("[blob] lokaler Kapiteltext nicht beschreibbar — weiche auf tmpdir aus");
      return tryWrite(tmpDir);
    }
    throw error;
  }
}

/**
 * Keep `chapter_content` inline when it fits a Sheets cell.
 * File-backend rows can hold the full JSON. Sheets rows over 50k go to
 * Blob/file with a short `{__gobdContent}` pointer in the cell.
 * The pointer stores a pathname. Older cells may still hold a public Blob URL.
 */
export async function persistChapterContent(
  input: {
    familyId: string;
    documentId: string;
    version: number;
    json: string;
  },
  io: BlobIo = defaultBlobIo,
): Promise<string> {
  if (input.json.length <= SHEETS_CELL_SAFE_CHARS) {
    return input.json;
  }
  if (!isSheetsConfigured()) {
    return input.json;
  }

  const familyId = input.familyId || input.documentId;
  const version = input.version > 0 ? input.version : 1;
  const blobPath = `gobd/${familyId}/v${version}-chapters.json`;
  const token = privateBlobToken();

  if (token) {
    try {
      const blob = await io.put(
        blobPath,
        input.json,
        privateWriteOptions(token, "application/json; charset=utf-8", true),
      );
      return encodeChapterContentRef(blob.pathname || blobPath);
    } catch (error) {
      if (error instanceof BlobStorageError) throw error;
      logBlobFailure("Schreiben", error);
      throw new BlobStorageError("write", error);
    }
  }

  if (isVercelRuntime() && !isBlobConfigured()) {
    throw new Error(
      "Der Dokumenttext ist zu lang für die Tabellen-Zelle. Bitte BLOB_READ_WRITE_TOKEN setzen.",
    );
  }

  const pathname = await writeLocalChapterJson(input.documentId, input.json);
  return encodeChapterContentRef(pathname);
}

export async function resolveChapterContent(
  raw: string | undefined | null,
  io: BlobIo = defaultBlobIo,
): Promise<string> {
  const locator = chapterContentLocator(raw);
  if (!locator) return raw?.trim() ?? "";

  const token = privateBlobToken();
  const blobPath = blobPathFromLocator(locator);
  if (blobPath && token) {
    const read = await readPrivateBlob(blobPath, token, io);
    return read ? read.buffer.toString("utf8") : "";
  }

  if (!locator.startsWith("http://") && !locator.startsWith("https://")) {
    try {
      return await readFile(locator, "utf8");
    } catch {
      return "";
    }
  }

  return "";
}

async function writeLocalAnswersJson(
  documentId: string,
  version: number,
  json: string,
): Promise<string> {
  const versionNo = version > 0 ? version : 1;
  const base = documentId.replace(/[^a-zA-Z0-9_-]/g, "") || "dokument";
  const name = `${base}-v${versionNo}-answers.json`;
  const tryWrite = async (dir: string): Promise<string> => {
    const answersDir = path.join(dir, "answers");
    await mkdir(answersDir, { recursive: true });
    const pathname = path.join(answersDir, name);
    await writeFile(pathname, json, "utf8");
    return pathname;
  };

  try {
    return await tryWrite(getFileFallbackDir());
  } catch (error) {
    const tmpDir = path.join(tmpdir(), "gobd-data");
    if (isFsUnavailable(error) && getFileFallbackDir() !== tmpDir) {
      console.warn("[blob] lokales Antwort-JSON nicht beschreibbar — weiche auf tmpdir aus");
      return tryWrite(tmpDir);
    }
    throw error;
  }
}

function assertIntakeSha(json: string, sha256: string): void {
  if (!sha256) return;
  const actual = createHash("sha256").update(json).digest("hex");
  if (actual !== sha256) {
    throw new DurableStoreError();
  }
}

/**
 * Keep `fragen` inline when it fits a Sheets cell.
 * Oversized answer JSON goes to a private Blob (or a local file in dev) and
 * the cell stores `{__gobdAnswers, sha256}`. Existing inline cells stay as they are.
 * `requireBlob` is only for the preview smoke, which has no Sheets credentials.
 */
export async function persistIntakePayload(
  input: {
    familyId: string;
    documentId: string;
    version: number;
    json: string;
  },
  io: BlobIo = defaultBlobIo,
  options?: { requireBlob?: boolean },
): Promise<string> {
  if (input.json.length <= SHEETS_CELL_SAFE_CHARS) {
    return input.json;
  }
  if (!options?.requireBlob && !isSheetsConfigured()) {
    return input.json;
  }

  const familyId = input.familyId || input.documentId;
  const documentId = input.documentId || familyId;
  const version = input.version > 0 ? input.version : 1;
  const blobPath = intakeAnswersBlobPath(familyId, documentId, version);
  const sha256 = createHash("sha256").update(input.json).digest("hex");
  const token = privateBlobToken();

  if (token) {
    try {
      const blob = await io.put(
        blobPath,
        input.json,
        privateWriteOptions(token, "application/json; charset=utf-8", true),
      );
      return encodeIntakePayloadRef(blob.pathname || blobPath, sha256);
    } catch (error) {
      if (error instanceof BlobStorageError) throw error;
      logBlobFailure("Schreiben", error);
      throw new BlobStorageError("write", error);
    }
  }

  if (isVercelRuntime() || options?.requireBlob) {
    throw new DurableStoreError();
  }

  const pathname = await writeLocalAnswersJson(documentId, version, input.json);
  return encodeIntakePayloadRef(pathname, sha256);
}

/** Inline JSON passes through. A pointer is loaded from private Blob or the local file. */
export async function resolveIntakePayload(
  raw: string | undefined | null,
  io: BlobIo = defaultBlobIo,
): Promise<string> {
  const text = raw ?? "";
  const ref = intakePayloadLocator(text);
  if (!ref) return text;

  const token = privateBlobToken();
  const blobPath = blobPathFromLocator(ref.locator);
  if (blobPath && token) {
    const read = await readPrivateBlob(blobPath, token, io);
    if (!read) {
      logBlobFailure("Lesen", new Error("Antwort-JSON fehlt"));
      throw new BlobStorageError("read", new Error("missing answers"));
    }
    const json = read.buffer.toString("utf8");
    assertIntakeSha(json, ref.sha256);
    return json;
  }

  if (ref.locator.startsWith("http://") || ref.locator.startsWith("https://")) {
    throw new DurableStoreError();
  }

  try {
    const json = await readFile(ref.locator, "utf8");
    assertIntakeSha(json, ref.sha256);
    return json;
  } catch (error) {
    if (error instanceof DurableStoreError) throw error;
    throw new DurableStoreError();
  }
}

export async function loadDocumentPdf(row: SheetRow, io: BlobIo = defaultBlobIo): Promise<Buffer> {
  const stored = await loadPdfFromStoredUrl(row.pdfUrl, io);
  if (stored) return stored;

  const sourceIdentity = identityFromSheetRow(row);
  const entity = row.entityId
    ? await getOwnedEntity(row.entityId, sourceIdentity.email)
    : null;
  const generated = await generatePdf({
    answers: answersFromSheetRow(row),
    identity: applyEntityToIdentity(sourceIdentity, entity),
    documentId: row.documentId || "regenerated",
    version: Number.parseInt(row.version || "1", 10) || 1,
    content: parseDocumentContent(await resolveChapterContent(row.chapterContent, io)),
  });
  return generated.buffer;
}

export async function loadReadinessPdf(
  lead: ReadinessLead,
  io: BlobIo = defaultBlobIo,
): Promise<Buffer> {
  const stored = await loadPdfFromStoredUrl(lead.pdfUrl, io);
  if (stored) return stored;
  const generated = await generateReadinessPdf(lead);
  return generated.buffer;
}

export function pdfDownloadName(row: SheetRow): string {
  const company =
    row.company.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) ||
    "dokument";
  const version = row.version || "1";
  return `Verfahrensdoku-${company}-v${version}.pdf`;
}

const UPLOAD_MAX_BYTES = 12 * 1024 * 1024;
const UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function uploadAllowed(contentType: string, size: number): string {
  if (size <= 0) return "Leere Datei.";
  if (size > UPLOAD_MAX_BYTES) return "Datei zu groß (max. 12 MB).";
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!UPLOAD_TYPES.has(type)) {
    return "Nur PDF, DOCX, JPEG, PNG oder WebP.";
  }
  return "";
}

function safeUploadName(name: string): string {
  const base = name.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80);
  return base || "dokument";
}

function contentTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function filenameFromPath(pathname: string): string {
  const base = pathname.split(/[/\\]/).pop() || "dokument";
  const cleaned = base.replace(/["\r\n\\]/g, "").slice(0, 120);
  if (!cleaned || /[^\x20-\x7E]/.test(cleaned)) {
    const ext = cleaned.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? "";
    return `dokument${ext}`;
  }
  return cleaned;
}

function uploadRoots(): string[] {
  return [
    path.resolve(path.join(getFileFallbackDir(), "uploads")),
    path.resolve(path.join(tmpdir(), "gobd-data", "uploads")),
  ];
}

function resolveLocalUpload(locator: string): string | null {
  const trimmed = locator.trim();
  if (!trimmed || trimmed.includes("\0") || trimmed.includes("..")) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return null;
  if (blobPathFromLocator(trimmed)) return null;
  const resolved = path.resolve(trimmed);
  for (const root of uploadRoots()) {
    if (resolved === root || resolved.startsWith(root + path.sep)) return resolved;
  }
  return null;
}

/**
 * Kunden-Upload für „durch bestehende Dokumentation abgedeckt“.
 * Privater Blob wenn ein Token gesetzt ist, sonst lokale Datei (Demo).
 * `url` ist immer die authentifizierte App-Route, nie ein Blob-Host.
 */
export async function storeCustomerUpload(
  input: {
    ownerKey: string;
    modulId: string;
    filename: string;
    contentType: string;
    buffer: Buffer;
  },
  io: BlobIo = defaultBlobIo,
): Promise<StoredPdf & { contentType: string; size: number; filename: string }> {
  const err = uploadAllowed(input.contentType, input.buffer.length);
  if (err) throw new Error(err);
  const filename = safeUploadName(input.filename);
  const owner = uploadOwnerSegment(input.ownerKey);
  const modul = input.modulId.replace(/[^a-z0-9]/g, "") || "modul";
  const stamp = Date.now().toString(36);
  const blobPath = `gobd/uploads/${owner}/${modul}/${stamp}-${filename}`;
  const token = privateBlobToken();

  if (token) {
    try {
      const blob = await io.put(
        blobPath,
        input.buffer,
        privateWriteOptions(token, input.contentType, false),
      );
      const pathname = blob.pathname || blobPath;
      return {
        backend: "blob",
        url: customerUploadHref(pathname),
        pathname,
        contentType: input.contentType,
        size: input.buffer.length,
        filename,
      };
    } catch (error) {
      if (error instanceof BlobStorageError) throw error;
      logBlobFailure("Schreiben", error);
      throw new BlobStorageError("write", error);
    }
  }

  const dir = path.join(getFileFallbackDir(), "uploads", owner, modul);
  await mkdir(dir, { recursive: true });
  const pathname = path.join(dir, `${stamp}-${filename}`);
  await writeFile(pathname, input.buffer);
  return {
    backend: "file",
    url: customerUploadHref(pathname),
    pathname,
    contentType: input.contentType,
    size: input.buffer.length,
    filename,
  };
}

export async function readCustomerUpload(
  locator: string,
  io: BlobIo = defaultBlobIo,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const blobPath = blobPathFromLocator(locator);
  const token = privateBlobToken();
  if (blobPath && isCustomerUploadPath(blobPath)) {
    if (!token) return null;
    const read = await readPrivateBlob(blobPath, token, io);
    if (!read) return null;
    const contentType =
      read.contentType && UPLOAD_TYPES.has(read.contentType.split(";")[0]?.trim().toLowerCase() ?? "")
        ? read.contentType
        : contentTypeFromName(blobPath);
    return {
      buffer: read.buffer,
      contentType,
      filename: filenameFromPath(blobPath),
    };
  }

  const local = resolveLocalUpload(locator);
  if (!local) return null;
  try {
    const buffer = await readFile(/*turbopackIgnore: true*/ local);
    return {
      buffer,
      contentType: contentTypeFromName(local),
      filename: filenameFromPath(local),
    };
  } catch {
    return null;
  }
}

/** Deletes one private object. Missing objects are success. Refuses paths outside `gobd/`. */
export async function deleteStoredBlob(pathname: string, io: BlobIo = defaultBlobIo): Promise<void> {
  if (!pathname.startsWith("gobd/") || pathname.includes("..") || pathname.includes("\\")) {
    throw new BlobStorageError("delete", new Error("invalid blob path"));
  }
  const token = privateBlobToken();
  if (!token) return;
  try {
    await io.del(pathname, { token });
  } catch (error) {
    if (isMissingBlob(error)) return;
    logBlobFailure("Löschen", error);
    throw new BlobStorageError("delete", error);
  }
}

export { UPLOAD_MAX_BYTES };
