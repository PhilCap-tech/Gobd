import { NextRequest } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { downloadStillOpen, listSvPurchases, readSvPdf } from "@/lib/schnellversion-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (!schnellversionOffered()) return new Response(null, { status: 404 });
  const email = await sessionEmailFromRequest(request);
  if (!email) return new Response("Kein Zugriff.", { status: 401 });
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  const row = (await listSvPurchases(email)).find((item) => item.id === id);
  if (!row) return new Response("Kein Zugriff.", { status: 403 });
  if (!downloadStillOpen(row, new Date())) {
    return new Response("Der Download ist gesperrt. Die Anrechnung der 49 € ist beendet.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const pdf = await readSvPdf(row);
  if (!pdf) return new Response("Der Download ist gesperrt. Die Anrechnung der 49 € ist beendet.", { status: 404 });
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "attachment; filename=\"standardfassung.pdf\"",
      "cache-control": "private, no-store",
    },
  });
}
