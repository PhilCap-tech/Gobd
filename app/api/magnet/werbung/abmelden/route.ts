import { NextResponse } from "next/server";
import { withdrawMagnetMarketing } from "@/lib/vorlagen/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID_LINK = "Dieser Abmeldelink ist ungültig.";

function tokenFromJson(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const token = (body as { token?: unknown }).token;
  return typeof token === "string" ? token : "";
}

/** A GET never withdraws, including link scanners. */
export async function GET(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL("/vorlagen/werbung/abmelden", incoming.origin);
  const token = incoming.searchParams.get("token");
  if (token) target.searchParams.set("token", token);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";
  const type = request.headers.get("content-type") ?? "";
  if (!token && type.includes("application/json")) {
    try {
      token = tokenFromJson(await request.json());
    } catch {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }
  }
  try {
    const result = await withdrawMagnetMarketing(token, url.searchParams.has("token") ? "one-click" : "link");
    if (!result.ok) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[magnet] Abmeldung fehlgeschlagen", error instanceof Error ? error.name : "error");
    return NextResponse.json(
      { error: "Die Abmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut." },
      { status: 500 },
    );
  }
}
