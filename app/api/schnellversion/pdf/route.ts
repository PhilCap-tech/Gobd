import { NextRequest } from "next/server";
import { schnellversion49Enabled } from "@/lib/schnellversion-flag";
import { confirmPaidSession } from "@/lib/schnellversion-payment";
import { readSvPdf } from "@/lib/schnellversion-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF nur für eine bezahlte Session. Das Zuteilungs-Cookie wird nicht gelesen. */
export async function GET(request: NextRequest): Promise<Response> {
  if (!schnellversion49Enabled()) return new Response(null, { status: 404 });
  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId) return new Response(null, { status: 401 });
  const confirmed = await confirmPaidSession(sessionId);
  if (!confirmed.paid) return new Response(null, { status: 402 });
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
  return new Response(null, { status: 405 });
}
