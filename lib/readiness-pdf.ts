import PDFDocument from "pdfkit";
import { writeMarkdownish } from "@/lib/pdf-markdown";
import { renderReadinessMarkdown } from "@/lib/readiness-content";
import {
  READINESS_DISCLAIMER,
  firmaPlaceholder,
  formatReadinessDate,
  type ReadinessAnswers,
} from "@/lib/readiness";

export async function generateReadinessPdf(answers: ReadinessAnswers): Promise<{
  buffer: Buffer;
  title: string;
}> {
  const { title, markdown } = renderReadinessMarkdown(answers);
  const firma = firmaPlaceholder(answers.company, answers.name);
  const datum = formatReadinessDate();
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

    const width = 480;
    doc.moveDown(4);
    doc.font("Helvetica").fontSize(10).fillColor("#5a6560");
    doc.text("GoBD Verfahrensdoku  ·  kostenlose Arbeitshilfe", { width });
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#14201b");
    doc.text(title, { width });
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(12).fillColor("#14201b");
    doc.text(`Betrieb: ${firma}`, { width });
    doc.text(`Stand: ${datum}`, { width });
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(10).fillColor("#5a6560");
    doc.text(READINESS_DISCLAIMER, { width });
    doc.addPage();

    writeMarkdownish(doc, markdown, width);
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(8).fillColor("#5a6560");
    doc.text(READINESS_DISCLAIMER, { width });
    doc.end();
  });
  return { buffer, title };
}
