import PDFDocument from "pdfkit";
import { writeMarkdownish } from "@/lib/pdf-markdown";
import { renderReadinessMarkdown } from "@/lib/readiness-content";
import { READINESS_DISCLAIMER, type ReadinessAnswers } from "@/lib/readiness";

export async function generateReadinessPdf(answers: ReadinessAnswers): Promise<{
  buffer: Buffer;
  title: string;
}> {
  const { title, markdown } = renderReadinessMarkdown(answers);
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title: title,
        Author: "GoBD Verfahrensdoku",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    writeMarkdownish(doc, markdown, 480);
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(8).fillColor("#5a6560");
    doc.text(READINESS_DISCLAIMER, { width: 480 });
    doc.end();
  });
  return { buffer, title };
}
