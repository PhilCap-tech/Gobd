import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getAppUrl, getMagicLinkSecret } from "@/lib/env";
import {
  loadMailLinkToken,
  newOpaqueMailLinkToken,
  saveMailLinkToken,
} from "@/lib/mail-link-token-store";
import { isSessionRevoked } from "@/lib/session-revocation";

export const SESSION_COOKIE = "gobd_session";
export const MAGIC_TTL_MS = 20 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type TokenPayload = {
  typ: "magic" | "session" | "checkout" | "invite";
  email: string;
  exp: number;
  /** Ausgestellt am, Unix-Millisekunden. Pflicht für Session-Cookies. */
  iat?: number;
  /** Stripe-Checkout-Session, nur bei typ "checkout". */
  sid?: string;
  /** Mitgliedschaft, nur bei typ "invite". */
  membershipId?: string;
  /** Einmaliger Zufallswert, nur bei typ "invite". Gespeichert wird nur der Hash. */
  jti?: string;
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

function verify(
  token: string | undefined | null,
  options?: { allowExpired?: boolean; now?: number },
): TokenPayload | null {
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
    if (!payload.email || !payload.exp) return null;
    const now = options?.now ?? Date.now();
    if (!options?.allowExpired && payload.exp < now) return null;
    if (payload.typ === "invite") {
      if (!payload.membershipId?.trim() || !payload.jti?.trim()) return null;
      return payload;
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

/**
 * Bereits versendeter Anmeldelink. Neue Mails nutzen `createMagicToken`.
 * Die Adresse steht noch im signierten Körper. Nur die Prüfung bleibt.
 */
export function legacyMagicToken(email: string, now = Date.now()): string {
  return sign({
    typ: "magic",
    email: email.trim().toLowerCase(),
    exp: now + MAGIC_TTL_MS,
  });
}

/**
 * Neue Anmeldelinks sind eine zufällige ID. Die Adresse liegt nur unter
 * dem SHA-256 im privaten Speicher. Gültigkeit bleibt `MAGIC_TTL_MS`
 * (20 Minuten). Bis dahin bleibt der Link mehrfach verwendbar.
 */
export async function createMagicToken(email: string, now = Date.now()): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const token = newOpaqueMailLinkToken();
  const saved = await saveMailLinkToken(token, {
    purpose: "magic",
    email: normalized,
    exp: now + MAGIC_TTL_MS,
  });
  return saved ? token : null;
}

export type InviteTokenClaims = {
  membershipId: string;
  email: string;
  jti: string;
  exp: number;
};

/**
 * Bereits versendete Einladung. Neue Mails nutzen `createInviteToken`.
 * `GET /auth/verify` nimmt nur `typ: "magic"` an und setzt dafür kein Cookie.
 */
export function legacyInviteToken(input: {
  membershipId: string;
  email: string;
  jti: string;
}, now = Date.now()): string {
  return sign({
    typ: "invite",
    email: input.email.trim().toLowerCase(),
    membershipId: input.membershipId.trim(),
    jti: input.jti.trim(),
    exp: now + MAGIC_TTL_MS,
  });
}

/**
 * Neue Einladung: zufällige ID. Adresse, Mitgliedschaft und Ablauf liegen
 * nur im privaten Speicher. Gültigkeit bleibt `MAGIC_TTL_MS` (20 Minuten).
 * Die Annahme verbraucht den Link weiterhin genau einmal.
 */
export async function createInviteToken(
  input: { membershipId: string; email: string },
  now = Date.now(),
): Promise<string | null> {
  const email = input.email.trim().toLowerCase();
  const membershipId = input.membershipId.trim();
  if (!email || !membershipId) return null;
  const token = newOpaqueMailLinkToken();
  const saved = await saveMailLinkToken(token, {
    purpose: "invite",
    email,
    membershipId,
    exp: now + MAGIC_TTL_MS,
  });
  return saved ? token : null;
}

function inviteClaimsFromLegacy(token: string, now: number): InviteTokenClaims | null {
  const payload = verify(token, { now });
  if (!payload || payload.typ !== "invite") return null;
  const membershipId = payload.membershipId?.trim() ?? "";
  const jti = payload.jti?.trim() ?? "";
  const email = payload.email.trim().toLowerCase();
  if (!membershipId || !jti || !email) return null;
  return { membershipId, email, jti, exp: payload.exp };
}

function inviteClaimsFromRecord(
  token: string,
  record: Record<string, unknown>,
  now: number,
): InviteTokenClaims | null {
  if (record.purpose !== "invite") return null;
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const membershipId = typeof record.membershipId === "string" ? record.membershipId.trim() : "";
  const exp = record.exp;
  if (!email || !membershipId || typeof exp !== "number" || !Number.isFinite(exp) || exp < now) {
    return null;
  }
  return { membershipId, email, jti: token, exp };
}

export async function verifyInviteToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<InviteTokenClaims | null> {
  if (!token) return null;
  if (token.includes(".")) return inviteClaimsFromLegacy(token, now);
  const record = await loadMailLinkToken(token);
  if (!record) return null;
  return inviteClaimsFromRecord(token, record, now);
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

function magicEmailFromRecord(
  record: Record<string, unknown> | null,
  now: number,
  mode: "valid" | "expired",
): string | null {
  if (!record || record.purpose !== "magic") return null;
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const exp = record.exp;
  if (!email || typeof exp !== "number" || !Number.isFinite(exp)) return null;
  if (mode === "valid" && exp < now) return null;
  if (mode === "expired" && exp >= now) return null;
  return email;
}

export async function verifyMagicToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<string | null> {
  if (!token) return null;
  if (token.includes(".")) {
    const payload = verify(token, { now });
    if (!payload || payload.typ !== "magic") return null;
    return payload.email;
  }
  return magicEmailFromRecord(await loadMailLinkToken(token), now, "valid");
}

/**
 * Signatur gültig, aber abgelaufen. Kein Login.
 * Ein noch gültiger Token liefert null, damit er nicht auf der Ablaufseite landet.
 * Neue IDs lesen die Adresse aus dem Speicher, bereits versendete Links aus der Signatur.
 */
export async function readExpiredMagicToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<string | null> {
  if (!token) return null;
  if (token.includes(".")) {
    const payload = verify(token, { allowExpired: true, now });
    if (!payload || payload.typ !== "magic") return null;
    if (payload.exp >= now) return null;
    return payload.email.trim().toLowerCase();
  }
  return magicEmailFromRecord(await loadMailLinkToken(token), now, "expired");
}

function sessionClaims(
  token: string | undefined | null,
): { email: string; iat: number } | null {
  const payload = verify(token);
  if (!payload || payload.typ !== "session") return null;
  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) {
    return null;
  }
  if (payload.iat < sessionMinIssuedAt()) return null;
  return { email: payload.email, iat: payload.iat };
}

export function verifySessionToken(
  token: string | undefined | null,
): string | null {
  return sessionClaims(token)?.email ?? null;
}

async function liveSessionEmail(
  token: string | undefined | null,
): Promise<string | null> {
  const claims = sessionClaims(token);
  if (!claims) return null;
  if (await isSessionRevoked(claims.email, claims.iat)) return null;
  return claims.email;
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
 * Customer onboarding lands on the Betriebs-Check. The path stays exact.
 * `/intake` may keep a whitelist of ids (Dokument, Checkout-Session). Hash,
 * other query keys and any other origin are dropped, so this is not an open redirect.
 */
export const CUSTOMER_ONBOARDING_NEXT_PATH = "/intake";

const INTAKE_NEXT_KEYS = new Set([
  "session_id",
  "document_id",
  "entity_id",
  "bereich",
  "basis",
  "modus",
  "schritt",
  "modul",
]);

const ALLOWED_NEXT_PATHS = new Set([
  "/portal",
  "/billing",
  "/account",
  "/account/billing",
  "/account/kuendigung",
  "/account/firma/neu",
  // Neues Preismodell: Login vor dem Fragebogen kehrt zum Fragebogen zurück (Entwurf bleibt).
  "/fragebogen",
  CUSTOMER_ONBOARDING_NEXT_PATH,
]);
const ACCOUNT_DOCUMENT_EDIT =
  /^\/account\/dokument\/[A-Za-z0-9_-]{8,80}$/;
const ACCOUNT_FIRMA_EDIT =
  /^\/account\/firma\/[A-Za-z0-9_-]{8,80}$/;

const ACCOUNT_MITWIRKUNG =
  /^\/account\/mitwirkung\/[A-Za-z0-9_-]{8,80}(?:\/modul\/m(?:0[1-9]|1\d|2[0-4]))?$/;

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
    if (parsed.pathname === CUSTOMER_ONBOARDING_NEXT_PATH) {
      return intakeNextPath(parsed.searchParams);
    }
    if (ALLOWED_NEXT_PATHS.has(parsed.pathname)) return parsed.pathname;
    if (ACCOUNT_DOCUMENT_EDIT.test(parsed.pathname)) return parsed.pathname;
    if (ACCOUNT_FIRMA_EDIT.test(parsed.pathname)) return parsed.pathname;
    if (ACCOUNT_MITWIRKUNG.test(parsed.pathname)) return parsed.pathname;
    return null;
  } catch {
    return null;
  }
}

function intakeNextPath(params: URLSearchParams): string {
  const kept = new URLSearchParams();
  for (const key of INTAKE_NEXT_KEYS) {
    const value = params.get(key)?.trim() ?? "";
    if (!value || value.length > 200) continue;
    if (!/^[A-Za-z0-9_-]+$/.test(value)) continue;
    kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `${CUSTOMER_ONBOARDING_NEXT_PATH}?${query}` : CUSTOMER_ONBOARDING_NEXT_PATH;
}

function cookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * Login-Mail aus dem Request-Cookie. Dieselbe Prüfung wie `getSessionEmail`,
 * einschließlich serverseitigem Widerruf nach Abmelden.
 */
export async function sessionEmailFromRequest(request: Request): Promise<string | null> {
  return liveSessionEmail(cookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE));
}

/** Signatur der Sitzung, ohne Widerruf. Nur zum Abmelden der vorgelegten Mailbox. */
export function presentedSessionEmail(request: Request): string | null {
  return verifySessionToken(cookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE));
}

/** Checkout-Nachweis aus dem Request. Kein Login. */
export function checkoutGrantFromRequest(request: Request): CheckoutGrant | null {
  return verifyCheckoutGrantToken(
    cookieFromHeader(request.headers.get("cookie"), CHECKOUT_GRANT_COOKIE),
  );
}

export function loginPath(next?: string | null): string {
  const safe = safeNextPath(next);
  return safe
    ? `/login?next=${encodeURIComponent(safe)}`
    : "/login";
}

export async function magicLinkUrl(
  email: string,
  next?: string | null,
  now = Date.now(),
): Promise<string | null> {
  const token = await createMagicToken(email, now);
  if (!token) return null;
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

const AUTH_COOKIE_NAMES = [SESSION_COOKIE, CHECKOUT_GRANT_COOKIE] as const;

/**
 * Set-Cookie lines that delete gobd_session and gobd_checkout.
 * The setters use a host-only cookie (no Domain) and Path=/.
 * The jar keys on name + domain + path, so a Domain or another Path
 * does not remove that cookie and must not be added here.
 * Secure and non-Secure are both sent: production sets Secure, and a
 * non-Secure deletion does not remove a Secure cookie.
 * Two names × two Secure flags. Nothing else — a large Set-Cookie
 * block makes the logout response fail before the browser applies it.
 */
export function authCookieDeletionLines(_hostname?: string): string[] {
  const lines: string[] = [];
  for (const name of AUTH_COOKIE_NAMES) {
    for (const secure of [false, true]) {
      const parts = [
        `${name}=`,
        "Path=/",
        "Max-Age=0",
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        "HttpOnly",
        "SameSite=Lax",
      ];
      if (secure) parts.push("Secure");
      lines.push(parts.join("; "));
    }
  }
  return lines;
}

export function clearAuthCookies(response: NextResponse, requestUrl?: string): void {
  for (const line of authCookieDeletionLines(requestUrl)) {
    response.headers.append("Set-Cookie", line);
  }
}

/** Logout and checkout handoff. Clears gobd_session and gobd_checkout. */
export function clearSessionCookie(response: NextResponse, requestUrl?: string): void {
  clearAuthCookies(response, requestUrl);
}

function authReadFailed(error: unknown): null {
  console.error(
    "[auth] Cookie nicht lesbar",
    error instanceof Error ? error.name : "error",
  );
  return null;
}

export async function getSessionEmail(): Promise<string | null> {
  try {
    const store = await cookies();
    return liveSessionEmail(store.get(SESSION_COOKIE)?.value);
  } catch (error) {
    return authReadFailed(error);
  }
}

/** Checkout-Nachweis. Das ist kein Login und öffnet nicht das Konto. */
export async function getCheckoutGrant(): Promise<CheckoutGrant | null> {
  try {
    const store = await cookies();
    return verifyCheckoutGrantToken(store.get(CHECKOUT_GRANT_COOKIE)?.value);
  } catch (error) {
    authReadFailed(error);
    return null;
  }
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
