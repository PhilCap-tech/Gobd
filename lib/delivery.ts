import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import {
  deliveryBundle,
  renderDeliveryDocument,
  type DeliveryOpenPoint,
} from "@/lib/delivery-templates";
import { writeMarkdownish } from "@/lib/pdf-markdown";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

/**
 * GoBD Delivery v1 — local PDF from Intake + content/delivery-templates.
 * Keine erfundenen GoBD-Rechtstexte über das Template hinaus.
 */

export const DELIVERY_DISCLAIMER = deliveryBundle.disclaimer;

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
    case "01-unternehmen":
      return join(answers.branchen) || answers.rechtsform || "Branche fehlt";
    case "02-systeme":
      return join(answers.fibu) || "FiBu fehlt";
    case "03-belegwesen":
      return join(answers.eingangsbelege) || "Eingang fehlt";
    case "04-aufbewahrung":
      return answers.hosting || answers.archiv || "Aufbewahrung fehlt";
    case "05-verantwortlichkeiten":
      return answers.gf || "GF fehlt";
    case "06-offene-punkte":
      return "Offene Punkte";
    default:
      return "";
  }
}

export function planDelivery(
  answers: IntakeAnswers,
  identity?: CheckoutIdentity,
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
  doc.moveDown(0.5);

  for (const chapter of rendered.chapters) {
    writeMarkdownish(doc, chapter.body, width);
    doc.moveDown(0.45);
  }

  doc.font("Helvetica").fontSize(8).fillColor("#5a6560");
  doc.text(rendered.disclaimer, { width });
}

export async function generatePdf(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
  documentId?: string;
  version?: number;
}): Promise<{ buffer: Buffer; plan: DeliveryPlan; documentId: string }> {
  const documentId = input.documentId || randomUUID();
  const version = input.version && input.version > 0 ? input.version : 1;
  const plan = planDelivery(input.answers, input.identity);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title: "Verfahrensdokumentation (GoBD) — Arbeitsfassung",
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

  console.info("[delivery] pdf", {
    documentId,
    version,
    bytes: buffer.length,
    chapters: plan.chapters.map((c) => c.id),
  });

  return { buffer, plan, documentId };
}
