import { NextResponse } from "next/server";
import {
  applySessionCookie,
  loginPath,
  mayIssueSessionCookie,
  readExpiredMagicToken,
  safeNextPath,
  verifyMagicToken,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const next = safeNextPath(url.searchParams.get("next"));
  const email = await verifyMagicToken(token);

  if (email && mayIssueSessionCookie({ channel: "magic", targetEmail: email })) {
    const response = NextResponse.redirect(new URL(next ?? "/account", request.url));
    applySessionCookie(response, email);
    return response;
  }

  // Korrekt signiert, aber abgelaufen: kein Cookie, Seite zum neuen Link.
  // Gilt für Login, Onboarding und erneutes Bearbeiten. Nur eine
  // ungültige Signatur fällt auf /login?error=invalid zurück.
  const expiredEmail = await readExpiredMagicToken(token);
  if (expiredEmail) {
    const expired = new URL("/auth/abgelaufen", request.url);
    expired.searchParams.set("token", token);
    if (next) expired.searchParams.set("next", next);
    return NextResponse.redirect(expired);
  }

  const login = new URL(loginPath(next), request.url);
  login.searchParams.set("error", "invalid");
  return NextResponse.redirect(login);
}
