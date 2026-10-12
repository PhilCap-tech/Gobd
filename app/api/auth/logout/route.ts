import { NextResponse } from "next/server";
import { clearSessionCookie, presentedSessionEmail } from "@/lib/auth";
import { revokeSessionsForEmail } from "@/lib/session-revocation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const email = presentedSessionEmail(request);
  if (email) {
    try {
      await revokeSessionsForEmail(email);
    } catch (error) {
      console.error(
        "[auth] Abmelden nicht gespeichert",
        error instanceof Error ? error.name : "error",
      );
      return NextResponse.json(
        { error: "Die Abmeldung ist fehlgeschlagen. Bitte versuchen Sie es noch einmal." },
        { status: 500, headers: { "Cache-Control": "private, no-store" } },
      );
    }
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  clearSessionCookie(response, request.url);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Clear-Site-Data", '"cache"');
  return response;
}
