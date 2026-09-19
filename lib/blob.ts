import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { put } from "@vercel/blob";
import { generatePdf } from "@/lib/delivery";
import {
  chapterContentLocator,
  encodeChapterContentRef,
  parseDocumentContent,
  SHEETS_CELL_SAFE_CHARS,
} from "@/lib/document-content";
import { isBlobConfigured, isSheetsConfigured } from "@/lib/env";
import { generateReadinessPdf, type ReadinessLead } from "@/lib/readiness";
import { getFileFallbackDir } from "@/lib/store";
import {
  answersFromSheetRow,
  identityFromSheetRow,
  type SheetRow,
} from "@/lib/types";

export type StoredPdf = {
  backend: "blob" | "file";
  url: string;
  pathname: string;
};

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
      console.warn("[blob] lokales PDF nicht beschreibbar — weiche auf tmpdir aus", error);
      return tryWrite(tmpDir);
    }
    throw error;
  }
}

export async function storePdf(input: {
  familyId: string;
  documentId: string;
  version: number;
  buffer: Buffer;
}): Promise<StoredPdf> {
  const familyId = input.familyId || input.documentId;
  const version = input.version > 0 ? input.version : 1;
  const blobPath = `gobd/${familyId}/v${version}.pdf`;
  const fileBase = `${familyId}-v${version}`;

  if (isBlobConfigured()) {
    try {
      const blob = await put(blobPath, input.buffer, {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return {
        backend: "blob",
        url: blob.url,
        pathname: blob.pathname,
      };
    } catch (error) {
      console.error("[blob] Vercel Blob Upload fehlgeschlagen — Datei-Fallback", error);
    }
  } else {
    console.warn(
      "[blob] BLOB_READ_WRITE_TOKEN fehlt — speichere PDF lokal (Demo, nicht persistent auf Vercel)",
    );
  }

  return writeLocalPdf(fileBase, input.buffer);
}

async function loadPdfFromStoredUrl(pdfUrl: string): Promise<Buffer | null> {
  if (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://")) {
    try {
      const response = await fetch(pdfUrl);
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
      console.warn("[blob] pdf_url nicht lesbar", response.status);
    } catch (error) {
      console.warn("[blob] pdf_url fetch fehlgeschlagen", error);
    }
  }

  if (pdfUrl && !pdfUrl.startsWith("http")) {
    try {
      return await readFile(pdfUrl);
    } catch (error) {
      console.warn("[blob] lokale PDF-Datei fehlt — regeneriere", error);
    }
  }

  return null;
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

async function writeLocalChapterJson(
  documentId: string,
  json: string,
): Promise<string> {
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
      console.warn(
        "[blob] lokaler Kapiteltext nicht beschreibbar — weiche auf tmpdir aus",
        error,
      );
      return tryWrite(tmpDir);
    }
    throw error;
  }
}

/**
 * Keep `chapter_content` inline when it fits a Sheets cell.
 * File-backend rows can hold the full JSON. Sheets rows over 50k go to
 * Blob/file with a short `{__gobdContent}` pointer in the cell.
 */
export async function persistChapterContent(input: {
  familyId: string;
  documentId: string;
  version: number;
  json: string;
}): Promise<string> {
  if (input.json.length <= SHEETS_CELL_SAFE_CHARS) {
    return input.json;
  }
  if (!isSheetsConfigured()) {
    return input.json;
  }

  const familyId = input.familyId || input.documentId;
  const version = input.version > 0 ? input.version : 1;
  const blobPath = `gobd/${familyId}/v${version}-chapters.json`;

  if (isBlobConfigured()) {
    try {
      const blob = await put(blobPath, input.json, {
        access: "public",
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return encodeChapterContentRef(blob.url);
    } catch (error) {
      console.error(
        "[blob] Kapiteltext-Upload fehlgeschlagen — Datei-Fallback",
        error,
      );
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
): Promise<string> {
  const locator = chapterContentLocator(raw);
  if (!locator) return raw?.trim() ?? "";

  if (locator.startsWith("http://") || locator.startsWith("https://")) {
    try {
      const response = await fetch(locator);
      if (response.ok) return await response.text();
      console.warn("[blob] Kapiteltext-URL nicht lesbar", response.status);
    } catch (error) {
      console.warn("[blob] Kapiteltext-URL fetch fehlgeschlagen", error);
    }
    return "";
  }

  try {
    return await readFile(locator, "utf8");
  } catch (error) {
    console.warn("[blob] lokale Kapiteltext-Datei fehlt", error);
    return "";
  }
}

export async function loadDocumentPdf(row: SheetRow): Promise<Buffer> {
  const stored = await loadPdfFromStoredUrl(row.pdfUrl);
  if (stored) return stored;

  const generated = await generatePdf({
    answers: answersFromSheetRow(row),
    identity: identityFromSheetRow(row),
    documentId: row.documentId || "regenerated",
    version: Number.parseInt(row.version || "1", 10) || 1,
    content: parseDocumentContent(await resolveChapterContent(row.chapterContent)),
  });
  return generated.buffer;
}

export async function loadReadinessPdf(lead: ReadinessLead): Promise<Buffer> {
  const stored = await loadPdfFromStoredUrl(lead.pdfUrl);
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
