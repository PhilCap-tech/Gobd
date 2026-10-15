import { NextResponse } from "next/server";
import { confirmKanzleiDoi } from "@/lib/kanzlei-confirm";
import { KANZLEI_CONFIRM_INVALID } from "@/lib/kanzlei-copy";

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
  if (!token) return NextResponse.json({ error: KANZLEI_CONFIRM_INVALID }, { status: 400 });
  try {
    const result = await confirmKanzleiDoi(token);
    if (!result.ok) return NextResponse.json({ error: KANZLEI_CONFIRM_INVALID }, { status: result.status });
    return NextResponse.json({ ok: true, withdrawn: result.withdrawn === true });
  } catch (error) {
    console.error("[kanzlei] Bestätigung fehlgeschlagen", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: KANZLEI_CONFIRM_INVALID }, { status: 500 });
  }
}
