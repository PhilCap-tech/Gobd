import { NextResponse } from "next/server";
import { ampelClientIp } from "@/lib/ampel-rate-limit";
import { completeAmpelResult } from "@/lib/ampel-result-send";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
  const result = await completeAmpelResult({
    email: value.email,
    answers: value.answers,
    ref: value.ref,
    marketing: value.marketing,
    honeypot: value.fax_number,
    ip: ampelClientIp(request.headers),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if ("honeypot" in result) {
    return NextResponse.json({ ok: true, honeypot: true });
  }
  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    marketing: result.marketing,
    mailed: result.mailed,
    ...(result.notice ? { notice: result.notice } : {}),
  });
}
