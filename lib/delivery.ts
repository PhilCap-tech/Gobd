import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import {
  renderDeliveryDocument,
  type DeliveryOpenPoint,
} from "@/lib/delivery-templates";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

/**
 * GoBD Delivery v1 — local PDF from Intake + content/delivery-templates.
 * Keine erfundenen GoBD-Rechtstexte über das Template hinaus.
 */

export const DELIVERY_DISCLAIMER =
  "Keine Steuerberatung / kein Steuerberatungsersatz. Dieses Dokument ist ein Entwurf aus den Intake-Angaben zur Abstimmung mit deinem Steuerberater — keine individuelle Steuer- oder Rechtsberatung.";

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
  version: 1;
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
    case "allgemein":
      return join(answers.branchen) || "Branche fehlt";
    case "systeme":
      return join(answers.fibu) || "FiBu fehlt";
    case "belegwesen":
      return join(answers.eingangsbelege) || "Eingang fehlt";
    case "aufbewahrung":
      return answers.hosting || answers.archiv || "Aufbewahrung fehlt";
    case "verantwortlichkeiten":
      return answers.gf || "GF fehlt";
    case "offene-punkte":
      return "Offene Punkte";
    default:
      return "";
  }
}

export function planDelivery(answers: IntakeAnswers): DeliveryPlan {
  const rendered = renderDeliveryDocument({
    identity: {
      email: "",
      company: "",
      stripeSessionId: "",
      stripeCustomerId: "",
      stub: true,
    },
    answers,
    documentId: "plan",
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

function writeMarkdownish(doc: PDFKit.PDFDocument, text: string, width: number) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      doc.moveDown(0.35);
      continue;
    }
    if (line.startsWith("# ")) {
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#14201b");
      doc.text(line.slice(2), { width });
      doc.moveDown(0.25);
      continue;
    }
    if (line.startsWith("## ")) {
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#14201b");
      doc.text(line.slice(3), { width });
      doc.moveDown(0.2);
      continue;
    }
    const bullet = line.startsWith("- ") ? line.slice(2) : line;
    const bold = bullet.startsWith("**") && bullet.endsWith("**") && bullet.length > 4;
    const content = bold ? bullet.slice(2, -2) : bullet;
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(bold ? 11 : 10)
      .fillColor(bold ? "#14201b" : "#14201b");
    doc.text(line.startsWith("- ") ? `• ${content}` : content, { width });
  }
}

function writePdf(
  doc: PDFKit.PDFDocument,
  input: {
    identity: CheckoutIdentity;
    answers: IntakeAnswers;
    documentId: string;
  },
) {
  const rendered = renderDeliveryDocument(input);
  const width = 480;

  writeMarkdownish(doc, rendered.cover, width);
  doc.moveDown(0.6);

  rendered.chapters.forEach((chapter, index) => {
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#14201b");
    doc.text(`${String(index + 1).padStart(2, "0")}. ${chapter.title}`, { width });
    doc.moveDown(0.25);
    writeMarkdownish(doc, chapter.body, width);
    doc.moveDown(0.6);
  });

  doc.fontSize(8).fillColor("#5a6560");
  doc.text(rendered.disclaimer, { width });
}

export async function generatePdf(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
  documentId?: string;
}): Promise<{ buffer: Buffer; plan: DeliveryPlan; documentId: string }> {
  const documentId = input.documentId || randomUUID();
  const plan = planDelivery(input.answers);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title: "Verfahrensdokumentation (Entwurf)",
        Author: "GoBD Verfahrensdoku",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    writePdf(doc, { ...input, documentId });
    doc.end();
  });

  console.info("[delivery] pdf v1", {
    documentId,
    bytes: buffer.length,
    chapters: plan.chapters.map((c) => c.id),
  });

  return { buffer, plan, documentId };
}
