import { randomUUID } from "node:crypto";
import {
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_DRAFT_LABEL,
} from "@/lib/partner-muster";
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
import type { VersionPdfMeta } from "@/lib/versioning";

/**
 * GoBD Delivery Templates v3.0.0 — local PDF from Intake + content/delivery-templates.
 * Präsens only for confirmed intake answers. No technical ids in the customer PDF.
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
    case "01-merkmal-tabelle":
      return answers.gf || join(answers.branchen) || "Merkmal";
    case "02-zweck-grenzen":
      return answers.gf || "Zweck";
    case "03-systeme-belegarten":
      return join(answers.fibu) || "Systeme";
    case "04-eingang-pruefung":
      return join(answers.eingangsbelege) || "Eingang fehlt";
    case "05-freigabe-buchung":
      return join(answers.ausgangsrechnungen) || "Freigabe";
    case "06-aufbewahrung":
      return answers.archiv || "Aufbewahrung";
    case "07-kontrollen-aenderungen":
      return "Kontrollen";
    case "08-anlagen-offene-punkte":
      return "Offene Punkte";
    case "09-version-bestaetigung":
      return "Bestätigung ausstehend";
    case "10-quellen":
      return "Quellen";
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
    versionLabel: string;
    validFrom?: string;
    draftLabel?: string;
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
        `${BRAND_NAME} · ${input.versionLabel}${input.validFrom ? ` · ab ${input.validFrom}` : ""}${input.draftLabel ? " · DRAFT / not Philip-final" : ""}`,
        left,
        ruleY + 18,
        { width, lineBreak: false },
      );
  });
}

function writeTitlePage(
  doc: PDFKit.PDFDocument,
  rendered: RenderedDocument,
  cover?: string,
  metaSentence?: string,
  draftLabel?: string,
) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const lockupHeight = 52;
  drawBrandLockup(doc, left, 44, lockupHeight);
  let cursor = 44 + lockupHeight + 10;
  if (draftLabel) {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(BRAND_NAVY)
      .text(draftLabel, left, cursor, { width });
    cursor = doc.y + 8;
  }
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(BRAND_NAVY)
    .text("Arbeitsfassung aus Kunden-Intake", left, cursor, {
      width,
    });

  doc.y = Math.max(draftLabel ? doc.y + 16 : 130, 130);
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
    draftLabel?: string;
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
      versionLabel: input.rendered.versionLabel,
      validFrom: input.rendered.validFromDisplay,
      draftLabel: input.draftLabel,
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
  const draftLabel =
    input.documentId === PARTNER_MUSTER_DOCUMENT_ID
      ? PARTNER_MUSTER_DRAFT_LABEL
      : undefined;
  writeTitlePage(
    doc,
    rendered,
    cover,
    customCover ? rendered.versionMetaSentence : "",
    draftLabel,
  );
  doc.addPage();

  for (const chapter of chapters) {
    writeMarkdownish(doc, chapter.body, width);
    doc.moveDown(0.55);
  }

  decoratePages(doc, {
    identity: input.identity,
    rendered,
    draftLabel,
  });
}

export async function generatePdf(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
  documentId?: string;
  version?: number;
  content?: DeliveryDocumentContent | null;
  versionMeta?: VersionPdfMeta;
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
        Title: `${
          documentId === PARTNER_MUSTER_DOCUMENT_ID ? "DRAFT — " : ""
        }${BRAND_DOC_TITLE} — ${input.identity.company || "Arbeitsfassung"}`,
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
    chapters: (input.content?.chapters?.length
      ? input.content.chapters
      : plan.chapters
    ).map((c) => c.id),
  });

  return { buffer, plan, documentId };
}
