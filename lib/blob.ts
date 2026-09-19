import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { put } from "@vercel/blob";
import { generatePdf } from "@/lib/delivery";
import { isBlobConfigured } from "@/lib/env";
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

export async function loadDocumentPdf(row: SheetRow): Promise<Buffer> {
  if (row.pdfUrl.startsWith("http://") || row.pdfUrl.startsWith("https://")) {
    try {
      const response = await fetch(row.pdfUrl);
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
      console.warn("[blob] pdf_url nicht lesbar", response.status);
    } catch (error) {
      console.warn("[blob] pdf_url fetch fehlgeschlagen", error);
    }
  }

  if (row.pdfUrl && !row.pdfUrl.startsWith("http")) {
    try {
      return await readFile(row.pdfUrl);
    } catch (error) {
      console.warn("[blob] lokale PDF-Datei fehlt — regeneriere", error);
    }
  }

  const generated = await generatePdf({
    answers: answersFromSheetRow(row),
    identity: identityFromSheetRow(row),
    documentId: row.documentId || "regenerated",
    version: Number.parseInt(row.version || "1", 10) || 1,
  });
  return generated.buffer;
}

export function pdfDownloadName(row: SheetRow): string {
  const company =
    row.company.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) ||
    "dokument";
  const version = row.version || "1";
  return `Verfahrensdoku-${company}-v${version}.pdf`;
}
