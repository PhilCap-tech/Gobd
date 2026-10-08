import { NextResponse } from "next/server";
import { magicLinkUrl, withoutSessionCookie } from "@/lib/auth";
import { BlobStorageError, blobFailureClass, storePdf } from "@/lib/blob";
import { getAppUrl } from "@/lib/env";
import { deliverLoginLink, readinessMailStatus } from "@/lib/login-mail";
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
    console.error("[readiness] PDF-Erzeugung fehlgeschlagen", blobFailureClass(error));
    if (error instanceof BlobStorageError) {
      return jsonError("PDF konnte nicht gespeichert werden.", 503);
    }
    return jsonError("PDF konnte nicht erzeugt werden.", 500, errorDetail(error));
  }

  const appUrl = getAppUrl();
  const downloadPath = readinessDownloadPath(leadId, accessToken);
  const successPath = readinessSuccessPath(leadId, accessToken);
  const downloadUrl = `${appUrl}${downloadPath}`;
  const successUrl = `${appUrl}${successPath}`;
  const magicUrl = magicLinkUrl(parsed.email);
  const brancheLabel = readinessBrancheLabel(parsed.answers.branche);

  let pdfMailStatus = "stub";
  try {
    const mail = await sendReadinessMail({
      email: parsed.email,
      name: parsed.name,
      brancheLabel,
      downloadUrl,
      successUrl,
      magicLinkUrl: magicUrl,
    });
    pdfMailStatus = mail.sent ? "sent" : mail.stub ? "stub" : "failed";
  } catch (error) {
    console.error("[readiness] mail fehlgeschlagen", error instanceof Error ? error.name : "error");
    pdfMailStatus = "failed";
  }

  const loginMail = await deliverLoginLink(parsed.email, "/account");
  const mailStatus = readinessMailStatus(pdfMailStatus, loginMail);

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
    loginMail,
    successUrl: successPath,
    pdfUrl: downloadPath,
  });
  return withoutSessionCookie(response);
}

export async function POST(request: Request) {
  try {
    return await handleReadiness(request);
  } catch (error) {
    console.error("[readiness] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
