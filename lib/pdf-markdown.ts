/**
 * Shared markdown-ish writer for pdfkit (delivery PDFs + readiness modules).
 */

import {
  BRAND_GREEN,
  BRAND_HEADER_BG,
  BRAND_INK,
  BRAND_MUTED,
  BRAND_RULE,
} from "@/lib/pdf-brand";

function isTableSeparator(line: string): boolean {
  return /^\|\s*:?-{3,}/.test(line.replaceAll(" ", ""));
}

function unwrapLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)");
}

function remainingHeight(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom - doc.y;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (remainingHeight(doc) < needed) {
    doc.addPage();
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  }
}

function writeInline(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  options?: { x?: number; y?: number; size?: number },
) {
  const plain = unwrapLinks(text).replace(/`([^`]+)`/g, "$1");
  const size = options?.size ?? 10;
  if (options?.x != null) doc.x = options.x;
  if (options?.y != null) doc.y = options.y;
  const segments = plain
    .split("**")
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
  if (segments.length === 0) return;
  if (segments.length === 1 && !segments[0]?.bold) {
    doc.font("Helvetica").fontSize(size).fillColor(BRAND_INK).text(segments[0]?.text ?? "", {
      width,
    });
    return;
  }
  segments.forEach((segment, index) => {
    doc
      .font(segment.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .fillColor(BRAND_INK);
    const last = index === segments.length - 1;
    if (index === 0) {
      doc.text(segment.text, { width, continued: !last });
    } else {
      doc.text(segment.text, { continued: !last });
    }
  });
}

function columnWidths(rows: string[][], width: number): number[] {
  const cols = Math.max(...rows.map((row) => row.length), 1);
  const weights = Array.from({ length: cols }, () => 1);
  for (const row of rows) {
    row.forEach((cell, index) => {
      weights[index] = Math.max(weights[index] ?? 1, Math.min(String(cell).length, 42));
    });
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0) || cols;
  return weights.map((weight) => (width * weight) / total);
}

function cellPlain(cell: string): string {
  return unwrapLinks(cell)
    .replaceAll("**", "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function cellIsBold(cell: string): boolean {
  return /\*\*[^*]+\*\*/.test(cell);
}

function writeTable(doc: PDFKit.PDFDocument, rows: string[][], width: number) {
  if (rows.length === 0) return;
  let start = 0;
  while (start < rows.length && rows[start]?.every((cell) => cellPlain(cell).length === 0)) {
    start += 1;
  }
  const visible = rows.slice(start);
  if (visible.length === 0) return;
  const headerIsReal = start === 0;
  const left = doc.page.margins.left;
  const cols = columnWidths(
    visible.map((row) => row.map(cellPlain)),
    width,
  );
  const pad = 5;

  visible.forEach((cells, rowIndex) => {
    const useHeaderFill = headerIsReal && rowIndex === 0;
    doc.font(useHeaderFill ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
    let rowHeight = 16;
    cells.forEach((cell, index) => {
      const h = doc.heightOfString(cellPlain(cell) || " ", {
        width: Math.max((cols[index] ?? width) - pad * 2, 20),
      });
      rowHeight = Math.max(rowHeight, h + pad * 2);
    });
    ensureSpace(doc, rowHeight + 2);
    const y = doc.y;
    if (useHeaderFill) {
      doc.save().rect(left, y, width, rowHeight).fill(BRAND_HEADER_BG).restore();
    }
    doc.save().strokeColor(BRAND_RULE).lineWidth(0.45);
    doc.rect(left, y, width, rowHeight).stroke();
    let x = left;
    for (const colWidth of cols.slice(0, -1)) {
      x += colWidth;
      doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
    }
    doc.restore();

    x = left;
    cells.forEach((cell, index) => {
      const colWidth = cols[index] ?? width;
      const bold = useHeaderFill || cellIsBold(cell);
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8.5)
        .fillColor(BRAND_INK)
        .text(cellPlain(cell), x + pad, y + pad, {
          width: Math.max(colWidth - pad * 2, 16),
        });
      x += colWidth;
    });
    doc.x = left;
    doc.y = y + rowHeight;
  });
  doc.moveDown(0.35);
}

function writeHeading(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  size: number,
  spacing: number,
  rule: boolean,
) {
  ensureSpace(doc, size + 28);
  const left = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(size).fillColor(BRAND_INK);
  doc.text(text, { width });
  if (rule) {
    const y = doc.y + 3;
    doc
      .save()
      .strokeColor(BRAND_GREEN)
      .lineWidth(1.2)
      .moveTo(left, y)
      .lineTo(left + Math.min(width, 220), y)
      .stroke()
      .restore();
    doc.moveDown(0.35 * spacing);
  } else {
    doc.moveDown(0.2 * spacing);
  }
}

function writeAbsatz(doc: PDFKit.PDFDocument, num: string, body: string, width: number) {
  const left = doc.page.margins.left;
  const label = `[${num}]`;
  const labelW = 28;
  const gap = 8;
  const bodyWidth = Math.max(width - labelW - gap, 80);
  ensureSpace(doc, 22);
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND_GREEN);
  doc.text(label, left, y, { width: labelW, lineBreak: false });
  writeInline(doc, body, bodyWidth, { x: left + labelW + gap, y, size: 10 });
  doc.x = left;
  doc.y += 5;
}

export function writeMarkdownish(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  spacing = 1,
) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const raw = lines[index] ?? "";
    const line = raw.trimEnd();
    if (!line.trim()) {
      doc.moveDown(0.28 * spacing);
      index += 1;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
        const tableLine = (lines[index] ?? "").trim();
        if (!isTableSeparator(tableLine)) tableLines.push(tableLine);
        index += 1;
      }
      const rows = tableLines.map((row) =>
        row
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim()),
      );
      writeTable(doc, rows, width);
      continue;
    }
    if (line.startsWith("# ")) {
      writeHeading(doc, unwrapLinks(line.slice(2)), width, 16, spacing, true);
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      writeHeading(doc, unwrapLinks(line.slice(4)), width, 11, spacing, false);
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      writeHeading(doc, unwrapLinks(line.slice(3)), width, 12.5, spacing, false);
      index += 1;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      const y = doc.y + 2;
      doc
        .save()
        .strokeColor(BRAND_RULE)
        .lineWidth(0.8)
        .moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.margins.left + width, y)
        .stroke()
        .restore();
      doc.moveDown(0.45);
      index += 1;
      continue;
    }
    const checkbox = line.match(/^- \[([ xX])\]\s+(.*)$/);
    if (checkbox) {
      const mark = checkbox[1] === " " ? "[ ]" : "[x]";
      writeInline(doc, `${mark}  ${checkbox[2] ?? ""}`, width);
      index += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      writeInline(doc, `• ${line.slice(2)}`, width);
      index += 1;
      continue;
    }
    const italicHint = line.trim().match(/^\*(.+)\*$/);
    if (italicHint && !line.trim().startsWith("**")) {
      ensureSpace(doc, 18);
      doc
        .font("Helvetica-Oblique")
        .fontSize(9.5)
        .fillColor(BRAND_MUTED)
        .text(unwrapLinks(italicHint[1] ?? ""), { width });
      doc.fillColor(BRAND_INK);
      index += 1;
      continue;
    }
    const absatz = line.match(/^\[(\d+)\]\s+(.*)$/);
    if (absatz) {
      writeAbsatz(doc, absatz[1] ?? "1", absatz[2] ?? "", width);
      index += 1;
      continue;
    }
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      writeInline(doc, `${numbered[1]}. ${numbered[2] ?? ""}`, width);
      index += 1;
      continue;
    }
    writeInline(doc, line, width);
    index += 1;
  }
}

export function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return match ? raw.slice(match[0].length) : raw;
}
