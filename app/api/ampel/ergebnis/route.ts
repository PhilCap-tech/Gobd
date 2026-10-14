import { NextResponse } from "next/server";
import { ampelClientIp } from "@/lib/ampel-rate-limit";
import { submitAmpelResult } from "@/lib/ampel-result-send";

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
  const result = await submitAmpelResult(
    {
      email: value.email,
      answers: value.answers,
      ref: value.ref,
      marketing: value.marketing,
      honeypot: value.fax_number,
      ip: ampelClientIp(request.headers),
    },
    { handoff: true },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if ("honeypot" in result) {
    return NextResponse.json({ ok: true, honeypot: true });
  }
  if (result.limited) {
    return NextResponse.json(
      { ok: true, mailed: false, duplicate: false, notice: result.notice, scope: result.limited },
      { status: 429 },
    );
  }
  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    marketing: result.marketing,
    mailed: result.mailed,
    pending: result.pending === true,
    ...(result.notice ? { notice: result.notice } : {}),
  });
}
