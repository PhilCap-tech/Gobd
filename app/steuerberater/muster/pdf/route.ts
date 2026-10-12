import { NextResponse } from "next/server";
import { generatePdf } from "@/lib/delivery";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_FILENAME,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";

export const runtime = "nodejs";

// Folge: gemeinsame Liefervorlagen; ein Umbenennen hier würde alle Kunden-PDFs ändern.
export async function GET() {
  const { buffer } = await generatePdf({
    answers: PARTNER_MUSTER_ANSWERS,
    identity: PARTNER_MUSTER_IDENTITY,
    documentId: PARTNER_MUSTER_DOCUMENT_ID,
    version: 1,
    versionMeta: PARTNER_MUSTER_VERSION_META,
    variant: "muster",
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${PARTNER_MUSTER_FILENAME}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
