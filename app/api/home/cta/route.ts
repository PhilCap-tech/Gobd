import { HOME_CTA_BODY_MAX_BYTES, homeCtaDate, homeCtaDevice, parseHomeCtaBody } from "@/lib/home-cta-event";
import { recordHomeCta } from "@/lib/home-cta-store";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { takeAmpelStepRate } from "@/lib/ampel-step-rate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function empty(status: number): Response {
  return new Response(null, { status });
}

async function readBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared) {
    const size = Number(declared);
    if (!Number.isInteger(size) || size < 0 || size > HOME_CTA_BODY_MAX_BYTES) return null;
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > HOME_CTA_BODY_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

let nowForTest: (() => Date) | null = null;

export function setHomeCtaNowForTest(next: (() => Date) | null): void {
  nowForTest = next;
}

export async function POST(request: Request): Promise<Response> {
  const raw = await readBody(request);
  if (raw == null) return empty(400);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty(400);
  }
  const fields = parseHomeCtaBody(parsed);
  if (!fields) return empty(400);

  const client = readAmpelClientIp(request);
  if (!takeAmpelStepRate(client.ip)) return empty(429);

  const device = homeCtaDevice(request.headers.get("user-agent") ?? "");
  const date = homeCtaDate(nowForTest ? nowForTest() : new Date());
  try {
    await recordHomeCta({ ...fields, date, device });
  } catch {
    // A write failure still answers 204. The store logs the error name only.
  }
  return empty(204);
}
