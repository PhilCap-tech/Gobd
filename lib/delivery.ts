import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

/**
 * GoBD Delivery v1.
 *
 * Kapitelgerüst + Intake-Fakten + Offene-Punkte-Liste.
 * Keine erfundenen GoBD-/Steuerrechtstexte — nur Angaben aus dem Intake
 * und klare Platzhalter.
 */

export const DELIVERY_DISCLAIMER =
  "Keine Steuerberatung. Dieses Dokument ist ein Entwurf aus den Intake-Angaben zur Abstimmung mit deinem Steuerberater — keine individuelle Steuer- oder Rechtsberatung.";

export const CHAPTER_PLACEHOLDER =
  "Platzhalter: Fließtext folgt nach Abstimmung mit dem Steuerberater.";

export type DeliveryChapter = {
  id: string;
  title: string;
  source: "placeholder";
  intakeHint: string;
  facts: string[];
};

export type DeliveryOpenItem = {
  id: string;
  title: string;
  status: "open";
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

function fact(label: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `${label}: ${trimmed}`;
}

function join(values: string[]): string {
  return values.join(", ");
}

export function planDelivery(answers: IntakeAnswers): DeliveryPlan {
  const chapters: DeliveryChapter[] = [
    {
      id: "allgemein",
      title: "Allgemeines / Unternehmen",
      source: "placeholder",
      intakeHint: join(answers.branchen) || "Branche fehlt",
      facts: [
        fact("Branche", join(answers.branchen)),
        fact("Rechtsform", answers.rechtsform),
        fact("Mitarbeitende", answers.mitarbeitende),
      ].filter((line): line is string => Boolean(line)),
    },
    {
      id: "systeme",
      title: "Systeme / Software",
      source: "placeholder",
      intakeHint: join(answers.fibu) || "FiBu fehlt",
      facts: [
        fact("FiBu", join(answers.fibu)),
        fact("Weitere Systeme", answers.weitereSysteme),
      ].filter((line): line is string => Boolean(line)),
    },
    {
      id: "belegwege",
      title: "Belegwege",
      source: "placeholder",
      intakeHint: join(answers.eingangsbelege) || "Eingang fehlt",
      facts: [
        fact("Eingangsbelege", join(answers.eingangsbelege)),
        fact("Ausgangsrechnungen", join(answers.ausgangsrechnungen)),
        fact("Archiv", answers.archiv),
      ].filter((line): line is string => Boolean(line)),
    },
    {
      id: "it",
      title: "IT / Zugriff / Archiv",
      source: "placeholder",
      intakeHint: answers.hosting || "Hosting fehlt",
      facts: [
        fact("Hosting", answers.hosting),
        fact("Backup", join(answers.backup)),
        fact("Zugriff", answers.zugriff),
      ].filter((line): line is string => Boolean(line)),
    },
    {
      id: "rollen",
      title: "Verantwortlichkeiten",
      source: "placeholder",
      intakeHint: answers.gf || "GF fehlt",
      facts: [
        fact("Geschäftsführung / Inhaber", answers.gf),
        fact("Buchhaltung", answers.buchhaltung),
        fact("IT / Systeme", answers.it),
        fact("Steuerberater", answers.steuerberater),
      ].filter((line): line is string => Boolean(line)),
    },
  ];

  const openItems: DeliveryOpenItem[] = [
    {
      id: "steuerberater-abstimmung",
      title: "Entwurf mit Steuerberater abstimmen",
      status: "open",
    },
  ];

  const missing: [string, string][] = [
    ["archiv", answers.archiv],
    ["zugriff", answers.zugriff],
    ["it", answers.it],
    ["steuerberater", answers.steuerberater],
    ["backup", join(answers.backup)],
  ];
  for (const [id, value] of missing) {
    if (!value.trim()) {
      openItems.push({
        id: `missing-${id}`,
        title: `Angabe ergänzen: ${id}`,
        status: "open",
      });
    }
  }

  return {
    status: "ready",
    chapters,
    openItems,
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

function newPdfDocument(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: "A4",
    margin: 56,
    info: {
      Title: "Verfahrensdokumentation (Entwurf)",
      Author: "GoBD Verfahrensdoku",
    },
  });
}

function writePlan(
  doc: PDFKit.PDFDocument,
  input: {
    answers: IntakeAnswers;
    identity: CheckoutIdentity;
    documentId: string;
    plan: DeliveryPlan;
  },
) {
  const created = new Date().toLocaleString("de-DE");
  const width = 480;

  doc.font("Helvetica-Bold").fontSize(18).fillColor("#14201b");
  doc.text("Verfahrensdokumentation", { width });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(11).fillColor("#5a6560");
  doc.text("Entwurf · Version 1 · aus Intake-Angaben", { width });
  doc.moveDown(0.8);

  doc.fontSize(10).fillColor("#14201b");
  doc.text(`Unternehmen: ${input.identity.company || "—"}`, { width });
  doc.text(`E-Mail: ${input.identity.email || "—"}`, { width });
  doc.text(`Dokument-ID: ${input.documentId}`, { width });
  doc.text(`Erstellt: ${created}`, { width });
  doc.moveDown(0.8);

  doc.fontSize(9).fillColor("#7a4e00");
  doc.text(DELIVERY_DISCLAIMER, { width });
  doc.moveDown(1);

  for (const [index, chapter] of input.plan.chapters.entries()) {
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#14201b");
    doc.text(`${index + 1}. ${chapter.title}`, { width });
    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(10).fillColor("#14201b");
    doc.text("Angaben aus dem Intake:", { width });
    if (chapter.facts.length === 0) {
      doc.fillColor("#5a6560").text("— keine Angabe —", { width });
    } else {
      for (const line of chapter.facts) {
        doc.fillColor("#14201b").text(`• ${line}`, { width });
      }
    }
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor("#5a6560");
    doc.text(CHAPTER_PLACEHOLDER, { width });
    doc.moveDown(0.8);
  }

  doc.font("Helvetica-Bold").fontSize(13).fillColor("#14201b");
  doc.text("Offene Punkte", { width });
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(10);
  for (const item of input.plan.openItems) {
    doc.fillColor("#14201b").text(`• ${item.title} (${item.status})`, { width });
  }
  doc.moveDown(1);
  doc.fontSize(8).fillColor("#5a6560");
  doc.text(
    "Quelle: Nutzer-Intake. Keine rechtliche Prüfung. Keine GoBD-Konformitätszusage.",
    { width },
  );
}

export async function generatePdf(input: {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
  documentId?: string;
}): Promise<{ buffer: Buffer; plan: DeliveryPlan; documentId: string }> {
  const documentId = input.documentId || randomUUID();
  const plan = planDelivery(input.answers);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = newPdfDocument();
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    writePlan(doc, { ...input, documentId, plan });
    doc.end();
  });

  console.info("[delivery] pdf v1", {
    documentId,
    bytes: buffer.length,
    chapters: plan.chapters.map((c) => c.id),
  });

  return { buffer, plan, documentId };
}
