import { readKanzleiReport } from "@/lib/kanzlei-toolbox-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_MAX_BYTES = 2048;

function json(body: { ok: boolean; optedOut?: boolean; months?: unknown }, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function readLimited(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared) {
    const size = Number(declared);
    if (!Number.isInteger(size) || size < 0 || size > BODY_MAX_BYTES) return null;
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > BODY_MAX_BYTES) {
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

export async function POST(request: Request): Promise<Response> {
  const raw = await readLimited(request);
  if (raw == null) return json({ ok: false }, 400);
  let token = "";
  try {
    const parsed = JSON.parse(raw) as { token?: unknown };
    if (!parsed || typeof parsed !== "object" || typeof parsed.token !== "string") return json({ ok: false }, 400);
    token = parsed.token;
  } catch {
    return json({ ok: false }, 400);
  }
  try {
    const report = await readKanzleiReport(token);
    if (!report) return json({ ok: false }, 404);
    if (report.optedOut) return json({ ok: true, optedOut: true }, 200);
    return json({ ok: true, months: report.months }, 200);
  } catch {
    return json({ ok: false }, 500);
  }
}
