import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { loadDocumentPdf, pdfDownloadName } from "@/lib/blob";
import { generatePdf } from "@/lib/delivery";
import { canAccessDocument } from "@/lib/documents";
import { isGesamt } from "@/lib/module/status";
import { modulById } from "@/lib/module/katalog";
import { normalizeQueryId } from "@/lib/query";
import { findDocumentById } from "@/lib/store";
import { answersFromSheetRow, identityFromSheetRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const sessionId = normalizeQueryId(url.searchParams.get("session_id"));
  const modul = (url.searchParams.get("modul") ?? "").trim();
  const sessionEmail = await getSessionEmail();
  const row = await findDocumentById(id);

  if (!row) {
    return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  }

  const allowed = canAccessDocument(row, { sessionEmail, sessionId });

  if (!allowed) {
    return NextResponse.json(
      { error: "Kein Zugriff." },
      { status: sessionEmail ? 403 : 401 },
    );
  }

  try {
    if (modul) {
      const answers = answersFromSheetRow(row);
      if (!isGesamt(answers) || !modulById(modul)) {
        return NextResponse.json({ error: "Modul-Export nur für Gesamtdokumente." }, { status: 400 });
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
    console.error("[docs] PDF-Download fehlgeschlagen", error);
    return NextResponse.json(
      { error: "PDF konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
