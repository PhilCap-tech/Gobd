import { NextResponse } from "next/server";
import { loadPdfFromStoredUrl, storePdf } from "@/lib/blob";
import {
  answersFromReadinessLead,
  readinessPdfFileName,
} from "@/lib/readiness";
import { generateReadinessPdf } from "@/lib/readiness-pdf";
import { findReadinessLeadById } from "@/lib/readiness-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await findReadinessLeadById(id);
  if (!row) {
    return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  }

  try {
    let buffer = await loadPdfFromStoredUrl(row.pdfUrl);
    if (!buffer) {
      const answers = answersFromReadinessLead(row);
      if (!answers) {
        return NextResponse.json(
          { error: "PDF konnte nicht geladen werden." },
          { status: 500 },
        );
      }
      const generated = await generateReadinessPdf(answers);
      buffer = generated.buffer;
      try {
        await storePdf({
          familyId: row.documentId,
          documentId: row.documentId,
          version: 1,
          buffer,
          blobPath: `readiness/${row.documentId}.pdf`,
        });
      } catch (error) {
        console.warn("[readiness] erneuter Blob-Upload fehlgeschlagen", error);
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${readinessPdfFileName(row)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[readiness] PDF-Download fehlgeschlagen", error);
    return NextResponse.json(
      { error: "PDF konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
