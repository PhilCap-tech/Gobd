import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { kanzleiMerkblattLines } from "@/lib/kanzlei-toolbox-copy";
import { drawBrandLockup } from "@/lib/pdf-brand";

export async function kanzleiQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", margin: 1, width: 280, errorCorrectionLevel: "M" });
}

export async function buildKanzleiMerkblattPdf(input: { displayName: string; slug: string; link: string }): Promise<Buffer> {
  const qr = await kanzleiQrPng(input.link);
  const lines = kanzleiMerkblattLines(input.displayName, input.slug);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: "GoBD-Ampel-Check für Mandanten",
        Author: LEGAL_OPERATOR.name,
        Subject: "Hinweis, keine Steuerberatung",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawBrandLockup(doc, doc.page.margins.left, doc.page.margins.top, 24);
    doc.y = doc.page.margins.top + 36;
    doc.font("Helvetica-Bold").fontSize(16).text(lines[0] ?? "", { width: 500 });
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11).text(lines[1] ?? "", { width: 500 });
    doc.moveDown(0.6);
    for (const line of lines.slice(2)) {
      const heading = !line.startsWith("1.") && !line.startsWith("2.") && !line.startsWith("3.") && line.length < 48 && !line.includes(".");
      doc.font(heading ? "Helvetica-Bold" : "Helvetica").fontSize(heading ? 12 : 10).text(line, { width: 360 });
      doc.moveDown(0.25);
    }
    doc.image(qr, 430, 120, { width: 120 });
    doc.end();
  });
}
