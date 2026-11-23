import { NextResponse } from "next/server";
import { buildVerifyInterstitial, VERIFY_INTERSTITIAL_HEADERS } from "@/lib/auth-verify-page";
import { authCallIsScanner, classifyAuthUserAgent, type AuthUaClass } from "@/lib/auth-ua-class";
import {
  applySessionCookie,
  loginPath,
  mayIssueSessionCookie,
  readExpiredMagicToken,
  safeNextPath,
  verifyMagicToken,
} from "@/lib/auth";
import { lookupMailDedupe } from "@/lib/mail-dedupe";
import { readMailLinkResendId } from "@/lib/mail-link-token-store";
import { recordAuthDailyCount, recordNewAccount, scheduleMeasureWrite } from "@/lib/measure-record";
import { ownerNoticeEmailHash, ownerNoticeMailKey, queueOwnerNotice } from "@/lib/owner-notice";

export const runtime = "nodejs";

type VerifyResult = "ok_first" | "ok_repeat" | "expired" | "invalid" | "scanner_skip";
type VerifyMethod = "GET" | "HEAD" | "POST";

function pathOnly(value: string): string {
  try {
    return new URL(value, "http://safe.invalid").pathname || "/login";
  } catch {
    return "/login";
  }
}

function region(): string | null {
  return process.env.VERCEL_REGION?.trim() || null;
}

function logVerify(fields: {
  result: VerifyResult;
  method: VerifyMethod;
  uaClass: AuthUaClass;
  target: string;
  region: string | null;
}): void {
  console.info("[auth] verify " + JSON.stringify(fields));
}

function requestHosts(request: Request): Set<string> {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(request.url).host.toLowerCase());
  } catch {
    // The request URL is still used as the redirect base below.
  }
  const host = request.headers.get("host")?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (host) hosts.add(host);
  return hosts;
}

/**
 * Matching Origin is accepted. A missing Origin keeps the Referer rule.
 * The literal `Origin: null` (opaque origin after a strict referrer policy)
 * is accepted only together with `Sec-Fetch-Site: same-origin`.
 */
export function verifyPostIsSameOrigin(request: Request): boolean {
  const hosts = requestHosts(request);
  const originHeader = request.headers.get("origin");
  if (originHeader !== null) {
    const origin = originHeader.trim();
    if (origin.toLowerCase() === "null") {
      return request.headers.get("sec-fetch-site")?.trim().toLowerCase() === "same-origin";
    }
    try {
      return hosts.has(new URL(origin).host.toLowerCase());
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer")?.trim() ?? "";
  if (!referer) return true;
  try {
    return hosts.has(new URL(referer).host.toLowerCase());
  } catch {
    return false;
  }
}

async function postedFields(request: Request): Promise<{ token: string; next: string | null }> {
  try {
    const form = await request.formData();
    const token = form.get("token");
    const next = form.get("next");
    return {
      token: typeof token === "string" ? token : "",
      next: typeof next === "string" ? next : null,
    };
  } catch {
    return { token: "", next: null };
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  return handleAuthVerify(request, "GET");
}

export async function HEAD(request: Request): Promise<NextResponse> {
  return handleAuthVerify(request, "HEAD");
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleAuthVerify(request, "POST");
}

async function handleAuthVerify(request: Request, method: VerifyMethod): Promise<NextResponse> {
  const url = new URL(request.url);
  const posted = method === "POST" ? await postedFields(request) : null;
  const token = posted ? posted.token : (url.searchParams.get("token") ?? "");
  const next = safeNextPath(posted ? posted.next : url.searchParams.get("next"));
  const uaClass = classifyAuthUserAgent(request.headers.get("user-agent"));
  const referrerHeader = request.headers.get("referer");
  const gobdTest = url.searchParams.get("gobd_test");
  let result: VerifyResult = "invalid";
  let target = "/login";
  let response = NextResponse.redirect(new URL("/login", request.url));
  try {
    if (method === "POST" && !verifyPostIsSameOrigin(request)) {
      result = "invalid";
      target = "/login";
      response = NextResponse.redirect(new URL("/login", request.url));
      return response;
    }
    if (method !== "POST" && authCallIsScanner({ method, uaClass })) {
      result = "scanner_skip";
      scheduleMeasureWrite(() =>
        recordAuthDailyCount({
          metric: "verify_scanner",
          referrerHeader,
          gobdTest,
        }),
      );
      if (method === "HEAD") {
        target = "/login";
        response = NextResponse.redirect(new URL("/login", request.url));
        return response;
      }
      target = "/auth/verify";
      response = new NextResponse(buildVerifyInterstitial({ token, next }), {
        status: 200,
        headers: VERIFY_INTERSTITIAL_HEADERS,
      });
      return response;
    }
    scheduleMeasureWrite(() =>
      recordAuthDailyCount({
        metric: "verify_human",
        referrerHeader,
        gobdTest,
      }),
    );
    const email = await verifyMagicToken(token);
    if (email && mayIssueSessionCookie({ channel: "magic", targetEmail: email })) {
      const login = await recordNewAccount({
        email,
        referrerHeader,
        gobdTest: url.searchParams.get("gobd_test"),
      });
      target = pathOnly(next ?? "/account");
      const redirect = NextResponse.redirect(new URL(next ?? "/account", request.url));
      applySessionCookie(redirect, email);
      response = redirect;
      const noticeKey = ownerNoticeMailKey("account", ownerNoticeEmailHash(email));
      const noticeAlready = login === "repeat" || (await lookupMailDedupe(noticeKey)) !== "free";
      if (noticeAlready) {
        result = "ok_repeat";
      } else {
        result = "ok_first";
        const resendId = await readMailLinkResendId(token);
        queueOwnerNotice({
          kind: "account",
          id: ownerNoticeEmailHash(email),
          title: "Neues Konto / erste Anmeldung",
          email,
          ...(resendId ? { facts: [["Versandkennung", resendId] as [string, string]] } : {}),
        });
      }
      return response;
    }
    const expiredEmail = await readExpiredMagicToken(token);
    if (expiredEmail) {
      result = "expired";
      target = "/auth/abgelaufen";
      const expired = new URL("/auth/abgelaufen", request.url);
      expired.searchParams.set("token", token);
      if (next) expired.searchParams.set("next", next);
      response = NextResponse.redirect(expired);
      return response;
    }
    result = "invalid";
    target = "/login";
    const loginUrl = new URL(loginPath(next), request.url);
    loginUrl.searchParams.set("error", "invalid");
    response = NextResponse.redirect(loginUrl);
    return response;
  } finally {
    logVerify({ result, method, uaClass, target, region: region() });
  }
}
