import { bereichDocTitle, bereichIdOf, bereichLabel, isBelegfluss } from "@/lib/bereiche";
import { gesamtDocTitle } from "@/lib/gesamt-document";
import { isGesamt } from "@/lib/module/status";
import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import {
  deliveryBundle,
  renderDeliveryDocument,
  type DeliveryOpenPoint,
  type RenderedDocument,
} from "@/lib/delivery-templates";
import {
  BRAND_DOC_TITLE,
  BRAND_INK,
  BRAND_MUTED,
  BRAND_NAME,
  BRAND_NAVY,
  BRAND_RULE,
  drawBrandLockup,
} from "@/lib/pdf-brand";
import { writeMarkdownish } from "@/lib/pdf-markdown";
import { CANONICAL_PRODUCTION_APP_URL } from "@/lib/env";
import {
  PDF_UPSELL_BODY,
  PDF_UPSELL_CTA,
  PDF_UPSELL_DISCLAIMER,
  PDF_UPSELL_FOOTNOTE,
  PDF_UPSELL_HEADLINE,
  PDF_UPSELL_PRICE,
} from "@/lib/offer-copy";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";
import type { VersionHistoryEntry, VersionPdfMeta } from "@/lib/versioning";

/**
 * GoBD Delivery Templates v3.0.0 — local PDF from Intake + content/delivery-templates.
 * Präsens only for confirmed intake answers. No technical ids in the customer PDF.
 */

const FOOTER_CHROME =
  "Kein Steuerberatungsersatz. Arbeitsfassung aus Kunden-Intake — vollständiger Hinweis auf dem Deckblatt.";

/** Nur Muster-PDFs. Kunden-PDFs bleiben ohne diesen Zusatz. */
export type PdfVariant = "muster" | "kunde";

export const MUSTER_WATERMARK = "MUSTER – fiktive Firma";
export const MUSTER_COVER_LINE = "Muster mit fiktiven Angaben";
export const KUNDE_COVER_LINE = "Arbeitsfassung aus Kunden-Intake";

const MUSTER_WATERMARK_COLOR = "#b5b5b5";
const MUSTER_WATERMARK_OPACITY = 0.18;

function isMuster(variant: PdfVariant | undefined): variant is "muster" {
  return variant === "muster";
}

function coverLine(variant: PdfVariant): string {
  return isMuster(variant) ? MUSTER_COVER_LINE : KUNDE_COVER_LINE;
}

function footerChrome(variant: PdfVariant): string {
  if (isMuster(variant)) {
    return "Kein Steuerberatungsersatz. Muster mit fiktiven Angaben.";
  }
  return FOOTER_CHROME;
}

function pdfCheckoutHref(): string {
  return `${CANONICAL_PRODUCTION_APP_URL}/checkout`;
}

export const DELIVERY_DISCLAIMER = deliveryBundle.disclaimer;

const PAGE_MARGIN = {
  top: 86,
  bottom: 72,
  left: 56,
  right: 56,
};

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

export type DeliveryChapter = {
  id: string;
  title: string;
  source: "placeholder";
  intakeHint: string;
};

export type DeliveryOpenItem = {
  id: string;
  priority: DeliveryOpenPoint["priority"];
  text: string;
  responsibility?: string;
  dueDate?: string;
  title: string;
  status: "open";
  severity?: DeliveryOpenPoint["severity"];
};

export type DeliveryPdfMeta = {
  version: number;
  documentId: string;
  url: string;
  pathname: string;
  backend: "blob" | "file";
};

/** Customer-owned chapter text (rendered draft or later edits). */
export type DeliveryDocumentContent = {
  cover?: string;
  chapters: Array<{
    id: string;
    title: string;
    body: string;
  }>;
};

export type DeliveryPlan = {
  status: "ready" | "failed";
  chapters: DeliveryChapter[];
  openItems: DeliveryOpenItem[];
  pdf: DeliveryPdfMeta | null;
};

function hintFromAnswers(id: string, answers: IntakeAnswers): string {
  const join = (values: string[]) => values.join(", ");
  switch (id) {
    case "00b-dokumentenlenkung":
      return "Dokumentenlenkung";
    case "01-zweck-geltung":
      return answers.gf || "Zweck";
    case "02-unternehmen-rollen":
      return answers.gf || join(answers.branchen) || "Rollen";
    case "03-systeme-datenfluss":
      return join(answers.fibu) || "Systeme";
    case "04-belegarten-kanaele":
      return join(answers.eingangsbelege) || "Belegarten";
    case "05-eingang-erechnung":
      return join(answers.eingangsbelege) || "Eingang fehlt";
    case "06-papier-digitalisierung":
      return "Papier nur wenn genannt";
    case "07-ausgangsrechnungen":
      return join(answers.ausgangsrechnungen) || "Ausgang fehlt";
    case "08-freigabe-buchung-status":
      return answers.gf || "Freigabe";
    case "09-ablage-aufbewahrung":
      return answers.archiv || "Aufbewahrung";
    case "10-berechtigungen-sicherung":
      return answers.zugriff || "Zugriff";
    case "11-iks":
      return "Kontrollen nicht bestätigt";
    case "12-versionspflege":
      return "Bestätigung ausstehend";
    case "13-mitgeltende-unterlagen":
      return "Anlagen offen";
    case "14-offene-punkte":
      return "Offene Punkte";
    case "A-prozessmatrix":
      return "Prozessmatrix";
    case "B-begriffe":
      return "Begriffe";
    default:
      return "";
  }
}

export function planDelivery(
  answers: IntakeAnswers,
  identity?: CheckoutIdentity,
  version?: number,
): DeliveryPlan {
  const rendered = renderDeliveryDocument({
    identity: identity ?? {
      email: "",
      company: "",
      stripeSessionId: "",
      stripeCustomerId: "",
      stub: true,
    },
    answers,
    documentId: "plan",
    version,
  });

  return {
    status: "ready",
    chapters: rendered.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      source: "placeholder",
      intakeHint: hintFromAnswers(chapter.id, answers),
    })),
    openItems: rendered.openPoints.map((item) => ({
      id: item.id,
      priority: item.priority,
      text: item.text,
      responsibility: item.responsibility,
      ...(item.dueDate ? { dueDate: item.dueDate } : {}),
      title: item.title,
      status: "open" as const,
      severity: item.severity,
    })),
    pdf: null,
  };
}

export async function enqueueDelivery(input: {
  sessionId: string;
  answers: IntakeAnswers;
}): Promise<DeliveryPlan> {
  const plan = planDelivery(input.answers);
  console.info("[delivery] plan", {
    sessionId: input.sessionId,
    chapters: plan.chapters.map((c) => c.id),
  });
  return plan;
}

function withOpenMargins(doc: PDFKit.PDFDocument, write: () => void) {
  const saved = { ...doc.page.margins };
  doc.page.margins = { top: 0, bottom: 0, left: saved.left, right: saved.right };
  write();
  doc.page.margins = saved;
}

function drawHeader(doc: PDFKit.PDFDocument, company: string) {
  withOpenMargins(doc, () => {
    const left = doc.page.margins.left;
    const width = contentWidth(doc);
    const top = 24;
    const lockupHeight = 26;
    drawBrandLockup(doc, left, top, lockupHeight);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND_MUTED)
      .text(company || BRAND_DOC_TITLE, left, top + 6, {
        width,
        align: "right",
        lineBreak: false,
      });
    const ruleY = top + lockupHeight + 6;
    doc
      .save()
      .strokeColor(BRAND_NAVY)
      .lineWidth(1.1)
      .moveTo(left, ruleY)
      .lineTo(left + width, ruleY)
      .stroke()
      .restore();
  });
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  input: {
    page: number;
    pages: number;
    versionLabel: string;
    validFrom?: string;
    chrome: string;
  },
) {
  withOpenMargins(doc, () => {
    const left = doc.page.margins.left;
    const width = contentWidth(doc);
    const ruleY = doc.page.height - 52;
    doc
      .save()
      .strokeColor(BRAND_RULE)
      .lineWidth(0.7)
      .moveTo(left, ruleY)
      .lineTo(left + width, ruleY)
      .stroke()
      .restore();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(BRAND_MUTED)
      .text(input.chrome, left, ruleY + 6, { width: width - 92, lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND_INK)
      .text(`Seite ${input.page} von ${input.pages}`, left, ruleY + 6, {
        width,
        align: "right",
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(BRAND_MUTED)
      .text(
        `${BRAND_NAME} · ${input.versionLabel}${input.validFrom ? ` · ab ${input.validFrom}` : ""}`,
        left,
        ruleY + 18,
        { width, lineBreak: false },
      );
  });
}

function drawWatermark(doc: PDFKit.PDFDocument) {
  withOpenMargins(doc, () => {
    const width = doc.page.width;
    const height = doc.page.height;
    const pagesBefore = doc.bufferedPageRange().count;
    doc.save();
    doc.fillColor(MUSTER_WATERMARK_COLOR);
    doc.fillOpacity(MUSTER_WATERMARK_OPACITY);
    doc.font("Helvetica").fontSize(34);
    const label = MUSTER_WATERMARK;
    const textWidth = doc.widthOfString(label);
    const cx = width / 2;
    const cy = height / 2;
    doc.rotate(-36, { origin: [cx, cy] });
    doc.text(label, cx - textWidth / 2, cy - 12, {
      lineBreak: false,
      width: textWidth + 8,
    });
    doc.restore();
    if (doc.bufferedPageRange().count !== pagesBefore) {
      throw new Error("Muster-Wasserzeichen hat eine zusätzliche Seite erzeugt.");
    }
  });
}

function writeUpsellPage(doc: PDFKit.PDFDocument) {
  doc.addPage();
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  doc.x = left;
  doc.y = doc.page.margins.top;
  doc.font("Helvetica-Bold").fontSize(16).fillColor(BRAND_NAVY).text(PDF_UPSELL_HEADLINE, { width });
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(11).fillColor(BRAND_INK).text(PDF_UPSELL_BODY, { width });
  doc.moveDown(0.9);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND_INK).text(PDF_UPSELL_PRICE, { width });
  doc.moveDown(1);
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(BRAND_NAVY)
    .text(PDF_UPSELL_CTA, {
      width,
      link: pdfCheckoutHref(),
      underline: true,
    });
  doc.moveDown(0.9);
  doc.font("Helvetica").fontSize(9).fillColor(BRAND_MUTED).text(PDF_UPSELL_DISCLAIMER, { width });
  doc.moveDown(0.7);
  doc.font("Helvetica").fontSize(8).fillColor(BRAND_MUTED).text(PDF_UPSELL_FOOTNOTE, { width });
}

function writeTitlePage(
  doc: PDFKit.PDFDocument,
  rendered: RenderedDocument,
  coverLineText: string,
  cover?: string,
  metaSentence?: string,
) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const lockupHeight = 52;
  drawBrandLockup(doc, left, 44, lockupHeight);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND_NAVY)
    .text(coverLineText, left, 44 + lockupHeight + 10, {
      width,
    });

  doc.y = 130;
  doc.x = left;
  writeMarkdownish(doc, cover?.trim() ? cover : rendered.cover, width);
  if (metaSentence) {
    doc
      .moveDown(0.6)
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BRAND_INK)
      .text(metaSentence, { width });
  }
}

function decoratePages(
  doc: PDFKit.PDFDocument,
  input: {
    identity: CheckoutIdentity;
    rendered: RenderedDocument;
    variant: PdfVariant;
  },
) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    if (i > 0) {
      drawHeader(doc, input.identity.company);
    }
    if (isMuster(input.variant)) drawWatermark(doc);
    drawFooter(doc, {
      page: i + 1,
      pages: range.count,
      versionLabel: input.rendered.versionLabel,
      validFrom: input.rendered.validFromDisplay,
      chrome: footerChrome(input.variant),
    });
  }
}

function writePdf(
  doc: PDFKit.PDFDocument,
  input: {
    identity: CheckoutIdentity;
    answers: IntakeAnswers;
    documentId: string;
    version?: number;
    content?: DeliveryDocumentContent | null;
    versionMeta?: VersionPdfMeta;
    versionHistory?: VersionHistoryEntry[];
    onlyModul?: string;
    variant: PdfVariant;
  },
) {
  const rendered = renderDeliveryDocument(input);
  const width = contentWidth(doc);
  const cover = input.content?.cover?.trim()
    ? input.content.cover
    : rendered.cover;
  const chapters =
    input.content?.chapters && input.content.chapters.length > 0
      ? input.content.chapters
      : rendered.chapters;

  const customCover = Boolean(input.content?.cover?.trim());
  writeTitlePage(
    doc,
    rendered,
    coverLine(input.variant),
    cover,
    customCover ? rendered.versionMetaSentence : "",
  );
  doc.addPage();

  for (const chapter of chapters) {
    writeMarkdownish(doc, chapter.body, width);
    doc.moveDown(0.55);
  }

  if (isMuster(input.variant)) writeUpsellPage(doc);

  decoratePages(doc, {
    identity: input.identity,
    rendered,
    variant: input.variant,
  });
}

export async function generatePdf(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
  documentId?: string;
  version?: number;
  content?: DeliveryDocumentContent | null;
  versionMeta?: VersionPdfMeta;
  /** Earlier versions for the Änderungshistorie, oldest first. */
  versionHistory?: VersionHistoryEntry[];
  /** Gesamtdokument: optional single-module PDF. */
  onlyModul?: string;
  /**
   * Muster-PDFs tragen Wasserzeichen, Deckblattzeile und Upsell.
   * Alles andere, auch ein vergessenes Feld, bleibt eine Kundenfassung.
   */
  variant?: PdfVariant;
}): Promise<{ buffer: Buffer; plan: DeliveryPlan; documentId: string }> {
  const documentId = input.documentId || randomUUID();
  const version = input.version && input.version > 0 ? input.version : 1;
  const variant: PdfVariant = isMuster(input.variant) ? "muster" : "kunde";
  const plan = planDelivery(input.answers, input.identity, version);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: PAGE_MARGIN,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `${isGesamt(input.answers) ? gesamtDocTitle() : isBelegfluss(input.answers) ? BRAND_DOC_TITLE : bereichDocTitle(bereichIdOf(input.answers))} — ${input.identity.company || (variant === "muster" ? "Muster" : "Arbeitsfassung")}`,
        Author: BRAND_NAME,
        Subject:
          variant === "muster"
            ? "Muster mit fiktiven Angaben — kein Steuerberatungsersatz"
            : `Arbeitsfassung ${isGesamt(input.answers) ? "Gesamtdokument" : isBelegfluss(input.answers) ? "Belegablage" : bereichLabel(bereichIdOf(input.answers))} — kein Steuerberatungsersatz`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.lineGap(1.6);
    writePdf(doc, { ...input, documentId, version, variant });
    doc.end();
  });

  console.info("[delivery] pdf", {
    documentId,
    version,
    bytes: buffer.length,
    chapters: (input.content?.chapters?.length
      ? input.content.chapters
      : plan.chapters
    ).map((c) => c.id),
  });

  return { buffer, plan, documentId };
}

/**
 * Simple branded PDF from markdown (Muster-Fragebogen). Same page frame as the
 * delivery PDF, own footer line.
 */
export async function generateMarkdownPdf(input: {
  markdown: string;
  company: string;
  title: string;
  footer: string;
  /** Fragebogen-Muster setzen „muster“. Sonst kein Wasserzeichen und kein Upsell. */
  variant?: PdfVariant;
}): Promise<Buffer> {
  const variant: PdfVariant = isMuster(input.variant) ? "muster" : "kunde";
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: PAGE_MARGIN,
      bufferPages: true,
      autoFirstPage: true,
      info: { Title: input.title, Author: BRAND_NAME, Subject: input.footer },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.lineGap(1.6);
    writeMarkdownish(doc, input.markdown, contentWidth(doc));
    if (isMuster(variant)) writeUpsellPage(doc);
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      drawHeader(doc, input.company);
      if (isMuster(variant)) drawWatermark(doc);
      withOpenMargins(doc, () => {
        const left = doc.page.margins.left;
        const width = contentWidth(doc);
        const ruleY = doc.page.height - 52;
        doc
          .save()
          .strokeColor(BRAND_RULE)
          .lineWidth(0.7)
          .moveTo(left, ruleY)
          .lineTo(left + width, ruleY)
          .stroke()
          .restore();
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(BRAND_MUTED)
          .text(input.footer, left, ruleY + 6, { width: width - 92, lineBreak: false });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(BRAND_INK)
          .text(`Seite ${i + 1} von ${range.count}`, left, ruleY + 6, {
            width,
            align: "right",
            lineBreak: false,
          });
      });
    }
    doc.end();
  });
}
