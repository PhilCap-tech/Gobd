import { ampelStepDate, ampelStepDevice, parseAmpelStepBody, AMPEL_STEP_BODY_MAX_BYTES } from "@/lib/ampel-step-event";
import { takeAmpelStepRate } from "@/lib/ampel-step-rate";
import { readAmpelClientIp } from "@/lib/ampel-rate-limit";
import { recordAmpelStep } from "@/lib/ampel-step-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function empty(status: number): Response {
  return new Response(null, { status });
}

async function readBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared) {
    const size = Number(declared);
    if (!Number.isInteger(size) || size < 0 || size > AMPEL_STEP_BODY_MAX_BYTES) return null;
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > AMPEL_STEP_BODY_MAX_BYTES) {
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

export function setAmpelStepNowForTest(next: (() => Date) | null): void {
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
  const fields = parseAmpelStepBody(parsed);
  if (!fields) return empty(400);

  const client = readAmpelClientIp(request);
  if (!takeAmpelStepRate(client.ip)) return empty(429);

  const device = ampelStepDevice(request.headers.get("user-agent") ?? "");
  const date = ampelStepDate(nowForTest ? nowForTest() : new Date());
  await recordAmpelStep({ ...fields, date, device });
  return empty(204);
}
