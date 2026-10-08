import { NextResponse } from "next/server";
import {
  applySessionCookie,
  loginPath,
  mayIssueSessionCookie,
  safeNextPath,
  verifyMagicToken,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const next = safeNextPath(url.searchParams.get("next"));
  const email = verifyMagicToken(token);

  if (!email || !mayIssueSessionCookie({ channel: "magic", targetEmail: email })) {
    const login = new URL(loginPath(next), request.url);
    login.searchParams.set("error", "invalid");
    return NextResponse.redirect(login);
  }

  const response = NextResponse.redirect(
    new URL(next ?? "/account", request.url),
  );
  applySessionCookie(response, email);
  return response;
}
