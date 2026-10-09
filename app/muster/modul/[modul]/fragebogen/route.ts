import { NextResponse } from "next/server";
import { generateMarkdownPdf } from "@/lib/delivery";
import { modulFragen } from "@/lib/module/katalog";
import { getModulMuster } from "@/lib/module-muster";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ modul: string }> }) {
  const { modul: modulId } = await params;
  const muster = getModulMuster(modulId);
  if (!muster) return NextResponse.json({ error: "Unbekanntes Modul." }, { status: 404 });
  const questions = modulFragen(muster.modul);
  const lines = [
    `# Muster-Fragebogen: Modul ${muster.modul.nr} ${muster.modul.titel}`,
    "",
    "*Fiktiv. Keine Steuerberatung.*",
    "",
    ...questions.flatMap((question) => [
      `## ${question.title}`,
      "",
      question.prompt,
      "",
      question.hint ? `*${question.hint}*` : "",
      "",
    ]),
  ];
  const buffer = await generateMarkdownPdf({
    markdown: lines.join("\n"),
    company: muster.identity.company,
    title: `Modul ${muster.modul.nr} Fragebogen`,
    footer: "Muster · fiktiv · keine Steuerberatung",
    variant: "muster",
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="muster-modul-${modulId}-fragebogen.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
