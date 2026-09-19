/**
 * Shared markdown-ish writer for pdfkit (delivery PDFs + readiness modules).
 */

function isTableSeparator(line: string): boolean {
  return /^\|\s*:?-{3,}/.test(line.replaceAll(" ", ""));
}

function unwrapLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)");
}

function writeInline(doc: PDFKit.PDFDocument, text: string, width: number) {
  const plain = unwrapLinks(text);
  if (!plain.includes("**")) {
    doc.font("Helvetica").fontSize(10).fillColor("#14201b").text(plain, { width });
    return;
  }
  const parts = plain.split("**");
  parts.forEach((part, index) => {
    doc.font(index % 2 === 1 ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(part, { width, continued: index < parts.length - 1 });
  });
  doc.text("");
}

function writeTable(doc: PDFKit.PDFDocument, rows: string[][], width: number) {
  doc.font("Helvetica").fontSize(9).fillColor("#14201b");
  for (const [index, cells] of rows.entries()) {
    const line = cells.join("  ·  ");
    doc.font(index === 0 ? "Helvetica-Bold" : "Helvetica").text(line, { width });
  }
  doc.moveDown(0.3);
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
      doc.moveDown(0.3 * spacing);
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
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#14201b");
      doc.text(unwrapLinks(line.slice(2)), { width });
      doc.moveDown(0.25 * spacing);
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#14201b");
      doc.text(unwrapLinks(line.slice(4)), { width });
      doc.moveDown(0.18 * spacing);
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#14201b");
      doc.text(unwrapLinks(line.slice(3)), { width });
      doc.moveDown(0.22 * spacing);
      index += 1;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      const y = doc.y + 2;
      doc
        .save()
        .strokeColor("#d8ddd8")
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
