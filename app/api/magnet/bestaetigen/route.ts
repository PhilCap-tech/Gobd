import { NextResponse } from "next/server";
import { MAGNET_INPUT_INVALID } from "@/lib/vorlagen/copy";
import { confirmMagnet } from "@/lib/vorlagen/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: MAGNET_INPUT_INVALID }, { status: 400 });
  }
  const token = body && typeof body === "object" ? (body as { token?: unknown }).token : "";
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const result = await confirmMagnet(token);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result);
}
