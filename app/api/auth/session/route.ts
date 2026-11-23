import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ob in diesem Browser ein Sitzungs-Cookie liegt.
 * Liest nur die bestehende Sitzung. Kein Sheet, kein Blob-Schreiben.
 * Die Adresse steht nicht in der Antwort.
 */
export async function GET(request: Request): Promise<Response> {
  const email = await sessionEmailFromRequest(request);
  return NextResponse.json(
    { ok: Boolean(email) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
