import { existsSync } from "node:fs";
import path from "node:path";

export const BRAND_GREEN = "#1f6b4a";
export const BRAND_NAVY = "#002050";
export const BRAND_INK = "#14201b";
export const BRAND_MUTED = "#5a6560";
export const BRAND_RULE = "#d8ddd8";
export const BRAND_HEADER_BG = "#eef4f0";
export const BRAND_NAME = "GoBD Verfahrensdoku";
export const BRAND_DOC_TITLE = "Verfahrensdokumentation zur Belegablage";

/** Trimmed official lockup (document + GoBD / Verfahrensdoku). */
const LOCKUP_ASPECT = 1015 / 385;

export function brandLockupPath(): string {
  return path.join(process.cwd(), "public", "brand", "logo-lockup.png");
}

export function brandMarkPath(): string {
  return path.join(process.cwd(), "public", "brand", "logo-mark.png");
}

export function brandLockupWidth(height: number): number {
  return height * LOCKUP_ASPECT;
}

/** Official lockup PNG — no generated wordmark. */
export function drawBrandLockup(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  height: number,
): number {
  const file = brandLockupPath();
  const width = brandLockupWidth(height);
  if (existsSync(file)) {
    doc.image(file, x, y, { height, width });
    return width;
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(Math.max(9, height * 0.38))
    .fillColor(BRAND_NAVY)
    .text(BRAND_NAME, x, y + height * 0.2, { lineBreak: false });
  return width;
}
