import { existsSync } from "node:fs";
import path from "node:path";

export const BRAND_GREEN = "#1f6b4a";
export const BRAND_INK = "#14201b";
export const BRAND_MUTED = "#5a6560";
export const BRAND_RULE = "#d8ddd8";
export const BRAND_HEADER_BG = "#eef4f0";
export const BRAND_NAME = "GoBD Verfahrensdoku";
export const BRAND_DOC_TITLE = "Verfahrensdokumentation zur Belegablage";

export function brandMarkPngPath(): string {
  return path.join(process.cwd(), "public", "branding", "gobd-mark.png");
}

/** Document-icon mark matching `app/icon.svg` / the wordmark tile. */
export function drawBrandMark(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
) {
  const png = brandMarkPngPath();
  if (existsSync(png)) {
    doc.image(png, x, y, { width: size, height: size });
    return;
  }

  const scale = size / 32;
  doc.save();
  doc.translate(x, y).scale(scale);
  doc.roundedRect(0, 0, 32, 32, 6).fill(BRAND_GREEN);
  doc
    .lineWidth(1.6)
    .strokeColor("#ffffff")
    .moveTo(9, 8.5)
    .lineTo(19, 8.5)
    .lineTo(23, 12.5)
    .lineTo(23, 23.5)
    .lineTo(9, 23.5)
    .closePath()
    .stroke();
  doc.moveTo(19, 8.5).lineTo(19, 13).lineTo(23, 13).stroke();
  doc.lineCap("round");
  doc.moveTo(12, 17).lineTo(20, 17).stroke();
  doc.moveTo(12, 20.5).lineTo(18, 20.5).stroke();
  doc.restore();
}

export function drawBrandWordmark(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  markSize: number,
) {
  drawBrandMark(doc, x, y, markSize);
  const textX = x + markSize + 10;
  const titleSize = markSize >= 32 ? 13 : 10;
  const subSize = markSize >= 32 ? 10 : 8;
  doc
    .font("Helvetica-Bold")
    .fontSize(titleSize)
    .fillColor(BRAND_INK)
    .text("GoBD", textX, y + markSize * 0.08, { lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(subSize)
    .fillColor(BRAND_GREEN)
    .text("Verfahrensdoku", textX, y + markSize * 0.52, { lineBreak: false });
}
