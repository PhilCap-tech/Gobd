import { NextRequest } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { SV_PDF_FAILED } from "@/lib/schnellversion-copy";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { confirmPaidSession, isSvPdfFailed } from "@/lib/schnellversion-payment";
import { readSvPdf, svDownloadAllowed } from "@/lib/schnellversion-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pdfFailedResponse(): Response {
  return new Response(SV_PDF_FAILED, {
    status: 409,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

/** PDF nur für eine bezahlte Session. Das Zuteilungs-Cookie wird nicht gelesen. */
export async function GET(request: NextRequest): Promise<Response> {
  if (!schnellversionOffered()) return new Response(null, { status: 404 });
  try {
    return await readPaidPdf(request);
  } catch (error) {
    if (isSvPdfFailed(error)) return pdfFailedResponse();
    throw error;
  }
}

async function readPaidPdf(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId) return new Response(null, { status: 401 });
  const confirmed = await confirmPaidSession(sessionId);
  if (!confirmed.paid) return new Response(null, { status: 402 });
  const email = (await sessionEmailFromRequest(request)) ?? "";
  const token = url.searchParams.get("dl")?.trim() ?? "";
  if (!svDownloadAllowed(confirmed.purchase, { email, token, now: new Date() })) {
    return new Response(null, { status: 401 });
  }
  const pdf = await readSvPdf(confirmed.purchase);
  if (!pdf) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "attachment; filename=\"standardfassung.pdf\"",
      "cache-control": "private, no-store",
    },
  });
}

export async function POST(): Promise<Response> {
  if (!schnellversionOffered()) return new Response(null, { status: 404 });
  return new Response(null, { status: 405 });
}
