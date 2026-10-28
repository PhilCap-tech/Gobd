import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";
import { OFFER_OPTOUT_PAGE, recordOfferOptOut } from "@/lib/offer-optout";

export const runtime = "nodejs";

/** GET meldet nie ab (Link-Scanner): weiter zur Bestätigungsseite. */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const target = new URL(OFFER_OPTOUT_PAGE, incoming.origin);
  const token = incoming.searchParams.get("token");
  if (token) target.searchParams.set("token", token);
  return NextResponse.redirect(target, 303);
}

/** POST: Bestätigung von der Seite oder List-Unsubscribe-Post (One-Click). */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token && (request.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const body = (await request.json()) as { token?: unknown };
      token = typeof body.token === "string" ? body.token : "";
    } catch {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }
  }
  try {
    const result = await recordOfferOptOut(token);
    if (!result.ok) return NextResponse.json({ error: "Dieser Abmeldelink ist ungültig." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("[angebote] Abmeldung fehlgeschlagen", error);
    return NextResponse.json(
      { error: "Die Abmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut." },
      { status: 500 },
    );
  }
}
