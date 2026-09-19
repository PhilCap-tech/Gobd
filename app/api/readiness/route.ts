import { NextResponse } from "next/server";
import { applySessionCookie, magicLinkUrl } from "@/lib/auth";
import { storePdf } from "@/lib/blob";
import { getAppUrl } from "@/lib/env";
import { sendReadinessMail } from "@/lib/ops";
import {
  createReadinessAccessToken,
  generateReadinessPdf,
  newReadinessLeadId,
  parseReadinessRequest,
  readinessBrancheLabel,
  readinessDownloadPath,
  readinessSuccessPath,
  toReadinessLead,
} from "@/lib/readiness";
import { appendReadinessLead } from "@/lib/store";

export const runtime = "nodejs";

function errorDetail(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unbekannter Fehler";
}

function jsonError(error: string, status: number, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

async function handleReadiness(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  const parsed = parseReadinessRequest(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const leadId = newReadinessLeadId();
  const accessToken = createReadinessAccessToken();
  let pdfUrl = "";

  try {
    const generated = await generateReadinessPdf({
      leadId,
      branche: parsed.answers.branche,
      company: parsed.company,
    });
    const storedPdf = await storePdf({
      familyId: `readiness-${leadId}`,
      documentId: leadId,
      version: 1,
      buffer: generated.buffer,
    });
    pdfUrl = storedPdf.url || storedPdf.pathname;
  } catch (error) {
    console.error("[readiness] PDF-Erzeugung fehlgeschlagen", error);
    return jsonError("PDF konnte nicht erzeugt werden.", 500, errorDetail(error));
  }

  const appUrl = getAppUrl();
  const downloadPath = readinessDownloadPath(leadId, accessToken);
  const successPath = readinessSuccessPath(leadId, accessToken);
  const downloadUrl = `${appUrl}${downloadPath}`;
  const successUrl = `${appUrl}${successPath}`;
  const magicUrl = magicLinkUrl(parsed.email);
  const brancheLabel = readinessBrancheLabel(parsed.answers.branche);

  let mailStatus = "stub";
  try {
    const mail = await sendReadinessMail({
      email: parsed.email,
      name: parsed.name,
      brancheLabel,
      downloadUrl,
      successUrl,
      magicLinkUrl: magicUrl,
    });
    mailStatus = mail.sent ? "sent" : mail.stub ? "stub" : "failed";
  } catch (error) {
    console.error("[readiness] mail fehlgeschlagen", error);
    mailStatus = "failed";
  }

  const lead = toReadinessLead({
    name: parsed.name,
    email: parsed.email,
    company: parsed.company,
    answers: parsed.answers,
    leadId,
    accessToken,
    pdfUrl,
    mailStatus,
  });

  let stored;
  try {
    stored = await appendReadinessLead(lead);
  } catch (error) {
    console.error("[readiness] appendReadinessLead fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }

  const response = NextResponse.json({
    ok: true,
    store: stored.backend,
    leadId,
    mailStatus,
    successUrl: successPath,
    pdfUrl: downloadPath,
  });
  applySessionCookie(response, parsed.email);
  return response;
}

export async function POST(request: Request) {
  try {
    return await handleReadiness(request);
  } catch (error) {
    console.error("[readiness] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
