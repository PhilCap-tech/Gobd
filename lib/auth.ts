import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getAppUrl, getMagicLinkSecret } from "@/lib/env";

export const SESSION_COOKIE = "gobd_session";
export const MAGIC_TTL_MS = 20 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type TokenPayload = {
  typ: "magic" | "session" | "checkout";
  email: string;
  exp: number;
  /** Ausgestellt am, Unix-Millisekunden. Pflicht für Session-Cookies. */
  iat?: number;
  /** Stripe-Checkout-Session, nur bei typ "checkout". */
  sid?: string;
};

export const CHECKOUT_GRANT_COOKIE = "gobd_checkout";
/** Kurzlebig gegenüber der 30-Tage-Session: reicht für den Betriebs-Check. */
export const CHECKOUT_GRANT_TTL_MS = 6 * 60 * 60 * 1000;
export const CHECKOUT_GRANT_MAX_AGE_SECONDS = 6 * 60 * 60;

export type SessionIssueChannel = "magic" | "readiness" | "intake";

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
    if (
      payload.typ !== "magic" &&
      payload.typ !== "session" &&
      payload.typ !== "checkout"
    ) {
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

/**
 * Untergrenze für `iat`. Leer oder ungültig heißt: jedes Cookie mit `iat`
 * ist zeitlich zulässig. Cookies ohne `iat` lehnt `verifySessionToken` immer
 * ab — dafür ist kein Env-Wert nötig.
 * Wert: Unix-Millisekunden oder ISO-8601.
 */
export function sessionMinIssuedAt(): number {
  const raw = process.env.SESSION_MIN_ISSUED_AT?.trim() ?? "";
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) {
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createSessionToken(email: string): string {
  const issuedAt = Date.now();
  return sign({
    typ: "session",
    email: email.trim().toLowerCase(),
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_MS,
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
  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) {
    return null;
  }
  if (payload.iat < sessionMinIssuedAt()) return null;
  return payload.email;
}

export type CheckoutGrant = {
  sessionId: string;
  email: string;
};

export function createCheckoutGrantToken(input: {
  sessionId: string;
  email: string;
}): string {
  const issuedAt = Date.now();
  return sign({
    typ: "checkout",
    email: input.email.trim().toLowerCase(),
    sid: input.sessionId.trim(),
    iat: issuedAt,
    exp: issuedAt + CHECKOUT_GRANT_TTL_MS,
  });
}

export function verifyCheckoutGrantToken(
  token: string | undefined | null,
): CheckoutGrant | null {
  const payload = verify(token);
  if (!payload || payload.typ !== "checkout") return null;
  const sessionId = payload.sid?.trim() ?? "";
  if (!sessionId || !payload.email) return null;
  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) {
    return null;
  }
  return { sessionId, email: payload.email };
}

/**
 * Login-Cookie nur nach bestätigtem Magic-Link.
 * Readiness und Intake stellen nie eine Session aus — auch nicht für eine
 * neue Adresse, und auch nicht wenn schon Konto, Firmen oder Dokumente
 * existieren. Eine bereits gültige Session bleibt im Browser liegen und
 * wird hier nicht neu ausgestellt.
 */
export function mayIssueSessionCookie(input: {
  channel: SessionIssueChannel;
  sessionEmail?: string | null;
  targetEmail?: string | null;
  hasProfile?: boolean;
  hasCompanies?: boolean;
  hasDocuments?: boolean;
}): boolean {
  if (input.channel !== "magic") return false;
  return Boolean(input.targetEmail?.trim());
}

/**
 * Customer onboarding lands on the Betriebs-Check. Exact path only:
 * `safeNextPath` drops query and hash, so this cannot become an open redirect.
 */
export const CUSTOMER_ONBOARDING_NEXT_PATH = "/intake";

const ALLOWED_NEXT_PATHS = new Set([
  "/portal",
  "/billing",
  "/account",
  "/account/billing",
  "/account/firma/neu",
  CUSTOMER_ONBOARDING_NEXT_PATH,
]);
const ACCOUNT_DOCUMENT_EDIT =
  /^\/account\/dokument\/[A-Za-z0-9_-]{8,80}$/;
const ACCOUNT_FIRMA_EDIT =
  /^\/account\/firma\/[A-Za-z0-9_-]{8,80}$/;

/**
 * Only same-origin relative paths we actually redirect to after login.
 * Rejects protocol-relative, absolute, and unknown paths (open-redirect).
 */
export function safeNextPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value, "http://safe.invalid");
    if (parsed.origin !== "http://safe.invalid") return null;
    if (parsed.username || parsed.password) return null;
    if (ALLOWED_NEXT_PATHS.has(parsed.pathname)) return parsed.pathname;
    if (ACCOUNT_DOCUMENT_EDIT.test(parsed.pathname)) return parsed.pathname;
    if (ACCOUNT_FIRMA_EDIT.test(parsed.pathname)) return parsed.pathname;
    return null;
  } catch {
    return null;
  }
}

export function loginPath(next?: string | null): string {
  const safe = safeNextPath(next);
  return safe
    ? `/login?next=${encodeURIComponent(safe)}`
    : "/login";
}

export function magicLinkUrl(email: string, next?: string | null): string {
  const token = createMagicToken(email);
  const params = new URLSearchParams({ token });
  const safe = safeNextPath(next);
  if (safe) params.set("next", safe);
  return `${getAppUrl()}/auth/verify?${params.toString()}`;
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

export function applyCheckoutGrantCookie(
  response: NextResponse,
  input: { sessionId: string; email: string },
): void {
  const sessionId = input.sessionId.trim();
  const email = input.email.trim();
  if (!sessionId || !email) return;
  response.cookies.set({
    name: CHECKOUT_GRANT_COOKIE,
    value: createCheckoutGrantToken({ sessionId, email }),
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: CHECKOUT_GRANT_MAX_AGE_SECONDS,
  });
}

/**
 * Antwort für Readiness und Intake. Setzt nie das Login-Cookie.
 * Optional nur den kurzlebigen Checkout-Nachweis für genau eine Session.
 */
export function withoutSessionCookie(
  response: NextResponse,
  grant?: { sessionId: string; email: string },
): NextResponse {
  if (grant) applyCheckoutGrantCookie(response, grant);
  return response;
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

/** Checkout-Nachweis. Das ist kein Login und öffnet nicht das Konto. */
export async function getCheckoutGrant(): Promise<CheckoutGrant | null> {
  const store = await cookies();
  return verifyCheckoutGrantToken(store.get(CHECKOUT_GRANT_COOKIE)?.value);
}

/**
 * Query-`session_id` bleibt der Bearer aus der Mail. Fehlt sie, gilt nur
 * der Cookie, und auch der nur für dieselbe Checkout-Session.
 */
export async function sessionIdForCheckoutProof(
  querySessionId?: string | null,
): Promise<string> {
  const query = querySessionId?.trim() ?? "";
  if (query) return query;
  const grant = await getCheckoutGrant();
  return grant?.sessionId ?? "";
}
