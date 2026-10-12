import { NextResponse } from "next/server";
import { generatePdf } from "@/lib/delivery";
import { getGesamtMuster, isMusterVorlage } from "@/lib/module-muster";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ vorlage: string }> }) {
  const { vorlage } = await params;
  if (!isMusterVorlage(vorlage)) {
    return NextResponse.json({ error: "Unbekannte Vorlage." }, { status: 404 });
  }
  const muster = getGesamtMuster(vorlage)!;
  const generated = await generatePdf({
    answers: muster.answers,
    identity: muster.identity,
    documentId: muster.documentId,
    version: muster.version,
    versionMeta: muster.versionMeta,
    variant: "muster",
  });
  return new NextResponse(new Uint8Array(generated.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="muster-gesamt-${vorlage}.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
