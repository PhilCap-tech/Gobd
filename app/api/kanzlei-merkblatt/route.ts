import { NextResponse } from "next/server";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { submitKanzleiMerkblatt } from "@/lib/kanzlei-submit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const client = readAmpelClientIp(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const value = body as Record<string, unknown>;
  try {
    const result = await submitKanzleiMerkblatt({
      email: value.email,
      optin: value.optin,
      honeypot: value.fax_number,
      ip: client.ip,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      ok: true,
      downloadUrl: result.downloadUrl,
      mailed: result.mailed,
    });
  } catch (error) {
    console.error("[kanzlei] Anfrage fehlgeschlagen", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 500 });
  }
}
