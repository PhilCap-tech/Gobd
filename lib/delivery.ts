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
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

/**
 * GoBD Delivery Templates v2.0.0 — local PDF from Intake + content/delivery-templates.
 * Standardrahmen aus den Templates; keine erfundenen Einzelfall-Rechtstexte.
 */

const FOOTER_CHROME =
  "Kein Steuerberatungsersatz. Arbeitsfassung aus Kunden-Intake — vollständiger Hinweis auf dem Deckblatt.";

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

export type DeliveryPlan = {
  status: "ready" | "failed";
  chapters: DeliveryChapter[];
  openItems: DeliveryOpenItem[];
  pdf: DeliveryPdfMeta | null;
};

function hintFromAnswers(id: string, answers: IntakeAnswers): string {
  const join = (values: string[]) => values.join(", ");
  switch (id) {
    case "01-vorbemerkungen":
      return answers.gf || "GF fehlt";
    case "02-zielsetzung":
      return join(answers.branchen) || answers.rechtsform || "Branche fehlt";
    case "03-organisation":
    case "03-organisation-sicherheit":
      return join(answers.fibu) || "FiBu fehlt";
    case "04-verfahren-papier":
      return join(answers.eingangsbelege) || "Eingang fehlt";
    case "05-verfahren-digital":
      return join(answers.ausgangsrechnungen) || "Ausgang fehlt";
    case "06-mitgeltende-unterlagen":
      return answers.steuerberater || "Mitgeltende Unterlagen";
    case "07-aenderungshistorie":
      return "Erstfassung";
    case "08-glossar":
      return "Begriffe";
    case "09-offene-punkte":
      return "Offene Punkte";
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
      title: item.title,
      status: "open",
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
    documentId: string;
    versionLabel: string;
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
      .text(FOOTER_CHROME, left, ruleY + 6, { width: width - 92, lineBreak: false });
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
        `${BRAND_NAME} · ${input.versionLabel} · ${input.documentId.slice(0, 8)}`,
        left,
        ruleY + 18,
        { width, lineBreak: false },
      );
  });
}

function writeTitlePage(
  doc: PDFKit.PDFDocument,
  rendered: RenderedDocument,
  identity: CheckoutIdentity,
) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const lockupHeight = 52;
  drawBrandLockup(doc, left, 44, lockupHeight);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND_NAVY)
    .text("Arbeitsfassung aus Kunden-Intake", left, 44 + lockupHeight + 10, {
      width,
    });

  doc.y = 130;
  doc.x = left;
  writeMarkdownish(doc, rendered.cover, width);
  if (identity.stub) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND_MUTED)
      .text("Erzeugt in einer Stub-Session (ohne Stripe-Livezahlung).", { width });
  }
}

function decoratePages(
  doc: PDFKit.PDFDocument,
  input: {
    identity: CheckoutIdentity;
    rendered: RenderedDocument;
    documentId: string;
  },
) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    if (i > 0) {
      drawHeader(doc, input.identity.company);
    }
    drawFooter(doc, {
      page: i + 1,
      pages: range.count,
      documentId: input.documentId,
      versionLabel: input.rendered.versionLabel,
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
  },
) {
  const rendered = renderDeliveryDocument(input);
  const width = contentWidth(doc);

  writeTitlePage(doc, rendered, input.identity);
  doc.addPage();

  for (const chapter of rendered.chapters) {
    writeMarkdownish(doc, chapter.body, width);
    doc.moveDown(0.55);
  }

  decoratePages(doc, {
    identity: input.identity,
    rendered,
    documentId: input.documentId,
  });
}

export async function generatePdf(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
  documentId?: string;
  version?: number;
}): Promise<{ buffer: Buffer; plan: DeliveryPlan; documentId: string }> {
  const documentId = input.documentId || randomUUID();
  const version = input.version && input.version > 0 ? input.version : 1;
  const plan = planDelivery(input.answers, input.identity, version);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: PAGE_MARGIN,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `${BRAND_DOC_TITLE} — ${input.identity.company || "Arbeitsfassung"}`,
        Author: BRAND_NAME,
        Subject: "Arbeitsfassung Belegablage — kein Steuerberatungsersatz",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.lineGap(1.6);
    writePdf(doc, { ...input, documentId, version });
    doc.end();
  });

  console.info("[delivery] pdf", {
    documentId,
    version,
    bytes: buffer.length,
    chapters: plan.chapters.map((c) => c.id),
  });

  return { buffer, plan, documentId };
}
