import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getAppUrl, getMagicLinkSecret } from "@/lib/env";

export const SESSION_COOKIE = "gobd_session";
export const MAGIC_TTL_MS = 20 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type TokenPayload = {
  typ: "magic" | "session";
  email: string;
  exp: number;
};

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function sign(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getMagicLinkSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string | undefined | null): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getMagicLinkSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as TokenPayload;
    if (!payload.email || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    if (payload.typ !== "magic" && payload.typ !== "session") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createMagicToken(email: string): string {
  return sign({
    typ: "magic",
    email: email.trim().toLowerCase(),
    exp: Date.now() + MAGIC_TTL_MS,
  });
}

export function createSessionToken(email: string): string {
  return sign({
    typ: "session",
    email: email.trim().toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS,
  });
}

export function verifyMagicToken(token: string | undefined | null): string | null {
  const payload = verify(token);
  if (!payload || payload.typ !== "magic") return null;
  return payload.email;
}

export function verifySessionToken(
  token: string | undefined | null,
): string | null {
  const payload = verify(token);
  if (!payload || payload.typ !== "session") return null;
  return payload.email;
}

export function magicLinkUrl(email: string): string {
  const token = createMagicToken(email);
  return `${getAppUrl()}/auth/verify?token=${encodeURIComponent(token)}`;
}

export function applySessionCookie(response: NextResponse, email: string): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionToken(email),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
