import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const TITLE = "Mandanten-Merkblatt: Verfahrensdokumentation nach GoBD";
const regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

function clean(line: string): string {
  return line.replaceAll("**", "").replaceAll("`", "").trim();
}

function render(markdown: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: TITLE,
      Author: "IKAT GmbH",
      Subject: "Merkblatt zum Weitergeben an Mandanten",
    },
  });
  doc.registerFont("body", regular);
  doc.registerFont("strong", bold);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const lines = markdown.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "---") continue;
    if (line.startsWith("|---")) continue;
    if (line.startsWith("# ")) {
      doc.moveDown(0.4);
      doc.font("strong").fontSize(16).fillColor("#1d3a34").text(clean(line.slice(2)), { align: "left" });
      doc.moveDown(0.3);
      continue;
    }
    if (line.startsWith("## ")) {
      doc.moveDown(0.5);
      doc.font("strong").fontSize(13).fillColor("#1d3a34").text(clean(line.slice(3)));
      doc.moveDown(0.2);
      continue;
    }
    if (line.startsWith(">")) {
      doc.font("body").fontSize(10).fillColor("#3c4448").text(clean(line.replace(/^>\s?/, "")), { indent: 8 });
      doc.moveDown(0.2);
      continue;
    }
    if (line.startsWith("|")) {
      const cells = line.split("|").map((cell) => clean(cell)).filter(Boolean);
      if (cells.length === 0) continue;
      doc.font("body").fontSize(10).fillColor("#1c2124").text(cells.join(" — "));
      continue;
    }
    if (line.startsWith("- ")) {
      doc.font("body").fontSize(10).fillColor("#1c2124").text(`• ${clean(line.slice(2))}`, { indent: 8 });
      doc.moveDown(0.15);
      continue;
    }
    doc.font("body").fontSize(10).fillColor("#1c2124").text(clean(line));
    doc.moveDown(0.25);
  }
  doc.end();
  return done;
}

async function main() {
  const source = readFileSync(path.join(process.cwd(), "content/kanzlei-merkblatt.md"), "utf8");
  const pdf = await render(source);
  if (!pdf.subarray(0, 5).toString("utf8").startsWith("%PDF")) {
    throw new Error("PDF header missing");
  }
  const title = pdf.toString("latin1");
  if (title.includes("(Entwurf)")) throw new Error("draft marker in PDF");
  writeFileSync(path.join(process.cwd(), "content/kanzlei-merkblatt.pdf"), pdf);
  console.log(`wrote ${pdf.length} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
