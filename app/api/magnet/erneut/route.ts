import { NextResponse } from "next/server";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { MAGNET_INPUT_INVALID } from "@/lib/vorlagen/copy";
import { renewMagnet } from "@/lib/vorlagen/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: MAGNET_INPUT_INVALID }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const token = typeof record.token === "string" ? record.token : "";
  if (!token) return NextResponse.json({ error: MAGNET_INPUT_INVALID }, { status: 400 });
  const result = await renewMagnet(token, {
    ip: readAmpelClientIp(request).ip,
    fax_number: record.fax_number,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
