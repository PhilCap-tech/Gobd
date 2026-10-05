import { NextResponse } from "next/server";
import { bereichDocTitle, isBereichId } from "@/lib/bereiche";
import { musterFragebogenFilename } from "@/lib/bereich-muster";
import { generateMarkdownPdf } from "@/lib/delivery";
import { fragebogenMarkdown, getMuster } from "@/lib/muster";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ bereich: string }> }) {
  const { bereich } = await params;
  const muster = isBereichId(bereich) ? getMuster(bereich) : undefined;
  if (!muster) return new NextResponse("Nicht gefunden", { status: 404 });
  const buffer = await generateMarkdownPdf({
    markdown: fragebogenMarkdown(muster),
    company: muster.identity.company,
    title: `Muster-Fragebogen ${bereichDocTitle(bereich)}`,
    footer: "Muster-Fragebogen mit fiktiven Beispielantworten. Keine Steuer- oder Rechtsberatung.",
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${musterFragebogenFilename(bereich)}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
