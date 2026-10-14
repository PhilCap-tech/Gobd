import { NextResponse } from "next/server";
import { withdrawAmpelMarketing } from "@/lib/ampel-unsubscribe";

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
  const result = await withdrawAmpelMarketing(token);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Dieser Abmeldelink ist ungültig." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
