import { NextRequest } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { confirmPaidSession } from "@/lib/schnellversion-payment";
import { downloadStillOpen, svDownloadAllowed } from "@/lib/schnellversion-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Danke-Seite fragt nach, solange der Kauf noch geschrieben wird. */
export async function GET(request: NextRequest): Promise<Response> {
  if (!schnellversionOffered()) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId) return Response.json({ state: "unpaid" });
  let confirmed: Awaited<ReturnType<typeof confirmPaidSession>>;
  try {
    confirmed = await confirmPaidSession(sessionId);
  } catch {
    return Response.json({ state: "confirming" });
  }
  if (!confirmed.paid) {
    return Response.json({ state: confirmed.confirming ? "confirming" : "unpaid" });
  }
  if (!downloadStillOpen(confirmed.purchase, new Date())) return Response.json({ state: "ended" });
  const email = (await sessionEmailFromRequest(request)) ?? "";
  const token = url.searchParams.get("dl")?.trim() ?? "";
  if (!svDownloadAllowed(confirmed.purchase, { email, token, now: new Date() })) {
    return Response.json({ state: "fremd" });
  }
  return Response.json({ state: "paid" });
}
