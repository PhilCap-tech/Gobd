import PDFDocument from "pdfkit";
import {
  BRAND_GREEN,
  BRAND_HEADER_BG,
  BRAND_INK,
  BRAND_MUTED,
  BRAND_NAME,
  BRAND_NAVY,
  BRAND_RULE,
  drawBrandLockup,
} from "@/lib/pdf-brand";
import { CANONICAL_PRODUCTION_APP_URL } from "@/lib/env";

export const LEAD_MAGNET_SLUG = "10-offene-punkte";
export const LEAD_MAGNET_FILENAME = "10-offene-punkte-vor-der-pruefung.pdf";
export const LEAD_MAGNET_PATH = "/resources/10-offene-punkte";
export const LEAD_MAGNET_DOWNLOAD_PATH = "/resources/10-offene-punkte/download";

/** Soft CTA only. Campaign params stay on this magnet. */
export const LEAD_MAGNET_UTM =
  "utm_source=leadmagnet&utm_medium=pdf&utm_campaign=10-offene-punkte";

export const LEAD_MAGNET_HEADLINE = "10 Offene Punkte vor der Prüfung";
export const LEAD_MAGNET_SUBHEAD =
  "Kurzer Abgleich für KMU & Handwerk — keine Steuerberatung";
export const LEAD_MAGNET_INTRO =
  "Die Verfahrensdokumentation soll einem sachverständigen Dritten eure Belegwege erklären. Vor einer Betriebsprüfung hilft oft kein „mehr Text“, sondern Klarheit über Lücken. Diese Liste macht typische offene Punkte sichtbar — zum Abhaken mit Team und Steuerberater.";

export const LEAD_MAGNET_POINTS = [
  {
    title: "Ist-Zustand aktuell?",
    body: "Belegarten, Systeme, Rollen und Scan ja/nein kurz notiert — nicht nur aus dem Gedächtnis.",
  },
  {
    title: "Beschreibung = Alltag?",
    body: "Text und reale Abläufe stimmen überein; Standardfloskeln ohne Betriebsbezug sind markiert.",
  },
  {
    title: "Belegweg Ende-zu-Ende?",
    body: "Eingang → Prüfung → Buchhaltung/Ablage ist nachvollziehbar beschrieben.",
  },
  {
    title: "Systeme & Zugriff?",
    body: "Welche Software (z. B. DATEV, sevdesk, lexoffice — Beispiele), wo liegen Daten, wie Export/Zugriff organisiert ist — soweit für euch relevant.",
  },
  {
    title: "Verantwortliche & Freigabe?",
    body: "Wer pflegt die Doku? Wer hat freigegeben? Version und Datum vorhanden?",
  },
  {
    title: "Ersetzendes Scannen abgedeckt?",
    body: "Falls Originale vernichtet werden: Scanprozess, Qualitätskontrolle, Vernichtungsregeln, Ausnahmen dokumentiert.",
  },
  {
    title: "Versionen nachgehalten?",
    body: "Software- oder Prozesswechsel seit der letzten Version eingearbeitet oder als offen markiert.",
  },
  {
    title: "Offene Punkte sichtbar?",
    body: "Unklares steht auf einer Liste — nicht „wegoptimiert“, damit es fertig wirkt.",
  },
  {
    title: "Berater eingebunden?",
    body: "Entwurf gespiegelt; Rückfragen und Prioritäten geklärt — nicht erst am Prüfungstag.",
  },
  {
    title: "Ablage & Auffindbarkeit?",
    body: "Freigegebene Version liegt an einem bekannten Ort; Team weiß, welche Datei gilt.",
  },
] as const;

export const LEAD_MAGNET_CTA_TITLE = "Unsicher, wo ihr steht?";
export const LEAD_MAGNET_CTA_BEFORE = "Kostenloser ";
export const LEAD_MAGNET_CTA_LINK_LABEL = "Readiness-Check";
export const LEAD_MAGNET_CTA_AFTER =
  " — kurze Fragen zu Branche, Software, Belegwegen und IT. Ohne Kreditkarte. Keine Steuerberatung.";

export const LEAD_MAGNET_DISCLAIMER =
  "Allgemeine Arbeitshilfe von gobd-doku-erstellen.de. Keine Steuer-, Rechts- oder Prüfungsberatung. Keine Zusicherung von GoBD-Konformität oder Prüfungsergebnis. Abstimmung und Freigabe bleiben bei dir bzw. deinem Berater.";

export function leadMagnetReadinessHref(): string {
  return `/readiness?${LEAD_MAGNET_UTM}`;
}

/** Saved PDFs open later, so the link uses the canonical production origin. */
export function leadMagnetReadinessAbsoluteUrl(): string {
  return `${CANONICAL_PRODUCTION_APP_URL}${leadMagnetReadinessHref()}`;
}

type TextRun = { text: string; bold: boolean };

/**
 * Helvetica is WinAnsi. U+2192 is not in that encoding and pdfkit would
 * emit a corrupted pair, so arrows are drawn as a short stroke.
 */
function writeRuns(
  doc: PDFKit.PDFDocument,
  runs: TextRun[],
  x: number,
  y: number,
  width: number,
  size: number,
): number {
  const lineHeight = size * 1.34;
  let cursorX = x;
  let cursorY = y;

  const tokens: { kind: "word" | "space" | "arrow"; text: string; bold: boolean }[] = [];
  for (const run of runs) {
    const parts = run.text.split(/(\s+|→)/).filter((part) => part.length > 0);
    for (const part of parts) {
      if (part === "→") tokens.push({ kind: "arrow", text: part, bold: run.bold });
      else if (/^\s+$/.test(part)) tokens.push({ kind: "space", text: " ", bold: run.bold });
      else tokens.push({ kind: "word", text: part, bold: run.bold });
    }
  }

  for (const token of tokens) {
    doc.font(token.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    if (token.kind === "arrow") {
      const arrowWidth = size * 0.95;
      if (cursorX > x && cursorX + arrowWidth > x + width) {
        cursorX = x;
        cursorY += lineHeight;
      }
      drawArrow(doc, cursorX + 0.4, cursorY + size * 0.28, arrowWidth - 1.4);
      cursorX += arrowWidth;
      continue;
    }
    const tokenWidth = doc.widthOfString(token.text);
    if (token.kind === "space") {
      if (cursorX > x && cursorX + tokenWidth <= x + width) cursorX += tokenWidth;
      continue;
    }
    if (cursorX > x && cursorX + tokenWidth > x + width) {
      cursorX = x;
      cursorY += lineHeight;
    }
    doc.fillColor(BRAND_INK).text(token.text, cursorX, cursorY, { lineBreak: false });
    cursorX += tokenWidth;
  }

  doc.x = x;
  doc.y = cursorY + lineHeight;
  return cursorY + lineHeight;
}

function drawArrow(doc: PDFKit.PDFDocument, x: number, y: number, width: number) {
  const head = Math.max(3.2, width * 0.42);
  const midY = y + head * 0.42;
  doc.save();
  doc.strokeColor(BRAND_INK).lineWidth(0.7).lineJoin("miter");
  doc.moveTo(x, midY).lineTo(x + width - 0.4, midY).stroke();
  doc
    .moveTo(x + width - head, y)
    .lineTo(x + width, midY)
    .lineTo(x + width - head, y + head * 0.84)
    .stroke();
  doc.restore();
}

function writePoint(
  doc: PDFKit.PDFDocument,
  point: { title: string; body: string },
  left: number,
  y: number,
  width: number,
): number {
  const size = 9.4;
  const box = 9;
  const textX = left + box + 7;
  const textWidth = width - box - 7;
  doc
    .save()
    .lineWidth(0.9)
    .strokeColor(BRAND_GREEN)
    .rect(left, y + 1.4, box, box)
    .stroke()
    .restore();
  const endY = writeRuns(
    doc,
    [
      { text: `${point.title} `, bold: true },
      { text: point.body, bold: false },
    ],
    textX,
    y,
    textWidth,
    size,
  );
  return endY + 4.5;
}

function writeCtaBox(
  doc: PDFKit.PDFDocument,
  left: number,
  y: number,
  width: number,
): number {
  const padX = 12;
  const padY = 9;
  const innerWidth = width - padX * 2;
  doc.font("Helvetica-Bold").fontSize(11);
  const titleHeight = doc.heightOfString(LEAD_MAGNET_CTA_TITLE, { width: innerWidth });
  doc.font("Helvetica").fontSize(9.4);
  const bodyHeight = doc.heightOfString(
    `${LEAD_MAGNET_CTA_BEFORE}${LEAD_MAGNET_CTA_LINK_LABEL}${LEAD_MAGNET_CTA_AFTER}`,
    { width: innerWidth, lineGap: 1 },
  );
  const boxHeight = padY + titleHeight + 3 + bodyHeight + padY;

  doc.save();
  doc.roundedRect(left, y, width, boxHeight, 4).fill(BRAND_HEADER_BG);
  doc.restore();
  doc
    .save()
    .strokeColor(BRAND_GREEN)
    .lineWidth(2.4)
    .moveTo(left + 1.2, y + 5)
    .lineTo(left + 1.2, y + boxHeight - 5)
    .stroke()
    .restore();

  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND_NAVY);
  doc.text(LEAD_MAGNET_CTA_TITLE, left + padX, y + padY, { width: innerWidth });
  const bodyY = y + padY + titleHeight + 3;
  doc.font("Helvetica").fontSize(9.4).fillColor(BRAND_INK);
  doc.text(LEAD_MAGNET_CTA_BEFORE, left + padX, bodyY, {
    width: innerWidth,
    continued: true,
    lineGap: 1,
  });
  doc.fillColor(BRAND_GREEN).text(LEAD_MAGNET_CTA_LINK_LABEL, {
    continued: true,
    underline: true,
    link: leadMagnetReadinessAbsoluteUrl(),
  });
  // Continued text inherits link/underline; clear both so only the label is linked.
  doc.fillColor(BRAND_INK).text(LEAD_MAGNET_CTA_AFTER, {
    lineGap: 1,
    link: null,
    underline: false,
  });
  return y + boxHeight;
}

export function generateLeadMagnetPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 28, bottom: 16, left: 40, right: 40 },
      bufferPages: true,
      info: {
        Title: LEAD_MAGNET_HEADLINE,
        Author: BRAND_NAME,
        Subject: "Arbeitshilfe — keine Steuerberatung",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    const lockupHeight = 22;
    const headerTop = 26;
    drawBrandLockup(doc, left, headerTop, lockupHeight);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND_MUTED)
      .text("gobd-doku-erstellen.de", left, headerTop + 6, {
        width,
        align: "right",
        lineBreak: false,
      });
    const headerRule = headerTop + lockupHeight + 8;
    doc
      .save()
      .strokeColor(BRAND_NAVY)
      .lineWidth(1.1)
      .moveTo(left, headerRule)
      .lineTo(left + width, headerRule)
      .stroke()
      .restore();

    let y = headerRule + 14;
    doc.font("Helvetica-Bold").fontSize(18).fillColor(BRAND_NAVY);
    doc.text(LEAD_MAGNET_HEADLINE, left, y, { width, lineBreak: true });
    y = doc.y + 3;
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(BRAND_MUTED);
    doc.text(LEAD_MAGNET_SUBHEAD, left, y, { width });
    y = doc.y + 8;
    doc.font("Helvetica").fontSize(9.6).fillColor(BRAND_INK);
    doc.text(LEAD_MAGNET_INTRO, left, y, { width, lineGap: 1.4 });
    y = doc.y + 10;

    for (const point of LEAD_MAGNET_POINTS) {
      y = writePoint(doc, point, left, y, width);
    }

    y += 6;
    y = writeCtaBox(doc, left, y, width);

    doc.font("Helvetica").fontSize(7.4).fillColor(BRAND_MUTED);
    const disclaimerHeight = doc.heightOfString(LEAD_MAGNET_DISCLAIMER, {
      width,
      lineGap: 0.8,
    });
    const disclaimerY = doc.page.height - 18 - disclaimerHeight;
    const footerRule = disclaimerY - 8;
    if (y > footerRule - 10) {
      reject(new Error("Lead-Magnet PDF passt nicht auf eine A4-Seite."));
      return;
    }

    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .save()
      .strokeColor(BRAND_RULE)
      .lineWidth(0.7)
      .moveTo(left, footerRule)
      .lineTo(left + width, footerRule)
      .stroke()
      .restore();
    doc.font("Helvetica").fontSize(7.4).fillColor(BRAND_MUTED);
    doc.text(LEAD_MAGNET_DISCLAIMER, left, disclaimerY, { width, lineGap: 0.8 });
    doc.page.margins.bottom = savedBottom;

    const pages = doc.bufferedPageRange().count;
    if (pages !== 1) {
      reject(new Error(`Lead-Magnet PDF hat ${pages} Seiten, erwartet 1.`));
      return;
    }
    doc.end();
  });
}
