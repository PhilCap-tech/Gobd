import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { storePdf } from "@/lib/blob";
import { generatePdf, type DeliveryPlan } from "@/lib/delivery";
import {
  canAccessDocument,
  documentFamilyId,
  nextVersionNumber,
} from "@/lib/documents";
import {
  normalizeDocumentContent,
  serializeDocumentContent,
} from "@/lib/document-content";
import { getAppUrl } from "@/lib/env";
import { sendDeliveryMail } from "@/lib/ops";
import { appendRecord, listDocumentFamily } from "@/lib/store";
import {
  answersFromSheetRow,
  identityFromSheetRow,
  toSheetRow,
} from "@/lib/types";

export const runtime = "nodejs";

function errorDetail(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unbekannter Fehler";
}

function jsonError(error: string, status: number, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

async function handleDocumentEdit(request: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return jsonError("Bitte anmelden.", 401);
  }

  let body: {
    documentId?: string;
    cover?: unknown;
    chapters?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  const sourceDocumentId = body.documentId?.trim() ?? "";
  if (!sourceDocumentId) {
    return jsonError("Dokument fehlt.", 400);
  }

  const content = normalizeDocumentContent({
    cover: body.cover,
    chapters: body.chapters,
  });
  if (!content) {
    return jsonError("Bitte mindestens ein Kapitel mit Text speichern.", 400);
  }

  let chapterContent: string;
  try {
    chapterContent = serializeDocumentContent(content);
  } catch (error) {
    return jsonError(errorDetail(error), 400);
  }

  const family = await listDocumentFamily(sourceDocumentId);
  const source =
    family.find((row) => row.documentId === sourceDocumentId) ?? family.at(-1);
  if (!source) {
    return jsonError("Dokument nicht gefunden.", 404);
  }
  if (!canAccessDocument(source, { sessionEmail })) {
    return jsonError("Kein Zugriff.", 401);
  }

  const identity = identityFromSheetRow(source);
  const answers = answersFromSheetRow(source);
  const version = nextVersionNumber(family);
  const parentDocumentId = documentFamilyId(source);
  const documentId = randomUUID();
  const status = identity.stub ? "document_edited_stub" : "document_edited";

  let delivery: DeliveryPlan;
  let pdfUrl = "";

  try {
    const generated = await generatePdf({
      answers,
      identity,
      documentId,
      version,
      content,
    });
    const storedPdf = await storePdf({
      familyId: parentDocumentId,
      documentId,
      version,
      buffer: generated.buffer,
    });
    pdfUrl = storedPdf.url || storedPdf.pathname;
    delivery = {
      ...generated.plan,
      status: "ready",
      pdf: {
        version,
        documentId,
        url: storedPdf.url,
        pathname: storedPdf.pathname,
        backend: storedPdf.backend,
      },
    };
  } catch (error) {
    console.error("[document] PDF-Erzeugung fehlgeschlagen", error);
    return jsonError("PDF konnte nicht erzeugt werden.", 500, errorDetail(error));
  }

  let stored;
  try {
    stored = await appendRecord(
      toSheetRow({
        identity,
        answers,
        status,
        deliveryStatus: delivery.status,
        documentId,
        parentDocumentId,
        pdfUrl,
        version: String(version),
        chapterContent,
      }),
    );
  } catch (error) {
    console.error("[document] appendRecord fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }

  const appUrl = getAppUrl();
  const downloadUrl = `${appUrl}/api/docs/${documentId}/download`;
  const successUrl = `${appUrl}/account`;

  try {
    await sendDeliveryMail({
      email: identity.email,
      company: identity.company,
      downloadUrl,
      successUrl,
      version,
    });
  } catch (error) {
    console.error("[document] delivery mail fehlgeschlagen", error);
  }

  return NextResponse.json({
    ok: true,
    store: stored.backend,
    delivery,
    documentId,
    pdfUrl: `/api/docs/${documentId}/download`,
    version,
  });
}

export async function POST(request: Request) {
  try {
    return await handleDocumentEdit(request);
  } catch (error) {
    console.error("[document] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
