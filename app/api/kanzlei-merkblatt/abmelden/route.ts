import { NextResponse } from "next/server";
import { KANZLEI_UNSUBSCRIBE_INVALID } from "@/lib/kanzlei-copy";
import { withdrawKanzleiMarketing } from "@/lib/kanzlei-unsubscribe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const token =
    body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : "";
  const result = await withdrawKanzleiMarketing(token);
  if (!result.ok) return NextResponse.json({ error: KANZLEI_UNSUBSCRIBE_INVALID }, { status: 400 });
  return NextResponse.json({ ok: true });
}
