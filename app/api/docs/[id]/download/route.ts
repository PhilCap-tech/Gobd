import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { subscriptionDownloadDenial } from "@/lib/kuendigung-access";
import { BlobStorageError, blobFailureClass, loadDocumentPdf, pdfDownloadName } from "@/lib/blob";
import { sessionOwnerDenial } from "@/lib/checkout-access";
import { generatePdf } from "@/lib/delivery";
import { isGesamt } from "@/lib/module/status";
import { modulById } from "@/lib/module/katalog";
import { findDocumentById } from "@/lib/store";
import { answersFromSheetRow, identityFromSheetRow, type SheetRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return downloadPdf(request, id);
}

/**
 * Ohne Sitzung immer 401, ob die Zeile liegt oder nicht.
 * Mit Sitzung, aber ohne diese Mailbox: immer 403 „Kein Zugriff.“
 */
export async function downloadPdf(
  request: Request,
  id: string,
  find: (documentId: string) => Promise<SheetRow | null> = findDocumentById,
) {
  const url = new URL(request.url);
  const modul = (url.searchParams.get("modul") ?? "").trim();
  const sessionEmail = await sessionEmailFromRequest(request);
  if (!sessionEmail) return jsonError("Kein Zugriff.", 401);

  const row = await find(id);
  if (!row || sessionOwnerDenial(sessionEmail, row.email)) {
    return jsonError("Kein Zugriff.", 403);
  }

  const downloadClosed = await subscriptionDownloadDenial(row.email);
  if (downloadClosed) return jsonError(downloadClosed, 403);

  try {
    if (modul) {
      const answers = answersFromSheetRow(row);
      if (!isGesamt(answers) || !modulById(modul)) {
        return jsonError("Modul-Export nur für Gesamtdokumente.", 400);
      }
      const generated = await generatePdf({
        answers,
        identity: identityFromSheetRow(row),
        documentId: row.documentId,
        version: Number(row.version) || 1,
        onlyModul: modul,
      });
      const name = pdfDownloadName(row).replace(/\.pdf$/i, `-modul-${modul}.pdf`);
      return new NextResponse(new Uint8Array(generated.buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const buffer = await loadDocumentPdf(row);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfDownloadName(row)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[docs] PDF-Download fehlgeschlagen", blobFailureClass(error));
    return jsonError(
      "PDF konnte nicht geladen werden.",
      error instanceof BlobStorageError ? 503 : 500,
    );
  }
}
