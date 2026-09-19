import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { loadDocumentPdf, pdfDownloadName } from "@/lib/blob";
import { findDocumentById } from "@/lib/store";
import { emailsEqual } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const sessionEmail = await getSessionEmail();
  const row = await findDocumentById(id);

  if (!row) {
    return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  }

  const allowed =
    (sessionEmail && emailsEqual(sessionEmail, row.email)) ||
    (sessionId && sessionId === row.stripeSessionId);

  if (!allowed) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 401 });
  }

  try {
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
