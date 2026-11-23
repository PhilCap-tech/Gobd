import { NextRequest } from "next/server";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { readSchnellversionCheckout } from "@/lib/schnellversion-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nur der Status. Kein PDF, kein Schreiben. */
export async function GET(request: NextRequest): Promise<Response> {
  if (!schnellversionOffered()) return new Response(null, { status: 404 });
  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId) return Response.json({ state: "unpaid" });
  try {
    const looked = await readSchnellversionCheckout(sessionId);
    return Response.json({ state: looked.state });
  } catch {
    return Response.json({ state: "confirming" });
  }
}
