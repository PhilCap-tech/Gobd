import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { storePdf } from "@/lib/blob";
import { getAppUrl } from "@/lib/env";
import { sendReadinessMail } from "@/lib/ops";
import { parseReadinessAnswers, toReadinessLead } from "@/lib/readiness";
import { generateReadinessPdf } from "@/lib/readiness-pdf";
import { appendReadinessRecord } from "@/lib/readiness-store";

export const runtime = "nodejs";

function errorDetail(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unbekannter Fehler";
}

function jsonError(error: string, status: number, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  const parsed = parseReadinessAnswers(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }
  const answers = parsed.answers;
  const documentId = randomUUID();

  let title: string;
  let pdfUrl = "";
  try {
    const generated = await generateReadinessPdf(answers);
    title = generated.title;
    const storedPdf = await storePdf({
      familyId: documentId,
      documentId,
      version: 1,
      buffer: generated.buffer,
      blobPath: `readiness/${documentId}.pdf`,
    });
    pdfUrl = storedPdf.url || storedPdf.pathname;
  } catch (error) {
    console.error("[readiness] PDF-Erzeugung fehlgeschlagen", error);
    return jsonError("PDF konnte nicht erzeugt werden.", 500, errorDetail(error));
  }

  const appUrl = getAppUrl();
  const downloadUrl = `${appUrl}/api/readiness/${documentId}/download`;
  const successUrl = `${appUrl}/readiness/success?id=${encodeURIComponent(documentId)}`;
  const checkoutUrl = `${appUrl}/checkout`;

  let mailStatus = "skipped";
  try {
    const mail = await sendReadinessMail({
      email: answers.email,
      name: answers.name,
      company: answers.company,
      title,
      downloadUrl,
      successUrl,
      checkoutUrl,
    });
    mailStatus = mail.sent ? "sent" : mail.stub ? "stub" : "failed";
  } catch (error) {
    console.error("[readiness] Mail fehlgeschlagen", error);
    mailStatus = "failed";
  }

  let stored;
  try {
    stored = await appendReadinessRecord(
      toReadinessLead({
        answers,
        documentId,
        pdfUrl,
        status: "readiness_submitted",
        mailStatus,
      }),
    );
  } catch (error) {
    console.error("[readiness] appendRecord fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }

  return NextResponse.json({
    ok: true,
    store: stored.backend,
    documentId,
    title,
    downloadUrl,
    successUrl,
    mailStatus,
  });
}
