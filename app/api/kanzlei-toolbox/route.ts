import { NextResponse } from "next/server";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { submitKanzleiToolbox } from "@/lib/kanzlei-toolbox-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400 });
  }
  const value = body as Record<string, unknown>;
  const client = readAmpelClientIp(request);
  const result = await submitKanzleiToolbox({
    name: value.name,
    website: value.website,
    email: value.email,
    city: value.city,
    authority: value.authority,
    terms: value.terms,
    report: value.report,
    honeypot: value.fax_number,
    ip: client.ip,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
