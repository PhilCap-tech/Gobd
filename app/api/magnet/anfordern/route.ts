import { NextResponse } from "next/server";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { MAGNET_INPUT_INVALID } from "@/lib/vorlagen/copy";
import { requestMagnet } from "@/lib/vorlagen/flow";

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
  const result = await requestMagnet({
    email: record.email,
    magnet: record.magnet,
    marketing: record.marketing,
    fax_number: record.fax_number,
    calc: record.calc,
    ip: readAmpelClientIp(request).ip,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
