import { NextResponse } from "next/server";
import { applySessionCookie, verifyMagicToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const email = verifyMagicToken(token);

  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  const response = NextResponse.redirect(new URL("/account", request.url));
  applySessionCookie(response, email);
  return response;
}
