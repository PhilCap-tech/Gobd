import { NextResponse } from "next/server";
import { isBereichId } from "@/lib/bereiche";
import { musterPdfFilename } from "@/lib/bereich-muster";
import { generatePdf } from "@/lib/delivery";
import { getMuster } from "@/lib/muster";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ bereich: string }> }) {
  const { bereich } = await params;
  const muster = isBereichId(bereich) ? getMuster(bereich) : undefined;
  if (!muster) return new NextResponse("Nicht gefunden", { status: 404 });
  const { buffer } = await generatePdf({
    answers: muster.answers,
    identity: muster.identity,
    documentId: muster.documentId,
    version: muster.version,
    versionMeta: muster.versionMeta,
    versionHistory: muster.versionHistory,
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${musterPdfFilename(bereich)}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
