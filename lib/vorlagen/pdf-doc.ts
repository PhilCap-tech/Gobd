import PDFDocument from "pdfkit";
import {
  BRAND_INK,
  BRAND_MUTED,
  BRAND_NAVY,
  BRAND_RULE,
  drawBrandLockup,
} from "@/lib/pdf-brand";

type Run = { text: string; bold: boolean; italic?: boolean; link?: string };

function pdfPlain(text: string): string {
  return text.replaceAll("→", "->").replaceAll("\u00a0", " ");
}

function tokenize(input: string): Run[] {
  const text = pdfPlain(input);
  const runs: Run[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|https?:\/\/[^\s)]+)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) runs.push({ text: text.slice(last, index), bold: false });
    const token = match[0];
    if (token.startsWith("**")) runs.push({ text: token.slice(2, -2), bold: true });
    else if (token.startsWith("*")) runs.push({ text: token.slice(1, -1), bold: false, italic: true });
    else runs.push({ text: token, bold: false, link: token });
    last = index + token.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false });
  return runs.filter((run) => run.text.length > 0);
}

export function renderMagnetMarkdown(markdown: string, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 64, bottom: 48, left: 48, right: 48 },
      compress: false,
      info: { Title: title, Author: "gobd-doku-erstellen.de", Subject: "Arbeitshilfe — keine Steuerberatung" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;

    function header(): number {
      const top = 32;
      drawBrandLockup(doc, left, top, 16);
      doc.font("Helvetica").fontSize(8).fillColor(BRAND_MUTED).text("gobd-doku-erstellen.de", left, top + 3, {
        width,
        align: "right",
        lineBreak: false,
      });
      const rule = top + 24;
      doc.save().strokeColor(BRAND_NAVY).lineWidth(0.8).moveTo(left, rule).lineTo(left + width, rule).stroke().restore();
      doc.x = left;
      doc.y = rule + 14;
      return rule + 14;
    }

    let y = header();

    function ensure(needed: number): void {
      if (y + needed <= bottom()) return;
      doc.addPage();
      y = header();
    }

    function writeRuns(runs: Run[], size: number, color: string, indent = 0): void {
      const lineHeight = size * 1.35;
      const textLeft = left + indent;
      const textWidth = width - indent;
      let cursorX = textLeft;
      let cursorY = y;
      const tokens: Run[] = [];
      for (const run of runs) {
        const parts = run.text.split(/(\s+)/).filter((part) => part.length > 0);
        for (const part of parts) tokens.push({ ...run, text: part });
      }
      let chunk = "";
      let chunkStyle: Run | null = null;
      const sameStyle = (token: Run) =>
        chunkStyle !== null &&
        chunkStyle.bold === token.bold &&
        chunkStyle.italic === token.italic &&
        chunkStyle.link === token.link;
      const paint = (text: string, token: Run, x: number, yPos: number) => {
        const face = token.bold ? "Helvetica-Bold" : token.italic ? "Helvetica-Oblique" : "Helvetica";
        doc.font(face).fontSize(size).fillColor(token.link ? BRAND_NAVY : color);
        doc.text(text, x, yPos, {
          lineBreak: false,
          underline: Boolean(token.link),
          link: token.link ?? undefined,
        });
      };
      const flush = () => {
        if (!chunk || !chunkStyle) {
          chunk = "";
          chunkStyle = null;
          return;
        }
        const style = chunkStyle;
        const text = chunk;
        chunk = "";
        chunkStyle = null;
        paint(text, style, cursorX, cursorY);
        const face = style.bold ? "Helvetica-Bold" : style.italic ? "Helvetica-Oblique" : "Helvetica";
        doc.font(face).fontSize(size);
        cursorX += doc.widthOfString(text);
      };
      const newline = () => {
        flush();
        cursorX = textLeft;
        cursorY += lineHeight;
        if (cursorY + lineHeight > bottom()) {
          doc.addPage();
          cursorY = header();
        }
      };
      for (const token of tokens) {
        const space = /^\s+$/.test(token.text);
        doc.font(token.bold ? "Helvetica-Bold" : token.italic ? "Helvetica-Oblique" : "Helvetica").fontSize(size);
        if (space) {
          if (cursorX === textLeft && chunk === "") continue;
          if (cursorX + doc.widthOfString(chunk + token.text) > textLeft + textWidth) continue;
          if (!sameStyle(token)) flush();
          chunkStyle = chunkStyle ?? token;
          chunk += token.text;
          continue;
        }
        const nextWidth = doc.widthOfString(chunk + token.text);
        if (chunk && cursorX + nextWidth > textLeft + textWidth) newline();
        if (!sameStyle(token)) flush();
        chunkStyle = chunkStyle ?? token;
        chunk += token.text;
      }
      flush();
      y = cursorY + lineHeight;
      doc.x = left;
      doc.y = y;
    }

    for (const rawLine of markdown.replaceAll("\r\n", "\n").split("\n")) {
      const line = rawLine.trim();
      if (!line) {
        y += 6;
        continue;
      }
      if (line === "---") {
        ensure(14);
        doc.save().strokeColor(BRAND_RULE).lineWidth(0.6).moveTo(left, y).lineTo(left + width, y).stroke().restore();
        y += 12;
        continue;
      }
      if (line.startsWith("# ")) {
        ensure(28);
        writeRuns(tokenize(line.slice(2)), 16, BRAND_NAVY);
        y += 2;
        continue;
      }
      if (line.startsWith("## ")) {
        ensure(22);
        writeRuns(tokenize(line.slice(3)), 13, BRAND_NAVY);
        continue;
      }
      if (line.startsWith("### ")) {
        ensure(18);
        writeRuns(tokenize(line.slice(4)), 11, BRAND_NAVY);
        continue;
      }
      if (line.startsWith("☐")) {
        ensure(16);
        const box = 8;
        doc.save().lineWidth(0.8).strokeColor(BRAND_NAVY).rect(left, y + 1, box, box).stroke().restore();
        const body = line.replace(/^☐\s*/, "");
        writeRuns(tokenize(body), 9.5, BRAND_INK, 14);
        y += 2;
        continue;
      }
      if (line.startsWith("- ")) {
        ensure(16);
        doc.font("Helvetica").fontSize(9.5).fillColor(BRAND_INK).text("•", left, y, { lineBreak: false });
        writeRuns(tokenize(line.slice(2)), 9.5, BRAND_INK, 12);
        continue;
      }
      const italic = line.startsWith("*") && line.endsWith("*") && !line.startsWith("**");
      ensure(16);
      writeRuns(tokenize(italic ? line.slice(1, -1) : line), italic ? 8 : 9.5, italic ? BRAND_MUTED : BRAND_INK);
      y += italic ? 2 : 3;
    }

    doc.end();
  });
}
