import { NextResponse } from "next/server";
import {
  applySessionCookie,
  loginPath,
  mayIssueSessionCookie,
  readExpiredMagicToken,
  safeNextPath,
  verifyMagicToken,
} from "@/lib/auth";
import { isOnboardingIntakeNext } from "@/lib/expired-onboarding-link";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const next = safeNextPath(url.searchParams.get("next"));
  const email = verifyMagicToken(token);

  if (email && mayIssueSessionCookie({ channel: "magic", targetEmail: email })) {
    const response = NextResponse.redirect(new URL(next ?? "/account", request.url));
    applySessionCookie(response, email);
    return response;
  }

  // Abgelaufener Link der Onboarding-Mail: kein Cookie, Seite zum neuen Link.
  const expiredEmail = readExpiredMagicToken(token);
  if (expiredEmail && next && isOnboardingIntakeNext(next)) {
    const expired = new URL("/auth/abgelaufen", request.url);
    expired.searchParams.set("token", token);
    expired.searchParams.set("next", next);
    return NextResponse.redirect(expired);
  }

  const login = new URL(loginPath(next), request.url);
  login.searchParams.set("error", "invalid");
  return NextResponse.redirect(login);
}
