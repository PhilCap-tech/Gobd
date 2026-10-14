import { NextResponse } from "next/server";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { AMPEL_RESULT_MAIL } from "@/lib/ampel-questions";
import { ampelSendTokenPresent } from "@/lib/ampel-send-token";
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
  if (!ampelSendTokenPresent(value.send_token)) {
    return NextResponse.json({ error: AMPEL_RESULT_MAIL.sendUnauthorized }, { status: 403 });
  }
  const client = readAmpelClientIp(request.headers);
  const result = await completeAmpelResult({
    email: value.email,
    answers: value.answers,
    ref: value.ref,
    marketing: value.marketing,
    honeypot: value.fax_number,
    ip: client.ip,
    ipSource: client.source,
    sendToken: value.send_token,
  });
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
    ...(result.notice ? { notice: result.notice } : {}),
  });
}
