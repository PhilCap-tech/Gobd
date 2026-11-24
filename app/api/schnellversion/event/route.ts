import { NextRequest } from "next/server";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { takeAmpelStepRate } from "@/lib/ampel-step-rate";
import { parseSvArm, SV_ARM_COOKIE } from "@/lib/schnellversion-assign";
import { clientEventAllowed, parseSvEvent } from "@/lib/schnellversion-events";
import { schnellversionOffered } from "@/lib/schnellversion-flag";
import { rememberSvEvent } from "@/lib/schnellversion-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2048;

export async function POST(request: NextRequest): Promise<Response> {
  if (!schnellversionOffered()) return new Response(null, { status: 404 });
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > MAX_BYTES) return new Response(null, { status: 400 });
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return new Response(null, { status: 400 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = parseSvEvent(parsed);
  if (!event) return new Response(null, { status: 400 });
  if (!clientEventAllowed(event.name)) return new Response(null, { status: 400 });
  if (event.name === "sv_visit") {
    const client = readAmpelClientIp(request);
    if (!takeAmpelStepRate(client.ip)) return new Response(null, { status: 429 });
    rememberSvEvent(event);
    return new Response(null, { status: 204 });
  }
  const arm = parseSvArm(request.cookies.get(SV_ARM_COOKIE)?.value);
  if (!arm || event.arm !== arm) return new Response(null, { status: 400 });
  const client = readAmpelClientIp(request);
  if (!takeAmpelStepRate(client.ip)) return new Response(null, { status: 429 });
  rememberSvEvent(event);
  return new Response(null, { status: 204 });
}
