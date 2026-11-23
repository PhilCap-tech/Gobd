import { NextRequest } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { SV_DOWNLOAD_COOKIE } from "@/lib/schnellversion-assign";
import { SV_PDF_FAILED } from "@/lib/schnellversion-copy";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { readSchnellversionCheckout } from "@/lib/schnellversion-payment";
import { findSvPurchaseByDownloadToken, readSvPdf, svDownloadAllowed, type SvPurchase } from "@/lib/schnellversion-record";

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

/** PDF nur mit Token, Cookie aus dem Checkout oder Anmeldung. session_id allein reicht nicht. */
export async function GET(request: NextRequest): Promise<Response> {
  if (!schnellversionOffered()) return new Response(null, { status: 404 });
  try {
    return await readPaidPdf(request);
  } catch {
    return pdfFailedResponse();
  }
}

async function readPaidPdf(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  const queryToken = url.searchParams.get("dl")?.trim() ?? "";
  const cookieToken = decodeURIComponent(request.cookies.get(SV_DOWNLOAD_COOKIE)?.value ?? "");
  const token = queryToken || cookieToken;
  const email = (await sessionEmailFromRequest(request)) ?? "";
  if (!token && !email) return new Response(null, { status: 401 });
  let purchase: SvPurchase | null = null;
  if (sessionId) {
    const looked = await readSchnellversionCheckout(sessionId);
    if (looked.state === "paid" || looked.state === "ended") purchase = looked.purchase;
  }
  if (!purchase && token) purchase = await findSvPurchaseByDownloadToken(token);
  if (!purchase) return new Response(null, { status: 401 });
  if (!svDownloadAllowed(purchase, { email, token, now: new Date() })) {
    return new Response(null, { status: 401 });
  }
  const pdf = await readSvPdf(purchase);
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
