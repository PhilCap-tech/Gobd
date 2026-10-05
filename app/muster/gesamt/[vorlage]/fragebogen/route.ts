import { NextResponse } from "next/server";
import { generateMarkdownPdf } from "@/lib/delivery";
import { catalogFragebogen } from "@/lib/intake-catalog";
import { getGesamtMuster, isMusterVorlage } from "@/lib/module-muster";

export const runtime = "nodejs";

function md(text: string): string {
  return text.replaceAll("|", "/").replace(/\s+/g, " ").trim();
}

export async function GET(_request: Request, { params }: { params: Promise<{ vorlage: string }> }) {
  const { vorlage } = await params;
  if (!isMusterVorlage(vorlage)) {
    return NextResponse.json({ error: "Unbekannte Vorlage." }, { status: 404 });
  }
  const muster = getGesamtMuster(vorlage)!;
  const steps = catalogFragebogen(muster.answers);
  const lines: string[] = [
    `# Muster-Fragebogen: Gesamtdokument ${muster.label}`,
    "",
    "*Fiktives Beispiel. Keine Steuerberatung.*",
    "",
  ];
  steps.forEach((step) => {
    lines.push(`## ${md(step.title)}`, "");
    for (const question of step.questions) {
      lines.push(`### ${md(question.prompt)}`, "");
      lines.push(`- **Stand:** ${question.status}`);
      for (const line of question.lines) lines.push(`- ${md(line)}`);
      lines.push("");
    }
  });
  const buffer = await generateMarkdownPdf({
    markdown: lines.join("\n"),
    company: muster.identity.company,
    title: `Muster-Fragebogen ${muster.label}`,
    footer: "Muster · fiktiv · keine Steuerberatung",
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="muster-fragebogen-${vorlage}.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
